import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { formatRupiah, getApprovalTier, ROLE_LABELS, UserRole } from '@/types'
import StatusBadge from '@/components/shared/StatusBadge'
import ImageViewer from '@/components/shared/ImageViewer'
import AiAnalysis from '@/components/requests/AiAnalysis'
import ApprovalActions from '@/components/approval/ApprovalActions'
import CommentThread from '@/components/approval/CommentThread'
import { ChevronLeft, Building2, User, Calendar, Hash, ExternalLink, Paperclip, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Separator } from '@/components/ui/separator'

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: request } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      department:departments(id,name),
      applicant:profiles!applicant_id(id,full_name,email,role),
      images:request_images(id,storage_path,file_name,sort_order),
      attachments:request_attachments(id,storage_path,file_name,file_type,file_size),
      urls:request_urls(id,url,title,description,thumbnail,sort_order),
      vendors(id,vendor_name,price,delivery_days,payment_terms,warranty,remarks,sort_order),
      ai_analysis:ai_analyses(id,summary,business_purpose,advantages,risks,recommendation,vendor_summary,generated_at),
      approvals(id,action,comment,created_at,role,approver:profiles!approver_id(full_name)),
      comments(id,content,created_at,author:profiles!author_id(full_name,role))
    `)
    .eq('id', id)
    .single()

  if (!request) notFound()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const images = [...(request.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const vendors = [...(request.vendors ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const urls = [...(request.urls ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const approvalHistory = [...(request.approvals ?? [])].sort((a: any, b: any) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-2 mb-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 mt-1">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-bold text-gray-900 leading-snug">{request.title}</h1>
            <StatusBadge status={request.status} />
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{request.department?.name}</span>
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{request.applicant?.full_name}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />
              {request.submitted_at ? format(new Date(request.submitted_at), 'dd MMM yyyy') : 'Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* 1. Images */}
      {images.length > 0 && (
        <section className="mb-5">
          <ImageViewer images={images} supabaseUrl={supabaseUrl} />
        </section>
      )}

      {/* 2. Purchase Summary */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Purchase Summary</h2>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-gray-500">Quantity</p>
            <p className="font-medium">{request.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Approval Route</p>
            <p className="font-medium text-xs">{getApprovalTier(request.estimated_cost)}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Business Purpose</p>
          <p className="text-sm text-gray-700 leading-relaxed">{request.purpose}</p>
        </div>
      </section>

      {/* 3. Amount */}
      <section className="bg-blue-600 rounded-xl p-5 mb-4 text-white">
        <p className="text-sm opacity-80">Estimated Cost</p>
        <p className="text-3xl font-bold mt-1">{formatRupiah(request.estimated_cost)}</p>
      </section>

      {/* 4. Vendor Comparison */}
      {vendors.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Vendor Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Vendor', 'Price', 'Delivery', 'Payment', 'Warranty', 'Notes'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors.map(v => (
                  <tr key={v.id} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-medium text-gray-900">{v.vendor_name}</td>
                    <td className="py-2 pr-3 text-blue-700 font-medium">{v.price ? formatRupiah(v.price) : '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{v.delivery_days ? `${v.delivery_days}d` : '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{v.payment_terms ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{v.warranty ?? '—'}</td>
                    <td className="py-2 text-gray-500 text-xs">{v.remarks ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Product URLs */}
      {urls.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Product Links</h2>
          <div className="space-y-2">
            {urls.map(u => (
              <a key={u.id} href={u.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                {u.thumbnail && (
                  <img src={u.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0"
                    onError={e => (e.currentTarget.style.display = 'none')} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.title || u.url}</p>
                  {u.description && <p className="text-xs text-gray-400 truncate">{u.description}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Attachments */}
      {(request.attachments ?? []).length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Attachments</h2>
          {request.attachments!.map((a: any) => (
            <a key={a.id}
              href={`${supabaseUrl}/storage/v1/object/public/request-attachments/${a.storage_path}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-blue-600 hover:underline">
              <Paperclip className="w-4 h-4" /> {a.file_name}
              <span className="text-gray-400 text-xs ml-auto">
                {a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB` : ''}
              </span>
            </a>
          ))}
        </section>
      )}

      {/* 5. AI Analysis */}
      <section className="mb-4">
        <AiAnalysis requestId={id} initial={request.ai_analysis?.[0] ?? null} />
      </section>

      {/* Approval History */}
      {approvalHistory.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Approval History</h2>
          <div className="space-y-3">
            {approvalHistory.map(a => (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`mt-0.5 ${a.action === 'approve' ? 'text-green-500' : a.action === 'reject' ? 'text-red-500' : 'text-orange-500'}`}>
                  {a.action === 'approve' ? <CheckCircle className="w-4 h-4" /> :
                   a.action === 'reject' ? <XCircle className="w-4 h-4" /> :
                   <RotateCcw className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {a.approver?.full_name} <span className="text-gray-400 font-normal">({ROLE_LABELS[a.role as UserRole]})</span>
                  </p>
                  {a.comment && <p className="text-sm text-gray-600 mt-0.5">"{a.comment}"</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{format(new Date(a.created_at), 'dd MMM yyyy, HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Approval Actions */}
      {profile && (
        <section className="mb-4">
          <ApprovalActions
            requestId={id}
            status={request.status}
            myRole={profile.role}
            currentApproverRole={request.current_approver_role}
          />
        </section>
      )}

      {/* 7. Comments */}
      <section className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <CommentThread
          requestId={id}
          comments={request.comments ?? []}
          currentUserId={user.id}
        />
      </section>
    </div>
  )
}
