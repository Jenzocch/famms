import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAuthClaims } from '@/lib/auth'
import { notifyFactory, esc } from '@/lib/telegram'

const ISSUE_TYPE_LABELS: Record<string, string> = {
  machine: '🔧 機器故障',
  pipe: '🚿 水管/管線',
  electrical: '💡 電力/照明',
  facility: '🏭 設施/基礎建設',
  safety: '⚠️ 安全問題',
  cleanliness: '🧹 衛生/清潔',
  other: '📋 其他',
}

const URGENCY_LABELS: Record<string, string> = {
  A: '🔴 緊急', B: '🟠 高', C: '🟡 中', D: '🟢 低',
}

// POST /api/incidents/notify — send Telegram alert for a new report
export async function POST(req: Request) {
  // Login required — without this, anyone on the internet could POST incident
  // ids and spam every registered Telegram group/user.
  const claims = await getAuthClaims()
  if (!claims) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { incidentId } = await req.json()
  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId required' }, { status: 400 })
  }

  const { data: incident } = await supabase
    .from('incidents')
    .select(`
      id, incident_no, incident_type, title, reporter_name, downtime_impact, factory_id,
      machine:machines(machine_code, machine_name),
      factory:factories(name)
    `)
    .eq('id', incidentId)
    .single()

  if (!incident) {
    return NextResponse.json({ error: 'incident not found' }, { status: 404 })
  }

  const machine = incident.machine as unknown as { machine_code: string | null; machine_name: string } | null
  const factory = incident.factory as unknown as { name: string } | null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Resolve the type label (covers admin-added types). The message is in zh,
  // so prefer the Chinese label; fall back to the built-in map, then the code.
  // select('*') keeps this working before the i18n columns migration is run.
  let typeLabel = ISSUE_TYPE_LABELS[incident.incident_type] || incident.incident_type
  const { data: typeRow } = await supabase
    .from('incident_types')
    .select('*')
    .eq('code', incident.incident_type)
    .maybeSingle()
  if (typeRow) typeLabel = (typeRow as any).label_zh || (typeRow as any).label || typeLabel

  // User-entered fields (title, names) must be escaped — a stray '<' would
  // otherwise make Telegram reject the whole message as bad HTML.
  const html = [
    `<b>🆕 新報修案件</b>`,
    `<b>編號:</b> ${esc(incident.incident_no)}`,
    `<b>類型:</b> ${esc(typeLabel)}`,
    `<b>緊急度:</b> ${URGENCY_LABELS[incident.downtime_impact] || esc(incident.downtime_impact)}`,
    incident.title ? `<b>標題:</b> ${esc(incident.title)}` : '',
    `<b>位置:</b> ${esc(factory?.name || '?')}${machine ? ` · ${esc(machine.machine_name)}` : ''}`,
    incident.reporter_name ? `<b>回報人:</b> ${esc(incident.reporter_name)}` : '',
    `<a href="${appUrl}/incidents/${incident.id}">查看詳情 →</a>`,
  ].filter(Boolean).join('\n')

  try {
    const result = await notifyFactory(supabase, {
      factoryId: incident.factory_id,
      type: 'new_incident',
      html,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'notify failed' })
  }
}
