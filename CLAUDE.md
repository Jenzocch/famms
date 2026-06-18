# PDP — Procurement Decision Platform
## Claude Code Session Handoff

Read this file first before starting any work.

---

## Project Location & Start

```
D:\Projects\pdp\
npm run dev   →   http://localhost:3000
npx tsc --noEmit   →   should exit 0 (clean)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router + TypeScript |
| Styling | Tailwind CSS v4 + shadcn (`@base-ui/react`) |
| Database | Supabase (PostgreSQL + Auth + RLS + Storage) |
| AI | OpenAI `gpt-4o-mini` |
| URL Preview | Microlink API (no key needed) |
| Image Viewer | `react-photo-view` |
| Toast | `sonner` |
| Date | `date-fns` |

### CRITICAL — Base UI, NOT Radix UI

shadcn was initialized with `@base-ui/react`. This means:
- **`asChild` prop does NOT exist** on any component
- Use styled `<Link className="...">` instead of `<Button asChild><Link>`
- Use `onClick={() => router.push(...)}` instead of `<MenuItem asChild><Link>`
- Apply className directly to `<DropdownMenuTrigger>`, never `asChild`

---

## Environment Variables

`.env.local` at project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=sk-...
```

---

## Database

Run `supabase/schema.sql` in Supabase SQL editor.

**Tables:** `departments`, `profiles`, `purchase_requests`, `request_images`, `request_attachments`, `request_urls`, `vendors`, `ai_analyses`, `approvals`, `comments`

**Storage buckets (create manually in Supabase dashboard or SQL):**
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('request-images', 'request-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('request-attachments', 'request-attachments', false);
```

`profiles` is auto-created on signup via trigger `on_auth_user_created`.

---

## Domain Types (`src/types/index.ts`)

```typescript
type UserRole = 'applicant' | 'dept_manager' | 'general_manager' | 'director' | 'purchasing'

type RequestStatus =
  | 'draft' | 'pending_dept_manager' | 'pending_general_manager'
  | 'pending_director' | 'approved' | 'rejected' | 'returned'

type ApprovalAction = 'approve' | 'reject' | 'return'
```

Exported helpers: `formatRupiah(n)`, `getApprovalTier(n)`, `STATUS_LABELS`, `STATUS_COLORS`, `ROLE_LABELS`

---

## Approval Workflow

Thresholds (`src/lib/constants.ts`):
- `≤ 5,000,000 IDR` → Dept. Manager only
- `5M–20M IDR` → Dept. Manager → General Manager
- `> 20M IDR` → Dept. Manager → General Manager → Director

Status flow:
```
draft → pending_dept_manager → [pending_general_manager] → [pending_director] → approved
                              ↘ rejected  (any stage)
                              ↘ returned  (any stage) → applicant edits → resubmit
```

`purchase_requests.current_approver_role` is denormalized. Updated by `/api/approve` on each action.

---

## File Map

```
src/
├── app/
│   ├── layout.tsx                        root layout, Inter font, Sonner toaster
│   ├── page.tsx                          redirect → /dashboard
│   ├── login/page.tsx                    login + signup form
│   ├── (dashboard)/
│   │   ├── layout.tsx                    fetches user+profile, passes to Navbar
│   │   ├── dashboard/page.tsx            tabs: Pending/InProgress/Approved/Rejected
│   │   ├── history/page.tsx              search: title, dept, date range
│   │   ├── profile/page.tsx              edit full_name + department
│   │   └── requests/
│   │       ├── new/page.tsx              server page → RequestForm
│   │       └── [id]/page.tsx             full detail page
│   └── api/
│       ├── url-preview/route.ts          Microlink proxy
│       ├── ai/analyze/route.ts           OpenAI analysis + upsert to ai_analyses
│       └── approve/route.ts              validate role → advance status → log approval
├── components/
│   ├── shared/
│   │   ├── Navbar.tsx                    sticky header, avatar dropdown (no asChild)
│   │   ├── StatusBadge.tsx               colored chip from STATUS_COLORS
│   │   └── ImageViewer.tsx               react-photo-view grid + download toolbar
│   ├── dashboard/
│   │   └── RequestCard.tsx               16:9 thumbnail card with status badge overlay
│   ├── requests/
│   │   ├── RequestForm.tsx               full new-request form (title/dept/qty/cost/images/attachments/urls/vendors)
│   │   ├── ImageUploader.tsx             drag-drop → request-images bucket, max 20
│   │   ├── AttachmentUploader.tsx        → request-attachments bucket
│   │   ├── UrlInput.tsx                  add URLs → /api/url-preview → preview cards
│   │   ├── VendorForm.tsx                up to 5 vendors (name/price/delivery/payment/warranty/remarks)
│   │   └── AiAnalysis.tsx                button trigger → /api/ai/analyze → structured result
│   └── approval/
│       ├── ApprovalActions.tsx           Approve/Return/Reject (only shown to correct approver role)
│       └── CommentThread.tsx             real-time comments via Supabase client
├── lib/
│   ├── constants.ts                      APPROVAL_THRESHOLDS, MAX_IMAGES=20, MAX_VENDORS=5
│   ├── utils.ts                          cn() helper
│   └── supabase/
│       ├── client.ts                     createBrowserClient
│       └── server.ts                     createServerClient (cookies from next/headers)
├── middleware.ts                         auth guard: unauthenticated → /login
└── types/index.ts                        all interfaces + UI helpers
supabase/
└── schema.sql                            full DB schema + RLS + triggers
```

---

## Key Logic Notes

### RequestForm submit flow
1. Inserts `purchase_request` (`status: 'draft'`)
2. Inserts images, attachments, URLs, vendors in parallel (each linked by `request_id`)
3. "Submit" button: updates status → `pending_dept_manager`, sets `current_approver_role = 'dept_manager'`, sets `submitted_at = now()`

### /api/approve
- Validates `profile.role === request.current_approver_role`
- `nextStatus(action, currentStatus, amount)` → new status
- `nextApproverRole(newStatus)` → next `current_approver_role` (or null if terminal)
- Inserts into `approvals` (audit trail)
- If `newStatus === 'approved'`: sets `approved_at`

### /api/ai/analyze
- Fetches full request + vendors
- Calls `gpt-4o-mini` with JSON mode
- Upserts to `ai_analyses` (`onConflict: 'request_id'`)
- Returns: `summary, business_purpose, advantages[], risks[], recommendation, vendor_summary`

### /api/url-preview
- Proxies `https://api.microlink.io?url=<url>`
- Returns `{ title, description, thumbnail }`

---

## Current Status

- **TypeScript**: 0 errors (`npx tsc --noEmit` exits 0)
- **All pages + API routes**: implemented
- **RLS policies**: in schema.sql

## Needs Before First Run

1. Create `.env.local` with Supabase + OpenAI keys
2. Run `supabase/schema.sql` in Supabase SQL editor
3. Create 2 storage buckets (see above)
4. `npm install` if node_modules missing
5. `npm run dev`

## Not Yet Tested in Browser

- End-to-end signup → create request → upload → submit → approval chain
- OpenAI key billing
- Storage bucket permissions
