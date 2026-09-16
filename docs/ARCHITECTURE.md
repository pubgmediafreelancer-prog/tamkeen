# Architecture — Stardom University AI Admission Assistant

## 1. Current architecture (before this work)

The repository was empty except for `.mcp.json` (a Stitch MCP server config).
No framework, frontend, backend, database, environment variables,
authentication, API routes, or components existed. This is a greenfield
build.

## 2. Proposed architecture

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4) as a single
full-stack app — server components + API routes — deployed to any Node
host (Vercel, etc.). Supabase (Postgres + Storage + Auth) as the database
and file store. Anthropic Claude as the AI layer. n8n as the automation
layer. This matches the brief's "don't overengineer" instruction: one app,
one database, no microservices, no separate agent framework.

```
Traffic → Landing page (Next.js, SSR)
        → AI Chat widget (client) → /api/chat (server)
                                    → retrieval (Supabase: knowledge_base + programs)
                                    → Claude (system prompt + verified context)
                                    → lead upsert + conversation log (Supabase)
                                    → n8n webhook (lead_created / hot_lead)
        → /apply (multi-step form) → /api/applications, /api/documents
                                    → Supabase (applications, documents, Storage)
                                    → n8n webhook (application_event)
        → /admin (token-gated)     → /api/admin/leads[/:id]
```

## 3. Technologies

- **Framework:** Next.js 16 App Router, TypeScript, Tailwind v4.
- **Database:** Supabase Postgres (see `supabase/migrations/0001_init.sql`).
- **Storage:** Supabase Storage, private bucket `student-documents`.
- **AI:** Anthropic Claude via `@anthropic-ai/sdk` (model configurable via
  `ANTHROPIC_MODEL`, defaults to `claude-sonnet-5`).
- **Automation:** n8n via outbound webhooks (this app never depends on n8n
  to function — every webhook call is a fire-and-forget no-op if the URL
  env var is unset).
- **Validation:** zod on every API route.

## 4. Database

Full schema in `supabase/migrations/0001_init.sql`:

- `knowledge_base` — verified facts, one row per fact/chunk, always carrying
  `source_url` + `last_verified` + `category`. Full-text search via
  `to_tsvector`; optional `pgvector` column (`embedding`) for semantic
  search once an embeddings pipeline is wired up (see §6).
- `programs` — structured program records (tuition, duration, requirements,
  documents, scholarships), each with `source_url` + `last_verified` +
  `active`. This is the **only** source the AI is allowed to recommend
  programs from.
- `leads` — the core acquisition record; every full field from the brief's
  spec (personal, contact, address, academic, program interest, marketing
  attribution, lead scoring/status).
- `conversations` — full transcript per `session_id`, with `sources_used`
  (jsonb) recording which knowledge/program rows backed each AI reply, for
  auditability.
- `documents` — metadata only; files live in private Supabase Storage, never
  a public bucket.
- `applications` / `application_events` — application lifecycle + funnel
  analytics events (`page_view` → … → `enrollment_confirmed`).
- `campaigns` — attribution reference table.
- Row Level Security is enabled on every table. The Next.js server uses the
  Supabase **service role** key for all reads/writes (RLS bypass by
  design, since the server is the trust boundary); RLS policies exist as
  defense-in-depth: `programs`/`knowledge_base` allow public read of
  `active` rows (for a client-side fallback), everything else is
  service-role-only, with an `admin` policy stubbed in for a future
  Supabase Auth migration.

## 5. AI layer

`src/lib/ai/`:

- `system-prompt.ts` — the dedicated Admissions Assistant system prompt
  (identity, source-of-truth discipline, no-hallucination rules, admissions
  language discipline, progressive lead collection, EN/AR auto-detect).
  `buildContextBlock()` renders retrieved knowledge + program rows +
  known student profile into the prompt — this is the **only** factual
  input the model receives; it is instructed never to answer from memory.
- `retrieval.ts` — retrieves `knowledge_base` rows via Postgres full-text
  search (ILIKE fallback), and `programs` rows via structured filtering
  (degree-level + subject keyword detection) rather than fuzzy matching,
  since tuition/duration/requirements must come from exact records.
  `match_knowledge_base()` (pgvector cosine search) is defined in the
  migration and ready to use once an embeddings pipeline populates
  `knowledge_base.embedding` — not required for the MVP.
- `chat.ts` — two Claude calls per turn: (1) the conversational reply
  grounded in the context block, (2) a best-effort structured-extraction
  call that pulls new profile facts (name, nationality, desired program,
  contact info, "wants to apply", "wants human") as JSON, merged into the
  lead record. Extraction failures never break the chat turn.

**Hallucination guardrails:** the system prompt explicitly lists every
"never invent" category from the brief, mandates the exact fallback
sentence when information isn't in the verified context, and forbids
definitive admission-decision language. This is enforced by prompt design
today; a stronger enforcement (e.g., citation-checking a claim against
`sources_used` before sending) is a natural next step once real traffic is
flowing.

## 6. Knowledge base

Two ways to populate it:

1. **`npm run seed`** — loads `data/knowledge-base-seed.json` (13 entries)
   and `data/programs-seed.json` (11 programs), hand-verified against the
   live site during this build (September 2026) via targeted search of
   `stardomuniversity.edu.eu`, each with a real `source_url` and
   `last_verified` date. This is the fastest path to a working demo.
2. **`npm run ingest`** (`scripts/ingest-stardom.ts`) — a reusable crawler:
   fetches each allowed `stardomuniversity.edu.eu` page, strips
   nav/header/footer/script noise, dedupes paragraphs, chunks to ~1500
   chars, heuristically categorizes by URL pattern, and upserts into
   `knowledge_base` keyed on `(source_url, title)`. Re-run periodically to
   refresh `last_verified` and catch site changes. It hard-refuses any
   domain other than `stardomuniversity.edu.eu` (§8 of the brief).

**What was NOT captured** (and is intentionally absent rather than
guessed): the full 47-Master's/37-Doctoral program catalog (only 11
programs with fully-captured, unambiguous names were seeded — see the
`PROGRAMS` category note in the knowledge base for why), the exact
Bachelor's-level application fee, and live FAQ accordion content. The AI's
"I don't have verified information about that" fallback is exactly what
should fire for these — that's the intended behavior, not a bug.

## 7. n8n integration

`src/lib/n8n/notify.ts` fires three typed webhook events — `lead_created`,
`hot_lead`, `application_event` — to URLs configured via
`N8N_WEBHOOK_URL_*` env vars. Each call is fire-and-forget and logs a
warning (never throws) if the URL isn't set, so the app works standalone
without n8n. All business logic (notification formatting, follow-up
cadence, CRM sync) belongs in the n8n workflows themselves, per the brief —
this app only emits facts.

Suggested n8n workflows to build (not included as this app has no n8n
credentials configured in this environment — see §10):
- **New Lead**: validate → normalize phone/email → dedupe → notify admin →
  create follow-up task.
- **Hot Lead**: immediate admin notification with student + academic + lead
  + conversation summary (payload already includes the full lead row).
- **Follow-up**: nudge students who started but didn't finish an
  application, driven off `application_events`.

## 8. Authentication

- **Public chat/apply flows:** no login required (by design — this is a
  lead-gen funnel). Session identity is a client-generated UUID persisted
  in `localStorage` (`src/lib/utils/session.ts`), used to tie
  conversations → lead → application together across visits.
- **Admin dashboard:** MVP-level shared-secret auth (`ADMIN_TOKEN` env var,
  checked in `src/lib/admin/auth.ts`). This is intentionally minimal for
  the MVP and documented as such — replace with Supabase Auth once real
  admin users exist; the RLS policies for `role = 'admin'` in
  `app_metadata` are already written in the migration, ready for that
  swap.

## 9. Deployment requirements

1. Create a Supabase project; run `supabase/migrations/0001_init.sql`
   against it (SQL editor or CLI); create a private Storage bucket named
   `student-documents`.
2. Copy `.env.example` → `.env.local` and fill in every credential (see
   §10 — nothing here works without them).
3. `npm run seed` to load the verified knowledge base + programs (or
   `npm run ingest` for a fresh crawl).
4. `npm run build && npm start`, or deploy to Vercel/any Node host with the
   same env vars set.
5. Point n8n workflows at the `N8N_WEBHOOK_URL_*` endpoints once built.

## 10. Required credentials (not available in this build environment)

This environment has **no** Supabase project, Anthropic API key, or n8n
instance configured, and outbound network access to
`stardomuniversity.edu.eu` is blocked for direct fetches (site content was
gathered via the Firecrawl search tool instead — see §6). The app is fully
built and will run correctly once these are supplied:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB/Storage access |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public read-only fallback |
| `ANTHROPIC_API_KEY` | Powers the AI Admission Agent — chat returns a clear 500 error naming this variable if unset |
| `N8N_WEBHOOK_URL_LEAD_CREATED`, `N8N_WEBHOOK_URL_HOT_LEAD`, `N8N_WEBHOOK_URL_APPLICATION_EVENT` | Automation layer (optional — no-ops if unset) |
| `ADMIN_TOKEN` | Admin dashboard access |

Because none of these are present in this container, the app has been
verified with `npm run build` (production build + typecheck passes) but
**not** exercised end-to-end against a live database or live model — that
verification should happen as soon as credentials are supplied.
