'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Comment } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface Props {
  requestId: string
  comments: Comment[]
  currentUserId: string
}

export default function CommentThread({ requestId, comments: initial, currentUserId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [comments, setComments] = useState(initial)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function post() {
    if (!text.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('comments')
      .insert({ request_id: requestId, author_id: currentUserId, content: text.trim() })
      .select('*, author:profiles(full_name, role)')
      .single()
    if (error) { toast.error('Failed to post comment'); setLoading(false); return }
    setComments([...comments, data as Comment])
    setText('')
    setLoading(false)
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-3">Comments</h3>

      <div className="space-y-3 mb-4">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400">No comments yet</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                {c.author?.full_name?.slice(0, 2).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900">{c.author?.full_name}</span>
                <span className="text-xs text-gray-400">
                  {format(new Date(c.created_at), 'dd MMM, HH:mm')}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{c.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..."
          rows={2} className="flex-1 text-sm"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post() }} />
        <Button onClick={post} disabled={loading || !text.trim()} size="sm" className="self-end">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Ctrl+Enter to send</p>
    </div>
  )
}
