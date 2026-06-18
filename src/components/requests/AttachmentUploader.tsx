'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Paperclip, X, Loader2, FileText, FileSpreadsheet, FileImage } from 'lucide-react'
import { toast } from 'sonner'
import { ACCEPTED_ATTACHMENT_TYPES, MAX_FILE_SIZE_MB } from '@/lib/constants'

interface AttachmentFile {
  path: string
  name: string
  type: string
  size: number
}

interface Props {
  onUpload: (files: AttachmentFile[]) => void
}

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />
  if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-green-600" />
  if (type.includes('image')) return <FileImage className="w-4 h-4 text-blue-500" />
  return <FileText className="w-4 h-4 text-gray-400" />
}

export default function AttachmentUploader({ onUpload }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<AttachmentFile[]>([])
  const [uploading, setUploading] = useState(false)

  async function handleFiles(fileList: FileList) {
    setUploading(true)
    const newFiles: AttachmentFile[] = []
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`)
        continue
      }
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
      const { error } = await supabase.storage.from('request-attachments').upload(path, file)
      if (error) { toast.error(`Failed to upload ${file.name}`); continue }
      newFiles.push({ path, name: file.name, type: file.type, size: file.size })
    }
    const updated = [...files, ...newFiles]
    setFiles(updated)
    onUpload(updated)
    setUploading(false)
  }

  function remove(idx: number) {
    const updated = files.filter((_, i) => i !== idx)
    setFiles(updated)
    onUpload(updated)
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" multiple accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
        className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
      <button type="button" onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        Attach files
      </button>
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
          <FileIcon type={f.type} />
          <span className="flex-1 truncate text-gray-700">{f.name}</span>
          <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
