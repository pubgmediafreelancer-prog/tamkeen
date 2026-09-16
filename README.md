# Stardom University — AI Admission Assistant

An AI-guided admissions funnel for Stardom University: landing page → AI
admissions chat (grounded in a verified knowledge base) → progressive lead
capture → multi-step application → documents → human follow-up.

**AI layer runs on $0 free tiers**: Google Gemini (primary) with OpenRouter
(fallback), fully provider-agnostic — no Anthropic/Claude dependency.

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full system
design, database schema, AI layer, n8n integration, and required
credentials, and **[docs/SETUP.md](./docs/SETUP.md)** for step-by-step
setup instructions (Supabase, Gemini, OpenRouter, n8n).

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Gemini/OpenRouter credentials
```

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`
   against it, and create a private Storage bucket named
   `student-documents`.
2. Get a free Gemini API key at https://aistudio.google.com/apikey and set
   `GEMINI_API_KEY` (optionally also `OPENROUTER_API_KEY` from
   https://openrouter.ai/keys as a fallback — see `.env.example`).
3. Seed verified content: `npm run seed`
   (or crawl fresh content: `npm run ingest`)
4. `npm run dev` → http://localhost:3000
5. Admin dashboard: http://localhost:3000/admin (needs `ADMIN_TOKEN`)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build + typecheck |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (AI provider failover, retrieval safety, etc.) |
| `npm run seed` | Load hand-verified knowledge base + programs into Supabase |
| `npm run ingest` | Re-crawl `stardomuniversity.edu.eu` into the knowledge base |
| `npm run ingest:dry-run` | Preview crawl extraction without touching the DB |

## Project structure

```
src/app/                  Next.js App Router pages + API routes
src/components/           chat, landing, apply, admin UI
src/lib/ai/providers/     provider-agnostic AI layer (Gemini, OpenRouter, failover)
src/lib/ai/               system prompt, retrieval, chat orchestration
src/lib/                  supabase clients, lead scoring, n8n
supabase/migrations/      database schema (leads, conversations, knowledge_base, programs, ...)
scripts/                  ingest-stardom.ts, seed.ts
data/                     hand-verified seed content with source_url + last_verified
docs/ARCHITECTURE.md      full architecture writeup
docs/SETUP.md             step-by-step setup guide
```
