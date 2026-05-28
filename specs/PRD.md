# Lexitree — Master Product Requirements Document

> **Codename:** parler  
> **Status:** Pre-development — design & spec complete  
> **Last updated:** May 2026

---

## Table of Contents

1. [Vision](#1-vision)
2. [Problem](#2-problem)
3. [Target Users](#3-target-users)
4. [Product Pillars](#4-product-pillars)
5. [Grammar Taxonomy](#5-grammar-taxonomy)
6. [Exercise System](#6-exercise-system)
7. [Question Bank & Content Lifecycle](#7-question-bank--content-lifecycle)
8. [Content Quality System](#8-content-quality-system)
9. [Session View](#9-session-view)
10. [Grammar Map](#10-grammar-map)
11. [Progress View](#11-progress-view)
12. [Design System](#12-design-system)
13. [Technical Architecture](#13-technical-architecture)
14. [Success Metrics](#14-success-metrics)
15. [Open Questions](#15-open-questions)

---

## 1. Vision

Lexitree is an AI-powered French grammar mastery platform. It generates contextual exercises tailored to a learner's CEFR level and maps each learner's progress across a complete taxonomy of 78 grammar concepts — A1 through C2.

The long-term experience is a knowledge tree that lights up as you master it. In later phases, generated exercises feed a shared community bank — a flywheel where more learners means better content for everyone.

**Primary language:** French (v1). Architecture is language-agnostic for future expansion.

---

## 2. Problem

Existing grammar learning tools have three failure modes:

1. **Repetition without progression.** Apps like Duolingo drill vocabulary but do not map learner progress against a complete grammar model. Learners don't know what they don't know.
2. **Static content.** Fixed exercise banks go stale. There is no mechanism for content to improve as the user base grows.
3. **No spatial understanding.** Progress is represented as a percentage or streak. Learners have no sense of where a concept sits in the full landscape of the language — which concepts they've mastered, which are adjacent, and what lies ahead.

---

## 3. Target Users

**Primary:** Adult French learners at B1–B2 level who have outgrown beginner apps and want structured grammar mastery. Typically self-directed, goal-oriented (DELF exam, travel, career), and comfortable with a more demanding product.

**Secondary:** A1–A2 learners who want a rigorous alternative to gamified apps. C1 learners polishing for near-native fluency.

**Not in scope (v1):** Complete beginners with no French exposure. Children. Classroom/institutional use.

---

## 4. Product Pillars

| Pillar | Description |
|---|---|
| **Complete map** | Every French grammar concept from A1 to C2 is named, placed, and trackable — 78 concepts total |
| **World-class content** | AI-generated exercises are crafted through careful prompt engineering and CEFR-scoped constraints; Phase 2 adds a validation pipeline and community bank |
| **Adaptive sessions** | What you practice next is determined by mastery signals, spaced repetition, and concept dependencies |
| **Network flywheel** | *(Phase 2)* Each user's session contributes to a shared bank; the product improves with every learner |
| **Spatial progress** | Progress is a lit-up knowledge map, not a percentage bar |

---

## 5. Grammar Taxonomy

The grammar taxonomy is **MECE** (Mutually Exclusive, Collectively Exhaustive): 78 concepts, each assigned to exactly one CEFR level, collectively covering all French grammar a learner will encounter from first contact to near-native mastery.

### Level summary

| Level | Concepts | Focus |
|---|---|---|
| A1 | 14 | Subject pronouns, être/avoir, -er verbs, articles, basic adjectives, negation, questions, numbers, prepositions, possessives, imperatives |
| A2 | 15 | Passé composé (avoir/être), imparfait intro, futur proche, -ir/-re verbs, irregular verbs, contracted/partitive articles, adjective placement, adverbs, COD/COI pronouns, demonstratives, reflexive verbs, comparative |
| B1 | 15 | Imparfait vs passé composé contrast, futur simple, conditionnel présent, subjonctif présent, relative pronouns, stressed pronouns, y/en, double pronouns, superlative, extended negation, interrogative pronouns, depuis/pendant/il y a, causative faire, gérondif, si clauses type 1 |
| B2 | 14 | Extended subjonctif triggers, plus-que-parfait, futur antérieur, conditionnel passé, passive voice, si clauses types 2–3, indirect speech, nominalisation, complex relative pronouns, concession/opposition, cause/consequence, infinitive constructions, cleft structures, register awareness |
| C1 | 12 | Subjonctif passé/imparfait, passé simple, passé antérieur, conditionnel journalistique, nuanced negation, abstract nominalisation, advanced discourse connectors, implicit participles, complex passive, stylistic inversion, idiomatic verb constructions |
| C2 | 8 | Rare literary tenses, rhetorical structures, lexical precision, regional/sociolectal variation, archaic vocabulary, register switching, ellipsis/syntactic compression, complex irony/implicature |
| **Total** | **78** | Full A1–C2 |

### Design principles

- A concept is placed at the level where it is **first introduced**, not where it is mastered. It does not reappear at higher levels even though it continues to be used.
- Some concepts are **intentionally split**: imparfait appears at A2 (introduction), but imparfait vs passé composé contrast is B1. Subjonctif triggers appear at B1, extended triggers at B2.
- C2 has fewer concepts because mastery at that level is about precision and stylistic range within known structures, not new grammatical forms.
- Aligned with CEFR global scale, DELF/DALF examination descriptors, Alliance Française curriculum, and Grevisse's *Le Bon Usage*.

### Full taxonomy

See `french-grammar-mece.md` for the complete concept list with examples, notes, and design rationale.

---

## 6. Exercise System

### Exercise types

| Type | Code | Description |
|---|---|---|
| Fill in the blank | `fill_blank` | Sentence with one gap; learner types or selects the missing word/phrase |
| Multiple choice | `multiple_choice` | Four options; exactly one correct answer |
| Fix the error | `fix_error` | Sentence containing a grammatical error; learner identifies and corrects it |
| Translation | `translate` | English prompt; learner produces the French equivalent |

### Exercise metadata

**v1 — ephemeral (not persisted after session):**

```
exercise_id       — unique identifier for the session
level             — CEFR level (A1–C2)
topic             — grammar concept slug (e.g. subjonctif_present)
type              — fill_blank | multiple_choice
generated_for     — user_id
created_at        — timestamp
```

**Phase 2 additions (question bank):**

```
source            — generated | seed | community | featured
status            — provisional | community | featured | discarded
accuracy_rate     — rolling % correct across all completions
completion_count  — total times served
flag_count        — total user flags received
```

### Story context

Exercises are optionally wrapped in a **story context** — a short scenario (2–3 sentences) that grounds the grammar in a realistic situation. Marie running late for work, a friend planning a holiday, a job interview. Context is generated at session time and scoped to the user's level vocabulary.

Story context serves two purposes: it makes exercises feel less clinical, and it provides pragmatic anchoring — learners see the grammar used in a real communicative situation, not in isolation.

### Session structure

A session is a sequence of 7 exercises around a single grammar concept. In v1, all exercises are generated dynamically by the LLM at session time — no bank, no reuse, every question is fresh.

The session ends with a brief **accuracy summary** and a nudge toward the next concept in the learning path.

Phase 2 introduces a question bank that replaces live generation progressively as the bank fills with validated content.

### Mastery definition

A concept is marked **mastered** when a user achieves ≥90% accuracy across 10 or more exercises on that concept. Mastered concepts are deprioritised in session queues but remain in the spaced repetition schedule.

---

## 7. Question Bank & Content Lifecycle

> **v1 scope:** 100% dynamic AI generation. No question bank. Every exercise is generated fresh at session time. The bank architecture below is Phase 2.

### v1 — Dynamic generation only

Every exercise in every session is generated live by the LLM. No persistence of exercises beyond the session. User progress (accuracy per concept) is tracked, but the exercises themselves are not stored or reused.

This keeps v1 simple: one LLM call per exercise, no infrastructure for storage, validation, or selection. The cost is that the same concept generates different questions each time, which is actually desirable early on (see §8 on repetition).

### Phase 2 — Question bank

Once prompt quality and user behaviour are understood, exercises worth keeping are validated and stored. The bank becomes the primary content source, with dynamic generation as a fallback for thin concepts.

**Content lifecycle:**

```
Dynamic generation (v1 only)
        │
        └──→ [Phase 2: async validation after serving]
                    │
              LanguageTool check + LLM rubric
                    │
              pass ─┤─ fail → discard
                    │
              Bank [provisional]
                    │
              20 completions, accuracy 25–85%, no flags
                    │
              Bank [community]
                    │
              200 completions + measurable learning signal
                    │
              Bank [featured]
```

**Phase 2 promotion thresholds:**

*provisional → community* (after 20 completions): no flags raised, accuracy 25–85%, completion time within 2 std devs of mean.

*community → featured* (after 200 completions): measurable reduction in learner error rate on subsequent sessions, accuracy remains in band, flag rate < 1%.

**Phase 2 question selection algorithm:**

When the bank is populated, 7 questions per session are selected using a scoring model across four signals: question status quality (featured > community), personal spaced repetition (time since this user last saw this question), personal error history (wrong answers return sooner), and difficulty calibration (question's global accuracy rate matched to user's current mastery).

Questions answered correctly are suppressed for 30 days. Questions answered incorrectly return in the next session on that concept. The suppression window relaxes proportionally if the bank is thin for a given concept.

**Phase 2 seed set:**

Commission 5–10 exercises per concept from a qualified French linguist before enabling the bank. These enter at `featured` status immediately and serve as few-shot examples in generation prompts.

---

## 8. Content Quality System

The platform's reputation depends entirely on the correctness and naturalness of its French. A learner cannot detect a subtle grammatical error — they will learn it as correct.

### v1 — Prompt engineering as the quality gate

In v1, quality lives entirely in the generation prompt. No post-generation validation. The prompt must do all the work.

The generation prompt enforces quality through:

| Constraint | How it's enforced in the prompt |
|---|---|
| Grammatical correctness | Explicit instruction + few-shot examples of correct French only |
| Single defensible answer | Instruction to verify exactly one option is correct before outputting |
| Concept isolation | Prompt scoped tightly to the target concept; vocabulary list constrained to CEFR level |
| Register consistency | Prompt specifies register (tu-form for conversational, vous-form for formal) per concept |
| Distractor plausibility | Instruction to generate distractors that reflect common learner errors, not random wrong answers |
| Naturalness | Few-shot examples use authentic, conversational French — not textbook-ese |

**v1 exercise types:** `fill_blank` and `multiple_choice` only. These are the most prompt-controllable types. `fix_error` and `translate` require more complex generation and are deferred to Phase 2.

### Latency — hiding generation time

The **grammar rule callout** at the top of the session is served instantly from the concept database. The exercise generates while the user reads the rule. Perceived latency ≈ 0 for most sessions.

**Speculative pre-generation (Phase 2 optimisation):** while the user answers the current exercise, silently generate the next one in the background, eliminating inter-question latency entirely.

### Phase 2 — Two-stage validation pipeline

When the question bank is introduced, every generated exercise passes two checks before being stored:

**Stage 1 — LanguageTool (mechanical)**
Run against LanguageTool's French ruleset. Catches: missing accents, agreement errors, conjugation mistakes. Any error → discard, do not proceed.

**Stage 2 — LLM validator (pedagogical rubric)**

| Criterion | Check |
|---|---|
| Grammatical correctness | Is the French in the exercise itself error-free? |
| Single defensible answer | Is there exactly one correct answer, clearly distinct from all distractors? |
| Concept isolation | Does answering correctly require only the target concept? |
| CEFR vocabulary scope | Is all vocabulary appropriate for the target level? |
| Register consistency | Is the register (tu/vous, formal/informal) consistent throughout? |
| Distractor plausibility | Are wrong options plausible enough to require concept knowledge to reject? |
| Naturalness | Does the French read like something a native speaker would say or write? |

Any failure → discard. The reason is logged for prompt refinement.

---

## 9. Session View

The session view is the primary learning surface. A session targets one grammar concept and contains 10 exercises.

### Layout (desktop)

- **Sidebar** — navigation (Today's session, Progress, Grammar map), topic list with mastery indicators, level progress bar (e.g. B1 → B2, 62%), streak
- **Topbar** — breadcrumb (session → concept), Skip topic + Submit answer buttons
- **Page header** — concept name in Playfair Display, CEFR badge, accuracy %, last seen, source badge (community / featured / AI)
- **Grammar rule callout** — the core rule stated in plain language, with the key terms in Playfair italic
- **Story context** — collapsible 2–3 sentence scenario grounding the exercises
- **Exercise card** — question, options, inline feedback on answer
- **Session footer** — step progress (3 of 10), Back / Next exercise buttons

### Feedback behaviour

On answer submission, the exercise card expands inline:
- **Correct** — green confirmation, brief reinforcement of why it was correct
- **Incorrect** — red indicator, explanation of the error, and the correct form shown in Playfair italic

No separate feedback screen. Feedback is contextual and immediate.

### Exercise card states

| State | Visual |
|---|---|
| Unanswered | White background, light border |
| Correct answer | Green background (#EAF3DE), green border (#4A9E6A) |
| Wrong answer | Red background (#FCEBEB), red border (#E24B4A) |
| Dimmed (not yet reached) | Reduced opacity (45%) |

### Reference mockup

`parler_desktop_notion.html`

---

## 10. Grammar Map

The grammar map is a spatial representation of all 78 concepts across the 6 CEFR levels. It shows the learner where they are in the full landscape of French grammar.

### Layout

Six level columns (A1 → C2), connected by directional arrows. Each concept is a node. The view is horizontally scrollable and opens centred on the learner's current active level.

### Node states

| State | Visual | Meaning |
|---|---|---|
| Mastered | Green fill (#EAF3DE), green border (#4A9E6A) | ≥90% accuracy on 10+ exercises |
| In progress | Orange fill (#FFF3EC), orange border (#C4603A), bold text | Active — being practiced now |
| Open | White fill, grey border (#D5D0C8) | Unlocked but not yet started |
| Locked | Light grey fill (#F7F6F3), faint border (#E3E2DF), muted text | Requires completing the previous level |

### Level header states

| Level state | Badge style |
|---|---|
| Fully mastered | Green badge ("A1"), "14/14 mastered" |
| Current | Orange badge ("B1 · now"), "3 mastered · 3 in progress" |
| Locked | Grey badge ("B2"), "14 locked" |

### Level connectors

Arrows between level columns signal progression direction. Arrow colour matches the state of the source level:
- Green arrow: fully mastered level → next level
- Orange arrow: current level → next (locked) level
- Grey arrow: locked level → locked level

### Summary bar

Displayed above the graph: counts of mastered / in progress / open / locked concepts with colour-coded dots. Total: 78 concepts.

### Concept detail panel

Clicking any non-locked node opens a right-hand detail panel showing:

- Concept name (Playfair Display)
- CEFR level and status badges
- **Mastery ring** — circular progress indicator showing accuracy %
- **Stats grid** — exercises done, accuracy %, last seen, status
- **Builds on ↑** — prerequisite concepts (requires prerequisite edge mapping — see §10.1)
- **Unlocks ↓** — concepts this one enables (requires prerequisite edge mapping)
- **Practice this concept** button

### 10.1 Prerequisite edge mapping (Phase 2)

In the current implementation, the graph uses level-based ordering only: all A1 concepts unlock A2, all A2 concepts unlock B1, and so on. This is sufficient for the v1 grammar map.

The higher-value version adds **directed prerequisite edges** between individual concepts — e.g. *L'imparfait* (A2) and *Verbes irréguliers* (A2) are prerequisites of *Subjonctif présent* (B1). This enables:

- **Fine-grained adaptive routing** — unlock individual concepts rather than whole levels
- **"Builds on / Unlocks" panels** in the detail view
- **Shortest path to a target concept** — a learner aiming at C1 passive complex can see exactly which B2 concepts they need first

Prerequisite edge mapping requires a one-time authoring pass over the 78 concepts (manually or Claude-assisted). This is the primary Phase 2 investment.

### Reference mockup

`grammar_map.html`

---

## 11. Progress View

The progress view is the temporal complement to the grammar map. Where the map shows *where* the learner is, progress shows *how they're moving*.

### Stats bar

Four headline metrics displayed in a row at the top of the view:

| Metric | Description |
|---|---|
| Day streak | Consecutive days with at least one completed session |
| Mastered this week | Concepts that crossed the mastery threshold in the last 7 days |
| Avg accuracy | Rolling average accuracy across all exercises this week |
| Study time | Total time in active sessions this week |

### Activity heatmap

GitHub-style contribution calendar showing session activity over the last 12 weeks. Four intensity levels (none / light / medium / heavy) mapped to number of exercises completed per day. Month labels displayed above the grid.

### Accuracy trends chart

Line chart showing accuracy over the last 8 weeks for the 3 most active concepts. Each concept rendered as a distinct coloured line with endpoint dots. Key features:

- **90% mastery threshold** marked with a dashed horizontal line — learners can see when a concept crosses the threshold
- Y-axis: 25%, 50%, 75%, 90%
- Current values shown in the legend, not as inline SVG labels (avoids overlap)

### Path to B2 (pace projection)

- **Headline** — "B2 in ~6 weeks" (calculated from current mastery velocity)
- **Level progress bars** — A1, A2, B1, B2 shown as horizontal bars. Mastered portion in green, in-progress portion in light orange, locked in grey
- **Milestones** — projected unlock dates for B2, C1, C2 at current pace

### Review queue (spaced repetition)

Concepts due for review, sorted by urgency:

- **Overdue** (red) — concepts past their review date
- **Today** (orange) — concepts due today
- **This week** (grey) — concepts due in the next 7 days

The review queue drives the "Today's session" recommendation. If 3 concepts are overdue, today's session prioritises them over new content.

### Reference mockup

`progress.html`

---

## 12. Design System

### Typography

Two typefaces. The rule: **Playfair Display for French content, DM Sans for everything else**. The distinction is a teaching tool — users learn to read Playfair as "this is the language, pay attention."

| Role | Font | Size | Weight |
|---|---|---|---|
| Hero title | Playfair Display | 28px | 500 |
| Lesson rule | Playfair Display | 19px | 400 |
| Exercise question | Playfair Display | 17px | 400 |
| French example | Playfair Display italic | 16px | 400 |
| Section heading | DM Sans | 11px | 500, all-caps, 0.7px tracking |
| Body / feedback | DM Sans | 14px | 400 |
| UI label | DM Sans | 12px | 400 |
| Badge / tag | DM Sans | 10–11px | 500 |
| Stat value | DM Sans | 20–22px | 500 |

Full specification: `typography.md`

### Colour palette

| Token | Hex | Usage |
|---|---|---|
| Dark | `#1C1B18` | Primary text, filled buttons |
| Terracotta | `#C4603A` | Brand colour, active/in-progress states, CTAs |
| Green | `#4A9E6A` | Mastered states, correct answers, positive trends |
| Purple | `#534AB7` | Community badge, third data series |
| Error red | `#E24B4A` | Wrong answers, overdue items |
| Background white | `#FFFFFF` | Main canvas |
| Background warm | `#F7F6F3` | Sidebar, card fills |
| Background subtle | `#FAFAF8` | Card backgrounds, right panels |
| Border | `#E3E2DF` | All dividers and card borders |
| Muted text | `#A9A6A0` | Labels, captions, secondary info |
| Secondary text | `#5C5850` | Body copy, list items |

### Component patterns

- **Node** — 5px border-radius pill, 11px DM Sans, 5px vertical / 9px horizontal padding. Four fill states (mastered / active / open / locked).
- **Badge** — 4px border-radius, 10–11px DM Sans 500, colour-coded by concept level or status.
- **Callout** — warm fill (#FFF9F5), orange border (#F0C4A8), 8px border-radius, Playfair italic for key terms.
- **Exercise card** — #FAFAF8 fill, 0.5px #E3E2DF border, 8px border-radius, 20px padding.
- **Stat cell** — white fill, 0.5px border, 5px border-radius, 15–16px DM Sans 500 value + 10px label.

---

## 13. Technical Architecture

*High-level only. Implementation detail is outside scope of this document.*

### Content pipeline

**v1:**
```
Session request
      │
      ▼
Concept selector
(mastery state + spaced repetition + session history)
      │
      ▼
LLM generation × 7
(prompt: concept, level, exercise type,
 story context, CEFR vocabulary constraints)
      │
      ▼
Serve to user
```

**Phase 2 (with question bank):**
```
Session request → Concept selector
      │
      ▼
Question bank query (concept + level + status)
      │
Bank hit? ──yes──→ score + select 7 → serve
      │ no (or gap fill)
      ▼
LLM generation → serve immediately
      │
      └──→ [async] LanguageTool → LLM rubric → bank [provisional]
```

### Data model (simplified)

**Concepts** — 78 rows, static. Fields: id, slug, level, name_fr, name_en, taxonomy_notes.

**Exercises** — grows with usage. Fields: exercise_id, concept_id, level, type, question, answer, distractors, story_context, source, status, accuracy_rate, completion_count, flag_count, created_at.

**User progress** — per-user, per-concept. Fields: user_id, concept_id, exercise_count, accuracy_rate, last_seen, mastered_at, next_review_at.

**Sessions** — log of completed sessions. Fields: session_id, user_id, concept_id, exercises_served[], started_at, completed_at.

### Key integrations

| Integration | Phase | Purpose |
|---|---|---|
| LLM API (Claude) | v1 | Exercise generation |
| Google Fonts | v1 | Playfair Display + DM Sans |
| Spaced repetition algorithm | v1 | SM-2 or equivalent for review queue scheduling |
| LanguageTool API | Phase 2 | French grammar checking (Stage 1 bank validation) |
| LLM validator | Phase 2 | 7-criterion pedagogical rubric before bank write |

---

## 14. Success Metrics

### Product health (v1)

| Metric | Definition | Target (6 months) |
|---|---|---|
| D7 retention | Users returning after 7 days | >40% |
| Session completion rate | Sessions with 7/7 exercises completed | >70% |
| Concepts mastered / user / week | Average rate of mastery progression | >1.5 |
| User flag rate | User flags per exercise served | <2% |

### Content quality (v1)

| Metric | Definition | Target |
|---|---|---|
| User flag rate | Flags per exercise served (primary quality signal in v1) | <2% |
| Post-session accuracy lift | Does accuracy on a concept improve session-over-session? | Positive trend |

### Phase 2 metrics (question bank)

| Metric | Definition | Target |
|---|---|---|
| Bank hit rate | % exercises served from bank vs dynamically generated | >70% at 6 months post-launch |
| Validation pass rate | % generated exercises passing both validation stages | >80% |
| Bank accuracy distribution | % of bank exercises with global accuracy 25–85% | >90% |
| Seed set coverage | % of 78 concepts with ≥5 seed exercises | 100% before bank goes live |

### Learning signal

| Metric | Definition |
|---|---|
| Post-session error reduction | Does accuracy on a concept improve in the session after practicing it? |
| Time to mastery per concept | How many sessions before a user crosses the 90% threshold? |
| Concept regression rate | How often do mastered concepts fall below 80% on review? |

---

## 15. Open Questions

| # | Question | Phase | Impact |
|---|---|---|---|
| 1 | What is the right spaced repetition interval model — SM-2 (Anki-style) or a custom decay function per concept difficulty? | v1 | Review queue accuracy |
| 2 | Mobile: the session and grammar map views are designed desktop-first. What is the mobile interaction model for the knowledge graph? | v1 | Scope |
| 3 | Prerequisite edge mapping: manually authored, Claude-assisted, or inferred from user error patterns? | Phase 2 | Grammar map depth |
| 4 | Should the accuracy band thresholds (25–85%) differ by exercise type? Translation exercises may naturally skew lower than multiple choice. | Phase 2 | Bank promotion thresholds |
| 5 | Should users be able to see and replay exercises they personally contributed to the community bank? | Phase 2 | Engagement / contribution loop |
| 6 | How do we handle exercises that are grammatically correct but culturally specific (e.g. references that only resonate in certain regions of France)? | Phase 2 | Content quality, inclusivity |
| 7 | Should the validator LLM be the same model used for generation, or a separate evaluation model? | Phase 2 | Quality / cost |
| 8 | What notification triggers the contribution moment — exercise promoted to community, or promoted to featured? | Phase 2 | Engagement |

---

## Appendix A — Reference Files

| File | Description |
|---|---|
| `french-grammar-mece.md` | Full 78-concept taxonomy with examples, notes, and design rationale |
| `network-effect-feature.md` | Detailed spec for the community content system |
| `typography.md` | Typeface selection, weights, type scale, pairing rationale |
| `parler_desktop_notion.html` | Session view mockup (desktop) |
| `grammar_map.html` | Grammar map view mockup |
| `progress.html` | Progress view mockup |

---

## Appendix B — Decisions Made

Decisions recorded here to avoid revisiting them without cause.

| Decision | Rationale |
|---|---|
| v1 is 100% dynamic generation — no question bank | Reduces implementation complexity for first iteration; allows focus on prompt quality and user experience before building bank infrastructure |
| Question bank and selection algorithm deferred to Phase 2 | Bank value is proportional to depth; with no users yet there is no depth. Build it when there is content to put in it |
| MECE taxonomy over a free-form concept list | Ensures full coverage, prevents duplicates, makes the grammar map spatially coherent |
| v1 quality gate is the generation prompt only | Validation pipeline adds infrastructure complexity; prompt engineering alone is sufficient to establish quality bar before the bank exists |
| Level-based graph edges in v1, prerequisite edges in Phase 2 | Prerequisite mapping requires significant authoring effort; level-based ordering delivers 80% of the value immediately |
| Playfair Display for French content only | Typography as a teaching signal — visual register distinction reinforces language attention |
| v1 exercise types: fill_blank and multiple_choice only | Simpler types are easier to generate reliably; fix_error and translate follow once the prompt pipeline is proven |
| Validate at write time, not serve time (Phase 2) | Removes latency from the user path; keeps the bank clean without slowing the product |
| Accuracy band 25–85% as primary quality gate (Phase 2) | Outside this band, an exercise is either trivially easy or ambiguously worded; both degrade learning signal |
