# Setup guide

Step-by-step setup for a fresh environment. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for *why* things are built this way —
this doc is just the checklist to get it running.

Nothing in this guide asks you to paste a credential anywhere but your own
`.env.local` (local dev) or your deployment platform's secret manager
(production). Never commit real credentials — `.env.local` is already
git-ignored (see `.gitignore`); only `.env.example` (no real values) is
tracked.

## 1. Supabase (database + storage)

1. Create a project at https://supabase.com.
2. In the SQL editor, run the contents of
   `supabase/migrations/0001_init.sql` — this creates every table
   (`knowledge_base`, `programs`, `leads`, `conversations`, `documents`,
   `applications`, `application_events`, `campaigns`), enables Row Level
   Security, and installs the `pgvector` extension (used only if/when you
   later wire up embeddings — not required for the MVP).
3. In Storage, create a **private** bucket named `student-documents`.
   Never make this bucket public — see ARCHITECTURE.md §8/§17.
4. Copy your project's URL and keys into `.env.local`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API —
     the **service_role** key, server-only, never exposed to the browser)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
     **anon** key — safe to expose, only reads `active` rows per RLS)

## 2. AI providers — Gemini (primary, free) + OpenRouter (fallback, free)

Both are optional in the sense that only one is strictly required for chat
to work, but configuring both gives you real failover.

### Gemini

1. Get a free API key at https://aistudio.google.com/apikey.
2. Set `GEMINI_API_KEY` in `.env.local`.
3. `GEMINI_MODEL` defaults to `gemini-2.0-flash` if unset. Check
   https://ai.google.dev/gemini-api/docs/pricing for the current free-tier
   model list before going live — Google renames/retires these over time,
   and this app only ever calls exactly the model you configure.

### OpenRouter

1. Get a free API key at https://openrouter.ai/keys.
2. Set `OPENROUTER_API_KEY` in `.env.local`.
3. `OPENROUTER_MODEL` defaults to `meta-llama/llama-3.3-70b-instruct:free`.
   Browse the current free roster at
   https://openrouter.ai/models?max_price=0 — **the model you set must end
   in `:free`**, or the app refuses to call it (cost protection — see
   ARCHITECTURE.md §11). Only set `OPENROUTER_ALLOW_PAID_MODEL=true` if you
   deliberately want to pay for a specific model.

### Verifying it's wired up

With `GEMINI_API_KEY` (and/or `OPENROUTER_API_KEY`) set and the dev server
running, open the chat widget and ask a question. The API response's
`provider` field tells you which one answered (`"gemini"` or
`"openrouter"`); `null` means both failed or neither is configured — check
your server logs (`[ai] provider "..." failed, trying next: ...`) for the
reason (never logged with the API key itself).

## 3. Knowledge base

```bash
npm run seed          # loads data/knowledge-base-seed.json + programs-seed.json
# or
npm run ingest        # fresh crawl of stardomuniversity.edu.eu
npm run ingest:dry-run  # preview extraction without touching the DB
```

Re-run `npm run ingest` periodically (e.g. monthly, or after a known site
update) to keep `last_verified` fresh.

## 4. n8n (optional — automation layer)

The app works standalone without n8n; these just enable notifications.

1. In n8n, create a Webhook-triggered workflow for each event you want to
   handle: new lead, hot lead, application event.
2. Copy each webhook's URL into `.env.local`:
   `N8N_WEBHOOK_URL_LEAD_CREATED`, `N8N_WEBHOOK_URL_HOT_LEAD`,
   `N8N_WEBHOOK_URL_APPLICATION_EVENT`.
3. Leave any of them unset to no-op that event — the app never depends on
   n8n to function. AI provider API keys are never sent to n8n; only the
   lead/application record itself is in the webhook payload.

## 5. Admin dashboard

Set `ADMIN_TOKEN` to any strong random string in `.env.local`. Visit
`/admin` and enter it once — it's stored in `sessionStorage` for that
browser tab only. This is MVP-level shared-secret auth; see
ARCHITECTURE.md §8 for the recommended production replacement (Supabase
Auth + the `admin` RLS policies already written in the migration).

## 6. Run it

```bash
npm install
npm run build   # production build + typecheck
npm run lint    # should be clean
npm test        # unit tests — see ARCHITECTURE.md §11 for what's covered
npm run dev     # http://localhost:3000
```

## Environment variable reference

See `.env.example` for the full, current list with inline comments — it is
the source of truth. Do not duplicate values here; they will drift.
