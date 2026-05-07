# Spec: Vocabulary V1 — Grammar-Anchored Vocabulary

**Status:** Pending approval  
**Date:** 2026-05-07

---

## Problem

Grammar comprehension is bottlenecked by vocabulary range. Today Mistral picks vocabulary freely during question generation — we have no visibility into which words users encounter, and no mechanism to systematically expand their vocabulary range. Users may practice the same grammar rule repeatedly with the same handful of words, limiting their ability to generalise the rule.

---

## Solution

Build a curated master vocabulary list of grammar-critical words. Pass 7 words — one per question — to Mistral during question generation. Mistral uses each word naturally in whichever question it fits best. Tag each question with the vocabulary word used. Track which words each user has encountered. Surface a word count in the sidebar.

Vocabulary learning is invisible — it happens through better, more systematic exercises, not a separate quiz or flash card UI.

---

## Vocabulary Scope

**In scope:**

| Part of speech | Role | Example |
|---|---|---|
| Verbs | Core element in conjugation/tense/mood exercises | *parvenir, accomplir, promettre* |
| Adjectives | Agreement, placement, comparative exercises | *ambitieux, jaloux, vif* |
| Manner adverbs | Context enrichment, tense-agnostic | *rapidement, souvent, absolument* |
| Prepositions | Verb + preposition collocations | *parvenir à, rêver de* |

**Excluded:**

| Part of speech | Reason |
|---|---|
| Nouns | Grammatically neutral — Mistral picks freely, no value in controlling |
| Temporal adverbs (*soudain, jadis*) | Already systematically used as forcing cues in the prompt — redundant |
| Conjunctions (*bien que, si*) | Already systematically used as forcing cues in the prompt — redundant and conflict-prone |

Temporal adverbs and conjunctions are grammar-locked to specific tenses and moods. Passing them to a mismatched concept session produces bad French or wasted slots. Since they are already covered by the existing forcing cue rules in the prompt, excluding them from the vocabulary bank has no learning cost.

---

## Master Vocabulary List

**File:** `src/data/vocabulary-map.js`  
**Philosophy:** Same as `grammar-map.js` — static curriculum data, zero latency, changes only on curriculum redesign.

### Word shape

```js
{
  word: 'parvenir',
  definition: 'to manage / to succeed in',
  pos: 'verb',     // 'verb' | 'adjective' | 'adverb' | 'preposition'
  level: 'B1',
}
```

No concept field — all words are level-wide and safe for any concept at that level.

### List size

~40–45 words per level, ~260 total across A1–C2:
- 20–25 verbs
- 8–10 adjectives
- 5–7 manner adverbs
- 5–8 prepositions (in verb collocation context)

**First draft:** Mistral-generated per level, human-reviewed, committed to code.

Generation prompt:
> "Give me the 40 most important French vocabulary words for grammar practice at [LEVEL] — verbs, adjectives, manner adverbs, and prepositions only. No nouns, no temporal adverbs (soudain, jadis, etc.), no conjunctions. For each: French word, English definition, part of speech."

---

## Question Generation Changes

### How it works

Every question generation call receives 7 vocabulary words from the bank (least-used first by `use_count` at the active level). Mistral is instructed to use each word exactly once across the 7 questions, in whichever question it fits most naturally. Mistral reports back which word it used per question via a `vocabularyWord` field in the JSON response.

### Prompt addition

Replace rule 6 ("Vocabulary appropriate for ${level}") with:

```
6. VOCABULARY: Use each of the following words exactly once across the 
   ${count} questions, placing each in whichever question it fits most 
   naturally. The word may appear conjugated in the blank, as part of 
   the sentence context, or in a supporting clause.
   Words: [word1, word2, word3, word4, word5, word6, word7]
   Add a "vocabularyWord" field to each question with the exact word used.
```

### Updated JSON shape

```json
{
  "question": "Elle ___ à finir avant minuit.",
  "options": ["parviendra", "parvenait", "est parvenue", "parviendrait"],
  "answer": "parviendra",
  "explanation": "...",
  "wrongExplanations": { ... },
  "vocabularyWord": "parvenir"
}
```

### Word selection

Pick 7 words from `vocabulary-map.js` filtered by `level === activeLevel`, ordered by `use_count ASC` from the questions table (words least recently used across all sessions at this level).

### Quality gate

After generation, verify `vocabularyWord` is present and non-empty on each question. If missing — question is still valid and saved, just stored with `vocabulary_word: null`. Log for monitoring.

---

## Schema Changes

### `questions` table

```sql
ALTER TABLE questions ADD COLUMN vocabulary_word text;
ALTER TABLE questions ADD COLUMN vocabulary_pos  text;
```

Both nullable. Null = freely generated, no vocabulary seeding.

### `profiles` table

```sql
ALTER TABLE profiles ADD COLUMN vocabulary_seen jsonb DEFAULT '[]'::jsonb;
```

Array of unique vocabulary words the user has encountered. Appended at session save.

### Question bank

**Truncate and rebuild.** Old questions incompatible with new prompt and missing columns.

```sql
TRUNCATE TABLE questions;
```

---

## Session Save Changes

The session save payload must include IDs of questions served. The save-session route:

1. Fetches `vocabulary_word` for each served question ID
2. Deduplicates
3. Appends new words to `profiles.vocabulary_seen`

Requires a small change to the session page — include question IDs in the save payload.

---

## Sidebar

Add below the level display:

```
47 words
encountered at B1
```

Computed from `profiles.vocabulary_seen` filtered by current level. Available via profile fetch in `useAuth`.

---

## Files Touched

| File | Change |
|---|---|
| `src/data/vocabulary-map.js` | New — master vocabulary list |
| `src/app/api/generate-questions/route.js` | Pass 7 words to Mistral, tag questions with vocabularyWord |
| `src/app/api/save-session/route.js` | Accept question IDs, append vocabulary_seen to profile |
| `src/app/session/page.js` | Include question IDs in save payload, show word count in sidebar |
| `src/hooks/useAuth.js` | Expose vocabulary_seen from profile |
| Supabase | Run ALTER TABLE migrations |

---

## Out of Scope (V2)

- Comprehension analytics per word
- Per-user word rotation (serve unseen words first per individual)
- Pos breakdown in sidebar
- Spaced repetition
- Vocabulary question type

---

## Success Metrics

**Primary:** Session completion rate — A/B holdout from launch. Revert if > 2pp drop.  
**Secondary:** 30-day retention lift vs control group.

---

## Dependencies

- `vocabulary-map.js` written and reviewed before question generation changes
- Supabase migrations run before deploy
- Question bank truncated before deploy
