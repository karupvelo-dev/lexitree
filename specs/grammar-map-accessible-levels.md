# Spec: Grammar Map — Accessible Levels

**Status:** Approved  
**Date:** 2026-05-07

---

## Problem

The grammar map currently makes only the user's current level interactive. Lower-level concepts are greyed out and non-practisable. A B1 user who wants to review passé composé (A2) or présent simple (A1) has no way to do so from the map. This limits the map's value as a review tool.

---

## Solution

Make all concepts at levels ≤ the user's current level interactive and practisable. Concepts above the user's level remain locked.

---

## Changes

### `map/page.js`

**1. Performance fetch — remove level filter**

Current:
```js
.eq('level', userLevel)
```
Remove this filter so sessions across all levels are loaded. Concept slugs are unique across levels, so the `performance` object (keyed by slug) remains unambiguous.

**2. Node interactivity — extend to levels ≤ userLevel**

Current:
```js
state: isCurrent ? (performance[slug] ?? 'open') : 'grey',
concept: isCurrent ? { ...concepts[slug], level: lvl } : null,
```

New:
```js
const isAccessible = LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(userLevel)

state: isAccessible ? (performance[slug] ?? 'open') : 'grey',
concept: isAccessible ? { ...concepts[slug], level: lvl } : null,
```

Lower-level nodes become clickable and show good/medium/poor/open performance colours. Nodes above userLevel remain grey and non-interactive.

**3. Badge — visual distinction for accessible vs current**

Add an `'accessible'` badge variant in `LevelCol`:

| State | Badge colour |
|---|---|
| `current` | Terracotta background, terracotta text |
| `accessible` | White background, mid-grey text, border |
| `grey` | Bg, light text, border — same as today |

Column label stays `'${lvl} · now'` for current, plain `lvl` for all others.

---

### `session/page.js`

When a user clicks a lower-level concept, the concept object stored in localStorage carries `concept.level` (e.g. `'A2'`). The session page must use this for API calls.

**Question generation** — use concept's native level, not user's stored level:
```js
// Inside fetchSession(lvl, c):
const conceptLevel = c.level ?? lvl
body: JSON.stringify({ level: conceptLevel, concept: c, lesson, vocabularyWords })
```

**Vocabulary selection** — still uses user's stored level (vocab pool is based on proficiency):
```js
const vocabularyWords = selectVocabularyWords(lvl, vocabularySeen) // lvl = storedLevel
```

**Session save** — record the concept's native level so map performance coloring is correct:
```js
level: concept.level ?? level,  // concept.level = 'A2', level state = 'B1'
```

**Sidebar** — still shows user's current level (storedLevel). No change.

---

## What does NOT change

- The user's stored level (`lexitree_level` in localStorage) is never modified when practicing a lower-level concept
- Recalibration nudge reads the last 5 sessions regardless of level — no change needed (a session at A2 still contributes to rolling accuracy)
- Promotion check for B1 remains tied to B1 sessions only (already filtered by level in `checkPromotion`)
- Vocabulary word pool is always drawn from ≤ user's stored level, not concept level

---

## Files touched

| File | Change |
|---|---|
| `src/app/map/page.js` | Remove level filter from performance fetch; extend interactivity to ≤ userLevel; add accessible badge |
| `src/app/session/page.js` | Use `concept.level ?? level` for question generation and session save |
