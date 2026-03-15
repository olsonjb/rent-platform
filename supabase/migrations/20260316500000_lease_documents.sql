-- T15: Document Intelligence — lease_documents + extraction job queue

-- 1. lease_documents table
create table if not exists public.lease_documents (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  file_url text not null,
  file_name text not null,
  extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'completed', 'failed')),
  extracted_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lease_documents_landlord_id_idx
  on public.lease_documents (landlord_id);

create index if not exists lease_documents_extraction_status_idx
  on public.lease_documents (extraction_status);

alter table public.lease_documents enable row level security;

create policy "landlord select own documents"
  on public.lease_documents for select
  using (auth.uid() = landlord_id);

create policy "landlord insert own documents"
  on public.lease_documents for insert
  with check (auth.uid() = landlord_id);

create policy "landlord update own documents"
  on public.lease_documents for update
  using (auth.uid() = landlord_id);

create policy "landlord delete own documents"
  on public.lease_documents for delete
  using (auth.uid() = landlord_id);

-- 2. document_extraction_jobs table
create table if not exists public.document_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.lease_documents(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists document_extraction_jobs_status_idx
  on public.document_extraction_jobs (status);

create index if not exists document_extraction_jobs_document_id_idx
  on public.document_extraction_jobs (document_id);

-- updated_at trigger
create trigger document_extraction_jobs_updated_at
  before update on public.document_extraction_jobs
  for each row execute function public.set_updated_at();

-- 3. Trigger: auto-enqueue extraction job on lease_documents insert
create or replace function public.enqueue_document_extraction()
returns trigger as $$
begin
  insert into public.document_extraction_jobs (document_id)
  values (new.id);
  return new;
end;
$$ language plpgsql;

create trigger lease_documents_enqueue_extraction
  after insert on public.lease_documents
  for each row execute function public.enqueue_document_extraction();
