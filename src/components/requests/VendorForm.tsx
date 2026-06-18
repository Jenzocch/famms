'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { MAX_VENDORS } from '@/lib/constants'

interface VendorRow {
  vendor_name: string
  price: string
  delivery_days: string
  payment_terms: string
  warranty: string
  remarks: string
}

interface Props {
  value: VendorRow[]
  onChange: (v: VendorRow[]) => void
}

const empty = (): VendorRow => ({
  vendor_name: '', price: '', delivery_days: '', payment_terms: '', warranty: '', remarks: '',
})

export default function VendorForm({ value, onChange }: Props) {
  function add() {
    if (value.length >= MAX_VENDORS) return
    onChange([...value, empty()])
  }
  function remove(i: number) { onChange(value.filter((_, idx) => idx !== i)) }
  function update(i: number, field: keyof VendorRow, val: string) {
    const updated = [...value]
    updated[i] = { ...updated[i], [field]: val }
    onChange(updated)
  }

  if (value.length === 0) {
    return (
      <Button type="button" variant="outline" onClick={add} size="sm">
        <Plus className="w-4 h-4 mr-1" /> Add Vendor
      </Button>
    )
  }

  return (
    <div className="space-y-4">
      {value.map((v, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3 relative">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Vendor {i + 1}</span>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Vendor Name *" value={v.vendor_name}
              onChange={e => update(i, 'vendor_name', e.target.value)} />
            <Input placeholder="Price (IDR)" type="number" value={v.price}
              onChange={e => update(i, 'price', e.target.value)} />
            <Input placeholder="Delivery (days)" type="number" value={v.delivery_days}
              onChange={e => update(i, 'delivery_days', e.target.value)} />
            <Input placeholder="Payment Terms" value={v.payment_terms}
              onChange={e => update(i, 'payment_terms', e.target.value)} />
            <Input placeholder="Warranty" value={v.warranty}
              onChange={e => update(i, 'warranty', e.target.value)} />
            <Input placeholder="Remarks" value={v.remarks}
              onChange={e => update(i, 'remarks', e.target.value)} />
          </div>
        </div>
      ))}
      {value.length < MAX_VENDORS && (
        <Button type="button" variant="outline" onClick={add} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add Vendor ({value.length}/{MAX_VENDORS})
        </Button>
      )}
    </div>
  )
}
