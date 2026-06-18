import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestForm from '@/components/requests/RequestForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewRequestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: departments } = await supabase.from('departments').select('id, name').order('name')

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Purchase Request</h1>
      </div>
      <RequestForm departments={departments ?? []} userId={user.id} />
    </div>
  )
}
