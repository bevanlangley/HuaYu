# HuaYu (華語) — AI Codebase Guide

HuaYu is a personal Taiwanese Mandarin acquisition environment. It connects external learning
sources (Seeds) to a phrase library (Phrases) and deploys that library in AI-generated scripted
conversations (Dialogues — Phase 2). Built as a single-page React app with no custom backend;
all data goes directly from the browser to Supabase. Phase 1 (current target) covers Seeds CRUD,
Phrases CRUD, global Phrases view, TTS audio playback, and fluency drilling.

**Critical constraint:** All TTS and AI-generated content must use `zh-TW` Taiwanese Mandarin —
this is an architectural requirement, not a preference.

---

## Workflow Rules
- **Deploy after every meaningful change**: `git push` to `main` triggers Vercel auto-deploy.
  Verify the Vercel dashboard shows a successful build before considering a task done.
- **Phase discipline**: Do not scaffold Phase 2 or Phase 3 features during Phase 1. Schema
  definitions exist for forward-compatibility only — do not create Phase 2 tables yet.
- **No `window.confirm()`**: Always use the global `<ConfirmDialog>` singleton (see Patterns).
- **Always use `logger`**: Every Supabase call and error path must go through `src/lib/logger.ts`.
- **Forms use react-hook-form + zod**: No exceptions. Schemas live in `src/lib/schemas/`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5, Vite 5 |
| Routing | React Router 6 (client-side only, no SSR) |
| Styling | Tailwind CSS 3 + shadcn/ui (Neutral base, CSS variables) |
| Icons | Lucide React (sizes: 16/20/24px, stroke 1.5px) |
| Forms | react-hook-form + zod + @hookform/resolvers |
| Toasts | sonner |
| Class utils | clsx + tailwind-merge (via `cn()` in `src/lib/utils.ts`) |
| Database | Supabase (Postgres, JS client v2, single-user auth, RLS enabled) |
| TTS | Web Speech API — browser-native, `zh-TW` locale only |
| AI — Text | Anthropic API (Phase 2 only — user-supplied key stored in localStorage) |
| Testing | Vitest + @testing-library/react (unit), Playwright (E2E) |
| Deployment | Vercel (auto-deploy on push to `main`) |

No custom backend. No SSR. No API routes. Vercel serves the static build.

---

## Project Structure

```
HuaYu/
├── .claude/memory/          # AI agent topic files (see MEMORY.md index)
├── PRD/                     # Product requirements documents (source of truth)
├── .env.local               # Never committed — VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.example             # Committed — documents all required vars
├── vite.config.ts
├── tailwind.config.js       # Custom tokens: primary, secondary, grey, semantic
├── src/
│   ├── main.tsx             # Entry — env guard, app mount
│   ├── App.tsx              # Router setup
│   ├── index.css            # Tailwind + CSS variable definitions
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client singleton
│   │   ├── database.types.ts # Generated — run `supabase gen types` after schema changes
│   │   ├── logger.ts        # Log utility (debug/info/warn/error, dev-only for debug+info)
│   │   ├── utils.ts         # cn() helper
│   │   └── schemas/         # Zod schemas: seeds.ts, phrases.ts, auth.ts (one per entity)
│   ├── components/
│   │   ├── ui/              # shadcn primitives + Skeleton, Pagination, AudioPlayButton
│   │   ├── layout/          # AppShell, Sidebar, BottomNav, Header
│   │   └── shared/          # ErrorBoundary, ErrorPage, ConfirmDialog (singleton)
│   ├── context/             # AuthContext, ConfirmDialogContext, TtsContext
│   └── features/
│       ├── auth/            # LoginPage, RequireAuth (route gate)
│       ├── seeds/           # SeedsList, SeedCard, SeedForm (modal)
│       ├── phrases/         # PhrasesList, PhraseCard, PhraseForm (modal), GlobalPhrases
│       └── drilling/        # DrillingMode, DrillingControls
├── supabase/migrations/     # SQL migrations (RLS policies, schema changes)
```

---

## Build & Run Commands

```bash
# Type check
npx tsc -b --noEmit

# Run all unit tests
npx vitest run

# Run single test file
npx vitest run src/path/to/file.test.ts

# E2E tests
npx playwright test

# Production build
npm run build

# Dev server
npm run dev

# Regenerate Supabase types (run after any schema change)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

---

## Environment Variables

### Frontend (`.env.local` — never committed)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Phase 2 — Anthropic API key
Stored in `localStorage` by the user at runtime. Never in env vars or committed files.

---

## Key Architectural Rules

### Frontend
- **Path alias**: `@/` maps to `src/`. Always use `@/` for imports, never relative `../../`.
- **Tailwind v3**: Uses `tailwind.config.js` with custom token extensions. No `@theme` directive.
- **Theme**: Light + dark mode. System preference default; manual toggle in nav. Shift
  `primary-500` → `primary-400` in dark mode. Use `border: 1px solid grey-700` instead of
  box shadows on cards in dark mode.
- **State management**: React context only (Phase 1). No Zustand/Redux. ConfirmDialog uses a
  global context singleton mounted in `<AppShell>`.
- **Routing**: React Router 6. Seed create/edit = modals (no dedicated routes). Phrase
  create/edit = modals with URL update (enables deep-linking + browser back to close).
- **Sensitive operations**: Anthropic API key in localStorage only. No secrets in the bundle.
- **TTS**: Must use `zh-TW` locale. Check voice availability at app load; set a global flag.
  Three button states: idle, playing, voice-unavailable.

### Supabase / Data
- **Single-user auth**: Supabase email/password auth with one user. RLS is enabled — policies
  grant full access to the `authenticated` role only; `anon` has none. Routes are gated by
  `<RequireAuth>` (shows `LoginPage` when signed out); supabase-js persists the session.
  SQL migrations live in `supabase/migrations/`. Per-user policies (`user_id`) are Phase 2.
- **Generated types**: Use `Database['public']['Tables']['seeds']['Row']` — never write manual
  interface definitions for table rows.
- **Ordering**: Phrases always ordered by `created_at ASC`. No reordering feature in any phase.
- **Deletion**: Hard deletes only. Deleting a Seed cascades to delete all its Phrases (FK).
- **Search**: `ilike` across `mandarin`, `english`, `pinyin` columns — no FTS index needed.
- **Pagination**: Show pagination when `totalItems > 50`. Page size: 25.

### Logging (apply to every Supabase operation)
```typescript
logger.info('Fetching seeds')
const { data, error } = await supabase.from('seeds').select('*')
if (error) {
  logger.error('Failed to fetch seeds', error)
  toast.error('Could not load seeds. Try again.')
  return
}
logger.info('Seeds fetched', { count: data?.length })
```

### Standard Function Flow (all Supabase mutations)
(1) Validate via zod schema → (2) Call Supabase → (3) Handle error with `logger.error` +
`toast.error` → (4) On success, update local state + `toast.success`

---

## Conventions
- **Imports**: Always use `@/` alias. Include file extensions for non-TS files.
- **Types**: Use generated DB types. Custom types exported from feature files, re-exported
  via `src/lib/database.types.ts` derived types.
- **Components**: Named exports. Page/feature components live in `features/`. Shared
  components in `components/shared/`. UI primitives in `components/ui/`.
- **Forms**: Every form uses `react-hook-form` + zod. `mode: 'onBlur'` or `mode: 'onSubmit'`.
  Errors display below fields via `aria-describedby`. All string inputs use `.trim()` in schema.
- **Destructive actions**: Must use `openConfirmDialog()` — never `window.confirm()`.
- **Error messages**: Never expose raw Supabase error messages to users. Plain-language toast
  only. Full error logged via `logger.error`.

---

## Design System Standards

> **Do NOT deviate from these values when writing new UI or editing existing UI.**
> Full token reference: `.claude/memory/design-system.md`

### Color — Semantic Quick Reference
| Role | Token | Rule |
|------|-------|------|
| Primary CTA | `primary-500` (light) / `primary-400` (dark) | One per view only |
| Tags / categorisation | `secondary-100` bg, `secondary-500` text | Tags only |
| Success | `#d1fae5` bg / `#065f46` text | Never raw `green-*` |
| Warning | `#fef3c7` bg / `#92400e` text | Never raw `amber-*` |
| Error | `#fee2e2` bg / `#991b1b` text | Never raw `red-*` |
| Page bg | `grey-50` (light) / `grey-900` (dark) | |
| Card bg | `grey-100` (light) / `grey-800` (dark) | |

### Border Radius
| Context | Class |
|---------|-------|
| Cards, modals, panels | `rounded-lg` (8px = radius-lg default) |
| Inputs, buttons | `rounded-md` (6px) |
| Tags, pills, avatars | `rounded-full` |

### Spacing (base unit: 4px, multiples only)
Standard gap: `gap-2` (8px). Card padding: `p-4` (16px). Section gaps: `gap-6` (24px).
No fractional values like `gap-1.5` or `gap-2.5`.

### Typography
Fonts: **Inter** (Latin) + **Noto Sans TC** (Chinese) via Google Fonts.
Two weights only: **500** (headings/labels) and **400** (body). Never 600 or 700.
Pinyin: one size step smaller than the Mandarin it labels. English translation: same as Pinyin, `grey-500`.

---

## Accessibility Standards

### Interactive Elements (non-button with onClick)
```tsx
role="button" tabIndex={0}
onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); /* action */ } }}
className="... focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
```

### Icon-Only Buttons
Must have `aria-label`. Audio button: `"Play [Mandarin text]"` idle, `"Pause"` playing.

### Modals & Overlays
`role="dialog"`, `aria-modal="true"`. Close button: `aria-label="Close dialog"`.
Focus trap required (shadcn `@radix-ui/react-dialog` handles this).

### Motion
Respect `prefers-reduced-motion` — disable animations when set. Default: 150ms ease-out.

---

## Data Model

```
seeds/{id}            # id, name, source_url?, tag?, created_at
  └── phrases/{id}    # id, seed_id (FK cascade), mandarin, english, pinyin, created_at

# Phase 2 (do not create yet):
dialogues/{id}        # name, tag?, speaker_1_role, speaker_2_role, difficulty,
                      # turn_count (4-20), script (JSONB)?, is_favourite, created_at, updated_at
dialogue_phrases/     # junction: dialogue_id (cascade), phrase_id (no action)
```

---

## Core Workflow (Phase 1)

1. **Create a Seed** — name an external learning source (e.g., a YouTube video, podcast)
2. **Add Phrases to the Seed** — Mandarin + Pinyin + English for each phrase learned
3. **Browse Phrases globally** — search/filter across all Seeds
4. **Play audio** — TTS playback of any Mandarin phrase via Web Speech API (`zh-TW`)
5. **Fluency drilling** — auto-play / step-through mode for a Seed's phrase list

---

## Common Recipes

### Adding a New Feature Component
1. Create in `src/features/<domain>/` with named export
2. Add lazy import in `src/App.tsx` router
3. Add route definition (if page-level, not modal)
4. Use `logger.info` at component mount and key interactions

### Adding a Supabase Operation
1. Write zod schema in `src/lib/schemas/<entity>.ts` (or add to existing)
2. Implement in a service/hook file using the standard logging + error pattern
3. Use generated types — never hand-write row interfaces
4. Regenerate `database.types.ts` if schema changed

---

## Documentation Navigation

| Need | Go to |
|------|-------|
| Full color tokens | `.claude/memory/design-system.md` |
| Database schema details | `.claude/memory/database.md` |
| Cross-cutting patterns (logging, errors, forms, pagination) | `.claude/memory/patterns.md` |
| Feature status & routing | `.claude/memory/features.md` |
| PRD source of truth | `PRD/` directory |
