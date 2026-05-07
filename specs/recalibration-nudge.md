# Spec: Recalibration Nudge

**Status:** Implemented  
**Date:** 2026-05-07  
**Author:** PM discussion

---

## Problem

Users placed at the wrong CEFR level by the assessment have no correction mechanism. The TCF delta moves too slowly (−5/session max) to fix gross misplacement — a user overplaced by two levels would need ~30 consecutive bad sessions to drift down. Most churn before that happens.

---

## Solution

Two complementary mechanisms:

1. **Recalibration nudge** — after 5 completed sessions, if rolling accuracy is clearly too low or too high, surface a non-intrusive prompt to adjust level.
2. **TCF delta** — already exists, handles fine within-level movement. No changes needed.

---

## Trigger Rules

| Parameter | Value |
|-----------|-------|
| Minimum sessions | 5 completed (any level) |
| Recency gate | Current session always satisfies this — check runs on session save |
| Downward threshold | Rolling accuracy < 40% |
| Upward threshold | Rolling accuracy > 92% |
| Cooldown after dismissal | 10 sessions |
| C2 ceiling | Upward nudge suppressed at C2 |
| A1 floor | Downward nudge suppressed at A1 |

Rolling accuracy = sum(score) / sum(total) across last 5 completed sessions.

---

## Schema Change

```sql
ALTER TABLE profiles
ADD COLUMN recalibration_dismissed_at timestamptz;
```

Cooldown is computed dynamically: count sessions created after `recalibration_dismissed_at`. If < 10, suppress nudge.

---

## API Changes

### `POST /api/save-session` (modified)

Add `checkRecalibration(userId, currentLevel)` after existing promotion check.

Logic:
1. Fetch last 5 completed sessions for user
2. If fewer than 5 → return null
3. Compute rolling accuracy
4. Fetch `recalibration_dismissed_at` from profile
5. If dismissed: count sessions since dismissal → if < 10, return null
6. Evaluate thresholds → return `{ direction, suggestedLevel, rollingAccuracy }` or null

Response shape becomes:
```json
{ "ok": true, "promotion": ..., "recalibration": { "direction": "down", "suggestedLevel": "B1", "rollingAccuracy": 0.34 } }
```

### `POST /api/accept-recalibration` (new)

```
Body: { suggestedLevel }
Action: UPDATE profiles SET level_score = levelToMidScore(suggestedLevel), recalibration_dismissed_at = null
```

### `POST /api/dismiss-recalibration` (new)

```
Body: none
Action: UPDATE profiles SET recalibration_dismissed_at = now()
```

---

## UI Changes

### `session/page.js` — complete phase

If `recalibration` is present in save-session response, render a nudge card above the session summary.

**Downward copy:**
> "Your recent sessions suggest [Current Level] is a tough stretch. Move to [Suggested Level] to build stronger foundations?"

**Upward copy:**
> "You're consistently acing these. Ready to move up to [Suggested Level]?"

**Actions:**

| Button | Action |
|--------|--------|
| Yes, adjust my level | POST /api/accept-recalibration → update localStorage → router.push('/session') |
| Stay at [Current Level] | POST /api/dismiss-recalibration → dismiss card, no redirect |

---

## Files Touched

| File | Change |
|------|--------|
| `src/app/api/save-session/route.js` | Add checkRecalibration logic, update response shape |
| `src/app/api/accept-recalibration/route.js` | New endpoint |
| `src/app/api/dismiss-recalibration/route.js` | New endpoint |
| `src/app/session/page.js` | Render nudge card in complete phase |
| Supabase | Run ALTER TABLE migration |

---

## Success Metrics

- Accuracy-per-session in the 10 sessions after recalibration vs matched cohort who did not recalibrate
- 30-day retention split by: accepted recalibration / dismissed / not triggered

---

## Out of Scope

- C2 mastery / plateau experience
- Streak tracking
- Forced level change (nudge is always optional)
