# Network effect — community content system

## Overview

AI-generated exercises created during individual user sessions are captured, quality-filtered, and promoted into a shared question bank accessible to all users at the same CEFR level. Over time the platform's content improves purely through usage — no manual editorial work required.

---

## Problem statement

A purely AI-generated exercise pool has no memory. Every user starts from the same baseline, and good exercises disappear after a single session. There is no compound value from the platform growing its user base — each user's experience is independent of everyone else's.

This feature introduces a flywheel: more users → more exercises generated → better quality filtering → richer shared bank → better experience for all users.

---

## Goals

- Capture the best AI-generated exercises and make them reusable across all users at the relevant level
- Build a self-improving content layer that requires no human curation
- Give users a sense of contribution and shared ownership over the curriculum
- Maintain exercise quality by preventing poor AI-generated content from propagating

---

## Non-goals

- User-facing content creation tools (v1 — passive capture only; active authoring by advanced users is a future consideration)
- Cross-level content sharing (a B2 exercise is never surfaced to an A1 user)
- Manual editorial review pipelines

---

## How it works

### 1. Capture

Every AI-generated exercise is stored at the point of creation with the following metadata:

| Field | Description |
|---|---|
| `exercise_id` | Unique identifier |
| `level` | CEFR level (A1–C2) |
| `topic` | Grammar concept (e.g. subjonctif, passé composé) |
| `type` | fill_blank / multiple_choice / fix_error / translate |
| `generated_for` | User ID of originating session |
| `created_at` | Timestamp |
| `status` | `provisional` → `community` → `featured` |

### 2. Quarantine pool

New exercises enter a **provisional** state. They are served to a random sample of 20 users before being considered for promotion. This limits exposure to potentially low-quality content while gathering enough signal to make a quality judgment.

### 3. Promotion thresholds

An exercise is promoted from `provisional` to `community` if it meets all of the following after 20 completions:

- No flags raised
- Accuracy rate between **25% and 85%** — outside this band suggests the exercise is either trivial or ambiguous
- Completion time within 2 standard deviations of the mean for that exercise type and level

An exercise is discarded if:
- It receives 2 or more flags
- Accuracy falls outside the 25–85% band
- It is flagged by the automated grammar validator (see Quality controls below)

An exercise is promoted from `community` to `featured` if, after 200 completions:
- Its topic shows a measurable reduction in error rate for users who attempted it in a subsequent session (learning signal > 0)
- It maintains an accuracy rate within band
- Flagging rate remains below 1%

### 4. User-facing contribution moment

When a user's session-generated exercise is promoted to `community`, they receive a notification:

> *"An exercise from your session is now being practiced by other B1 learners."*

When it reaches `featured`:

> *"An exercise from your session has become a community favourite — over 500 learners have practiced it."*

This turns contribution into a visible, motivating moment without requiring any active effort from the user.

---

## Content states

```
AI generates exercise
        │
        ▼
  [provisional]  ← served to 20-user sample
        │
   passes QA?
   ┌────┴────┐
  yes       no
   │         │
   ▼         ▼
[community] [discarded]
   │
200+ completions
+ learning signal?
   │
   ▼
[featured]
```

---

## Quality controls

### Automated grammar validation
Every AI-generated exercise is passed through a grammar validator before entering the quarantine pool. Exercises containing grammatically ambiguous target sentences are discarded at source.

### User flagging
Any user can flag an exercise as confusing, incorrect, or poorly worded. Two flags trigger immediate removal from circulation pending review. Flag rate is surfaced in the content health dashboard.

### Accuracy band enforcement
The 25–85% accuracy band is the primary quality signal. It is recalculated on a rolling basis and exercises that drift outside it after promotion are automatically demoted back to provisional.

---

## Level scoping

Content is strictly scoped by CEFR level. An exercise generated in a B1 session is only ever surfaced to B1 users. Level assignment is set at generation time and is immutable.

Topic tagging is used as a secondary filter — if a user has already demonstrated mastery of a topic (>90% accuracy across 10+ exercises), exercises for that topic are deprioritised in their session queue regardless of their community status.

---

## Content balance

The session exercise queue always maintains a ratio of shared bank content to fresh AI-generated content. This ratio shifts as the platform scales:

| Platform stage | Community content | AI-generated |
|---|---|---|
| Early (< 1k users) | 10% | 90% |
| Growth (1k–50k users) | 40% | 60% |
| Scale (> 50k users) | 70% | 30% |

This ensures the experience is never degraded during the early period when the shared bank is sparse.

---

## Future considerations

- **Active authoring** — allow B2+ users to write exercises for lower levels, subject to the same quality pipeline
- **Topic gap detection** — identify grammar concepts underrepresented in the community bank and bias AI generation toward filling them
- **Contributor profiles** — surface a user's contribution count and community impact on their profile screen
- **Duel mode integration** — featured exercises are prioritised as duel challenges, giving the best content the highest-stakes context

---

## Open questions

1. Should users be able to see exercises they personally contributed to the bank, and replay them?
2. What is the right notification cadence — immediate on promotion, or batched into a weekly summary?
3. How do we handle exercises that are correct but culturally specific (e.g. references that only resonate in certain regions)?
4. Should the accuracy band thresholds differ by exercise type — e.g. translation exercises may naturally have lower accuracy than multiple choice?
