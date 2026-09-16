-- Stardom University AI Admission Assistant — initial schema
-- Run against a Supabase Postgres project. Requires the pgvector extension
-- for semantic search on knowledge_base.embedding (falls back to plain
-- keyword/SQL retrieval if pgvector or embeddings are unavailable).

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============================================================
-- knowledge_base — verified, source-linked facts about the university
-- ============================================================
create table if not exists knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in (
    'UNIVERSITY','PROGRAMS','ADMISSIONS','APPLICATION','TUITION',
    'SCHOLARSHIPS','INTERNATIONAL','RECOGNITION','DEGREE_AUTHENTICATION',
    'FAQ','POLICIES','CONTACT','OTHER'
  )),
  content text not null,
  source_url text not null,
  source_title text,
  language text not null default 'en' check (language in ('en','ar')),
  last_verified date not null default current_date,
  status text not null default 'active' check (status in ('active','stale','retracted')),
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table knowledge_base add constraint knowledge_base_source_title_unique unique (source_url, title);

create index if not exists knowledge_base_category_idx on knowledge_base (category);
create index if not exists knowledge_base_status_idx on knowledge_base (status);
create index if not exists knowledge_base_content_trgm_idx on knowledge_base using gin (to_tsvector('english', content));

-- ============================================================
-- programs — structured, authoritative program records
-- ============================================================
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  program_name text not null,
  degree_level text not null check (degree_level in ('HIGHER_DIPLOMA','BACHELOR','MASTER','DOCTORATE')),
  faculty text not null,
  school text,
  description text,
  duration text,
  study_mode text default 'Online',
  language text default 'English',
  tuition text,
  application_fee text,
  requirements text,
  documents_required text,
  scholarship_information text,
  source_url text not null,
  last_verified date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table programs add constraint programs_name_level_unique unique (program_name, degree_level);

create index if not exists programs_degree_level_idx on programs (degree_level);
create index if not exists programs_faculty_idx on programs (faculty);
create index if not exists programs_active_idx on programs (active);

-- ============================================================
-- leads — the core acquisition record
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),

  first_name text,
  middle_name text,
  last_name text,
  gender text,
  marital_status text,
  date_of_birth date,

  nationality text,
  country_of_residence text,

  passport_number text,
  passport_expiry_date date,

  primary_phone text,
  alternative_phone text,
  email text,

  address text,
  city text,
  state_province text,
  country text,

  employment_status text,
  current_job_sector text,

  education_level text,
  certificate_type text,
  track text,
  percentage text,
  gpa text,
  graduation_year text,
  education_country text,

  desired_level text,
  desired_faculty text,
  desired_program text,
  alternative_program text,
  intended_start text,

  preferred_language text default 'en',
  preferred_contact_method text,

  lead_status text not null default 'NEW' check (lead_status in (
    'NEW','CONTACTED','QUALIFIED','APPLICATION_STARTED','APPLICATION_SUBMITTED',
    'ENROLLED','LOST','UNRESPONSIVE'
  )),
  lead_score text check (lead_score in ('HOT','WARM','COLD')),
  human_followup_required boolean not null default false,
  human_followup_reason text,

  source text,
  landing_page text,
  referrer text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,

  session_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_email_idx on leads (lower(email));
create index if not exists leads_phone_idx on leads (primary_phone);
create index if not exists leads_session_idx on leads (session_id);
create index if not exists leads_score_idx on leads (lead_score);
create index if not exists leads_status_idx on leads (lead_status);

-- ============================================================
-- conversations — full chat transcript, tied to a session + lead
-- ============================================================
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  lead_id uuid references leads(id) on delete set null,
  role text not null check (role in ('user','assistant','system')),
  message text not null,
  intent text,
  sources_used jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_session_idx on conversations (session_id, created_at);
create index if not exists conversations_lead_idx on conversations (lead_id);

-- ============================================================
-- documents — secure uploads tied to a lead
-- ============================================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  document_type text not null check (document_type in (
    'PHOTO','PASSPORT','HIGH_SCHOOL_DIPLOMA','BACHELOR_DEGREE','MASTER_DEGREE',
    'ACADEMIC_TRANSCRIPT','ENGLISH_CERTIFICATE','OTHER_CERTIFICATE','OTHER_ATTACHMENT'
  )),
  file_path text not null, -- private storage bucket path, never public
  status text not null default 'UPLOADED' check (status in ('UPLOADED','VERIFIED','REJECTED')),
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists documents_lead_idx on documents (lead_id);

-- ============================================================
-- applications — formal application lifecycle
-- ============================================================
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  program_id uuid references programs(id),
  status text not null default 'DRAFT' check (status in (
    'DRAFT','IN_PROGRESS','READY_FOR_REVIEW','SUBMITTED','NEEDS_DOCUMENTS',
    'UNDER_REVIEW','ADMISSION_DECISION','ENROLLED','REJECTED','WITHDRAWN'
  )),
  application_number text unique,
  form_data jsonb default '{}'::jsonb,
  submitted_at timestamptz,
  review_status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_lead_idx on applications (lead_id);
create index if not exists applications_status_idx on applications (status);

-- ============================================================
-- application_events — audit trail / funnel analytics events
-- ============================================================
create table if not exists application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  event_type text not null check (event_type in (
    'page_view','chat_started','question_asked','program_viewed','lead_created',
    'lead_qualified','application_started','application_step_completed',
    'application_completed','document_uploaded','application_submitted',
    'enrollment_confirmed'
  )),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists application_events_type_idx on application_events (event_type);
create index if not exists application_events_lead_idx on application_events (lead_id);
create index if not exists application_events_created_idx on application_events (created_at);

-- ============================================================
-- campaigns — marketing attribution reference table
-- ============================================================
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  utm_campaign text,
  utm_source text,
  utm_medium text,
  landing_page text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kb_updated_at on knowledge_base;
create trigger trg_kb_updated_at before update on knowledge_base
  for each row execute function set_updated_at();

drop trigger if exists trg_programs_updated_at on programs;
create trigger trg_programs_updated_at before update on programs
  for each row execute function set_updated_at();

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

drop trigger if exists trg_applications_updated_at on applications;
create trigger trg_applications_updated_at before update on applications
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- All tables are locked down by default. The Next.js server uses the
-- Supabase SERVICE ROLE key (server-only, never shipped to the client) for
-- all reads/writes, so these policies exist as defense-in-depth against
-- any accidental use of the anon/public key.
-- ============================================================
alter table knowledge_base enable row level security;
alter table programs enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;
alter table documents enable row level security;
alter table applications enable row level security;
alter table application_events enable row level security;
alter table campaigns enable row level security;

-- Public (anon) read-only access to verified, active knowledge + programs
-- so a client-side fallback can render program info without a server hop.
-- No policy is created for leads/conversations/documents/applications —
-- those are service-role-only by omission (RLS default-denies).
drop policy if exists "public can read active programs" on programs;
create policy "public can read active programs" on programs
  for select using (active = true);

drop policy if exists "public can read active knowledge" on knowledge_base;
create policy "public can read active knowledge" on knowledge_base
  for select using (status = 'active');

-- Admin dashboard access: authenticated users with an 'admin' app_metadata
-- role. Adjust to your real auth setup before relying on this in production.
drop policy if exists "admins can manage leads" on leads;
create policy "admins can manage leads" on leads
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage conversations" on conversations;
create policy "admins can manage conversations" on conversations
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage documents" on documents;
create policy "admins can manage documents" on documents
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage applications" on applications;
create policy "admins can manage applications" on applications
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage application_events" on application_events;
create policy "admins can manage application_events" on application_events
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage knowledge_base" on knowledge_base;
create policy "admins can manage knowledge_base" on knowledge_base
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage programs" on programs;
create policy "admins can manage programs" on programs
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admins can manage campaigns" on campaigns;
create policy "admins can manage campaigns" on campaigns
  for all using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- Semantic search helper (used when embeddings are populated)
-- ============================================================
create or replace function match_knowledge_base(
  query_embedding vector(1536),
  match_count int default 5,
  filter_category text default null
)
returns table (
  id uuid,
  title text,
  category text,
  content text,
  source_url text,
  source_title text,
  similarity float
)
language sql stable
as $$
  select
    kb.id, kb.title, kb.category, kb.content, kb.source_url, kb.source_title,
    1 - (kb.embedding <=> query_embedding) as similarity
  from knowledge_base kb
  where kb.status = 'active'
    and kb.embedding is not null
    and (filter_category is null or kb.category = filter_category)
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;
