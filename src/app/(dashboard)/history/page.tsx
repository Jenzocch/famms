import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatRupiah } from '@/types'
import StatusBadge from '@/components/shared/StatusBadge'
import Link from 'next/link'
import { format } from 'date-fns'
import { Search } from 'lucide-react'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isApprover = ['dept_manager', 'general_manager', 'director', 'purchasing'].includes(profile?.role ?? '')

  let query = supabase
    .from('purchase_requests')
    .select('*, department:departments(name), applicant:profiles!applicant_id(full_name)')
    .in('status', ['approved', 'rejected'])
    .order('updated_at', { ascending: false })

  if (!isApprover) query = query.eq('applicant_id', user.id)
  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (params.dept) query = query.eq('department_id', params.dept)
  if (params.from) query = query.gte('submitted_at', params.from)
  if (params.to) query = query.lte('submitted_at', params.to + 'T23:59:59')

  const { data: requests } = await query
  const { data: departments } = await supabase.from('departments').select('id,name').order('name')

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Purchase History</h1>

      {/* Filters */}
      <form className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input name="q" defaultValue={params.q} placeholder="Search by title..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select name="dept" defaultValue={params.dept}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Departments</option>
          {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={params.from}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" name="to" defaultValue={params.to}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit"
          className="bg-blue-600 text-white text-sm rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors">
          Search
        </button>
      </form>

      {/* Results */}
      {!requests || requests.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No purchase history found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <Link key={r.id} href={`/requests/${r.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm truncate">{r.title}</p>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(r.department as any)?.name} · {(r.applicant as any)?.full_name} ·{' '}
                    {r.approved_at ? format(new Date(r.approved_at), 'dd MMM yyyy') : format(new Date(r.updated_at), 'dd MMM yyyy')}
                  </p>
                </div>
                <p className="text-sm font-bold text-blue-700 shrink-0">{formatRupiah(r.estimated_cost)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
