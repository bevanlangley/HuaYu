# HuaYu — Drill & Recall Redesign Spec

**Date:** 2026-06-13  
**Status:** Approved  
**Scope:** Rework fluency drilling into two distinct modes (Listen + Shadow), add a new Active Recall section, remove the Global Phrases nav item.

---

## Background

Language acquisition requires four repeating steps:
1. Build a sentence list
2. Listen to sentences repeatedly (hands-free)
3. Shadow — speak simultaneously with the recording
4. Active recall — see the native-language prompt, produce the target language

HuaYu Phase 1 covers step 1 well. The existing Drilling feature partially covers steps 2–3 but lacks configurability and conflates auto-play listening with manual shadowing. Step 4 is entirely absent. This redesign addresses all four steps.

---

## Navigation Changes

**Before:** Seeds | Phrases | Drill  
**After:** Seeds | Drill | Recall

- The **Global Phrases page** (route, nav link, component) is removed. Phrases remain fully manageable within each Seed's detail view — nothing is lost, only the standalone browse page is gone.
- The **Drill nav link** points to the reworked Drill page.
- The **Recall nav link** is new, pointing to the new Recall page.
- Both the bottom nav (mobile) and sidebar (desktop) update to reflect this.

---

## Drill Page

A single page combining two modes. The user selects a mode, configures options, then starts. Configuration collapses during active playback.

### Configuration Controls (shared across both modes)

| Control | Options | Default |
|---------|---------|---------|
| Mode | Listen / Shadow (toggle) | Listen |
| Source | "All phrases" or any seed (dropdown) | All phrases |
| Order | In order / Random (toggle) | In order |

### Listen-only Configuration Controls

| Control | Options | Default |
|---------|---------|---------|
| Gap between phrases | 1–30 seconds (number input) | 3s |
| Loop | On / Off (toggle) | Off |
| Show text | On / Off (toggle) | On |

These controls are hidden when Shadow mode is selected.

---

### Listen Mode — Playback Behaviour

Auto-advances through the phrase list with the configured gap between each phrase.

**Display:**
- If "Show text" is on: current phrase card shows Mandarin (large) + Pinyin (smaller) + English (grey, same size as Pinyin)
- If "Show text" is off: blank card (audio only — designed for in-car / eyes-free use)

**Controls:**
- Pause / Resume
- Skip Back (previous phrase)
- Skip Forward (next phrase)
- Stop (returns to configuration)

**Progress indicator:** "4 / 23" — current position in the phrase list.

**Loop behaviour:** when the last phrase plays and the gap elapses, the list restarts from the beginning if Loop is on. If Loop is off, playback stops and returns to configuration.

---

### Shadow Mode — Playback Behaviour

Manual step-through. Never auto-advances. The user reads the phrase while hearing it simultaneously (shadowing).

**Display:**
- Always shows all three fields: Mandarin (large) + Pinyin + English
- One phrase shown at a time

**Controls:**
- **Play** (primary, prominent) — triggers TTS audio for the current phrase. Can be pressed repeatedly to replay.
- Previous — moves to the prior phrase (does not auto-play)
- Next — moves to the next phrase (does not auto-play)
- Stop — returns to configuration

The user's workflow: read the phrase → press Play → speak along with the audio → press Play again to repeat, or Next to advance.

**Progress indicator:** "4 / 23"

---

### Shared Drill Behaviour

- Random order shuffles the phrase list once on start; In order uses `created_at ASC`
- If the selected source has zero phrases, show an empty state with a link to the relevant seed (or to Seeds if "All phrases" selected)
- TTS always uses `zh-TW`; voice-unavailable state is handled the same as the rest of the app

---

## Recall Page

Active recall: see the English prompt, attempt to produce the Chinese, then reveal to verify.

### Configuration Controls

| Control | Options | Default |
|---------|---------|---------|
| Source | "All phrases" or any seed (dropdown) | All phrases |
| Order | In order / Random (toggle) | Random |

---

### Recall — Playback Behaviour

One phrase at a time.

**Before reveal:**
- Card shows only the English sentence, displayed prominently in the centre
- Single **"Reveal"** button below

**After reveal (on the same card):**
- Card expands to show: Traditional characters (large) + Pinyin (smaller below)
- Audio plays automatically on reveal
- **"Play again"** button available for manual replay
- Navigation appears: **← Previous** | **Next →**

**Navigation behaviour:**
- Moving to a phrase the user has not yet revealed shows it in the hidden / English-only state
- Moving back to a phrase already revealed shows it in the revealed state
- Order (random or sequential) is fixed for the session — determined on start, not re-shuffled mid-session

**Progress indicator:** "4 / 23"

**Empty state:** if the source has zero phrases, prompt to add some via the relevant seed.

---

## What Is Not Changing

- Seeds CRUD — no changes
- Phrases CRUD within a Seed detail view — no changes
- Per-phrase audio playback in Seed detail — no changes
- TTS integration (`zh-TW`, voice availability check, three button states) — no changes
- Auth, RLS, logging, form patterns — no changes

---

## Out of Scope (Phase 1)

- Spaced repetition / marking phrases correct or incorrect in Recall
- Repeat N times per phrase before auto-advancing in Listen mode
- Any AI-generated content (Phase 2)
