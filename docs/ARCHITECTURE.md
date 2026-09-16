# Architecture — Stardom University AI Admission Assistant

> **Revision note:** the AI layer originally shipped on Anthropic Claude.
> It has since been replaced end-to-end with a provider-agnostic layer
> running on Google Gemini (free tier, primary) with OpenRouter (free tier,
> fallback) for a $0 MVP cost baseline — see §5 and §11. No Anthropic
> dependency remains anywhere in the codebase.

## 1. Current architecture (before this work)

The repository was empty except for `.mcp.json` (a Stitch MCP server config).
No framework, frontend, backend, database, environment variables,
authentication, API routes, or components existed. This is a greenfield
build.

## 2. Proposed architecture

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4) as a single
full-stack app — server components + API routes — deployed to any Node
host (Vercel, etc.). Supabase (Postgres + Storage + Auth) as the database
and file store. A provider-agnostic AI layer — **Google Gemini (free tier)
as primary, OpenRouter (free tier) as fallback** — powers the Admission
Agent at $0 base cost. n8n as the automation layer. This matches the
brief's "don't overengineer" instruction: one app, one database, no
microservices, no separate agent framework.

```
Traffic → Landing page (Next.js, SSR)
        → AI Chat widget (client) → /api/chat (server)
                                    → retrieval (Supabase: knowledge_base + programs)
                                    → AI Service (provider-agnostic)
                                        → Gemini (free tier, primary)
                                        → OpenRouter (free tier, fallback)
                                        → safe human-advisor fallback (never fabricates)
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
- **AI:** Provider-agnostic (`src/lib/ai/providers/`) — **Gemini** (primary,
  free tier, model configurable via `GEMINI_MODEL`) with **OpenRouter**
  (fallback, free tier, model configurable via `OPENROUTER_MODEL`) as
  failover. No AI vendor SDK is used — both call the vendor's REST API
  directly via `fetch`, so there's no SDK-imposed billing/retry behavior
  and no dependency to swap when a provider changes. **Anthropic/Claude has
  been fully removed** — see §5 and §10.
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

**Provider-agnostic by design** — the rest of the app never imports a
vendor SDK or calls a vendor endpoint directly. Everything goes through
one abstraction:

```
Admission Agent (chat.ts)
      ↓
AI Service (providers/index.ts) — ordered failover
      ↓
  ┌───────────┐      fails →   ┌──────────────┐    fails →  return null
  │  Gemini   │  ───────────►  │  OpenRouter  │  ─────────► (caller shows
  │ (primary) │                │  (fallback)  │             safe fallback)
  └───────────┘                └──────────────┘
```

`src/lib/ai/`:

- `providers/types.ts` — the `AIProvider` interface (`isConfigured()`,
  `generate({system, messages, maxTokens})`) and `AIProviderError`. Adding a
  new vendor later (e.g. a paid provider, a local model) means implementing
  this interface and appending it to the list in `providers/index.ts` —
  nothing else in the app changes.
- `providers/gemini.ts` — calls Google's official Gemini REST API
  (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`)
  directly via `fetch`, authenticated via the `x-goog-api-key` header (the
  current Gemini standard — not the legacy `?key=` query param, which
  risks the key ending up in proxy/error logs). Model is `GEMINI_MODEL`
  (default `gemini-3.6-flash` — **live-verified** with a real key/request,
  not just a web search: `gemini-2.5-flash` now returns a live HTTP 404,
  `"This model ... is no longer available to new users. Please update your
  code to use models/gemini-3.6-flash"`, and the default before that,
  `gemini-2.0-flash`, was shut down by Google on June 1, 2026 — two
  real-world confirmations of exactly the kind of rename/retirement this
  design anticipates; the model is **never hardcoded as a permanent
  assumption**, see `.env.example`). `generationConfig.thinkingConfig:
  {thinkingBudget: 0}` is set explicitly — confirmed live that
  `gemini-3.6-flash` otherwise spends part of `maxOutputTokens` on an
  invisible reasoning trace before any visible text, which can silently
  truncate a small token budget down to empty output; this app needs
  deterministic tagged output, not open-ended reasoning, and disabling
  thinking also avoids burning free-tier quota on invisible tokens. A 20s
  timeout, non-2xx responses, and empty/safety-blocked candidates all
  throw `AIProviderError` (tagged with a coarse `category` — `auth`,
  `rate_limit`, `timeout`, `server_error`, `empty_response`, `network`,
  `model_not_found` (Gemini's 404) — used by the health-check utility, see
  below) so the service fails over rather than showing the student a raw
  error.
- `providers/openrouter.ts` — calls OpenRouter's OpenAI-compatible
  `/chat/completions` endpoint. Model is `OPENROUTER_MODEL`, defaulting to
  `openrouter/free` — OpenRouter's own self-updating Free Models Router,
  which resolves to whatever free-tier model is currently available
  without manual upkeep (chosen after the previous pinned default,
  `meta-llama/llama-3.3-70b-instruct:free`, was confirmed to have left
  OpenRouter's free tier entirely in August 2026 — concrete evidence that
  pinning one free model by name is fragile). **Cost guard:** the provider
  refuses to call any model that isn't `openrouter/free` or `:free`-suffixed
  unless `OPENROUTER_ALLOW_PAID_MODEL=true` is explicitly set — a stale or
  mistyped model id can never silently start incurring cost.
- `providers/index.ts` (`generateAIResponse`) — tries each *configured*
  provider in order (Gemini, then OpenRouter), catching and logging (name +
  reason only — never a key) any failure and moving to the next. If every
  configured provider fails, or none are configured, it returns `null`
  rather than throwing — the caller is required to handle that by showing
  the safe fallback, never by guessing.
- `health.ts` — a server-only utility (`checkProviderHealth()`) that
  exercises each configured provider with a minimal request and reports
  `{ configured, reachable, model, errorCategory }` per provider — never
  a key, header, or raw error string. Used for operational verification
  (e.g. "is Gemini actually reachable with these credentials right now"),
  not wired to any public route — see §13.
- `system-prompt.ts` — the dedicated Admissions Assistant system prompt
  (identity, source-of-truth discipline, no-hallucination rules, admissions
  language discipline, progressive lead collection, EN/AR auto-detect).
  `buildContextBlock()` renders retrieved knowledge + program rows +
  known student profile into the prompt — this is the **only** factual
  input the model receives; it is instructed never to answer from memory.
  Also exports `NO_INFO_FALLBACK` (the exact required sentence for
  "not in the knowledge base") and `PROVIDER_UNAVAILABLE_FALLBACK` (shown
  when every AI provider is down — written by application code, never by a
  model).
- `retrieval.ts` — retrieves `knowledge_base` rows via Postgres full-text
  search (ILIKE fallback), and `programs` rows via structured filtering
  (degree-level + subject keyword detection) rather than fuzzy matching,
  since tuition/duration/requirements must come from exact records.
  `match_knowledge_base()` (pgvector cosine search) is defined in the
  migration and ready to use once an embeddings pipeline populates
  `knowledge_base.embedding` — not required for the MVP. **Unchanged by
  the provider swap** — retrieval is provider-independent by construction.
- `chat.ts` (`generateChatTurn`) — **one** AI call per turn (not two): the
  system prompt requires the model to answer inside a `<reply>` tag and
  emit any newly-learned profile facts as JSON inside a `<profile_update>`
  tag in the same response. `parseTaggedResponse()` extracts both,
  tolerating a model that doesn't follow the format perfectly (falls back
  to using the raw text as the reply, and `{}` for extraction, so the
  student is never shown broken output). This halves API usage against the
  two-call design used with Claude — see §15 "Cost protection", since
  free-tier rate limits are the binding constraint now, not per-token cost.

**Hallucination guardrails:** the system prompt explicitly lists every
"never invent" category from the brief, mandates the exact `NO_INFO_FALLBACK`
sentence (word-for-word) when information isn't in the verified context,
and forbids definitive admission-decision language. This is enforced by
prompt design and is provider-independent — the same rules apply whether
Gemini or OpenRouter answers. A stronger enforcement (e.g., citation-checking
a claim against `sources_used` before sending) is a natural next step once
real traffic is flowing.

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

This environment has **no** Supabase project, Gemini/OpenRouter API key, or
n8n instance configured, and outbound network access to
`stardomuniversity.edu.eu` is blocked for direct fetches (site content was
gathered via the Firecrawl search tool instead — see §6). The app is fully
built and will run correctly once these are supplied:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB/Storage access |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public read-only fallback |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Primary AI provider (free tier) |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Fallback AI provider (free tier) |
| `N8N_WEBHOOK_URL_LEAD_CREATED`, `N8N_WEBHOOK_URL_HOT_LEAD`, `N8N_WEBHOOK_URL_APPLICATION_EVENT` | Automation layer (optional — no-ops if unset) |
| `ADMIN_TOKEN` | Admin dashboard access |

At least one of `GEMINI_API_KEY` / `OPENROUTER_API_KEY` must be set for the
chat to function at all; the chat API returns a clear 500 naming the exact
missing variable if neither is set, rather than failing silently.

Because none of these are present in this container, the app has been
verified with `npm run build` (production build + typecheck passes),
`npm run lint` (clean), and `npm test` (provider-failover logic tested with
mocked `fetch` — see §11) but **not** exercised end-to-end against a live
database or a live Gemini/OpenRouter account — that verification should
happen as soon as credentials are supplied. Live-credential claims are
called out explicitly as such wherever they appear in this repo; anything
not marked "confirmed by live test" was verified by code/unit test only.

## 11. Cost protection & provider failover (design contract)

This MVP is designed so it **cannot** incur unexpected AI cost:

1. Only `GEMINI_MODEL` / `OPENROUTER_MODEL` — both configurable, both
   defaulting to a free-tier model — are ever called. No code path
   upgrades or substitutes a different (potentially paid) model on
   failure; failover only ever switches *provider*, never silently
   switches to a paid *model* within a provider.
2. `OpenRouterProvider` hard-refuses to call a non-`:free` model unless
   `OPENROUTER_ALLOW_PAID_MODEL=true` is explicitly set — see §5.
3. One AI call per chat turn (reply + profile extraction combined via the
   `<reply>`/`<profile_update>` tagged output format), not two — see §5,
   `chat.ts`.
4. Retrieval sends only the top ~6 matching `knowledge_base` rows and ~5
   matching `programs` rows per turn (see `retrieval.ts` `limit`
   parameters) — never the whole site or the whole table.
5. Conversation history sent to the model is capped at the last 30 turns
   (`api/chat/route.ts`, `.limit(30)` on the Supabase query).
6. Failure handling never retries in a loop: each provider is tried
   exactly once per turn, then the service moves on or gives up — no
   exponential backoff that could multiply request volume against a
   rate-limited free tier.

Failover behavior, exactly as implemented in `providers/index.ts`:

```
generateAIResponse(params)
  for provider in [Gemini, OpenRouter]:
    if not provider.isConfigured(): skip
    try: return provider.generate(params)   // success — stop here
    catch: log "<provider> failed, trying next" (no secrets), continue
  return null   // every configured provider failed, or none configured
```

`generateChatTurn()` (`chat.ts`) turns a `null` result into
`PROVIDER_UNAVAILABLE_FALLBACK` — a fixed, human-advisor-pointing sentence
written by application code, never generated by a model — and
`api/chat/route.ts` forces `human_followup_required = true` on the lead in
that case, so a real person is guaranteed to pick up the thread even when
both AI providers are down.

## 12. End-to-end funnel

```
Stardom Official Website (stardomuniversity.edu.eu)
      ↓  (scripts/ingest-stardom.ts / npm run seed)
Knowledge Base (Supabase: knowledge_base, programs — source_url + last_verified on every row)
      ↓  (src/lib/ai/retrieval.ts)
Retrieval (full-text search + structured program filters, top ~6/~5 rows)
      ↓  (src/lib/ai/chat.ts → providers/index.ts)
Gemini Free Tier (primary)
      ↓ on failure
OpenRouter Free (fallback)
      ↓ on failure
Safe human-advisor fallback (never fabricated)
      ↓
AI Admission Agent (src/app/api/chat/route.ts)
      ↓
Lead (Supabase: leads, conversations — progressive capture + HOT/WARM/COLD scoring)
      ↓
Supabase (source of record for leads, applications, documents, events)
      ↓
n8n (lead_created / hot_lead / application_event webhooks — notifications, follow-ups, CRM sync)
      ↓
Application (src/app/apply — 7-step form → applications, documents tables)
      ↓
Human registration (Stardom University admissions team makes the actual enrollment decision)
```

## 13. Provider health-check utility

`src/lib/ai/health.ts` (`checkProviderHealth()`) sends one minimal request
("reply with the word OK") to each *configured* provider independently —
unlike `generateAIResponse()`'s failover path, which stops at the first
success and so never tells you whether the fallback provider is actually
reachable on a day Gemini happens to work fine. For each provider it
reports:

```ts
{ provider: "gemini" | "openrouter", configured: boolean, reachable?: boolean, model: string, errorCategory?: AIErrorCategory }
```

`AIErrorCategory` is one of `not_configured | auth | rate_limit | timeout |
server_error | empty_response | network | config_rejected | unknown` —
enough to diagnose a problem (expired key vs. rate limit vs. a retired
model id) without ever including the key, an auth header, or the raw
upstream response body.

Exposed at `GET /api/admin/ai-health`, gated by the same `requireAdmin`
shared-secret check as every other `/api/admin/*` route (§8) —
deliberately not public, since polling it would burn free-tier request
quota for no reason. This is the mechanism for answering "is Gemini/
OpenRouter actually reachable with these credentials right now" once
real API keys are configured; see the root-level report in this change
for whether that was possible to confirm live in this build environment.

## 14. Live verification log (Sept 2026)

A real `GEMINI_API_KEY` was configured in `.env.local` (never committed)
and exercised end-to-end. Findings that changed the code, in the order
they were discovered:

1. **`gemini-2.5-flash` → live HTTP 404.** Google's own error message named
   the replacement (`gemini-3.6-flash`) directly — stronger evidence than
   any web search, since it came from the API itself using this project's
   real key. Default changed accordingly (§5).
2. **`gemini-3.6-flash` truncated output under a small token budget.** A
   32-token budget came back as `finishReason: MAX_TOKENS` with empty
   text; `usageMetadata.thoughtsTokenCount` showed the model spending
   tokens on an invisible reasoning trace first. Setting
   `generationConfig.thinkingConfig.thinkingBudget = 0` fixed it
   completely — confirmed with an exact-match response on retry.
3. **Arabic replies transliterated "Stardom" into Arabic script**, garbling
   the university's name (e.g. rendering it as something unrelated) while
   getting every fact right (tuition, program, scholarship). Not a
   hallucination of the "never invent tuition/programs/requirements" kind,
   but a real fidelity bug. Fixed by extending the existing "keep program
   names in English" prompt rule to explicitly cover the university's own
   name; confirmed fixed on a live retry.
4. **Intermittent Gemini `503`s and one timeout occurred organically**
   during testing (not staged) — in every case `generateChatTurn()`
   returned the exact `PROVIDER_UNAVAILABLE_FALLBACK` string with
   `providerFailure: true` and made exactly one fetch call (no retry loop,
   no second provider call beyond what was configured) — real-world
   confirmation of the failover design in §11, not just the mocked tests.

What was and wasn't live-tested (OpenRouter had no key configured in this
session, so only Gemini's live behavior and the safe-fallback path were
observed; failing over *to* OpenRouter remains verified by mocked tests
only) is detailed in this change's final report rather than duplicated
here, since that's a point-in-time record rather than a living design doc.
