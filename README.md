# Stardom University — AI Admission Assistant

An AI-guided admissions funnel for Stardom University: landing page → AI
admissions chat (grounded in a verified knowledge base) → progressive lead
capture → multi-step application → documents → human follow-up.

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for the full system
design, database schema, AI layer, n8n integration, and required
credentials.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Anthropic credentials
```

1. Create a Supabase project, run `supabase/migrations/0001_init.sql`
   against it, and create a private Storage bucket named
   `student-documents`.
2. Seed verified content: `npm run seed`
   (or crawl fresh content: `npm run ingest`)
3. `npm run dev` → http://localhost:3000
4. Admin dashboard: http://localhost:3000/admin (needs `ADMIN_TOKEN`)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build + typecheck |
| `npm run seed` | Load hand-verified knowledge base + programs into Supabase |
| `npm run ingest` | Re-crawl `stardomuniversity.edu.eu` into the knowledge base |
| `npm run ingest:dry-run` | Preview crawl extraction without touching the DB |

## Project structure

```
src/app/            Next.js App Router pages + API routes
src/components/      chat, landing, apply, admin UI
src/lib/             supabase clients, AI (system prompt/retrieval/chat), lead scoring, n8n
supabase/migrations/ database schema (leads, conversations, knowledge_base, programs, ...)
scripts/             ingest-stardom.ts, seed.ts
data/                hand-verified seed content with source_url + last_verified
docs/ARCHITECTURE.md full architecture writeup
```
