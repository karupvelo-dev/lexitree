# Change Request Log

---

## CR-007 — Duplicate options + multi-blank separator validation

**Date:** 2026-05-28  
**File:** `src/app/api/generate-questions/route.js`  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

A question appeared with 3 identical options ("partir / donne" × 3) and a two-blank sentence where the first blank never varied across any option. Two root causes:

1. **No duplicate options check** — `validateQuestion` had no guard against identical option strings. Three identical options passed all existing checks.

2. **Check 3 separator mismatch** — The multi-blank variance check split options by `', '` (comma-space). The AI used `' / '` (space-slash-space) as its separator. Split returned a single-element array, `parts.every(p => p.length === numBlanks)` was false, and the check silently skipped.

### Change

**`validateQuestion`:**

Added Check 3 (now renumbered — old Check 3 becomes Check 4):
```js
if (new Set(q.options).size !== q.options.length) return false
```
Rejects any question where two or more options are identical strings.

Fixed separator regex in Check 4 from `o.split(', ')` to `o.split(/\s*[,/]\s*/)` — handles both `", "` and `" / "` and variations.

**Prompt rule 7:**

Added: "All 4 must be distinct strings — no two options may be identical."

### Bank note

Run `TRUNCATE TABLE questions;` in Supabase SQL editor to evict any existing questions with duplicate options already in the bank.

### Rollback

Remove the `new Set(q.options).size !== q.options.length` check. Revert the split regex back to `o.split(', ')`. Remove the added sentence from rule 7.

### Risk

**Low.** Validation-only change. Makes the filter stricter — a small number of edge-case valid questions could theoretically be rejected if two options are intentionally the same string (which is never correct design), so no real false-positive risk.

---

## CR-006 — Landing page CTA + guest session gate

**Date:** 2026-05-27  
**Files:** `src/app/page.js`, `src/app/session/page.js`  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

Two related issues:

1. **Landing page CTA** was "Continue to session →" for returning guests, which pointed at `/session` and bypassed placement. For a marketing/landing page, the primary action should always be a single consistent call to assess French level — not a conditional shortcut.

2. **No guest session limit** — guests could practice indefinitely with no nudge to sign in, reducing stickiness and preventing progress persistence.

### Change

**`page.js` (landing):**

Hero primary button and final CTA button now always read "Check my French level →". Both route to `/assess` (new users) or `/assess?retake=true` (returning guests who already have a level in localStorage). The nav utility button retains the conditional "Continue to session" / "Check my French level" copy as a shortcut.

**`session/page.js` (session gate):**

Three-tier guest gate using `localStorage.getItem('lexitree_guest_sessions')` (integer):

| Trigger | Behaviour |
|---------|-----------|
| Session 1 completes (guest) | Complete screen sign-in block copy: "1 free session remaining" |
| Session 2 starts (guest) | Warning banner in ConfirmCard: "Last free session — sign in after this to continue" |
| Session 2 completes (guest) | Complete screen sign-in block copy: "You've used your free sessions" |
| Session 3 attempted (guest) | ConfirmCard replaced with `GuestGateCard` — full-screen sign-in wall, no dismiss |

Counter increments only for `user === null`. Signing in automatically bypasses all gates (no counter cleared — gates are `user === null && guestSessions >= N`).

### Rollback

**`page.js`:**
- Hero button: restore `onClick={() => router.push(hasLevel ? '/session' : '/assess')}` and `{hasLevel ? 'Continue to session →' : 'Check my French level →'}`
- Final CTA button: same

**`session/page.js`:**
1. Remove `guestSessions` state and its localStorage read in the mount effect
2. Remove the guest session counter increment block in `handleNext`
3. Restore the confirm card render to: `<ConfirmCard concept={concept} level={level} onStart={handleStart} />`
4. Remove `showLastSessionWarning` prop from `ConfirmCard` signature and its banner JSX
5. Remove `guestSessions` prop from `SummaryCard` call and signature; restore the `{user === null && ...}` block to original single-copy version
6. Remove `GuestGateCard` component

### Risk

**Low.** Counter is localStorage-only — no schema changes. Signing in immediately bypasses all gates. Gate only fires after 2 full completed sessions; existing guests with `lexitree_guest_sessions` unset start at 0 (same as new).

---

## CR-005 — Strip embedded options from question text

**Date:** 2026-05-27  
**Files:** `src/app/api/generate-assessment/route.js`, `src/app/api/generate-questions/route.js`  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

Questions were rendered as: *"Quand j'étais enfant, je ___ toujours à l'école à pied. (vais / allais / suis allé / irai)"*

The options appeared both inside the question text AND as separate clickable buttons — duplicated. Root cause: Mistral defaults to the classic printed-worksheet format where answer choices are embedded in the question text (e.g. `___ (option1 / option2 / option3)`), because French grammar exercise books use this format. Neither prompt told the model that the UI renders options separately.

### Change

Added one rule to each prompt:

**Assessment** (`generate-assessment/route.js`), rule 6a:
> The "question" field must contain ONLY the sentence with ___ as the blank. Never embed the options or any list of choices inside the question text — they are displayed separately in the UI.

**Session questions** (`generate-questions/route.js`), appended to rule 6:
> The "question" field must contain ONLY the sentence — never embed the options or any list of choices inside the question text, as they are displayed separately in the UI.

### Bank note

Assessment questions are saved to the `questions` bank. Any existing banked questions with embedded options will surface in sessions until they are displaced by `use_count` rotation. To force-clear: `TRUNCATE TABLE questions;` (safe — regenerated on demand).

### Rollback

Remove the added sentence from rule 6 / 6a in both files.

### Risk

**Low.** Prompt-only change. No schema or client changes.

---

## CR-004 — Placement test retake from profile

**Date:** 2026-05-27  
**Files:** `src/app/assess/page.js`, `src/app/profile/page.js`  
**Author:** Nithin Sebastian  
**Status:** Applied

### What

Users can now retake the placement test from their profile page. The retake never resets history — it only upgrades the level if the new result is strictly higher than the current one.

### Entry point

`profile/page.js` — small "Retake placement test →" text link below the level badge in the profile header. Routes to `/assess?retake=true`.

### Assess page changes (`assess/page.js`)

1. **Bypass redirect** — the existing returning-user redirect (`if (level) router.replace('/session')`) is skipped when `?retake=true` is present. Without this, users with a stored level would be immediately bounced back.

2. **State** — `isRetake` (bool) and `currentLevel` (string from localStorage) are set on mount from the URL params.

3. **`handleBeginSession` — retake branch**
   - Compares `estimatedLevel` vs `currentLevel` using `LEVEL_SEQUENCE` index.
   - If upgrade: updates localStorage + profile (`level_score` only — no other profile columns touched).
   - If no upgrade: navigates to `/session` without changing anything.
   - History (sessions, vocab, streak) is never touched either way.

4. **`ResultCard` — retake UI**
   - Shows a green banner ("Your score beats X — your level will be upgraded") or a neutral banner ("Keep practicing and try again") depending on outcome.
   - Primary CTA: "Upgrade to [level] →" or "Back to session →".
   - Sign-in prompt hidden on retake (user is already signed in to reach profile).

### What is NOT changed

- `profiles.current_streak`, `last_session_date`, `vocabulary_seen`, `vocabulary_correct`, `vocab_score`, `vocab_words_seen` — untouched.
- `sessions` table — untouched.
- The normal (first-time) assessment flow — unchanged.

### Rollback

**`profile/page.js`** — remove the `<a href="/assess?retake=true">` link.

**`assess/page.js`** — four reversions:
1. Remove `LEVEL_SEQUENCE` constant, `isRetake`/`currentLevel` state, and retake detection from the params effect.
2. Restore redirect effect to: `const level = localStorage.getItem('lexitree_level'); if (level) router.replace('/session')`.
3. Restore `handleBeginSession` to the original 4-line version.
4. Restore `ResultCard` signature and body to remove `isRetake`/`currentLevel`/`isUpgrade` props and retake-specific JSX.

### Risk

**Low.** The retake path is gated behind a URL param and a profile-page link. The normal assessment flow is untouched. The only write is a selective `upsert` on `profiles.level_score` — same call the normal flow makes. No history is overwritten.

---

## CR-003 — Streak bar timezone mismatch fix

**Date:** 2026-05-27  
**File:** `src/components/Sidebar.js`  
**Line affected:** 91  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

Streak count showed 2 but only 1 bar (today) was filled. Root cause: timezone mismatch.

- `getLast7Days()` generates date strings using the browser's **local time** (`new Date()`, `getDate()`, etc.)
- Session dates were extracted with `created_at.slice(0, 10)` which takes the first 10 characters of the ISO string — always the **UTC date**

For users in a UTC+ timezone, a session completed "yesterday" in local time (e.g. 11pm local = next UTC day) would have `created_at` stamped as UTC "today". The bar lookup compared local "yesterday" against UTC "today" → no match → bar stays empty. The streak counter in `profiles.current_streak` is maintained server-side with correct date logic, so it showed 2 correctly while the bar showed only 1.

### Change

Changed line 91 from:

```js
s.created_at.slice(0, 10)
```

to extracting the local date using `getFullYear()` / `getMonth()` / `getDate()` (all local-time methods):

```js
const d = new Date(s.created_at)
return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
```

This produces a `YYYY-MM-DD` string in the user's local timezone, matching `getLast7Days()` exactly.

### Revision (second attempt)

The timezone fix was correct in principle but didn't resolve the issue. Root cause turned out to be a data divergence: the sessions table only had today's row, but `profiles.current_streak` was already 2. The bar queries sessions; the counter reads the profile — two different sources that can get out of sync (guest sessions, failed saves, manual DB edits, etc.).

**Final fix:** dropped the separate sessions query entirely. Now the profile fetch also selects `last_session_date`, and the filled-bar set is derived directly from `current_streak` + `last_session_date`. Both `streak.js` (server) and `getLast7Days` (client) use UTC, so keeping UTC for the derived dates ensures they match.

```js
// Derive filled days from streak + last_session_date (UTC throughout)
for (let i = 0; i < Math.min(currentStreak, 7); i++) {
  const d = new Date(data.last_session_date + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - i)
  filled.add(d.toISOString().slice(0, 10))
}
```

### Rollback

Restore the original two-query structure:
1. Profile select back to `'current_streak, vocab_score, vocab_words_seen'` (no `last_session_date`)
2. Restore the separate sessions query:
```js
const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString()
supabaseBrowser
  .from('sessions')
  .select('created_at')
  .eq('user_id', user.id)
  .gte('created_at', sevenDaysAgo)
  .then(({ data }) => setSessionDates(new Set((data ?? []).map(s => s.created_at.slice(0, 10)))))
  .catch(() => {})
```

### Risk

**Low.** Client-side display only. Eliminates one DB round-trip (net improvement). The bar now always matches the streak counter since they share the same data source.

---

## CR-002 — Session complete screen: button hierarchy cleanup

**Date:** 2026-05-27  
**File:** `src/app/session/page.js`  
**Lines affected:** ~1699–1719 (dark variant), ~1792–1811 (light variant)  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

The session completion screen showed four stacked full-width pill buttons at equal visual weight:

1. Primary CTA (black/gold pill)
2. "Try more questions" (ghost pill)
3. "Today's lesson" (ghost pill)
4. "Share result" (bordered pill)

Four identically-sized, identically-shaped buttons create a menu list, not a hierarchy. The eye has no natural landing point after the primary action.

### Change

Both variants (dark/gold and light) updated with the same pattern:

- **Primary CTA** — unchanged. One dominant pill button.
- **Secondary actions** — demoted to bare text buttons arranged side-by-side in a single row, separated by a hairline vertical divider. No border, no background. Same row reads as one decision, not two separate CTAs.
- **Share** — removed the border entirely. Now a small 12px text link below the action row. It is a utility action, not a navigation decision.
- Also renamed "Try more questions" → "Try again" in the map-session variant for conciseness at the smaller size.

### Rollback

Restore the two `<div>` blocks (one per variant) in `session/page.js`:

**Dark variant** (~line 1699): restore `gap: '8px'` on the outer div, and replace the text-button row + divider structure with three separate `btn-ghost` buttons as before.

**Light variant** (~line 1792): same — restore `gap: '10px'`, replace text-button row with separate `btn-ghost` buttons, restore `border: '1px solid var(--border)'` on the Share button.

### Risk

**Low.** Visual-only change. Button `onClick` handlers are untouched. No logic, routing, or state changes.

---

A running log of production changes to the Lexitree codebase. Each entry records what changed, why, and exactly how to revert it. Newest entries at the top.

---

## CR-001 — Jargon-free wrong explanations

**Date:** 2026-05-27  
**File:** `src/app/api/generate-questions/route.js`  
**Lines affected:** 139–140 (prompt rules 10 and 11)  
**Author:** Nithin Sebastian  
**Status:** Applied

### Problem

Wrong-answer explanations shown to users contained grammar jargon and leaked internal prompt terminology. Example of the bad output:

> *"The forcing cue is 'peux', which requires the infinitive form of the verb. 'Expliquer' is the correct infinitive form here."*

Two root causes:

1. **Rule 10** said *"Name the forcing cue"* — Mistral treated "forcing cue" as a copyable label and wrote it verbatim into the explanation the user sees.
2. **Rule 11** banned specific jargon words (`infinitive`, `subjunctive`, etc.) but left gaps: `forcing cue`, `tense`, `form`, `verb form` were not banned, and a minimal banned-word list alone is not enough to change Mistral's default register.

### Change

**Rule 10** — changed the instruction from:

> `Name the forcing cue.`

to:

> `Reference the specific word in the sentence that determines the answer — write it naturally as part of the explanation, not as a labelled term (e.g. "after 'peux', the next verb…" not "the forcing cue is 'peux'").`

**Rule 11** — three changes:

1. Reframed the goal from *"no grammar jargon"* to *"write as a fluent speaker explaining to a friend"* — a mental model beats a banned-word list.
2. Expanded the forbidden-word list to include: `tense`, `verb form`, `form`, `forcing cue`, `grammatical`.
3. Replaced the abstract example (`allons → irons`) with a concrete before/after using the exact failure case (`peux` / `expliquer`) so future-Mistral has no excuse.

### Why not just truncate the question bank?

Bank truncation (`TRUNCATE TABLE questions`) would regenerate all questions and is appropriate when the prompt structure changes in a breaking way (e.g. new required JSON field). This change only affects the prose register of `wrongExplanations` — existing banked explanations still function correctly, they're just stylistically worse. New questions generated after this change will have better explanations. Old questions will be rotated out naturally as `use_count` rises.

If you want to force-refresh immediately, run in Supabase SQL editor:
```sql
TRUNCATE TABLE questions;
```
This is safe — questions are regenerated on demand.

### Rollback

To revert to the previous prompt, restore the two lines in `generate-questions/route.js`:

**Rule 10** — change back to:
```
10. Explanation in English, 1–2 sentences explaining why the correct answer is right. Name the forcing cue.
```

**Rule 11** — change back to:
```
11. wrongExplanations: REQUIRED. For each wrong option, write a two-part explanation in this exact format: "[wrong word(s)] → [correct word(s)] — [one plain-English rule sentence]". The swap shows only the key differing word(s), not the full option. The rule sentence must name the specific forcing cue from the sentence. Use no grammar jargon — forbidden words include: 'partitive', 'reflexive pronoun', 'auxiliary', 'subjunctive', 'indicative', 'past participle', 'present tense', 'imperfect', 'conditional', 'infinitive', 'conjugated', 'pronominal', 'article', 'preposition', 'agreement', 'clause'. Example — instead of "allons is present tense — 'Demain' signals future" write "allons → irons — 'demain' means later, so use the future form here." Keys must exactly match the option strings character-for-character. This field must always be present with exactly 3 entries (one per wrong option).
```

### Risk

**Low.** This is a prompt-only change. No schema changes, no API contract changes, no client code changes. The `wrongExplanations` field structure (keys = wrong option strings, values = explanation strings) is unchanged. If Mistral produces worse output after this change, rollback is one edit and a bank truncation.
