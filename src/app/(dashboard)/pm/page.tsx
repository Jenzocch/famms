import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PMPage from '@/components/pm/PMPage'
import type { UserRole } from '@/types'

export const metadata = { title: 'PM | FAMMS' }

export default async function PMRoutePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return <PMPage role={(profile?.role ?? 'technician') as UserRole} />
}
