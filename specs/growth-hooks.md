# Growth Hooks — Spec

**Author:** Growth team (Andrew Chen, Lenny Rachitsky, Shreyas Doshi, Casey Winters, Brian Balfour)
**Status:** Ready for implementation
**Last updated:** 2026-05-17

---

## Overview

Six growth hooks identified to drive acquisition, retention, and viral distribution. Shareable result cards (vocab) are already shipped. This document covers the remaining five.

**Guiding principle:** Every hook should either bring a new user in or bring an existing user back. Nothing here is cosmetic.

---

## 1. Streak Recovery Email

**Category:** Retention
**Effort:** Low
**Priority:** 1

### Problem
Users who break a streak after 5+ days churn at a disproportionate rate. The streak breaks silently — no nudge, no recovery path. The emotional investment they built is abandoned without a prompt.

### Solution
Trigger a single re-engagement email within 24 hours of a missed day when the user had a streak of 5 or more days.

### Email content
- Subject: `Your X-day streak is waiting, [first name]`
- Body: streak count, last session date, single CTA — "Keep my streak →" → `/session`
- Tone: matter-of-fact, not guilt-tripping. One sentence, one button.

### Streak freeze (optional extension)
A streak freeze gives the user one grace day — earned automatically after a 7-day streak, or purchasable later if monetisation is introduced. Stored as `streak_freeze_available boolean` on the profiles table.

### Data / schema changes
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_available boolean NOT NULL DEFAULT false;
```

### Technical implementation
- Cron job runs daily at 09:00 UTC
- Query: users where `last_session_date = CURRENT_DATE - 2` and `current_streak >= 5`
- Send via Resend / Postmark
- One email per streak break — do not re-send if already sent for this break

### Success metrics
- Re-engagement rate: % of recipients who complete a session within 48hrs
- Target: >20% re-engagement on 5+ day streak breaks

---

## 2. Weekly Progress Email

**Category:** Retention / Re-engagement
**Effort:** Medium
**Priority:** 2

### Problem
Users who don't have an active streak have no regular reason to open LexiTree. Out of sight, out of habit.

### Solution
A weekly digest email sent every Sunday. Personalised to the user's actual activity. Not a newsletter — a personal progress report.

### Email content

| Section | Content |
|---|---|
| Streak | Current streak + longest streak |
| Vocab | Words practised this week, vocab score + change |
| Grammar | Concept practised last, next concept preview |
| CTA | "Continue →" → `/session` |

If the user did nothing this week: "Your French is waiting" + single CTA. No shame, no stats.

### Technical implementation
- Cron job every Sunday at 08:00 local time (approximate — send at 08:00 UTC as a first pass)
- Query: all users where `last_session_date IS NOT NULL` and email confirmed
- Aggregate stats from `sessions` and `profiles` tables
- Unsubscribe link required (one-click, sets `email_weekly_digest boolean DEFAULT true` to false)

### Schema changes
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_weekly_digest boolean NOT NULL DEFAULT true;
```

### Success metrics
- Open rate: target >30%
- Click-to-session rate: target >15% of openers
- Unsubscribe rate: watch for >2% (signal that content is irrelevant)

---

## 3. CEFR Level Certificate

**Category:** Viral / Acquisition
**Effort:** Low
**Priority:** 3

### Problem
The promotion gate (e.g. B1 → B2) is a significant achievement that currently produces no shareable artefact. The moment passes silently.

### Solution
When a user passes a promotion gate, generate a shareable certificate image (or styled page) they can post to LinkedIn, Twitter, or send directly.

### Certificate content
```
[LexiTree wordmark]

This certifies that

[Full Name]

has demonstrated B1 French proficiency

Assessed May 2026 · LexiTree
```

### Technical implementation

**Option A — Styled share page (recommended, low effort)**
Reuse the `/share/[id]` infrastructure. New `type: 'certificate'` in `shared_results`. Page renders the certificate layout. User copies link or downloads as PNG via browser print-to-PDF.

**Option B — Server-side image generation**
Use `@vercel/og` (Satori) to generate a PNG at `/api/og/certificate/[id]`. Higher effort, better for social previews.

Start with Option A. Upgrade to B if share rate justifies it.

### Trigger
Certificate is offered in the summary card when `promotion` is returned from `/api/save-session`. Currently the promotion banner shows — add a "Download certificate →" button alongside it.

### Schema changes
No new schema needed — reuses `shared_results` with `type: 'certificate'`.

Add `level_achieved text` to `shared_results`:
```sql
ALTER TABLE shared_results
  ADD COLUMN IF NOT EXISTS level_achieved text;
```

### Success metrics
- Certificate generation rate: % of eligible promotions where certificate is created
- Referral attribution: new users arriving via certificate links

---

## 4. Concept SEO Pages

**Category:** Acquisition
**Effort:** Medium
**Priority:** 4

### Problem
LexiTree has zero organic search presence. Every grammar concept in `grammar-map.js` maps to a high-volume search query ("French futur simple", "French subjunctive rules", "passé composé vs imparfait"). This traffic is going to competitor content sites with no product.

### Solution
Static pages at `/concept/[slug]` — one per grammar concept. Each page shows:
- Concept name + CEFR level
- The rule (already in `grammar-map.js`)
- The formula strip
- An example sentence
- CTA: "Test your French level — free" → `/assess`

### URL structure
`/concept/futur_simple` → "Le futur simple — French Grammar · LexiTree"

### Page content (per concept)
| Section | Source |
|---|---|
| Title | `concept.nameFr` |
| Level badge | `concept` level from grammar map |
| Rule | `concept.rule` |
| Formula | `concept.formula` |
| Example sentence | First panel from cached lesson (if available) or static example |
| CTA | → `/assess` |

### Technical implementation
- `generateStaticParams()` from all slugs across all levels in `grammar-map.js`
- Server component — no client JS needed
- `generateMetadata()` for each slug targeting the primary search query
- Reuse existing `FormulaStrip` component

### SEO metadata template
```
title: "Le futur simple — French Grammar Guide · LexiTree"
description: "Learn the futur simple in French. Rule, formula, examples. Free placement test included."
```

### Success metrics
- Organic impressions (Google Search Console)
- CTA click rate on concept pages
- Assess completion rate from concept page traffic

---

## 5. Friend Challenge

**Category:** Viral / Acquisition
**Effort:** Medium
**Priority:** 5

### Problem
The 7/7 moment is the highest-emotion point in the product. Currently the only exit from that moment is "Practice again." There is no social hook.

*(Note: shareable result cards address passive sharing. Friend challenge adds competitive, directed sharing.)*

### Solution
After a 7/7 session, show: **"Challenge a friend →"**

Generates a unique link tied to the same grammar concept and question set. The recipient:
1. Lands on a challenge page showing the challenger's score
2. Answers the same 7 questions (served from the question bank, same concept)
3. Sees a comparison at the end ("You got 6/7. [Name] got 7/7.")
4. Is prompted to register and track their level

### URL structure
`/challenge/[id]`

### Schema changes
```sql
CREATE TABLE challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid REFERENCES auth.users(id),
  display_name  text,
  concept       text NOT NULL,
  level         text NOT NULL,
  score         integer NOT NULL,
  total         integer NOT NULL,
  question_ids  uuid[] NOT NULL,
  created_at    timestamptz DEFAULT now()
);
```

### Technical implementation
1. "Challenge a friend →" button in grammar `SummaryCard` on 7/7 (not lower scores)
2. `POST /api/create-challenge` — stores challenge row, returns ID
3. `/challenge/[id]` — public page, shows challenger's score, runs the same questions
4. On completion: show comparison screen + sign-up CTA

### Scoping note
The challenge uses the same `question_ids` from the original session — so the recipient gets the identical questions, not a freshly generated set. This ensures fair comparison and avoids additional AI calls.

### Success metrics
- Challenge creation rate: % of 7/7 grammar sessions where challenge link is created
- Challenge completion rate: % of challenge page visits that complete all 7 questions
- Challenge conversion rate: % of completers who register

---

## Out of scope (this iteration)

**Embeddable widget** — "Test your French" iframe embed for external sites. High effort, dependent on auth flow working cleanly in iframe context. Revisit after SEO pages are live and driving traffic organically.

---

## Implementation order

| # | Hook | Effort | Owner |
|---|---|---|---|
| 1 | Streak recovery email | Low | Backend |
| 2 | Weekly progress email | Medium | Backend + Email |
| 3 | CEFR certificate | Low | Frontend |
| 4 | Concept SEO pages | Medium | Frontend |
| 5 | Friend challenge | Medium | Full stack |
| — | Embeddable widget | High | Later |
