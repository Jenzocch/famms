import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, PERMISSIONS } from '@/lib/auth'
import Link from 'next/link'
import { AlertTriangle, Clock, Factory, ChevronRight, CheckCircle2, Wrench } from 'lucide-react'
import { formatDistanceToNow, addDays, addWeeks, addMonths } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { IncidentStatus } from '@/types'
import { ISSUE_TYPE_LABELS, URGENCY_FROM_IMPACT, STATUS_ZH, STATUS_ZH_COLOR } from '@/lib/incident-display'

export const metadata = { title: '主管追蹤 | 維修系統' }

const OPEN_STATUSES: IncidentStatus[] = [
  'reported', 'accepted', 'analyzing', 'waiting_parts', 'waiting_approval',
  'waiting_vendor', 'waiting_shutdown', 'repairing', 'testing', 'observation',
]

interface Row {
  id: string
  incident_no: string
  status: IncidentStatus
  downtime_impact: 'A' | 'B' | 'C' | 'D'
  incident_type: string
  title: string | null
  reported_at: string
  updated_at: string
  factory: { name: string } | null
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user || !PERMISSIONS.dashboard(user.role)) {
    redirect('/incidents')
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('incidents')
    .select('id, incident_no, status, downtime_impact, incident_type, title, reported_at, updated_at, factory:factories(name)')
    .order('reported_at', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as unknown as Row[]
  const open = rows.filter(r => OPEN_STATUSES.includes(r.status))

  // Get overdue machines
  const { data: schedules } = await supabase
    .from('pm_schedules')
    .select('machine_id, pm_type, machines(machine_name, machine_code)')
    .eq('is_active', true)

  const { data: logs } = await supabase
    .from('maintenance_logs')
    .select('machine_id, performed_at')
    .order('performed_at', { ascending: false })

  const lastByMachine: Record<string, string> = {}
  if (logs) {
    for (const log of logs) {
      if (!lastByMachine[log.machine_id]) {
        lastByMachine[log.machine_id] = log.performed_at
      }
    }
  }

  function getNextDueDate(lastMaintained: string | null, pmType: string): Date {
    const base = lastMaintained ? new Date(lastMaintained) : new Date()
    switch (pmType) {
      case 'daily': return addDays(base, 1)
      case 'weekly': return addWeeks(base, 1)
      case 'monthly': return addMonths(base, 1)
      case 'quarterly': return addMonths(base, 3)
      case 'half_yearly': return addMonths(base, 6)
      case 'yearly': return addMonths(base, 12)
      default: return addMonths(base, 1)
    }
  }

  const overdue = (schedules ?? [])
    .filter(s => (s as any).machines)
    .map(s => {
      const lastMaintained = lastByMachine[s.machine_id]
      const dueDate = getNextDueDate(lastMaintained, s.pm_type)
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000)
      return {
        machine_id: s.machine_id,
        machine_name: (s as any).machines.machine_name,
        machine_code: (s as any).machines.machine_code,
        pm_type: s.pm_type,
        days_overdue: daysOverdue,
      }
    })
    .filter(m => m.days_overdue > 0)
    .sort((a, b) => b.days_overdue - a.days_overdue)
    .slice(0, 10)

  // Open count per factory
  const byFactory = new Map<string, number>()
  for (const r of open) {
    const name = r.factory?.name || '未指定'
    byFactory.set(name, (byFactory.get(name) ?? 0) + 1)
  }

  // Urgent open cases (impact A or B)
  const urgent = open.filter(r => r.downtime_impact === 'A' || r.downtime_impact === 'B')

  // Stale: open + not updated in 3+ days
  const now = Date.now()
  const stale = open.filter(r => now - new Date(r.updated_at).getTime() > 3 * 86400000)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">主管追蹤</h1>
        <p className="text-sm text-gray-500 mt-1">案件總覽</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="未結案" value={open.length} color="text-blue-600" />
        <SummaryCard label="緊急" value={urgent.length} color="text-red-600" />
        <SummaryCard label="逾時未更新" value={stale.length} color="text-amber-600" />
      </div>

      {/* Per-factory open counts */}
      <Section icon={<Factory className="w-4 h-4" />} title="各工廠未結案">
        {byFactory.size === 0 ? (
          <Empty text="目前沒有未結案案件" />
        ) : (
          <div className="space-y-1.5">
            {[...byFactory.entries()].map(([name, count]) => (
              <div key={name} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2.5">
                <span className="text-sm font-medium text-gray-700">{name}</span>
                <span className="text-sm font-bold text-blue-600">{count} 件</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Urgent cases */}
      <Section icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title="緊急案件">
        {urgent.length === 0 ? <Empty text="沒有緊急案件" /> : <CaseList rows={urgent} />}
      </Section>

      {/* Stale cases */}
      <Section icon={<Clock className="w-4 h-4 text-amber-500" />} title="逾 3 天未更新">
        {stale.length === 0 ? <Empty text="沒有逾時案件" /> : <CaseList rows={stale} />}
      </Section>

      {/* Overdue maintenance */}
      <Section icon={<Wrench className="w-4 h-4 text-red-500" />} title="逾期未保養機器">
        {overdue.length === 0 ? (
          <Empty text="沒有逾期未保養的機器" />
        ) : (
          <div className="space-y-1.5">
            {overdue.map(m => (
              <div key={m.machine_id} className="bg-red-50 rounded-lg border border-red-200 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {m.machine_code ? `[${m.machine_code}] ` : ''}{m.machine_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      保養頻率: {['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].includes(m.pm_type) ? ['每日', '每週', '每月', '每季', '每半年', '每年'][['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].indexOf(m.pm_type)] : m.pm_type}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-red-600">逾期 {m.days_overdue} 天</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-1.5">{icon} {title}</h2>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-green-400" /> {text}
    </div>
  )
}

function CaseList({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-1.5">
      {rows.map(r => {
        const urgency = URGENCY_FROM_IMPACT[r.downtime_impact]
        return (
          <Link key={r.id} href={`/incidents/${r.id}`} className="block bg-white rounded-lg border border-gray-200 p-3 active:bg-gray-50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_ZH_COLOR[r.status]}`}>{STATUS_ZH[r.status]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgency.color}`}>{urgency.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
            </div>
            <p className="text-sm font-medium text-gray-900 mt-1.5 line-clamp-1">
              {r.title || ISSUE_TYPE_LABELS[r.incident_type] || '問題'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {r.factory?.name || ''} · {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: zhTW })}
            </p>
          </Link>
        )
      })}
    </div>
  )
}
