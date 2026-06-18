'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_IMAGES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ImageUploaderProps {
  onUpload: (paths: string[]) => void
}

interface UploadedFile {
  path: string
  preview: string
  name: string
}

export default function ImageUploader({ onUpload }: ImageUploaderProps) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  async function handleFiles(fileList: FileList) {
    const toAdd = Array.from(fileList).slice(0, MAX_IMAGES - files.length)
    if (toAdd.length === 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`)
      return
    }
    setUploading(true)
    const newFiles: UploadedFile[] = []

    for (const file of toAdd) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) continue
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
      const { error } = await supabase.storage.from('request-images').upload(path, file)
      if (error) { toast.error(`Failed to upload ${file.name}`); continue }
      newFiles.push({ path, preview: URL.createObjectURL(file), name: file.name })
    }

    const updated = [...files, ...newFiles]
    setFiles(updated)
    onUpload(updated.map(f => f.path))
    setUploading(false)
  }

  function remove(idx: number) {
    const updated = files.filter((_, i) => i !== idx)
    setFiles(updated)
    onUpload(updated.map(f => f.path))
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); e.dataTransfer.files && handleFiles(e.dataTransfer.files) }}
        className={cn(
          'w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors',
          files.length >= MAX_IMAGES ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
        )}
        disabled={files.length >= MAX_IMAGES}
      >
        {uploading ? (
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
        ) : (
          <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
        )}
        <p className="text-sm text-gray-600">
          {files.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images reached` : 'Click or drag images here'}
        </p>
        <p className="text-xs text-gray-400 mt-1">{files.length} / {MAX_IMAGES} images</p>
      </button>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
              <Image src={f.preview} alt={f.name} fill className="object-cover" sizes="100px" />
              <button
                onClick={() => remove(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
