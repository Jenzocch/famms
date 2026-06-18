export type UserRole = 'applicant' | 'dept_manager' | 'general_manager' | 'director' | 'purchasing'

export type RequestStatus =
  | 'draft'
  | 'pending_dept_manager'
  | 'pending_general_manager'
  | 'pending_director'
  | 'approved'
  | 'rejected'
  | 'returned'

export type ApprovalAction = 'approve' | 'reject' | 'return'

export interface Department {
  id: string
  name: string
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  department_id: string | null
  avatar_url: string | null
  department?: Department
}

export interface RequestImage {
  id: string
  request_id: string
  storage_path: string
  file_name: string | null
  sort_order: number
}

export interface RequestAttachment {
  id: string
  request_id: string
  storage_path: string
  file_name: string
  file_type: string | null
  file_size: number | null
}

export interface RequestUrl {
  id: string
  request_id: string
  url: string
  title: string | null
  description: string | null
  thumbnail: string | null
  sort_order: number
}

export interface Vendor {
  id: string
  request_id: string
  vendor_name: string
  price: number | null
  delivery_days: number | null
  payment_terms: string | null
  warranty: string | null
  remarks: string | null
  sort_order: number
}

export interface AiAnalysis {
  id: string
  request_id: string
  summary: string | null
  business_purpose: string | null
  advantages: string[]
  risks: string[]
  recommendation: string | null
  vendor_summary: {
    lowest_price?: string
    fastest_delivery?: string
    best_warranty?: string
    recommended?: string
  } | null
  generated_at: string
}

export interface Approval {
  id: string
  request_id: string
  approver_id: string
  role: UserRole
  action: ApprovalAction
  comment: string | null
  created_at: string
  approver?: Profile
}

export interface Comment {
  id: string
  request_id: string
  author_id: string
  content: string
  created_at: string
  author?: Profile
}

export interface PurchaseRequest {
  id: string
  title: string
  department_id: string
  applicant_id: string
  purpose: string
  quantity: number
  estimated_cost: number
  status: RequestStatus
  current_approver_role: UserRole | null
  submitted_at: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  // relations
  department?: Department
  applicant?: Profile
  images?: RequestImage[]
  attachments?: RequestAttachment[]
  urls?: RequestUrl[]
  vendors?: Vendor[]
  ai_analysis?: AiAnalysis | null
  approvals?: Approval[]
  comments?: Comment[]
}

// UI helpers
export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  pending_dept_manager: 'Pending Dept. Manager',
  pending_general_manager: 'Pending General Manager',
  pending_director: 'Pending Director',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_dept_manager: 'bg-yellow-100 text-yellow-800',
  pending_general_manager: 'bg-orange-100 text-orange-800',
  pending_director: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  returned: 'bg-blue-100 text-blue-800',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  applicant: 'Applicant',
  dept_manager: 'Department Manager',
  general_manager: 'General Manager',
  director: 'Director',
  purchasing: 'Purchasing Team',
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getApprovalTier(amount: number): string {
  if (amount <= 5_000_000) return 'Dept. Manager only'
  if (amount <= 20_000_000) return 'Dept. Manager → GM'
  return 'Dept. Manager → GM → Director'
}
