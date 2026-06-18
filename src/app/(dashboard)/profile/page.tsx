'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Department, ROLE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, User } from 'lucide-react'

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [fullName, setFullName] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: p }, { data: depts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('departments').select('id,name').order('name'),
      ])
      setProfile(p)
      setFullName(p?.full_name ?? '')
      setDepartmentId(p?.department_id ?? '')
      setDepartments(depts ?? [])
    }
    load()
  }, [])

  async function save() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), department_id: departmentId || null })
      .eq('id', profile.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Profile updated')
  }

  if (!profile) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Profile</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile.full_name}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <p className="text-xs text-blue-600 mt-0.5">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>

        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" />
        </div>

        <div>
          <Label>Department</Label>
          <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? '')}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Role</Label>
          <p className="mt-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            {ROLE_LABELS[profile.role]} — Contact admin to change role
          </p>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
