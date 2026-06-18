'use client'

import { useState } from 'react'
import { AiAnalysis as AiAnalysisType } from '@/types'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Award } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Props {
  requestId: string
  initial?: AiAnalysisType | null
}

export default function AiAnalysis({ requestId, initial }: Props) {
  const [analysis, setAnalysis] = useState<AiAnalysisType | null>(initial ?? null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(!!initial)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      setAnalysis(data)
      setExpanded(true)
      toast.success('AI analysis generated')
    } catch (err: any) {
      toast.error(err.message || 'AI analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-200 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-violet-900">AI Analysis</span>
          {analysis && (
            <span className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">
              Generated
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"
            className="border-violet-300 text-violet-700 hover:bg-violet-100"
            onClick={generate} disabled={loading}>
            {loading
              ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Generating...</>
              : <><Sparkles className="w-3.5 h-3.5 mr-1" /> {analysis ? 'Regenerate' : 'Generate AI Analysis'}</>}
          </Button>
          {analysis && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {analysis && expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-violet-200 pt-4">
          {analysis.summary && (
            <div>
              <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Summary</h4>
              <p className="text-sm text-gray-700">{analysis.summary}</p>
            </div>
          )}

          {analysis.business_purpose && (
            <div>
              <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">Business Purpose</h4>
              <p className="text-sm text-gray-700">{analysis.business_purpose}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analysis.advantages?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Advantages
                </h4>
                <ul className="space-y-1">
                  {analysis.advantages.map((a, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5">✓</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.risks?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Risks
                </h4>
                <ul className="space-y-1">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <span className="text-orange-500 mt-0.5">⚠</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendation && (
            <div className="bg-violet-100 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Recommendation
              </h4>
              <p className="text-sm text-violet-800">{analysis.recommendation}</p>
            </div>
          )}

          {analysis.vendor_summary && Object.keys(analysis.vendor_summary).length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">Vendor Insights</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Lowest Price', key: 'lowest_price', icon: '💰' },
                  { label: 'Fastest Delivery', key: 'fastest_delivery', icon: '🚚' },
                  { label: 'Best Warranty', key: 'best_warranty', icon: '🛡️' },
                  { label: 'Recommended', key: 'recommended', icon: '⭐' },
                ].map(({ label, key, icon }) => {
                  const val = (analysis.vendor_summary as any)?.[key]
                  if (!val) return null
                  return (
                    <div key={key} className="bg-white rounded-lg p-2 border border-violet-100">
                      <p className="text-xs text-gray-500">{icon} {label}</p>
                      <p className="text-xs font-medium text-gray-800 mt-0.5">{val}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
