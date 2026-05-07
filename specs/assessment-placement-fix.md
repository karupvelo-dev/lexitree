# Spec: Assessment Placement Fix

**Status:** Implemented  
**Date:** 2026-05-07  
**File:** `src/data/assessment.js`

---

## Problem

`estimateLevel()` uses a cumulative accuracy threshold of ≥ 50% to determine placement. This means strong performance on early, easy questions carries the cumulative high enough that failing harder questions doesn't prevent overplacement.

**Concrete example:**  
Distribution: A1:1, A2:2, B1:2, B2:1, C1:1

User gets A1 ✓, both A2 ✓, one B1 ✓, misses B2 and C1 (4/7 correct):

| Level | Questions | Correct | Cumulative | ≥ 50%? | Result |
|-------|-----------|---------|------------|--------|--------|
| A1    | 1         | 1       | 1/1 = 100% | yes    | A1     |
| A2    | 2         | 2       | 3/3 = 100% | yes    | A2     |
| B1    | 2         | 1       | 4/5 = 80%  | yes    | B1     |
| B2    | 1         | 0       | 4/6 = 67%  | yes    | B2     |
| C1    | 1         | 0       | 4/7 = 57%  | yes    | **C1** |

User answered the C1 question wrong and is placed at C1.

---

## Root cause

The cumulative approach inherently lets early correct answers prop up the cumulative at harder levels. Getting C1 wrong while having a strong cumulative still satisfies the ≥ 50% condition.

---

## Fix: Consecutive per-level accuracy

Walk through levels in order. Advance to the next level only if per-level accuracy ≥ 50%. Stop at the first level that fails. Return the last level that passed.

This matches CEFR's hierarchical structure — you cannot be B2 if you cannot answer B1 questions, regardless of performance on harder items.

**Same example with the fix:**

| Level | Per-level | ≥ 50%? | Action |
|-------|-----------|--------|--------|
| A1    | 1/1 = 100% | yes   | advance |
| A2    | 2/2 = 100% | yes   | advance |
| B1    | 1/2 = 50%  | yes   | advance |
| B2    | 0/1 = 0%   | no    | **stop** |

→ Result: **B1** ✓

**Additional cases:**

| Scenario | Current result | Fixed result |
|----------|---------------|--------------|
| 7/7 correct | C1 | C1 |
| Gets A1, misses A2, gets B1–C1 | C1 | A1 |
| Gets A1, A2, misses B1, gets B2, C1 | C1 | A2 |
| Gets nothing right | A1 (default) | A1 (default) |
| Gets A1, half A2, half B1 | B1 | B1 |

---

## Code change

**File:** `src/data/assessment.js` — `estimateLevel()` function only.

**Current logic:**
```js
let cumC = 0, cumT = 0, result = 'A1'
for (const lvl of LEVEL_ORDER) {
  if (scores[lvl].t === 0) continue
  cumC += scores[lvl].c
  cumT += scores[lvl].t
  if (cumC / cumT >= 0.5) result = lvl
}
return result
```

**New logic:**
```js
let result = 'A1'
for (const lvl of LEVEL_ORDER) {
  if (scores[lvl].t === 0) continue
  const accuracy = scores[lvl].c / scores[lvl].t
  if (accuracy >= 0.5) result = lvl
  else break
}
return result
```

---

## Files touched

| File | Change |
|------|--------|
| `src/data/assessment.js` | Replace cumulative logic with consecutive per-level logic |

No schema changes. No API changes. No UI changes.

---

## Edge cases

- **Level with no questions** (`scores[lvl].t === 0`): skipped via `continue`, same as current behaviour. Does not break the consecutive chain — only levels with questions in the assessment count.
- **All wrong:** A1 fails (0/1 = 0%) → loop breaks immediately → returns default `'A1'`
- **All correct:** Every level passes → returns the highest level in the assessment (currently C1)
- **C2:** No C2 questions in assessment (distribution stops at C1), so C2 is never returned by this function

---

## Success metric

No false C1/C2 placements visible in `profiles.level_score` for users with < 5/7 assessment accuracy. Monitor via Supabase: users placed at C1 or C2 with level_score seeded at 550+ should show improved session accuracy post-placement.
