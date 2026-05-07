# Spec: Vocabulary V1 — Grammar-Anchored Vocabulary

**Status:** Pending approval  
**Date:** 2026-05-07

---

## Problem

Grammar comprehension is bottlenecked by vocabulary range. Today Mistral picks vocabulary freely during question generation — we have no visibility into which words users encounter, and no mechanism to systematically expand their vocabulary range. Users may practice the same grammar rule repeatedly with the same handful of words, limiting their ability to generalise the rule.

---

## Solution

Build a curated master vocabulary list of grammar-critical words. Pass 7 words to Mistral per question generation call — one per question. Mistral uses each word naturally in whichever question it fits best and reports back which word it used. Tag each question with the vocabulary word used. Track how many times each signed-in user has encountered each word. Surface a word count in the sidebar.

Vocabulary learning is invisible — it happens through better, more systematic exercises, not a separate quiz or flash card UI.

---

## Vocabulary Scope

**In scope:**

| Part of speech | Role | Example |
|---|---|---|
| Verbs | Core element in conjugation / tense / mood exercises | *parvenir, accomplir, promettre* |
| Adjectives | Agreement, placement, comparative exercises | *ambitieux, jaloux, vif* |
| Manner adverbs | Context enrichment, tense-agnostic | *rapidement, souvent, absolument* |

**Excluded:**

| Part of speech | Reason |
|---|---|
| Nouns | Grammatically neutral — Mistral picks freely, no value in controlling |
| Temporal adverbs (*soudain, jadis*) | Grammar-locked to specific tenses — already covered by forcing cue rules in prompt |
| Conjunctions (*bien que, si*) | Grammar-locked to specific moods — conflict-prone if passed to wrong concept |

Temporal adverbs and conjunctions are grammar-locked: passing *bien que* to a futur simple session produces contradictory French. Both are already systematically present through existing forcing cue rules. Excluding them has no learning cost and eliminates all concept-vocabulary conflict risk.

---

## Master Vocabulary List

**File:** `src/data/vocabulary-map.js`  
**Philosophy:** Same as `grammar-map.js` — static curriculum data, zero latency, changes only on curriculum redesign. Exports `getVocabularyForLevel(level)`.

**Word shape:**
```js
{
  word: 'parvenir',
  definition: 'to manage / to succeed in',
  pos: 'verb',     // 'verb' | 'adjective' | 'adverb'
  level: 'B1',
}
```

No concept field — all words are level-wide and safe for any concept at that level.

**Size:** ~35 words per level, ~210 total across A1–C2 (verbs, adjectives, manner adverbs only).

---

## How Vocabulary Words Are Selected Per Session

Words are selected client-side in `session/page.js` using the user's `vocabulary_seen` object:

```js
function selectVocabularyWords(level, vocabularySeen) {
  const words = getVocabularyForLevel(level)
  return [...words]
    .sort((a, b) => (vocabularySeen[a.word] ?? 0) - (vocabularySeen[b.word] ?? 0))
    .slice(0, 7)
}
```

- Words the user has never seen (count = 0) are served first
- Words with the lowest encounter count are prioritised
- If fewer than 7 words exist for a level, all are passed

**Guests:** No `vocabulary_seen` available → words sorted randomly. Vocabulary words are still passed to Mistral (better question quality) but encounter counts are not tracked.

---

## Question Generation Changes (`generate-questions/route.js`)

**Request body** — new field:
```json
{ "level": "B1", "concept": {...}, "lesson": {...}, "vocabularyWords": [
  { "word": "parvenir", "pos": "verb" },
  ...
] }
```

**Prompt change** — replace old rule 6 ("Vocabulary appropriate for ${level}") with:

```
VOCABULARY — use each of the following words exactly once across the
${count} questions, placing each in whichever question it fits most
naturally. The word may appear conjugated in the blank, in the sentence
for context, or in a supporting clause. Add a "vocabularyWord" field to
that question in the JSON with the exact word used.
Words: parvenir, accomplir, ambitieux, ...
```

**Mistral reports back** — `vocabularyWord` field on each question:
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

**Saving to bank** — normalize and persist vocabulary fields:
```js
vocabulary_word: q.vocabularyWord ?? null,
vocabulary_pos:  q.vocabularyWord
  ? (vocabularyWords.find(v => v.word === q.vocabularyWord)?.pos ?? null)
  : null,
```

**Serving from bank** — include `vocabulary_word` and `vocabulary_pos` in the select query.

---

## User-Level Vocabulary Tracking

### Data model

**`vocabulary_seen` on `profiles` table** — a JSONB object mapping word → encounter count:

```json
{ "parvenir": 3, "accomplir": 1, "ambitieux": 2, "vif": 1 }
```

- Keys: vocabulary word strings (exact match to `vocabulary-map.js`)
- Values: integer count — how many sessions this user has encountered this word

**Default for new users:** `'{}'::jsonb` (empty object)

**Guests:** No profile row → no tracking. Vocabulary words are still passed to Mistral but counts are never written.

### Schema

```sql
ALTER TABLE questions ADD COLUMN vocabulary_word text;
ALTER TABLE questions ADD COLUMN vocabulary_pos  text;

ALTER TABLE profiles  ADD COLUMN vocabulary_seen jsonb DEFAULT '{}'::jsonb;
```

### How counts are updated

After each session completes, `session/page.js` extracts vocabulary words from the served questions and passes them to `save-session`:

```js
// In saveSession():
const servedVocabWords = questions
  .map(q => q.vocabulary_word ?? q.vocabularyWord)
  .filter(Boolean)

// Included in save-session POST body:
{ ..., vocabularyWords: servedVocabWords }
```

`save-session/route.js` updates the profile:

```js
async function updateVocabularySeen(userId, words) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('vocabulary_seen')
    .eq('id', userId)
    .single()

  const seen = profile?.vocabulary_seen ?? {}
  const updated = { ...seen }
  for (const word of words) {
    updated[word] = (updated[word] ?? 0) + 1
  }

  await supabase
    .from('profiles')
    .update({ vocabulary_seen: updated })
    .eq('id', userId)
}
```

Called only for authenticated users. Guests are skipped.

---

## Sidebar — Vocabulary Word Count

**Shown for signed-in users only.** Guests see nothing.

```
─────────────────
Your level
B1  Intermediate

47 words
encountered at B1
─────────────────
```

Count computed client-side:
```js
const levelWordSet = new Set(getVocabularyForLevel(level).map(v => v.word))
const vocabCount = Object.keys(vocabularySeen ?? {})
  .filter(w => levelWordSet.has(w)).length
```

`vocabularySeen` is fetched from the profile on session page mount and updated locally after each session save — no additional page reload needed.

---

## Session Page Changes (`session/page.js`)

1. Import `getVocabularyForLevel` from `vocabulary-map.js`
2. Add `vocabularySeen` state — fetched from profile on mount (when `user` is signed in)
3. `selectVocabularyWords(level, vocabularySeen)` — pick 7 least-seen words
4. Pass `vocabularyWords` to `fetchSession` → included in generate-questions body
5. In `saveSession`:
   - Extract `vocabulary_word` / `vocabularyWord` from served questions
   - Include `vocabularyWords` array in save-session body
   - On success, update local `vocabularySeen` state with incremented counts
6. Pass `vocabCount` to `Sidebar` component
7. `Sidebar` displays word count for signed-in users

---

## Files Touched

| File | Change |
|---|---|
| `src/data/vocabulary-map.js` | New — master vocabulary list, `getVocabularyForLevel()` |
| `src/app/api/generate-questions/route.js` | Accept `vocabularyWords`, update prompt, save `vocabulary_word` / `vocabulary_pos` |
| `src/app/api/save-session/route.js` | Accept `vocabularyWords`, call `updateVocabularySeen` for authenticated users |
| `src/app/session/page.js` | Fetch/track `vocabularySeen`, select words, pass to API, show sidebar count |
| Supabase | Run `ALTER TABLE` migrations for `questions` and `profiles` |

---

## Question Bank

**Truncate and rebuild.** Old questions are incompatible — missing `vocabulary_word` column and generated without vocabulary seeding.

```sql
TRUNCATE TABLE questions;
```

---

## What Changes for Guests

| Behaviour | Guest | Signed-in |
|---|---|---|
| Vocabulary words passed to Mistral | Yes — better questions | Yes |
| `vocabulary_seen` tracked | No | Yes |
| Sidebar word count shown | No | Yes |
| Word selection | Random | Least-seen first |

---

## Out of Scope (V2)

- Comprehension analytics per word (requires question-level result tracking)
- Breakdown by part of speech in sidebar ("23 verbs · 12 adverbs")
- Spaced repetition / decay intervals
- Vocabulary question type (dedicated quiz)
- Separate vocabulary session mode

---

## Success Metrics

**Primary:** Session completion rate — A/B holdout 50/50 from launch. Revert vocabulary seeding if completion drops > 2 percentage points.

**Secondary:** 30-day retention lift vs control group.

---

## Dependencies

| Item | Required before |
|---|---|
| Supabase `ALTER TABLE` migrations | Deploy |
| Question bank truncated (`TRUNCATE TABLE questions`) | Deploy |
| `vocabulary-map.js` reviewed | Question generation changes |
