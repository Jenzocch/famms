import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MachinesList, { MachineRow } from '@/components/machines/MachinesList'

export const metadata = { title: 'Machines | FAMMS' }

export default async function MachinesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('factory_id')
    .eq('id', user.id)
    .single()

  // Cross-factory accounts (factory_id NULL, e.g. admins) see every machine;
  // .eq('factory_id', null) would match nothing and show an empty list.
  let query = supabase
    .from('machines')
    .select('*, area:areas(name), owner:profiles(full_name)')
    .order('machine_code')
  if (profile?.factory_id) query = query.eq('factory_id', profile.factory_id)

  const { data: machines } = await query

  async function deleteMachine(machineId: string) {
    'use server'
    const supabase = await createClient()
    await supabase.from('machines').delete().eq('id', machineId)
    redirect('/machines')
  }

  return (
    <MachinesList
      machines={(machines ?? []) as MachineRow[]}
      deleteAction={deleteMachine}
    />
  )
}
