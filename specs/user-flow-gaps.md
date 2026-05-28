# Spec: User Flow — Landing to Session (Gap Analysis & Fixes)

**Status:** Proposed — awaiting approval  
**Date:** 2026-05-15  
**Author:** Claude Code

---

## Problem

Several disconnects exist between the landing page and the session page that leave users confused, stuck, or with no clear path forward. This spec identifies each gap, proposes a fix, and lists the files to change.

---

## Identified Gaps

### Gap 1 — Landing page flashes for returning signed-in users

**What happens now:** The landing page always renders first, waits a hardcoded 400ms, then redirects signed-in users to `/session`. On a typical broadband connection this flash is noticeable; on slow connections it lingers longer.

**Root cause:** `user === undefined` (auth loading) and `user === null` (confirmed not signed in) are both treated as "show the landing page." The 400ms delay is a workaround, not a fix.

**Fix:** While `user === undefined`, show a blank or minimal loading screen rather than the full landing page. Only render the landing page when `user === null` (confirmed guest). Signed-in users skip the landing entirely.

---

### Gap 2 — "Continue with Google" on landing with no prior assessment → confusing redirect

**What happens now:**
1. New user clicks "Continue with Google" on landing (no level in localStorage, no profile in DB).
2. OAuth succeeds → `/auth/callback` redirects to `/session`.
3. Session page finds no level in localStorage → redirects to `/assess`.
4. Result: Landing → Google sign-in → `/session` (brief flash) → `/assess`. User has no idea why.

**Fix:** The auth callback redirect target should be smarter. After exchanging the code, check server-side if a profile exists for the user. If no profile exists, redirect to `/assess?reason=new_user` instead of `/session`. The assess page can display a brief contextual note ("Welcome — let's find your level first") when that query param is present.

---

### Gap 3 — "New session" on the same day re-shows the already-completed concept

**What happens now:** `getDailyConcept()` is date-based. Clicking "New session" after completing today's session brings up the confirm card for the exact same concept. The user just did it; doing it again is meaningless.

**Fix:** On session completion, write `localStorage.lexitree_session_date = today's date` and `lexitree_session_concept = slug`. When the session page loads and finds the daily concept matches the stored completed slug on the same date, skip the confirm card and show a "You've completed today's session" card instead, with links to the Grammar Map and Archive.

---

### Gap 4 — Archive page has no sign-in button on its empty state

**What happens now:** Guests who navigate to `/archive` see a message "Sign in to see your history" with no actionable button. They must navigate elsewhere to sign in.

**Fix:** Render a "Continue with Google" sign-in button directly below the message on the archive empty state.

---

### Gap 5 — Grammar Map → Session → dead end (no way back to map)

**What happens now:** A user picks a concept from the grammar map, practices it, completes the session. The complete card offers "New session" (which starts the daily concept flow, abandoning the map context) or "Change level". No path back to the map.

**Fix:** When a session was initiated from the Grammar Map (`localStorage.lexitree_concept` is set), add a "Back to Grammar Map" button to the complete card. Clear `localStorage.lexitree_concept` when the user clicks either "New session" (daily flow) or "Back to map". If "New session" is clicked after a map session, show a confirmation: "Return to today's scheduled concept?"

---

### Gap 6 — "Change level" is a destructive one-click action with no warning

**What happens now:** The "Change level" button on the complete card immediately clears localStorage level and (for signed-in users) resets `level_score` to 0, then navigates to `/assess`. A B2 user loses all TCF score history with one accidental click.

**Fix:** Replace the direct action with a confirmation step. Show an inline confirmation card: "This will reset your level. Your session history is kept. Continue?" with "Yes, reset" and "Cancel" buttons. Only clear the score on explicit confirm.

---

### Gap 7 — Assessment page has no back-to-landing navigation

**What happens now:** Users who land on `/assess` (either via CTA or direct URL) have no UI affordance to go back to the landing page. Browser back works but isn't obvious.

**Fix:** Add a small back arrow (←) in the top-left of the assess page that links to `/`. Only show it during the `intro` phase (during questions it would be disruptive).

---

## Summary Table

| # | Gap | Impact | Files |
|---|-----|--------|-------|
| 1 | Landing flash for signed-in users | High | `app/page.js` |
| 2 | Sign in without assessment → confusing redirect chain | High | `app/auth/callback/route.js`, `app/assess/page.js` |
| 3 | Same-day "New session" re-shows completed concept | High | `app/session/page.js` |
| 4 | Archive missing sign-in button | Medium | `app/archive/page.js` |
| 5 | Grammar Map session → no way back to map | Medium | `app/session/page.js` |
| 6 | "Change level" has no confirmation | Medium | `app/session/page.js` |
| 7 | Assess page has no back navigation | Low | `app/assess/page.js` |

---

## Schema Changes

None. All changes are client-side (localStorage flags, routing logic, UI).

---

## API Changes

One change to `/auth/callback/route.js`: after `exchangeCodeForSession`, query the `profiles` table server-side (using service role key) and conditionally redirect to `/assess?reason=new_user` instead of `/session`.

---

## Success Metrics

- Reduction in users who bounce at `/session` with no level (currently redirect to `/assess` mid-flow)
- Reduction in "Change level" rage-clicks (session where score was reset followed by immediate re-assess)
- Increase in Grammar Map → Session → Map return navigation (can be tracked via future analytics)

---

## Out of Scope

- Onboarding tutorial / tooltips
- Push notifications for daily session reminders
- Progress bars or streaks
- Any change to the session content itself (lesson, questions, scoring)
