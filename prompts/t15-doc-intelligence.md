# TASK T15: Document Intelligence (Lease PDF Extraction)

You are an autonomous agent working on the `rent-platform` repository. Your task is to build an AI pipeline that extracts structured data from uploaded lease PDFs and auto-populates property and lease records.

## Acceptance Criteria

### 1. PDF Upload Infrastructure
- Add Supabase Storage bucket `lease-documents` with RLS (landlord upload, landlord read)
- Create upload endpoint or server action: validates PDF type, max 20MB, stores file
- Store reference in `lease_documents` table: id, landlord_id, property_id (nullable), file_url, file_name, extraction_status (pending/processing/completed/failed), extracted_data (jsonb), created_at

### 2. Extraction Agent (`lib/agent/document-extraction.ts`)
- Accept a PDF from Supabase Storage
- Convert PDF to text (use `pdf-parse` npm package or Supabase edge function)
- Send text to Claude with a structured extraction prompt requesting:
  - Tenant name(s)
  - Property address (street, city, state, zip)
  - Monthly rent amount
  - Lease start date and end date
  - Security deposit amount
  - Pet policy
  - Parking policy
  - Quiet hours
  - Late fee terms
  - Early termination terms
  - Landlord/manager contact info
- Return as typed JSON matching the property/lease schema

### 3. Extraction Review Flow
- After extraction, show landlord a review page:
  - Side-by-side: original PDF viewer (embedded or link) and extracted fields
  - Each field is editable (pre-filled with AI extraction)
  - "Confirm & Create" button that creates/updates property and lease records
  - "Re-extract" button to retry with Claude
- Never auto-create records — landlord confirms first

### 4. Property/Lease Auto-Population
- On confirmation, create or update:
  - Property record with extracted address, policies, rent
  - Lease record with dates, rent amount, tenant reference
  - If tenant name matches existing landlord_tenant, link automatically
- Handle partial extractions gracefully (some fields may be unextractable)

### 5. Extraction Job Queue
- Follow existing async job pattern (claim/process/retry)
- `document_extraction_jobs` table
- Trigger on lease_documents insert
- Max 3 retries with exponential backoff

### 6. Tests
- Test PDF text extraction (mock pdf-parse)
- Test Claude extraction prompt with sample lease text
- Test partial extraction handling (missing fields)
- Test review confirmation creates correct records
- Test job queue lifecycle

## Technical Constraints
- PDF parsing must handle scanned documents gracefully (if text extraction fails, show "unable to extract" rather than crash)
- Claude's context window can handle ~75 pages of lease text — for longer documents, extract first 50 pages
- Don't store extracted PII longer than needed — extracted_data is cleared after confirmation
- Install `pdf-parse` as a dependency

## Definition of Done
- Landlord can upload a lease PDF
- AI extracts key terms into structured fields
- Landlord reviews and confirms before records are created
- Extraction job queue works with retry logic
- Tests pass, build passes

When ALL acceptance criteria are met and verified, output exactly: TASK_COMPLETE
