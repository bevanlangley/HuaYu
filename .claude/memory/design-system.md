# Design System — HuaYu

Direction: **Structured Calm** — quiet, intentional space for personal language acquisition.
Configure all tokens in `tailwind.config.js` and as CSS variables in `src/index.css`.
**Never hardcode hex values** anywhere in the codebase.

## Color Tokens

### Primary — Jade Teal
| Token | Hex | Usage |
|-------|-----|-------|
| primary-50 | `#f0faf8` | Subtle tinted backgrounds, hover fills |
| primary-100 | `#d0f0ea` | Active backgrounds, selected states |
| primary-200 | `#a3e0d4` | Borders on tinted surfaces |
| primary-300 | `#6dc9b8` | Decorative accents |
| primary-400 | `#3daf9c` | **Primary in dark mode** |
| primary-500 | `#2a9484` | **Primary in light mode — main CTA only** |
| primary-600 | `#1f7a6d` | Hover on primary buttons |
| primary-700 | `#165f55` | Active/pressed; active nav text |
| primary-800 | `#0e4540` | Dark text on light primary fills |

### Secondary — Warm Amber (Tags Only)
| Token | Hex | Usage |
|-------|-----|-------|
| secondary-100 | `#fef3c7` | Tag backgrounds |
| secondary-400 | `#e9a80b` | Tag text, badge fills |
| secondary-500 | `#c78a00` | Hover on secondary elements |

### Neutrals — Cool Grey
| Token | Hex | Light mode | Dark mode |
|-------|-----|------------|-----------|
| grey-50 | `#f9fafb` | Page background | — |
| grey-100 | `#f3f4f6` | Card backgrounds | — |
| grey-200 | `#e5e7eb` | Borders, dividers | — |
| grey-300 | `#d1d5db` | Placeholder text | — |
| grey-400 | `#9ca3af` | Muted text, icons | — |
| grey-500 | `#6b7280` | Secondary text; English translations | — |
| grey-600 | `#4b5563` | Body text | — |
| grey-700 | `#374151` | Strong text | Surface 2 (elevated) |
| grey-800 | `#1f2937` | — | Surface 1 (cards) |
| grey-900 | `#111827` | — | Page background |

### Semantic
| Role | Light bg | Light text | Dark bg | Dark text |
|------|----------|------------|---------|-----------|
| Success | `#d1fae5` | `#065f46` | `#065f46` | `#d1fae5` |
| Warning | `#fef3c7` | `#92400e` | `#92400e` | `#fef3c7` |
| Error | `#fee2e2` | `#991b1b` | `#991b1b` | `#fee2e2` |
| Info | `#dbeafe` | `#1e40af` | `#1e40af` | `#dbeafe` |
| qa-answer | `#ede9fe` | `#5b21b6` | *(no dark variant)* | *(no dark variant)* |

Tokens: `success-bg`/`success-text` (+ `-dark` suffix for dark mode), same pattern for
`warning`, `error`, `info`. `qa-answer-bg`/`qa-answer-text` (light mode only — used for the Q&A
answer badge, which doesn't currently need a dark variant).

**Error text (dark, inline validation):** `error-text-dark-alt` = `#fca5a5`. Used for inline
form-validation error text and destructive dropdown-menu items in dark mode
(`text-error-text dark:text-error-text-dark-alt`) — deliberately distinct from the badge/banner's
dark error pair (`error-text-dark` = `#fee2e2`), since the two render differently by design;
don't unify them.

### Color Rules
- `primary-500` (light) / `primary-400` (dark) for single main CTA per view only
- Amber tokens: tags/categorisation only
- Semantic red: genuine errors only — never for cancel or non-dangerous destructive actions
- Never hardcode color values — always use tokens (exception: `main.tsx`'s pre-mount env-var
  guard, which runs before Tailwind's classes exist)

## Typography
Fonts: **Inter** (Latin) + **Noto Sans TC** (Chinese) via Google Fonts.
`font-family: 'Inter', 'Noto Sans TC', system-ui, sans-serif`
Two weights only: **500** (headings/labels), **400** (body). Never 600 or 700.

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| display | 36px | 500 | 1.2 | Page heroes, empty states |
| h1 | 28px | 500 | 1.3 | Page titles |
| h2 | 22px | 500 | 1.35 | Section headings |
| h3 | 18px | 500 | 1.4 | Card headings |
| body-lg | 16px | 400 | 1.6 | Default body |
| body | 14px | 400 | 1.6 | Secondary body, descriptions |
| label | 13px | 500 | 1.4 | Form labels, table headers |
| caption | 12px | 400 | 1.5 | Timestamps, metadata |

**Mandarin/Pinyin sizing rule:** Pinyin = one step smaller than Mandarin it labels.
English translation = same size as Pinyin, `grey-500`. Minimum: 14px body, 12px caption.

## Spacing (Base unit: 4px, multiples only)
| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Tight internal gaps |
| space-2 | 8px | Compact internal padding |
| space-3 | 12px | Default internal padding |
| space-4 | 16px | Standard card padding |
| space-6 | 24px | Gap between cards |
| space-8 | 32px | Section padding |
| space-12 | 48px | Page vertical rhythm |

No fractional values (`gap-1.5`, `gap-2.5`, etc.).

## Border Radius & Shadows
| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 4px | Badges, inline tags |
| radius-md | 6px | Inputs, buttons |
| radius-lg | 8px | **Default — cards, modals, panels** |
| radius-xl | 12px | Large containers |
| radius-full | 9999px | Pills, avatars |

| Token | Usage |
|-------|-------|
| shadow-sm | Cards (light mode) |
| shadow-md | Dropdowns, tooltips |
| shadow-focus | `0 0 0 3px rgba(42,148,132,0.35)` — Focus ring, never remove |

Dark mode: use `border: 1px solid grey-700` on cards instead of box shadows.

## Component Specs

### Buttons
| Variant | Background | Text | When |
|---------|------------|------|------|
| Primary | primary-500 | white | Main CTA — one per view |
| Secondary | transparent | primary-500 | Supporting actions |
| Ghost | transparent | grey-600 | Tertiary, cancel |
| Danger | transparent | error-text | Destructive actions |

Sizes: sm (32px h, 12px hpad), md (38px h, 16px hpad), lg (44px h, 20px hpad).
States: hover → primary-600 · active → `scale(0.98)` 80ms · disabled → opacity 0.4 · loading → spinner.
Mobile: minimum 44px touch target. Never two primary buttons competing.

### Cards
Default: white bg (dark: grey-800), 1px solid grey-200 (dark: grey-700), radius-lg, space-4 padding.
- **Seed card**: Full-width, horizontal. Phrase count badge right. Tag below name. Hover: grey-50 bg.
- **Phrase card**: 3-line — Mandarin (body-lg), Pinyin (body, grey-500), English (body, grey-400). Audio button right.

### Tags & Badges
**Seed tags (amber):** bg secondary-100, text secondary-500, radius-full, padding 2px 8px, 12px weight 500.
**Phrase count (neutral):** bg grey-100, text grey-600, same sizing.

### Toasts (sonner)
Bottom-centre mobile / bottom-right desktop. Auto-dismiss 4s (error toasts persist). Max ~60 chars.

### Motion
Default transition: 150ms ease-out. Modals/drawers: 250ms. Skeleton pulse: 1.5s infinite.
Button press: 80ms. Always respect `prefers-reduced-motion`.

## Responsive Breakpoints
| Name | Breakpoint | Layout |
|------|-----------|--------|
| mobile | < 640px | Single column, 16px page padding. Bottom tab nav. |
| tablet | 640–1023px | 2-column available |
| desktop | ≥ 1024px | Full layout, sidebar nav |
