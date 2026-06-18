import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ApprovalAction, RequestStatus } from '@/types'
import { APPROVAL_THRESHOLDS } from '@/lib/constants'

function nextStatus(
  action: ApprovalAction,
  currentStatus: RequestStatus,
  amount: number
): RequestStatus {
  if (action === 'reject') return 'rejected'
  if (action === 'return') return 'returned'

  // approve — advance
  if (currentStatus === 'pending_dept_manager') {
    if (amount > APPROVAL_THRESHOLDS.GENERAL_MANAGER_MAX) return 'pending_general_manager'
    if (amount > APPROVAL_THRESHOLDS.DEPT_MANAGER_MAX) return 'pending_general_manager'
    return 'approved'
  }
  if (currentStatus === 'pending_general_manager') {
    if (amount > APPROVAL_THRESHOLDS.GENERAL_MANAGER_MAX) return 'pending_director'
    return 'approved'
  }
  if (currentStatus === 'pending_director') return 'approved'
  return currentStatus
}

function nextApproverRole(status: RequestStatus) {
  if (status === 'pending_dept_manager') return 'dept_manager'
  if (status === 'pending_general_manager') return 'general_manager'
  if (status === 'pending_director') return 'director'
  return null
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId, action, comment } = await req.json() as {
    requestId: string; action: ApprovalAction; comment?: string
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const { data: request } = await supabase
    .from('purchase_requests')
    .select('status, estimated_cost, current_approver_role')
    .eq('id', requestId)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // Verify this approver is allowed to act
  if (request.current_approver_role !== profile.role) {
    return NextResponse.json({ error: 'Not your turn to approve' }, { status: 403 })
  }

  const newStatus = nextStatus(action, request.status as RequestStatus, request.estimated_cost)
  const newApproverRole = nextApproverRole(newStatus)

  // Save approval record
  const { error: approvalError } = await supabase.from('approvals').insert({
    request_id: requestId,
    approver_id: user.id,
    role: profile.role,
    action,
    comment: comment ?? null,
  })
  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 500 })

  // Update request status
  const { error: updateError } = await supabase
    .from('purchase_requests')
    .update({
      status: newStatus,
      current_approver_role: newApproverRole,
      approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', requestId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  return NextResponse.json({ status: newStatus })
}
