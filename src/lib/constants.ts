export const APPROVAL_THRESHOLDS = {
  DEPT_MANAGER_MAX: 5_000_000,
  GENERAL_MANAGER_MAX: 20_000_000,
} as const

export const MAX_IMAGES = 20
export const MAX_VENDORS = 5
export const MAX_FILE_SIZE_MB = 10

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const ACCEPTED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  ...ACCEPTED_IMAGE_TYPES,
]
