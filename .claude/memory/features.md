# Features & Routing — HuaYu

## Build Sequence (Phase 1)

| # | Feature | PRD File | Status |
|---|---------|----------|--------|
| 1 | Project setup & DX foundations | `01_Project_Setup.md` | TODO |
| 2 | Database schema (create tables in Supabase) | `02_Database_Schema.md` | TODO |
| 3 | Design system (tokens, shadcn components) | `03_UI_Design_System.md` | TODO |
| 4 | App shell & routing | `04_App_Shell_Navigation.md` | TODO |
| 5 | Technical foundations (logging, error boundary, patterns) | `10_Foundations_Technical.md` | TODO |
| 6 | Seeds CRUD | `05_Seeds_CRUD.md` | TODO |
| 7 | Phrases within Seed | `06_Phrases_Within_Seed.md` | TODO |
| 8 | Global Phrases view | `07_Phrases_Global_View.md` | TODO |
| 9 | TTS Audio | `08_TTS_Audio.md` | TODO |
| 10 | Fluency Drilling | `09_Fluency_Drilling.md` | TODO |

Phase 2 (Dialogues) begins only after Phase 1 is complete and validated.

## Routing Structure (React Router 6)

| Path | View | Notes |
|------|------|-------|
| `/` | Redirect → `/seeds` | |
| `/seeds` | Seeds list | Default landing |
| `/seeds/:seedId` | Seed detail (phrases list + drilling) | |
| `/seeds/:seedId/phrases/new` | Add Phrase modal | Modal overlaid on Seed detail; URL reflects modal state |
| `/seeds/:seedId/phrases/:phraseId/edit` | Edit Phrase modal | Modal overlaid; URL enables deep-link + back-to-close |
| `/phrases` | Global Phrases view | |
| `*` | 404 page | |

Seed create/edit are modals triggered from Seeds list — no dedicated routes.

## Navigation

### Desktop (≥1024px)
Sidebar (fixed left): App logo "華語" → Seeds link → Phrases link → Dark/light toggle (bottom).
Active: `primary-100` bg, `primary-700` text, `primary-500` left border accent.

### Mobile/Tablet (<1024px)
Bottom tab bar: Seeds | Phrases (icons + labels). Dark/light toggle moves to top-right header button.
Active: `primary-500` underline/indicator.

**Phase 1 only: No Dialogues nav item.** Add fresh in Phase 2 — do not scaffold a disabled link.

## Feature Summary

### Auth (`features/auth/` + `context/AuthContext.tsx`)
- Single-user Supabase email/password auth. `<RequireAuth>` wraps `<AppShell>` in the router:
  spinner while the session resolves, `LoginPage` when signed out, app when signed in.
- Sign-out buttons: Sidebar footer (desktop), Header icon (mobile).
- RLS policies allow only the `authenticated` role (see `database.md`).

### Seeds CRUD (`features/seeds/`)
- List view: Seeds ordered by `created_at DESC`. Tag filter (pill/toggle). Empty state.
- Create/edit: modal dialog with SeedForm. Name required, source_url + tag optional.
- Delete: `openConfirmDialog()` with phrase count ("This will also delete N Phrases.").
- Phrase count badge displayed on each Seed card.

### Phrases Within Seed (`features/phrases/`)
- Scoped to a single Seed (Seed detail view). Ordered `created_at ASC`.
- Add/Edit: modal dialog with PhraseForm (Mandarin, Pinyin, English — all required).
- Pagination: show when `totalItems > 50`, page size 25. Page 1 = items 1–25 once >50 total.
- Audio play button on each Phrase card.

### Global Phrases View (`features/phrases/`)
- All phrases across all Seeds. Search: `ilike` across mandarin + pinyin + english.
- Tag filter (by Seed tag). Pagination (same rules as above).
- Read-only from this view (edit from Seed detail).

### TTS Audio (`src/lib/` + audio button component)
- Web Speech API, `zh-TW` locale. Check voice availability at app load; set global flag.
- Three states: idle (`aria-label="Play [text]"`), playing (`aria-label="Pause"`), voice-unavailable.
- Fallback: show unavailable state when no `zh-TW` voice detected.

### Fluency Drilling (`features/drilling/`)
- Auto-play mode: cycles through Seed's phrases with configurable interval.
- Step-through mode: keyboard shortcuts (`keydown` on document, cleaned up on unmount).
- Loop option. Drill prompt display.

## Key Decisions (Recorded Gaps)
- **Tag filter UI**: pill/toggle selector (applied from PRD gap default)
- **Phrase add/edit**: modal (not dedicated view)
- **Pagination ambiguity**: page 1 shows items 1–25 once count exceeds 50
- **Dark/light toggle**: system preference default; manual toggle in nav (desktop: sidebar bottom, mobile: top-right header)
- **`updated_at` on dialogues (Phase 2)**: update in application code on every write
