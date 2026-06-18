import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  // Fetch full request data
  const { data: request } = await supabase
    .from('purchase_requests')
    .select(`*, department:departments(name), vendors(*), urls:request_urls(url,title)`)
    .eq('id', requestId)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const vendorText = request.vendors?.length
    ? request.vendors.map((v: any) =>
        `- ${v.vendor_name}: Price IDR ${v.price?.toLocaleString() ?? 'N/A'}, Delivery ${v.delivery_days ?? 'N/A'} days, Payment: ${v.payment_terms ?? 'N/A'}, Warranty: ${v.warranty ?? 'N/A'}`
      ).join('\n')
    : 'No vendors provided'

  const prompt = `You are a procurement analyst. Analyze this purchase request and provide a structured analysis.

Purchase Request:
- Title: ${request.title}
- Department: ${request.department?.name}
- Purpose: ${request.purpose}
- Quantity: ${request.quantity}
- Estimated Cost: IDR ${request.estimated_cost?.toLocaleString()}

Vendors Compared:
${vendorText}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence summary of the request",
  "business_purpose": "Clear explanation of why this purchase is needed",
  "advantages": ["advantage 1", "advantage 2", "advantage 3"],
  "risks": ["risk 1", "risk 2"],
  "recommendation": "Decision support note for the approver",
  "vendor_summary": {
    "lowest_price": "vendor name or null",
    "fastest_delivery": "vendor name or null",
    "best_warranty": "vendor name or null",
    "recommended": "vendor name with brief reason or null"
  }
}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const analysis = JSON.parse(completion.choices[0].message.content ?? '{}')

    // Save to DB (upsert — one analysis per request)
    const { data: saved, error } = await supabase
      .from('ai_analyses')
      .upsert({
        request_id: requestId,
        generated_by: user.id,
        ...analysis,
      }, { onConflict: 'request_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(saved)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
