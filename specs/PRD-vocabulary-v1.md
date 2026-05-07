# Product Requirements Document
# Grammar-Anchored Vocabulary

**Status:** Draft — Pending approval  
**Date:** 2026-05-07  
**Author:** Product  
**Target release:** V1

---

## Problem

Lexitree teaches French grammar rules, but grammar comprehension is bottlenecked by vocabulary range. A B1 user who understands the *subjonctif présent* rule but doesn't recognise *bien que* as a subjunctive trigger will consistently fail exercises — not because of grammar knowledge, but because of vocabulary. Today Mistral picks vocabulary freely during question generation. We have no visibility into which words users encounter, no mechanism to systematically expand their grammatical vocabulary range, and no way to detect vocabulary-driven failure vs grammar-driven failure.

---

## Goals

- Systematically expose users to grammar-critical French vocabulary through existing grammar exercises
- Track vocabulary exposure per user without adding a separate learning mode or habit
- Give users a visible signal of vocabulary progress
- Keep session completion rate flat or improved (vocabulary must not add friction)

## Non-goals

- Teaching general French vocabulary (nouns, thematic word sets)
- Building a separate vocabulary quiz or flash card mode
- Spaced repetition (V2)
- Per-user word targeting — serving unseen words first per individual (V2)
- Vocabulary comprehension scoring (V2)

---

## User stories

**As a learner**, I want the exercises I already do to expand my vocabulary naturally, so I'm not practicing grammar with the same five words every session.

**As a learner**, I want to see how many French words I've encountered, so I have a second axis of progress beyond my grammar level.

**As a learner**, I want vocabulary to feel like part of grammar practice, not a separate task — so I don't have to do two things to make progress.

---

## Background and rationale

### Why grammar-anchored vocabulary specifically

Lexitree is a grammar app. Adding general vocabulary (food, travel, daily life) would dilute the product identity and compete directly with Duolingo. Grammar-anchored vocabulary is differentiated — words are taught because of their grammatical role, not their thematic category:

- Temporal adverbs (*jadis, soudain, désormais*) are forcing cues — they determine which tense is grammatically correct
- Conjunctions (*bien que, pourvu que*) trigger specific moods — knowing the word IS knowing the rule
- Verbs expand the range of grammar rules a user can apply — understanding futur simple with 5 verbs vs 50 verbs is a different level of fluency
- Adjectives enable agreement practice across more contexts

### Why embedded, not separate

Separate vocabulary modes get abandoned. Users come to Lexitree for grammar sessions — asking for a second daily habit is a retention risk. Embedding vocabulary inside existing exercises means vocabulary learning is invisible. Users don't experience it as extra work.

### Why 7 words per session

One vocabulary word per question. Every question in a session exposes the user to one intentional vocabulary item. No additional time cost. The word appears in a grammatically meaningful sentence — the strongest context for retention.

---

## Feature definition — V1

### 1. Vocabulary bank

A curated master list of grammar-critical French words, organised by CEFR level.

**In scope:**

| Part of speech | Grammar role | Example |
|---|---|---|
| Verbs | Conjugation, tense, mood exercises | *parvenir, accomplir, promettre* |
| Adjectives | Agreement, placement, comparative | *ambitieux, jaloux, vif* |
| Manner adverbs | Context enrichment, tense-agnostic | *rapidement, souvent, absolument* |
| Prepositions | Verb + preposition collocations | *parvenir à, rêver de* |

**Excluded:**

| Part of speech | Reason |
|---|---|
| Nouns | Grammatically neutral — no value in controlling |
| Temporal adverbs (*soudain, jadis*) | Already covered by forcing cue rules in prompt — redundant |
| Conjunctions (*bien que, si*) | Grammar-locked to specific moods/tenses — conflict-prone if passed to wrong concept |

Temporal adverbs and conjunctions are already systematically present in exercises through the existing forcing cue prompt rules. Excluding them from the vocabulary bank has no learning cost and eliminates all concept-vocabulary conflict risk.

**Size:** ~40–45 words per level, ~260 total across A1–C2.

**Location:** `src/data/vocabulary-map.js` — static file, same philosophy as `grammar-map.js`. Zero latency, changes only on curriculum redesign.

**Word shape:**
```js
{
  word: 'parvenir',
  definition: 'to manage / to succeed in',
  pos: 'verb',
  level: 'B1',
}
```

No concept field — all words are level-wide and safe for any concept at that level.

**First draft:** Mistral-generated per level, human-reviewed, committed to code.

---

### 2. Vocabulary-seeded question generation

Every question generation call passes 7 vocabulary words to Mistral — one per question. Mistral uses each word naturally in whichever question it fits best. Mistral decides placement and reports back which word it used per question via a `vocabularyWord` field in the JSON response.

**Prompt addition:**
> "Use each of the following words exactly once across the 7 questions, placing each in whichever question it fits most naturally. The word may appear conjugated in the blank, as part of the sentence context, or in a supporting clause. Add a 'vocabularyWord' field to each question with the exact word used."

**Word selection:** 7 words from `vocabulary-map.js` at the active level, ordered by `use_count ASC` — least-used words across all sessions at this level served first. No concept filtering needed — all words are level-wide and safe for any concept.

---

### 3. Schema changes

**`questions` table:**
```sql
ALTER TABLE questions ADD COLUMN vocabulary_word text;
ALTER TABLE questions ADD COLUMN vocabulary_pos  text;
```

Populated from `vocabularyWord` in Mistral's response. Nullable — old banked questions have null.

**`profiles` table:**
```sql
ALTER TABLE profiles ADD COLUMN vocabulary_seen jsonb DEFAULT '[]'::jsonb;
```

Array of unique vocabulary words the user has encountered. Appended at session save.

**Question bank:** Truncate and rebuild. Old questions are incompatible with the new prompt and missing `vocabulary_word`.

```sql
TRUNCATE TABLE questions;
```

---

### 4. Vocabulary tracking — count-based, signed-in users only

`vocabulary_seen` on `profiles` is a JSONB object mapping word → integer encounter count:

```json
{ "parvenir": 3, "accomplir": 1, "ambitieux": 2 }
```

After each session, `session/page.js` extracts vocabulary words from served questions and passes them to `save-session`. The route increments the count for each word on the user's profile.

**Guests are not tracked.** Vocabulary words are still passed to Mistral for guests (better question quality), but no counts are written — guests have no profile row.

**New users** start with `'{}'::jsonb` — an empty object. First session populates it.

**Word selection** is per-user: words sorted by `vocabulary_seen[word] ?? 0` ascending — words the user has seen least are served first. Guests fall back to random selection.

---

### 5. Sidebar — vocabulary word count

Below the level display in the sidebar:

```
─────────────────
Your level
B1  Intermediate

47 words
encountered at B1
─────────────────
```

Computed from `vocabulary_seen.length` filtered by current level.

---

## Feature definition — V2 (out of scope now)

| Feature | Description |
|---|---|
| Comprehension analytics | Track question-level results per word to infer per-word comprehension |
| Per-user word targeting | Serve words the user hasn't seen yet, prioritised per individual |
| Breakdown by part of speech | "23 verbs · 12 conjunctions · 8 adjectives" in sidebar |
| Spaced repetition | Re-surface words the user struggled with on a decay schedule |
| Vocabulary questions | Dedicated vocabulary question type alongside grammar questions |

V2 is gated on V1 showing 30-day retention lift in A/B test.

---

## Success metrics

| Metric | Target | How measured |
|---|---|---|
| Session completion rate | No regression vs control (< 2pp drop) | A/B holdout from launch |
| 30-day retention | Lift vs control | A/B holdout — treatment vs control |
| Vocabulary seen growth | Avg words encountered per user after 10 sessions | `vocabulary_seen` array length |

**A/B holdout:** 50/50 split from launch day. Control group receives no vocabulary seeding (questions generated as today). Treatment group receives vocabulary-seeded questions. Hold for 30 days before evaluating V2.

---

## Dependencies

| Dependency | Owner | Required before |
|---|---|---|
| `vocabulary-map.js` written and reviewed | Product / content | Question generation changes |
| Supabase migrations run | Engineering | Deploy |
| Question bank truncated | Engineering | Deploy |
| Question IDs included in save payload | Engineering | Session save changes |

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vocabulary seeding makes questions feel forced or awkward | Medium | Mistral has free placement — grammar-critical words are naturally hard to use shallowly |
| Session completion rate drops | Low-Medium | A/B holdout catches this — revert if > 2pp drop |
| Mistral ignores vocabulary instruction | Low | Post-generation check: verify `vocabularyWord` field is present and word appears in question text |
| Question bank rebuild causes cold start (no bank for first users) | Medium | Bank rebuilds quickly once users start sessions — first session per concept generates live |

---

## Open questions

| Question | Status |
|---|---|
| Should vocabulary words be concept-aware or level-only? | Decided: concept-aware preferred, level-wide fallback |
| Should we show vocabulary word count broken down by pos in sidebar? | Deferred to V2 |
| Should accepting a recalibration reset `vocabulary_seen`? | Open — if user drops from B2 to B1, do B2 words stay in their count? |
