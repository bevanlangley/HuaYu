# Database — HuaYu

Supabase (Postgres). RLS is **enabled** on all tables: policies grant full access to the
`authenticated` role; `anon` has no access. Auth is single-user email/password (no `user_id`
columns yet — that's the Phase 2 multi-user migration). SQL migrations are committed under
`supabase/migrations/` and run via the Management API (see user memory: Supabase access).
Phase 2 tables are defined here but must NOT be created until Phase 2 build begins.

## Phase 1 Tables (Active)

### `seeds`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, `gen_random_uuid()` | |
| `name` | text | NOT NULL | |
| `source_url` | text | nullable | Any string, no format validation |
| `tag` | text | nullable | Free-text, no taxonomy enforced in Phase 1 |
| `created_at` | timestamptz | default `now()` | |

No additional indexes needed for Phase 1 scale.

### `phrases`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, `gen_random_uuid()` | |
| `seed_id` | uuid | NOT NULL, FK → `seeds.id` ON DELETE CASCADE | Cascade deletes phrases when seed is deleted |
| `mandarin` | text | NOT NULL | Traditional Chinese characters |
| `english` | text | NOT NULL | |
| `pinyin` | text | NOT NULL | With tone marks |
| `created_at` | timestamptz | default `now()` | |

Index on `seed_id` for performant phrase lookups by seed.
**Search:** `ilike` across `mandarin`, `english`, `pinyin` — no FTS index needed at Phase 1 scale.
**Ordering:** always `created_at ASC`. No reordering in any phase.

## Deletion Behaviour
- All deletes are **hard deletes** — no `deleted_at` soft delete in any phase.
- Deleting a Seed cascades to delete all its Phrases (FK constraint).
- Deleting a Phrase does NOT affect Dialogues (Phase 2: junction rows become orphaned; script JSONB is the source of truth).

## Phase 2 Tables (Define Now, Create Later)
Do NOT create until Phase 2 build begins.

### `dialogues`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `tag` | text nullable | |
| `speaker_1_role` | text NOT NULL | e.g., "Shopkeeper" |
| `speaker_2_role` | text NOT NULL | e.g., "Customer" |
| `difficulty` | text NOT NULL | `'simple'` or `'intermediate'` only |
| `turn_count` | integer NOT NULL | check 4–20, default 8 |
| `script` | jsonb nullable | Null until generated |
| `is_favourite` | boolean NOT NULL | default false |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Updated in application code on every write |

Script JSON format (Speaker 2 always contains the selected Phrases):
```json
[{ "speaker": "Speaker 2", "role": "Customer", "mandarin": "...", "english": "..." }]
```

### `dialogue_phrases` (junction)
| Column | Type | Constraints |
|--------|------|-------------|
| `dialogue_id` | uuid | FK → `dialogues.id` ON DELETE CASCADE |
| `phrase_id` | uuid | FK → `phrases.id` ON DELETE NO ACTION |

Composite PK on `(dialogue_id, phrase_id)`. `phrase_id` FK is NO ACTION — orphaned rows acceptable.

## Phase 2 Migration Path (do not implement now)
- Add `user_id uuid NOT NULL references auth.users` to `seeds`, `phrases`, `dialogues`
- Replace the "authenticated full access" policies with per-user policies
  (users can only read/write their own rows)

## TypeScript Types
Generated from Supabase. Never write manual row interfaces.

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

Re-run after any schema change.

```typescript
import type { Database } from '@/lib/database.types'

type Seed       = Database['public']['Tables']['seeds']['Row']
type SeedInsert = Database['public']['Tables']['seeds']['Insert']
type Phrase       = Database['public']['Tables']['phrases']['Row']
type PhraseInsert = Database['public']['Tables']['phrases']['Insert']
```

## Supabase Client
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Missing Supabase environment variables')

export const supabase = createClient<Database>(url, key)
```
