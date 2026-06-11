# HuaYu — Memory Index

Navigation index for AI agent topic files. Load files listed below when the task matches the trigger.
Max 2 hops from cold start to any detail.

---

## Topic Files

- [design-system.md](design-system.md) — Full color tokens, typography scale, spacing, component specs, motion rules. **Load when:** writing or reviewing any UI, picking colors/spacing/radius, checking component variants.

- [database.md](database.md) — Supabase table schemas, column types, FK constraints, deletion behavior, TypeScript type derivation, Phase 2 table definitions. **Load when:** writing Supabase queries, adding columns, running migrations, working with database types.

- [patterns.md](patterns.md) — Cross-cutting implementation patterns: logging utility, error boundary, form validation, Supabase error handling, pagination, skeleton loaders, confirm dialog, accessibility, environment guard. **Load when:** adding any new feature component, writing a Supabase operation, handling errors, building forms.

- [features.md](features.md) — Feature inventory, phase status, routing structure, nav structure, component locations. **Load when:** adding a new page/route, checking what's in scope for Phase 1, finding where a feature lives in the codebase.

- [supabase.md](supabase.md) — How to run SQL autonomously via the Management API. Credentials stored in `.env.local`. **Load when:** running migrations, creating tables, or any Supabase schema work.

- [vercel.md](vercel.md) — How to manage deployments and env vars via Vercel API. Credentials stored in `.env.local`. **Load when:** deploying, setting env vars, checking build status.

---

## Cross-Cutting Patterns (Always Apply)

- **Taiwanese Mandarin only** — TTS locale must be `zh-TW`. AI content (Phase 2) must be prompted for Taiwanese vocabulary.
- **Phase 1 scope** — Do not scaffold Phase 2 or Phase 3 features. Single-user auth + RLS (authenticated-only policies) are live; no `user_id` columns or per-user policies yet.
- **Logger on every Supabase call** — `logger.info` before, `logger.error` on failure. Never expose raw DB errors to users.
- **Forms** — always `react-hook-form` + zod + `@hookform/resolvers`. Schemas in `src/lib/schemas/`.
- **No `window.confirm()`** — always `openConfirmDialog()` from the global context singleton.
- **Generated types** — never hand-write Supabase row interfaces. Use `Database['public']['Tables'][...]['Row']`.
- **Hard deletes** — no soft delete in any phase.
- **Ordering** — phrases always `created_at ASC`.
