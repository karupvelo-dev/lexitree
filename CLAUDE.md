# Lexitree — Engineering Reference

Lexitree is a French grammar learning app. Users are assessed, placed at a CEFR level (A1–C2), and practice daily sessions. Each session consists of a dynamically generated visual lesson followed by 7 fill-in-the-blank multiple-choice questions. Progress is tracked and tied to a TCF numerical score that gates level advancement.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | JavaScript (no TypeScript) |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL |
| AI | Mistral Large (via REST) |
| Styling | CSS custom properties (globals.css), inline styles |
| Deployment | Vercel (assumed) |

---

## Project structure

```
src/
├── app/
│   ├── page.js                      Landing — routes returning users, shows CTAs for new
│   ├── assess/page.js               CEFR placement assessment (7 AI-generated questions)
│   ├── session/page.js              Daily practice session (lesson + 7 questions)
│   ├── map/page.js                  Full grammar map across all levels
│   ├── archive/page.js              Session history (signed-in users only)
│   ├── auth/callback/route.js       OAuth code exchange → redirect to /session
│   └── api/
│       ├── generate-assessment/route.js   GET — 7 placement questions across A1–C1
│       ├── generate-lesson/route.js       POST — visual lesson for a concept (cached)
│       ├── generate-questions/route.js    POST — 7 practice questions (banked)
│       └── save-session/route.js          POST — saves session, updates score, checks promotion
├── data/
│   ├── grammar-map.js               All concept definitions for every level (A1–C2)
│   ├── concepts.js                  Legacy per-level defaults + LEVEL_INFO display metadata
│   └── assessment.js                estimateLevel() — scoring algorithm for placement
├── hooks/
│   └── useAuth.js                   Supabase auth state, Google sign-in, profile sync
└── lib/
    ├── mistral.js                   callMistral() — thin fetch wrapper with retry logic
    ├── level.js                     TCF score math: bands, deltas, clamp, promotion check
    ├── supabase.js                  Server-side client (service role key)
    └── supabase-browser.js          Browser client (anon key, used in client components)
```

---

## User flows

### New user
```
/ → (no level in localStorage) → show landing page
Landing → "Check my French level" → /assess
/assess → AI generates 7 questions while user reads intro
→ user answers → estimateLevel() → result card
→ "Begin session" → sets lexitree_level in localStorage → /session
```

### Returning user (guest)
```
/ → (level in localStorage) → redirect to /session
/session → confirm card → lesson → 7 questions → summary
```

### Returning user (signed in)
```
/ → useAuth resolves → syncProfileToStorage() fetches profile.level_score
→ writes lexitree_level to localStorage → redirect to /session
```

### Guest who signs in after assessment
```
assess → sets lexitree_level in localStorage (no profile yet)
→ later signs in via Google → SIGNED_IN event fires
→ syncProfileToStorage() returns false (no profile row)
→ createProfileFromStorage() creates profile from localStorage level
```

---

## Data model

### `profiles`
One row per authenticated user.

```sql
id            uuid   PRIMARY KEY  references auth.users(id)
email         text   NOT NULL
level_score   integer NOT NULL    -- TCF numeric score (100–699)
created_at    timestamptz
updated_at    timestamptz
```

RLS: users can read/insert/update their own row only.

### `sessions`
One row per completed practice session.

```sql
id            uuid   PRIMARY KEY
user_id       uuid   references auth.users(id)
level         text                    -- e.g. 'B1'
concept       text                    -- slug e.g. 'futur_simple'
concept_name  text                    -- display name e.g. 'Le futur simple'
score         integer                 -- first-attempt correct count
total         integer                 -- always 7
created_at    timestamptz
```

RLS: users can select/insert their own rows only.

### `questions`
The question bank — AI-generated questions accumulated over time, served by least-recently-used rotation.

```sql
id              uuid    PRIMARY KEY
level           text                    -- 'A1' … 'C2'
concept         text                    -- slug
type            text    DEFAULT 'multiple_choice'
question        text                    -- sentence with ___ blank
options         jsonb                   -- string[] of 4 options
answer          text                    -- must exactly match one option
explanation     text                    -- why the correct answer is right
wrong_explanations jsonb               -- { "option text": "why it's wrong" } for each wrong option
source          text    DEFAULT 'ai_generated'
use_count       integer DEFAULT 0       -- incremented each time question is served
correct_count   integer DEFAULT 0
flag_count      integer DEFAULT 0
created_at      timestamptz
```

Index on `(level, concept)` for fast concept queries. Index on `use_count` for rotation.

RPC `increment_use_counts(p_ids uuid[])` — atomically bumps use_count for all served question IDs.

**Bank thresholds** (defined in `generate-questions/route.js`):
- `BANK_SERVE_THRESHOLD = 7` — minimum questions before serving from bank instead of generating live
- `BANK_TARGET = 50` — keep growing in background until this many per concept

### `concept_lessons`
Cache for AI-generated lessons. One row per (level, concept). Generated once, reused forever.

```sql
id         uuid    PRIMARY KEY
level      text    NOT NULL
concept    text    NOT NULL     -- slug
lesson     jsonb   NOT NULL     -- full lesson object (panels, conjugation, timeline, etc.)
created_at timestamptz
UNIQUE(level, concept)
```

---

## AI integration

All AI calls go through `lib/mistral.js`, which wraps Mistral's chat completions endpoint. JSON mode is on by default (`response_format: { type: 'json_object' }`). Retries: 2 attempts with 1.5s/3s backoff.

```js
callMistral({ messages, model, temperature, json, retries })
// Returns: raw text content of first choice (already a JSON string when json: true)
```

**Model:** `mistral-large-latest`  
**Temperatures:** 0.4 for lessons (more consistent structure), 0.5 for questions (more variety)

### Lesson generation (`/api/generate-lesson`)

1. Check `concept_lessons` table — return cached lesson if found.
2. On cache miss, build prompt with concept metadata (level, nameFr, name, rule, formula, keyTerms).
3. Call Mistral. Parse JSON. Upsert to cache (fire-and-forget).
4. Return lesson with `source: 'cache' | 'generated'`.

**Lesson JSON shape:**
```json
{
  "panels": [{ "num", "color", "title", "titleFr", "fr", "en", "highlight", "note" }],
  "conjugation": { "verb": "parler", "rows": [{ "pronoun", "form" }] },
  "timelinePoints": [{ "label", "sublabel", "color" }],
  "keyIdea": "...",
  "takeaway": "..."
}
```

`conjugation` is included only for verb-tense/mood concepts. `timelinePoints` only for temporally-positioned tenses (futur simple, imparfait, passé composé, plus-que-parfait, etc.) — never for modal or mood concepts.

### Question generation (`/api/generate-questions`)

The session page fetches lesson first, then passes it to question generation. This ensures every generated question is lesson-seeded — the prompt references exact lesson vocabulary and constructions.

**Bank logic:**
```
if bankSize >= 7:
    serve 7 from least-used pool (rotation)
    increment use_count for served IDs
    if bankSize < 50: grow bank in background (fire-and-forget)
else:
    generate 7 live with lesson context
    save to bank (fire-and-forget)
```

Options are shuffled before serving so the correct answer is never in a predictable position.

**Prompt enforces:**
- One unambiguous correct answer
- Structural forcing cues (déjà, soudain, il faut que, si + PQP…) that eliminate every wrong option
- `wrongExplanations` JSONB: one targeted sentence per wrong option naming its tense and why the forcing cue rules it out

### Assessment generation (`/api/generate-assessment`)

GET endpoint — no request body. Picks concepts via `DISTRIBUTION = { A1:1, A2:2, B1:2, B2:1, C1:1 }`, generates all 7 questions in one Mistral call ordered A1 → C1. Not banked (always fresh). Options shuffled before response.

---

## Level system

### TCF score bands (`lib/level.js`)

| CEFR | TCF range | Mid (initial score) |
|------|-----------|---------------------|
| A1   | 100–199   | 150 |
| A2   | 200–299   | 250 |
| B1   | 300–399   | 350 |
| B2   | 400–499   | 450 |
| C1   | 500–599   | 550 |
| C2   | 600–699   | 650 |

When a user completes assessment at level X, their profile is seeded with `levelToScore(X)` (the mid-point of that band).

### Session delta

Applied after every completed session. Based on first-attempt accuracy only (retries after wrong guesses don't count).

| First-attempt accuracy | Delta |
|------------------------|-------|
| 7/7 (100%)             | +15   |
| 6/7 (≥85%)             | +10   |
| 5/7 (≥70%)             | +5    |
| 4/7 (≥57%)             | 0     |
| ≤3/7                   | −5    |

Score is clamped to [100, 699]. Band boundaries are soft — the score can drift within the level band without triggering a display change.

### Promotion gate (`checkPromotion`)

Runs after every session for levels that have a full concept ORDER defined in `LEVEL_CONCEPTS` (currently only B1). All three conditions must be true:

1. All concepts in the level attempted at least once
2. Overall accuracy across all sessions ≥ 70%
3. No concept with accuracy < 50% (no "weak concepts")

The summary card shows a green promotion banner when eligible, or a progress checklist when not.

---

## Concept data

Every concept is defined in `src/data/grammar-map.js`. The shape:

```js
{
  slug: 'futur_simple',          // DB key, URL param
  name: 'Futur simple',          // English name
  nameFr: 'Le futur simple',     // Full French name (shown in session/confirm card)
  mapLabel: 'Futur simple',      // Short label for the map node card (may truncate)
  rule: '...',                   // One-paragraph grammar rule
  formula: ['radical', '+', '...'],  // Array of tokens — '+', '→', '/' are operators
}
```

B1 concepts additionally have `keyTerms` (legacy) used in old lesson panel data.

### Adding a new level to the progression system

1. Define `{LEVEL}_ORDER` and `{LEVEL}_CONCEPTS` in `grammar-map.js` (already done for A1–C2).
2. Add the level to `LEVEL_DATA` in `map/page.js` and `session/page.js`.
3. Add the level to `LEVEL_CONCEPTS` in `save-session/route.js` so promotion checks run for it.

---

## Auth

`useAuth` (`hooks/useAuth.js`) manages the full auth lifecycle:

- `user === undefined` — auth state still loading (render nothing)
- `user === null` — not signed in (show guest UI)
- `user` — signed-in Supabase user object

On page load, `getSession()` is called. On SIGNED_IN event:
1. `syncProfileToStorage(user)` — fetches profile row, writes `level_score → lexitree_level` to localStorage. Returns `true` if successful.
2. If `false` (no profile yet — new sign-in after guest assessment): `createProfileFromStorage(user)` — creates profile row from localStorage level using `levelToScore()`.

**Two Supabase clients:**
- `lib/supabase.js` — server-side, uses `SUPABASE_SERVICE_ROLE_KEY`. Used in all API routes. Bypasses RLS.
- `lib/supabase-browser.js` — browser, uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Used in client components. Subject to RLS.

**OAuth callback:** `/auth/callback/route.js` exchanges the OAuth code for a session and redirects to `/session`.

---

## Session page state machine

`phase` controls what the user sees:

```
confirm → loading → scenario → question ↔ feedback → complete
```

- `confirm` — initial state. Shows concept name, rule, Start button. Fetch is not triggered until user clicks Start.
- `loading` — lesson and questions are being fetched (sequential: lesson first, then questions with lesson context).
- `scenario` — visual lesson is shown (panels, conjugation table, timeline, takeaway).
- `question` — exercise card shown. User selects an option.
- `feedback` — correct answer selected. Explanation shown. Footer shows "✓ Correct".
- `complete` — summary card with score, promotion check, sign-in prompt.

**Hint system:** Wrong answers are tracked in `triedWrong` (Set). Each wrong pick:
1. Dims and strikes through the tried option (disabled).
2. Shows `wrong_explanations[pickedOption]` inline — a sentence naming the tense and explaining why the forcing cue rules it out.
3. Does not affect the score — only the `firstPick` matters.

**Scoring:** `firstPick` is recorded on the very first selection per question. `results` accumulates `{ correct: bool }` entries. The retry loop is for learning only.

**Daily rotation:** `getDailyConcept(level)` uses `Math.floor(Date.now() / 86_400_000) % order.length` to pick a concept slug, ensuring the same concept for all users on a given calendar day, rotating through the full order.

---

## Environment variables

```
# Server-only (API routes)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MISTRAL_API_KEY

# Public (browser + server)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Key design decisions

**Sequential fetch (lesson → questions).** Questions are generated with the lesson passed as context so Mistral builds exercises around the exact examples, vocabulary, and constructions the user just read. A parallel fetch would produce unrelated questions.

**`wrong_explanations` must be JSONB, keyed by exact option string.** The client looks up `q.wrong_explanations[pickedOption]`. If the key doesn't match character-for-character (including accents, spaces), the fallback "Not quite — try another option." shows. Truncating the question bank (`truncate table questions`) is required whenever the prompt changes, because old rows lack the field.

**TCF scale (not arbitrary).** The 100–699 score range mirrors the real Test de Connaissance du Français standard. This means scores are externally interpretable and the band boundaries are linguistically motivated.

**Concept data in code, not DB.** Concept definitions (slug, name, rule, formula) are static curriculum structure — they change only when the course is redesigned, which warrants a code deploy anyway. AI-generated content (lessons, questions) lives in the DB. The split is deliberate: zero latency for metadata, DB for dynamic content.

**`use_count` rotation for questions.** Serving questions in ascending `use_count` order means every question in the bank is exhausted once before any repeats. The pool is oversampled (up to `SESSION_SIZE * 3` candidates) then randomly sub-selected, so the user sees variety across sessions even when the bank is small.

**`useRef(false)` guard in session page.** React 18 StrictMode double-fires effects in development. The `didFetch` ref prevents two simultaneous lesson+question fetches on mount.

**Promotion requires all three gates.** Score alone is gameable (high score on one repeated concept). Requiring all concepts attempted + overall accuracy ≥ 70% + no weak concepts (<50%) ensures genuine level mastery before advancement.
