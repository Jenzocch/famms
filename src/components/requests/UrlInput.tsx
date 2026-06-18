'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, X, Loader2, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

interface UrlEntry {
  url: string
  title?: string
  description?: string
  thumbnail?: string
}

interface Props {
  value: UrlEntry[]
  onChange: (v: UrlEntry[]) => void
}

export default function UrlInput({ value, onChange }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function addUrl() {
    const url = input.trim()
    if (!url || value.find(v => v.url === url)) { setInput(''); return }
    setLoading(true)
    try {
      const res = await fetch('/api/url-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const preview = await res.json()
      onChange([...value, { url, ...preview }])
      setInput('')
    } catch {
      onChange([...value, { url }])
      toast.error('Could not fetch URL preview')
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)}
          placeholder="https://www.tokopedia.com/..." className="flex-1"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUrl())} />
        <Button type="button" variant="outline" onClick={addUrl} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {value.map((entry, i) => (
        <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
          {entry.thumbnail && (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-white border border-gray-200">
              <Image src={entry.thumbnail} alt="" fill className="object-cover" sizes="64px"
                onError={e => (e.currentTarget.style.display = 'none')} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-1">
              {entry.title || entry.url}
            </p>
            {entry.description && (
              <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{entry.description}</p>
            )}
            <a href={entry.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 flex items-center gap-1 mt-1 hover:underline">
              <ExternalLink className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{entry.url}</span>
            </a>
          </div>
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
