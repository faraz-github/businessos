# Business OS

Personal & Agency Business Operating System — built for a freelance developer and designer transitioning into an agency.

## Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4 + Custom Design System (DASH.DS)
- **Database:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Auth:** @supabase/ssr (server-side sessions)
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Animation:** Framer Motion
- **Package Manager:** pnpm

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up Supabase

Create a Supabase project at [supabase.com](https://supabase.com). Copy your project URL and anon key.

```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

### 3. Run migrations

Using Supabase CLI:

```bash
supabase db push
```

Or run the SQL files manually in the Supabase SQL editor:
1. `supabase/migrations/001_schema.sql` — Tables, indexes, triggers
2. `supabase/migrations/002_rls_policies.sql` — RLS policies, storage bucket

### 4. Start development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

### Two Modes
- **Personal** — Private workspace for the owner
- **Agency** — Supports role-based access (owner + BD)

### Key Features
- Brand Settings (Personal + Agency profiles)
- Attention Feed (auto-generated action items)
- Client Pipeline (17-stage project lifecycle)
- Document Engine (6 doc types with PDF + e-signature)
- Composers (Email + WhatsApp templates)
- Social Brand Management (LinkedIn + GitHub)
- Finance (Invoices, Transactions, Subscriptions)
- BD Pipeline (Kanban with Supabase Realtime)

### Data Isolation
All data is scoped by `user_id` and `mode` (personal/agency). RLS policies enforce this at the database level.

## File Structure

```
app/
  dashboard/
    personal/     — Personal dashboard pages
    agency/       — Agency dashboard pages
    actions/      — Server actions
  auth/           — Login + callback
  doc/[token]/    — Public document view + e-signature
components/
  ui/             — Primitives (Button, Input, Card, Modal, etc.)
  dashboard/      — Layout (Sidebar, TopBar, ModeSwitch)
  charts/         — Recharts wrappers
lib/
  supabase/       — Client, server, middleware
  brand/          — Brand context + hooks
  utils/          — Formatting, dates, currency
types/            — TypeScript types + Zod schemas
hooks/            — Custom React hooks
supabase/
  migrations/     — SQL migration files
```
