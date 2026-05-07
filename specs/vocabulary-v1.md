# Spec: Vocabulary V1 — Grammar-Anchored Vocabulary

**Status:** Pending approval  
**Date:** 2026-05-07

---

## Problem

Grammar comprehension is bottlenecked by vocabulary range. A B1 user who understands the *subjonctif présent* rule but doesn't recognise *bien que* as a subjunctive trigger will fail exercises not because of grammar knowledge but because of vocabulary. Today Mistral chooses vocabulary freely — we have no visibility into which words users encounter, and no mechanism to systematically expand their grammatical vocabulary range.

---

## Solution

Build a curated master vocabulary list of grammar-critical words. Pass words from this list to Mistral during question generation. Mistral uses them as the grammatically testable element in exercise sentences. Tag each question with the vocabulary word it used. Track which words each user has encountered. Surface a word count in the sidebar.

Vocabulary learning is invisible to the user — it happens through better, more systematic exercises, not a separate quiz or flash card UI.

---

## Vocabulary Scope

**In scope — grammar-critical parts of speech only:**

| Part of speech | Grammar role | Example |
|---|---|---|
| Verbs | Conjugation, tense, mood exercises | *parvenir, accomplir, promettre* |
| Adjectives | Agreement, placement, comparative | *ambitieux, jaloux, vif* |
| Adverbs | Temporal forcing cues, tense selection | *jadis, soudain, désormais* |
| Conjunctions | Mood/tense triggers | *bien que, à condition que, pourvu que* |
| Prepositions | Verb + preposition collocations | *à, de, pour* (in context) |

**Out of scope:** Nouns — grammatically neutral, Mistral picks freely.

---

## Master Vocabulary List

**File:** `src/data/vocabulary-map.js`  
**Philosophy:** Same as `grammar-map.js` — static curriculum data, zero latency, changes only on course redesign.

### Word shape

```js
{
  word: 'parvenir',
  definition: 'to manage / to succeed in',
  pos: 'verb',              // 'verb' | 'adjective' | 'adverb' | 'conjunction' | 'preposition'
  level: 'B1',
  concept: 'futur_simple',  // optional — null means level-wide
  tier: 'concept',          // 'concept' | 'level' | 'cross-level'
}
```

### Tiers and serving priority

| Tier | Description | Served when |
|---|---|---|
| `concept` | Words specific to one grammar concept | Active concept matches |
| `level` | Words useful across any concept at this level | Always available at this level |
| `cross-level` | High-frequency grammar words (prepositions, core conjunctions) | Always available, any level |

### List size

~55–60 words per level, ~350 total across A1–C2. Breakdown per level:
- 20–25 verbs (level-wide)
- 10 concept-specific adverbs (temporal forcing cues)
- 8–10 conjunctions (mood/tense triggers)
- 8–10 adjectives (agreement practice)
- 5–8 prepositions (verb collocations)

**First draft:** Mistral-generated per level, human-reviewed, committed to code.

Prompt for generation:
> "Give me the 60 most grammatically important French words at [LEVEL] — verbs, adjectives, adverbs, conjunctions, and prepositions only. For each: French word, English definition, part of speech, and the grammar concept it most directly supports. No nouns."

---

## Question Generation Changes

### Words passed per session

The number of vocabulary-seeded questions is **concept-type-aware**, not a fixed number. The concept slug determines how many words are passed:

| Concept type | Words passed | Rationale |
|---|---|---|
| Verb tense (futur, imparfait, etc.) | 3–4 verbs | Core element being conjugated |
| Mood (subjonctif, conditionnel) | 2 conjunctions + 1 verb | Trigger word + conjugation both matter |
| Agreement (adjective) | 3–4 adjectives | Core element being agreed |
| Verb + preposition | 2–3 prepositions + 1 verb | Collocation is the rule |

Words are passed as an array to the generation call. Implicitly, one word = one seeded question.

### Prompt instruction per part of speech

```
For each vocabulary word provided, use it in exactly one question as follows:
- verb: conjugated form must appear as the correct answer in the blank
- adjective: agreed form (correct gender/number) must appear as the correct answer
- adverb: word must appear in the question stem as a temporal/contextual forcing cue
- conjunction: word must appear in the question stem to trigger the required mood or tense
- preposition: must appear as part of a verb + preposition collocation in the correct answer
```

### Quality gate (post-generation)

After Mistral responds, verify each vocabulary-seeded question:

| Part of speech | Check |
|---|---|
| verb | Word root appears in `question.answer` |
| adjective | Word root appears in `question.answer` |
| adverb | Word appears in `question.question` |
| conjunction | Word appears in `question.question` |
| preposition | Word appears in `question.answer` |

If check fails: do not tag the question with the vocabulary word. Log for monitoring. Do not regenerate in V1 — question is still valid, just untagged.

---

## Schema Changes

### `questions` table

```sql
ALTER TABLE questions ADD COLUMN vocabulary_word text;
ALTER TABLE questions ADD COLUMN vocabulary_pos  text;
```

Both nullable. Null = freely generated question with no vocabulary seeding.

### `profiles` table

```sql
ALTER TABLE profiles ADD COLUMN vocabulary_seen jsonb DEFAULT '[]'::jsonb;
```

Array of unique vocabulary words the user has encountered across all sessions. Appended at session save time.

### Question bank

**Truncate and rebuild.** Old questions are incompatible — missing `wrong_explanations`, missing `vocabulary_word`, generated with old prompt. Run:

```sql
TRUNCATE TABLE questions;
```

---

## Session Save Changes (`save-session/route.js`)

After saving the session, extract vocabulary words from the questions that were served:

1. Fetch the question rows that were served this session (by ID — requires question IDs to be included in the session save payload)
2. Extract non-null `vocabulary_word` values, deduplicate
3. Append new words to `profiles.vocabulary_seen` (union with existing array)

**Note:** This requires the session save payload to include the IDs of questions served. Currently it does not — this is an additional change to the session page and save-session route.

---

## Sidebar Change (`session/page.js`)

Add below the level display in the sidebar:

```
47 words
encountered at B1
```

Computed from `profiles.vocabulary_seen.length` — available from the profile fetch in `useAuth`.

---

## Files Touched

| File | Change |
|---|---|
| `src/data/vocabulary-map.js` | New file — master vocabulary list |
| `src/app/api/generate-questions/route.js` | Pass vocabulary words to Mistral, apply quality gate, store vocabulary_word + vocabulary_pos |
| `src/app/api/save-session/route.js` | Accept question IDs in payload, append vocabulary_seen to profile |
| `src/app/session/page.js` | Include question IDs in save-session payload, show word count in sidebar |
| `src/hooks/useAuth.js` | Expose vocabulary_seen count from profile |
| Supabase | Run ALTER TABLE migrations for questions and profiles |

---

## Out of Scope (V2)

- Comprehension analytics per word (requires question-level result tracking)
- Per-user word rotation — serve unseen words first (requires per-user word tracking beyond vocabulary_seen)
- Breakdown by part of speech in sidebar ("23 verbs, 12 conjunctions…")
- Spaced repetition
- Vocabulary questions as a distinct question type
- Separate vocabulary session mode

---

## Success Metric

**Primary:** Session completion rate — does adding vocabulary-seeded questions increase or decrease completion? A/B holdout from launch day. If completion drops > 2 percentage points, revert vocabulary seeding.

**Secondary:** 30-day retention split by users who encountered vocabulary seeding vs control group.

---

## Dependencies

- Question bank must be truncated before launch
- Supabase migrations must run before deploy
- `vocabulary-map.js` must be written and reviewed before question generation changes are implemented
