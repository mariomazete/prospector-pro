# Prospector Pro

**Find local businesses that need a website, understand them, and reach out — in one tool.**

I run a small web agency. To find clients, I was manually searching Google Maps for local businesses without a website so I could offer to build one. It was slow and hard to track, so I built Prospector Pro to automate the whole process.

You pick a country, a city and a niche (dentists, law firms, pet shops…), and it pulls real businesses from Google Places, scores how likely each one is to buy a website, writes a tailored pitch with AI, and lets you send it on WhatsApp and track the deal in a built-in CRM.

I used it in production for my agency's WhatsApp outreach.

---

## The problem

Thousands of small businesses have good reviews and steady customers but no website — or one that is outdated. Finding them by hand on Google Maps is slow: you open each listing, check if there's a site, copy the phone number, write a message, and lose track of who you already contacted.

## What it does

| Step | Feature |
| --- | --- |
| **Search** | Search by country, city and niche using the **Google Places API (New)**. Results stream in as they load. |
| **Score** | Each business gets an **Opportunity Score (0–100)**: no website (+50), rating ≥ 4.5 (+20), 100+ reviews (+20), local business (+10). The best prospects rise to the top. |
| **Enrich** | Finds contact **emails** by crawling the business's site (homepage + common contact pages), with a web-search fallback. |
| **Analyze** | An LLM writes a **strategic analysis** of each specific business (pains, opportunities, best angle), in the local language of its country. |
| **Pitch** | A second AI step turns that analysis into ready-to-send **outreach messages** — grounded in the analysis, not generic templates. |
| **Contact** | One-click **WhatsApp** send through a companion Chrome extension that reuses the open WhatsApp Web tab instead of opening duplicates. |
| **Track** | A **CRM pipeline** with statuses, favorites, notes and a per-company timeline of events. |

## Architecture

```
Browser (React + TanStack Router)
   │
   ├─ Search ─► TanStack Start server functions ─► Google Places API (via connector gateway)
   │                     │
   │                     ├─► Supabase: prospector_cache (14-day TTL)  ← avoids paying twice for the same search
   │                     ├─► Supabase: companies / pipeline / events
   │                     └─► LLM (Gemini 2.5 Flash): analysis + pitch generation
   │
   └─ "Send WhatsApp" ─► Chrome extension ─► existing WhatsApp Web tab
```

### Key decisions

- **Server-side API calls only.** Google Places and the LLM are called from server functions, so no paid API key is ever shipped to the browser.
- **Search cache with a 14-day TTL.** Places API calls are billed per request. Identical searches are served from Supabase instead of hitting Google again, which cut cost and made repeat searches instant.
- **Row Level Security on every table.** Each user only sees their own pipeline, notes and history; cache tables are writable only by the server role.
- **Two-step AI (analyze → pitch).** Asking the model for a pitch directly produced generic messages. Generating a business-specific analysis first, and using it as the "source of truth" for the pitch, made the messages concrete and avoided invented facts.
- **A Chrome extension instead of `wa.me` links.** Every `wa.me` link opened a new WhatsApp Web tab. The extension focuses and reuses the existing tab, which matters when you send dozens of messages in a session.
- **Exposed as an MCP tool.** `search_businesses` is also available over MCP, so an AI assistant can run prospecting searches directly.

## Tech stack

- **Frontend:** React, TypeScript, TanStack Start / Router, Tailwind CSS, shadcn/ui
- **Backend:** TanStack Start server functions, Supabase (Postgres, Auth, RLS)
- **APIs:** Google Places API (New), LLM via AI gateway (Gemini 2.5 Flash)
- **Extras:** Chrome extension (Manifest V3), MCP server endpoint
- **Built with:** AI-assisted development (Lovable + Claude), with the architecture and product decisions above made by me

## Project structure

```
src/
  routes/                 # pages (search, CRM) and API/MCP endpoints
  components/prospector/  # search filters, results table, business modal, score badge
  lib/
    prospector-core.ts    # Places search, caching, mapping to the Business model
    prospector.functions.ts # server functions: search, AI analysis, pitch generation
    find-emails.functions.ts # email discovery
    companies-client.ts   # CRM pipeline, statuses, timeline
    mcp/                  # MCP tool definitions
extension/                # WhatsApp connector Chrome extension
supabase/migrations/      # database schema and RLS policies
```

## Running locally

```bash
npm install
cp .env.example .env   # fill in your own Supabase project values
npm run dev
```

You need a Supabase project (run the SQL in `supabase/migrations/`) and server-side credentials for Google Places and the LLM gateway. The Places/LLM keys are read from server environment variables and are not part of this repository.

## Status

No longer in active use — kept as a portfolio project.

---

Built by **Mário Mazete** · [github.com/mariomazete](https://github.com/mariomazete)
