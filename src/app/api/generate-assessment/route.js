// import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callMistral } from '@/lib/mistral'

export const dynamic = 'force-dynamic' // never cache this route

// const client = new Anthropic()

const CONCEPT_POOL = {
  A1: [
    "être and avoir (present tense conjugation)",
    "regular -er verb conjugation in present tense",
    "indefinite articles (un, une, des)",
    "definite articles (le, la, les, l')",
    "gender agreement of adjectives",
    "negation with ne...pas",
    "subject pronouns (je, tu, il, elle, nous, vous, ils, elles)",
    "numbers and quantity expressions",
  ],
  A2: [
    "passé composé with avoir auxiliary",
    "passé composé with être auxiliary (movement/state verbs)",
    "direct object pronouns (le, la, les, l')",
    "indirect object pronouns (lui, leur)",
    "adjective agreement in gender and number",
    "comparative adjectives (plus...que, moins...que, aussi...que)",
    "near future with aller + infinitive",
    "imparfait for habitual past actions",
    "reflexive verbs in present tense",
    "partitive articles (du, de la, de l')",
  ],
  B1: [
    "imparfait vs passé composé: ongoing action interrupted",
    "subjonctif présent after il faut que",
    "subjonctif présent after vouloir que / préférer que",
    "relative pronouns qui and que",
    "relative pronoun dont",
    "reflexive verbs in passé composé",
    "object pronouns y and en",
    "double object pronouns",
    "imperative with object pronouns",
    "futur simple for future plans",
  ],
  B2: [
    "plus-que-parfait to express prior past action",
    "conditionnel passé in type-3 si-clauses (si + PQP → conditionnel passé)",
    "passive voice with être + past participle",
    "subjonctif after expressions of doubt (douter que, ne pas croire que)",
    "subjonctif after expressions of emotion (regretter que, être surpris que)",
    "causative faire (faire + infinitive)",
    "conditionnel présent for polite requests and hypotheticals",
    "sequence of tenses with reported speech",
  ],
  C1: [
    "subjonctif passé for completed actions in subjunctive contexts",
    "concordance des temps in indirect speech",
    "gérondif (en + present participle) to express simultaneous action",
    "passé simple recognition in literary texts",
    "discours indirect with tense backshift",
    "négation complexe (ne...que, ne...aucun, ne...guère)",
    "infinitive constructions replacing subjunctive clauses",
  ],
  C2: [
    "literary tenses — passé simple, passé antérieur, subjonctif imparfait, subjonctif plus-que-parfait",
    "rhetorical structures — anaphora, chiasmus, thèse–antithèse–synthèse",
    "lexical precision — distinguishing near-synonyms, collocations, avoiding false friends",
    "regional variations — Québécois, Belgian, Swiss French distinctions",
    "archaic and legal vocabulary — icelle, nonobstant, susmentionné",
    "stylistic register — adapting vocabulary and syntax across literary, academic, professional registers",
    "syntactic ellipsis — omitting predictable elements for concision or style",
    "irony and implicature — decoding meaning beyond literal words (Gricean maxims)",
  ],
}

const DISTRIBUTION = { A1: 1, A2: 1, B1: 2, B2: 1, C1: 1, C2: 1 }

function pickConcepts() {
  const picked = {}
  for (const [level, count] of Object.entries(DISTRIBUTION)) {
    const pool = [...CONCEPT_POOL[level]]
    const selected = []
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      selected.push(pool.splice(idx, 1)[0])
    }
    picked[level] = selected
  }
  return picked
}

export async function GET() {
  try {
    const concepts = pickConcepts()
    const questions = await generateAssessment(concepts)

    saveManyToBank(questions).catch(err =>
      console.error('Failed to save assessment questions to bank:', err)
    )

    return NextResponse.json({ questions })
  } catch (error) {
    console.error('generate-assessment error:', error)
    return NextResponse.json({ error: 'Failed to generate assessment' }, { status: 500 })
  }
}

async function generateAssessment(concepts) {
  const lines = Object.entries(concepts)
    .map(([level, cs]) =>
      cs.map((c, i) => `- ${level} question ${i + 1}: test "${c}"`).join('\n')
    )
    .join('\n')

  const prompt = `You are an expert French language teacher designing a CEFR placement assessment.

Generate exactly 7 multiple-choice questions. Each question tests the concept assigned below — do not substitute a different concept.

Assigned concepts:
${lines}

QUALITY RULES — every question must satisfy all of these:

1. ONE unambiguous correct answer. The sentence must be constructed so that only one option is grammatically valid. A fluent French speaker must not be able to reasonably defend any other option.

2. Use structural forcing cues in the sentence to eliminate every wrong option. Examples:
   - Force plus-que-parfait: include "déjà" and a sequenced past event ("Quand elle est arrivée, il ___ déjà ___")
   - Force subjonctif: open with an explicit trigger ("Il faut que tu ___ / Bien qu'il ___")
   - Force imparfait for background: frame with an ongoing marker ("Pendant qu'il ___, soudain...")
   - Force conditionnel passé: use explicit si + plus-que-parfait ("Si tu m'avais appelé, je ___")
   - Force passé composé over imparfait: use "soudain", "tout à coup", or a specific completed moment

3. Every wrong option must fail for a specific grammatical reason tied to the assigned concept. If a distractor could work in a slightly different sentence, rewrite the sentence to close that loophole.

4. Do not write open-ended contexts where multiple tenses are pragmatically interchangeable.

5. Each question tests its assigned concept ONLY — no other grammar.
6. Exactly 4 options per question.
6a. The "question" field must contain ONLY the sentence with ___ as the blank. Never embed the options or any list of choices inside the question text — they are displayed separately in the UI.
7. The answer must exactly match one of the 4 options character-for-character.
8. Distractors must be real French forms — just wrong in this context.
9. Explanation in English, 1–2 sentences. Name the forcing cue that makes this the only valid answer.
10. Output questions in order: A1 first, then A2, B1, B2, C1.

Return ONLY a valid JSON object — no markdown, no extra text:
{"questions":[{"level":"A1","concept":"...","question":"...","options":["...","...","...","..."],"answer":"...","explanation":"..."}]}`

  // const message = await client.messages.create({
  //   model: 'claude-sonnet-4-6',
  //   max_tokens: 3072,
  //   messages: [{ role: 'user', content: prompt }],
  // })
  // let text = message.content[0].text.trim()
  // text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  // return JSON.parse(text)

  const raw = await callMistral({ messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
  const questions = JSON.parse(raw).questions
  // Shuffle options so the correct answer isn't always in the same position
  return questions.map(q => ({
    ...q,
    options: [...q.options].sort(() => Math.random() - 0.5),
  }))
}

async function saveManyToBank(questions) {
  const rows = questions.map(q => ({
    level: q.level,
    concept: q.concept.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    type: 'multiple_choice',
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    source: 'ai_generated',
  }))

  const { error } = await supabase.from('questions').insert(rows)
  if (error) throw error
}
