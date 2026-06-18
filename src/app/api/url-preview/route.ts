import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  try {
    const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false`
    const res = await fetch(apiUrl, {
      headers: process.env.MICROLINK_API_KEY
        ? { 'x-api-key': process.env.MICROLINK_API_KEY }
        : {},
    })
    const data = await res.json()
    if (data.status !== 'success') throw new Error('Preview failed')
    return NextResponse.json({
      title: data.data?.title ?? null,
      description: data.data?.description ?? null,
      thumbnail: data.data?.image?.url ?? data.data?.logo?.url ?? null,
    })
  } catch {
    return NextResponse.json({ title: null, description: null, thumbnail: null })
  }
}
