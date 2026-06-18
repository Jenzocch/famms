import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RequestCard from '@/components/dashboard/RequestCard'
import { RequestStatus, PurchaseRequest } from '@/types'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TABS: { value: string; label: string; statuses: RequestStatus[] }[] = [
  {
    value: 'pending',
    label: 'Pending',
    statuses: ['pending_dept_manager', 'pending_general_manager', 'pending_director'],
  },
  { value: 'inprogress', label: 'In Progress', statuses: ['draft', 'returned'] },
  { value: 'approved', label: 'Approved', statuses: ['approved'] },
  { value: 'rejected', label: 'Rejected', statuses: ['rejected'] },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isApprover = ['dept_manager', 'general_manager', 'director', 'purchasing'].includes(profile?.role ?? '')

  // Build query — approvers see all, applicants see own
  const baseQuery = supabase
    .from('purchase_requests')
    .select(`*, department:departments(id,name), applicant:profiles!applicant_id(id,full_name), images:request_images(id,storage_path,sort_order)`)
    .order('updated_at', { ascending: false })

  const query = isApprover ? baseQuery : baseQuery.eq('applicant_id', user!.id)
  const { data: requests } = await query

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const grouped = (statuses: RequestStatus[]) =>
    (requests as PurchaseRequest[] ?? []).filter(r => statuses.includes(r.status))

  const pendingForMe = isApprover
    ? (requests as PurchaseRequest[] ?? []).filter(r => {
        if (profile?.role === 'dept_manager') return r.status === 'pending_dept_manager'
        if (profile?.role === 'general_manager') return r.status === 'pending_general_manager'
        if (profile?.role === 'director') return r.status === 'pending_director'
        return false
      })
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Procurement Decision Platform</p>
        </div>
        <Link href="/requests/new"
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New Request
        </Link>
      </div>

      {/* Pending for me — shown to approvers only */}
      {isApprover && pendingForMe.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Awaiting Your Approval ({pendingForMe.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pendingForMe.map(r => (
              <RequestCard key={r.id} request={r} supabaseUrl={supabaseUrl} />
            ))}
          </div>
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          {TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
              {tab.label}
              {grouped(tab.statuses).length > 0 && (
                <span className="ml-1.5 bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 text-xs">
                  {grouped(tab.statuses).length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {grouped(tab.statuses).length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">No requests here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {grouped(tab.statuses).map(r => (
                  <RequestCard key={r.id} request={r} supabaseUrl={supabaseUrl} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
