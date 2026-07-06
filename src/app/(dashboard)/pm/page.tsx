import { getAuthClaims } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PMPage from '@/components/pm/PMPage'

export const metadata = { title: '保養紀錄 | 維修系統' }

export default async function PMRoutePage() {
  const claims = await getAuthClaims()
  if (!claims) redirect('/login')

  return <PMPage />
}
