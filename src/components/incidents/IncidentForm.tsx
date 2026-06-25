'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Machine, FailureCategory, FailureCode, DowntimeImpact, DOWNTIME_IMPACT_LABELS,
} from '@/types'
import { SLA_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'

type IncidentType = 'machine' | 'facility'
const IMPACTS: DowntimeImpact[] = ['A', 'B', 'C', 'D']

interface Facility {
  id: string
  facility_code: string
  facility_name: string
  facility_type: string
}

interface FacilityIssueCategory {
  id: string
  code: string
  name: string
}

export default function IncidentForm() {
  const router = useRouter()
  const supabase = createClient()

  const [incidentType, setIncidentType] = useState<IncidentType>('machine')

  // Machine-related
  const [machines, setMachines] = useState<Machine[]>([])
  const [categories, setCategories] = useState<FailureCategory[]>([])
  const [codes, setCodes] = useState<FailureCode[]>([])
  const [machineId, setMachineId] = useState('')
  const [mainCatId, setMainCatId] = useState('')
  const [subCatId, setSubCatId] = useState('')
  const [failureCodeId, setFailureCodeId] = useState('')

  // Facility-related
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [facilityIssueCategories, setFacilityIssueCategories] = useState<FacilityIssueCategory[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [facilityIssueId, setFacilityIssueId] = useState('')
  const [facilityDescription, setFacilityDescription] = useState('')

  // Common
  const [impact, setImpact] = useState<DowntimeImpact>('D')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: m },
        { data: cats },
        { data: fc },
        { data: fac },
        { data: fic },
      ] = await Promise.all([
        supabase.from('machines').select('*').neq('status', 'scrapped').order('machine_code'),
        supabase.from('failure_categories').select('*').eq('is_active', true).order('display_order'),
        supabase.from('failure_codes').select('*').eq('is_active', true).order('display_order'),
        supabase.from('facilities').select('*').eq('status', 'operational').order('facility_code'),
        supabase.from('facility_issue_categories').select('*').eq('is_active', true).order('display_order'),
      ])
      setMachines(m ?? [])
      setCategories(cats ?? [])
      setCodes(fc ?? [])
      setFacilities(fac ?? [])
      setFacilityIssueCategories(fic ?? [])
    }
    load()
  }, [])

  // Cascade derivations (machines only)
  const mainCats = useMemo(() => categories.filter(c => c.level === 1), [categories])
  const subCats = useMemo(
    () => categories.filter(c => c.level === 2 && c.parent_id === mainCatId),
    [categories, mainCatId]
  )
  const leafCodes = useMemo(
    () => codes.filter(c => c.category_id === subCatId),
    [codes, subCatId]
  )

  async function submitMachine() {
    if (!machineId || !failureCodeId) {
      toast.error('Pilih mesin dan failure code')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type: 'machine',
          machine_id: machineId,
          failure_code_id: failureCodeId,
          downtime_impact: impact,
          remarks,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal membuat incident')

      if (json.potential_repeats?.length > 0) {
        const nos = json.potential_repeats.map((p: { incident_no: string }) => p.incident_no).join(', ')
        toast.warning(`⚠️ Suspek Repeat Failure: ${nos}. Supervisor harus konfirmasi.`, { duration: 6000 })
      } else {
        toast.success(`Incident ${json.incident.incident_no} dibuat`)
      }
      router.push(`/incidents/${json.incident.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat incident')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitFacility() {
    if (!facilityId) {
      toast.error('Pilih fasilitas')
      return
    }
    if (!facilityDescription.trim()) {
      toast.error('Jelaskan masalah yang terjadi')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_type: 'facility',
          facility_id: facilityId,
          facility_issue_description: facilityDescription,
          downtime_impact: impact,
          remarks,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Gagal membuat incident')
      toast.success(`Incident ${json.incident.incident_no} dibuat`)
      router.push(`/incidents/${json.incident.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat incident')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Report Type Selection */}
      <div>
        <Label>Tipe Laporan <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            type="button"
            onClick={() => setIncidentType('machine')}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              incidentType === 'machine'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            🔧 Mesin/Peralatan
          </button>
          <button
            type="button"
            onClick={() => setIncidentType('facility')}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
              incidentType === 'facility'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'
            }`}
          >
            🏭 Fasilitas/Infrastruktur
          </button>
        </div>
      </div>

      {incidentType === 'machine' ? (
        <>
          {/* Machine Selection */}
          <div>
            <Label>Mesin <span className="text-red-500">*</span></Label>
            <Select value={machineId} onValueChange={(v) => setMachineId(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih mesin" /></SelectTrigger>
              <SelectContent>
                {machines.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.machine_code} — {m.machine_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {machines.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Belum ada mesin terdaftar. Tambah mesin dulu.</p>
            )}
          </div>

          {/* Fault Tree Cascade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Kategori <span className="text-red-500">*</span></Label>
              <Select
                value={mainCatId}
                onValueChange={(v) => { setMainCatId(v ?? ''); setSubCatId(''); setFailureCodeId('') }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Main" /></SelectTrigger>
                <SelectContent>
                  {mainCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub-Kategori <span className="text-red-500">*</span></Label>
              <Select
                value={subCatId}
                onValueChange={(v) => { setSubCatId(v ?? ''); setFailureCodeId('') }}
                disabled={!mainCatId}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sub" /></SelectTrigger>
                <SelectContent>
                  {subCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Failure Code <span className="text-red-500">*</span></Label>
              <Select value={failureCodeId} onValueChange={(v) => setFailureCodeId(v ?? '')} disabled={!subCatId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Code" /></SelectTrigger>
                <SelectContent>
                  {leafCodes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-mono text-xs text-gray-400 mr-1">{c.code}</span>{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Facility Selection */}
          <div>
            <Label>Fasilitas <span className="text-red-500">*</span></Label>
            <Select value={facilityId} onValueChange={(v) => setFacilityId(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih fasilitas" /></SelectTrigger>
              <SelectContent>
                {facilities.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.facility_code} — {f.facility_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {facilities.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Belum ada fasilitas terdaftar.</p>
            )}
          </div>

          {/* Facility Issue Category (optional quick selection) */}
          <div>
            <Label>Kategori Masalah (Opsional)</Label>
            <Select value={facilityIssueId} onValueChange={(v) => setFacilityIssueId(v ?? '')}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
              <SelectContent>
                {facilityIssueCategories.map(fic => (
                  <SelectItem key={fic.id} value={fic.id}>
                    {fic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Facility Issue Description */}
          <div>
            <Label htmlFor="facility-desc">Deskripsi Masalah <span className="text-red-500">*</span></Label>
            <Textarea
              id="facility-desc"
              value={facilityDescription}
              onChange={e => setFacilityDescription(e.target.value)}
              placeholder="Jelaskan masalah secara detail: lokasi, gejala, kapan terjadi, dll."
              className="mt-1"
              rows={4}
            />
          </div>
        </>
      )}

      {/* Common Fields */}

      {/* Downtime Impact */}
      <div>
        <Label>Dampak Downtime <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          {IMPACTS.map(i => (
            <button
              key={i}
              type="button"
              onClick={() => setImpact(i)}
              className={`text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                impact === i ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="font-bold">{i}</span>
              <span className="block text-xs text-gray-500">{DOWNTIME_IMPACT_LABELS[i]}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> SLA respons: {SLA_LABELS[impact]}
        </p>
      </div>

      {/* Remarks */}
      <div>
        <Label htmlFor="remarks">Catatan Tambahan</Label>
        <Textarea
          id="remarks"
          value={remarks}
          onChange={e => setRemarks(e.target.value)}
          placeholder="Informasi tambahan yang relevan..."
          className="mt-1"
          rows={2}
        />
      </div>

      <Button
        onClick={incidentType === 'machine' ? submitMachine : submitFacility}
        disabled={submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Buat Incident
      </Button>
    </div>
  )
}
