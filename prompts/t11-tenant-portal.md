# TASK T11: Tenant Self-Service Portal

You are an autonomous agent working on the `rent-platform` repository. Your task is to build a comprehensive renter dashboard where tenants can manage their rental lifecycle without calling their landlord.

## Acceptance Criteria

### 1. Renter Dashboard Redesign (`app/renter/dashboard/page.tsx`)
- Card-based layout showing:
  - Lease summary: address, rent amount, due date, lease end date, days remaining
  - Payment status: next payment due, last payment, balance (if billing exists from T09)
  - Active maintenance requests with status badges
  - Quick action buttons: "Report Issue", "Pay Rent", "Message Landlord"

### 2. Maintenance Request Form (`app/renter/maintenance-requests/new/page.tsx`)
- Redesign the maintenance request form with:
  - Photo upload support (store in Supabase Storage, link to request)
  - Location picker (dropdown matching MAINTENANCE_REQUEST_LOCATIONS)
  - Urgency selector with clear descriptions of habitability vs standard
  - Entry permission preference
  - Contact phone pre-filled from profile
- After submission: show confirmation with request ID and expected timeline

### 3. Maintenance Request Tracking (`app/renter/maintenance-requests/page.tsx`)
- List all requests with: status badge, date submitted, issue summary, location
- Detail view showing: full description, photos, AI review results (cost estimate, severity — if landlord has shared), assigned vendor (if available), status history timeline
- Real-time status via Supabase Realtime subscription (or polling fallback)

### 4. Lease Document Viewer
- Show lease terms in a readable format on `/renter/lease`
- Pull from property's lease_terms field
- Display key dates, policies (parking, pets, quiet hours), and manager contact
- "Download Lease" button (placeholder for future PDF generation)

### 5. Photo Upload Infrastructure (`lib/storage/photos.ts`)
- Configure Supabase Storage bucket `maintenance-photos`
- Create upload utility: accepts file, validates (image type, max 10MB), uploads, returns public URL
- Add `photos` (text[] of URLs) column to maintenance_requests table via migration
- RLS: tenants can upload to their own requests, landlords can view

### 6. Tests
- Test photo upload validation (file type, size limits)
- Test maintenance request submission with photos
- Test dashboard data loading
- Test lease display with various property configurations

## Technical Constraints
- All pages must be mobile-responsive (tenants primarily use phones)
- Photo uploads must validate file type server-side (not just client)
- Use existing shadcn/ui components
- Supabase Storage must have proper RLS on the bucket

## Definition of Done
- Tenants can submit maintenance requests with photos
- Tenants can track request status in real-time
- Dashboard shows lease, payment, and maintenance summary
- All tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE
