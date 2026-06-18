import { RequestStatus, STATUS_LABELS, STATUS_COLORS } from '@/types'
import { cn } from '@/lib/utils'

export default function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}
