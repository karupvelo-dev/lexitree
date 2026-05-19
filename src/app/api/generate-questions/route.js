// import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callMistral } from '@/lib/mistral'

const SESSION_SIZE = 7
const BANK_SERVE_THRESHOLD = 7   // serve from bank once we have a full session's worth
const BANK_TARGET = 50           // keep growing in background until we reach this per concept

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export async function POST(request) {
  try {
    // lesson passed directly from client (always lesson-seeded on first generation)
    const { level, concept, lesson: clientLesson = null, vocabularyWords = [] } = await request.json()

    // 1. Check question bank — fetch by least-used first, include id for use_count tracking
    const { data: banked } = await supabase
      .from('questions')
      .select('id, question, options, answer, explanation, wrong_explanations, use_count, vocabulary_word, vocabulary_pos')
      .eq('level', level)
      .eq('concept', concept.slug)
      .order('use_count', { ascending: true })

    const bankSize = banked?.length ?? 0

    if (bankSize >= BANK_SERVE_THRESHOLD) {
      // Pick 7 from the least-used pool (ensures rotation before repeats)
      const pool = banked.slice(0, Math.max(SESSION_SIZE * 3, bankSize))
      const questions = pickRandom(pool, SESSION_SIZE).map(q => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5),
      })).filter(validateQuestion)

      // Increment use_count for served questions (fire and forget)
      const ids = questions.map(q => q.id)
      supabase.rpc('increment_use_counts', { p_ids: ids })
        .then(({ error }) => { if (error) console.error('increment_use_counts error:', error) })

      // Background: grow bank toward target using lesson context
      if (bankSize < BANK_TARGET) {
        const lesson = clientLesson ?? await fetchCachedLesson(level, concept.slug)
        generateQuestions(level, concept, lesson, SESSION_SIZE, vocabularyWords)
          .then(({ questions: newQs }) => {
            const normalized = newQs.map(q => ({
              ...q,
              wrong_explanations: q.wrongExplanations ?? null,
              vocabulary_word: q.vocabularyWord ?? null,
              vocabulary_pos: q.vocabularyWord
                ? (vocabularyWords.find(v => v.word === q.vocabularyWord)?.pos ?? null)
                : null,
            })).filter(validateQuestion)
            if (normalized.length > 0) return saveToBank(level, concept.slug, normalized)
          })
          .catch(err => console.error('Background bank growth error:', err))
      }

      return NextResponse.json({ questions, source: 'bank' })
    }

    // 2. Bank insufficient — use lesson passed from client (or fall back to cache)
    const lesson = clientLesson ?? await fetchCachedLesson(level, concept.slug)
    const { questions: rawQuestions } = await generateQuestions(level, concept, lesson, SESSION_SIZE, vocabularyWords)

    // Normalize camelCase → snake_case and shuffle options so correct answer isn't always first
    const questions = rawQuestions.map(q => ({
      ...q,
      options: [...q.options].sort(() => Math.random() - 0.5),
      wrong_explanations: q.wrongExplanations ?? null,
      vocabulary_word: q.vocabularyWord ?? null,
      vocabulary_pos: q.vocabularyWord
        ? (vocabularyWords.find(v => v.word === q.vocabularyWord)?.pos ?? null)
        : null,
    }))

    const validQuestions = questions.filter(validateQuestion)
    if (validQuestions.length > 0) {
      saveToBank(level, concept.slug, validQuestions).catch(err =>
        console.error('Failed to save to bank:', err)
      )
    }

    return NextResponse.json({ questions: validQuestions, source: 'generated' })
  } catch (error) {
    console.error('generate-questions error:', error)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}

async function fetchCachedLesson(level, conceptSlug) {
  try {
    const { data } = await supabase
      .from('concept_lessons')
      .select('lesson')
      .eq('level', level)
      .eq('concept', conceptSlug)
      .single()
    return data?.lesson ?? null
  } catch {
    return null
  }
}


async function generateQuestions(level, concept, lesson = null, count = SESSION_SIZE, vocabularyWords = []) {
  const lessonContext = lesson ? buildLessonContext(lesson) : ''

  const vocabRuleNum = lessonContext ? '14' : '13'
  const vocabInstruction = vocabularyWords.length > 0
    ? `\n${vocabRuleNum}. VOCABULARY — use each of the following words exactly once across the ${count} questions, placing each in whichever question it fits most naturally. The word may appear conjugated in the blank, in the sentence for context, or in a supporting clause. Add a "vocabularyWord" field to that question in the JSON with the exact word used (match the list exactly).
Words: ${vocabularyWords.map(v => v.word).join(', ')}`
    : ''

  const prompt = `You are an expert French language teacher.

Level: ${level} (CEFR)
Topic: ${concept.nameFr} (${concept.name})
Grammar rule: ${concept.rule}
${lessonContext}
Generate ${count} fill-in-the-blank multiple-choice questions.

QUALITY RULES — every question must satisfy all of these:
1. ONE unambiguous correct answer. The sentence must make only one option grammatically valid.
2. Design a forcing cue that fits this specific concept and level. The cue must make exactly one option grammatically correct based on the grammar being tested. Do not use grammar structures from levels above ${level}.
   - Use exactly one blank (___). Never put two blanks in one question.
   - The forcing cue must come from sentence context only (words around the blank) — not from a second blank testing a different grammar point.
3. Every wrong option must fail for a specific grammatical reason tied to ${concept.name}.
4. Do not write contexts where two options are pragmatically interchangeable.
5. Tests ONLY ${concept.name} — no other grammar.
6. Mark blank(s) with ___.
7. Exactly 4 options per question.
8. Answer must exactly match one of the 4 options character-for-character.
9. Vary contexts: dialogue, short narrative, everyday situation. No two questions with the same context type.
10. Explanation in English, 1–2 sentences explaining why the correct answer is right. Name the forcing cue.
11. wrongExplanations: REQUIRED. For every incorrect option, write one sentence that (a) names the tense or form of that option, and (b) explains why it conflicts with the specific forcing cue in the sentence. Do NOT name or hint at the correct tense. Example: "allons is present tense — but 'Demain' signals an action that hasn't happened yet." Keys must exactly match the option strings character-for-character. This field must always be present with exactly 3 entries (one per wrong option).
12. BLANK CHECK — before finalising each question: mentally substitute ___ with your correct answer. The resulting sentence must be grammatically complete with no repeated words. The blank must replace the ENTIRE tested phrase. If any word in your correct answer already appears immediately after ___ in the sentence template, you have split incorrectly — remove that word from the template and put it only in the options.
${lessonContext ? '13. Use different verbs and vocabulary from the lesson examples — test the same patterns, not the same sentences.' : ''}${vocabInstruction}

Return ONLY this JSON — no markdown, no extra text:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":"...","explanation":"...","wrongExplanations":{"wrong option 1":"why wrong","wrong option 2":"why wrong","wrong option 3":"why wrong"},"vocabularyWord":"..."}]}`

  // const message = await client.messages.create({
  //   model: 'claude-sonnet-4-6',
  //   max_tokens: 3072,
  //   messages: [{ role: 'user', content: prompt }],
  // })
  // let text = message.content[0].text.trim()
  // text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  // return JSON.parse(text)

  const raw = await callMistral({ messages: [{ role: 'user', content: prompt }], temperature: 0.5 })
  const parsed = JSON.parse(raw)
  const questions = Array.isArray(parsed) ? parsed : parsed?.questions
  if (!Array.isArray(questions)) {
    throw new Error(`Mistral returned unexpected structure: ${raw.slice(0, 300)}`)
  }
  return { questions }
}

function buildLessonContext(lesson) {
  const lines = ['\nLESSON CONTEXT (already shown to the user):']

  if (lesson.keyIdea) {
    lines.push(`Key idea: ${lesson.keyIdea}`)
  }

  if (lesson.conjugation) {
    const { verb, rows } = lesson.conjugation
    const forms = rows.map(r => `${r.pronoun}: ${r.form}`).join(', ')
    lines.push(`Conjugation shown (${verb}): ${forms}`)
  }

  if (lesson.panels?.length) {
    lines.push('Panel examples:')
    lesson.panels.forEach(p => {
      lines.push(`  - "${p.fr}" → ${p.en}`)
    })
  }

  lines.push('Write questions that reinforce these constructions using fresh vocabulary.\n')
  return lines.join('\n')
}

function validateQuestion(q) {
  if (typeof q.question !== 'string' || !q.question.includes('___')) return false
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  if (q.options.some(o => typeof o !== 'string' || !o.trim())) return false
  if (typeof q.answer !== 'string' || !q.options.includes(q.answer)) return false
  if (typeof q.explanation !== 'string' || !q.explanation.trim()) return false
  const wrongOptions = q.options.filter(o => o !== q.answer)
  const explanations = q.wrong_explanations ?? q.wrongExplanations ?? {}
  if (wrongOptions.some(o => !explanations[o])) return false

  // Check 1: filling the blank must not produce duplicate adjacent tokens
  const filled = q.question.replace('___', q.answer)
  const tokens = filled.toLowerCase().replace(/[«»?!.,;:'"]/g, ' ').split(/\s+/).filter(w => w.length > 1)
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) return false
  }

  // Check 2: no answer word appears immediately after the blank in the template
  const afterBlank = (q.question.split('___')[1] ?? '').trim().split(/\s+/)[0].replace(/[?!.,;:'"«»]/g, '').toLowerCase()
  const answerTokens = q.answer.toLowerCase().split(/\s+/)
  if (afterBlank && answerTokens.includes(afterBlank)) return false

  return true
}

async function saveToBank(level, conceptSlug, questions) {
  const rows = questions.map(q => ({
    level,
    concept: conceptSlug,
    type: 'multiple_choice',
    question: q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    wrong_explanations: q.wrong_explanations ?? q.wrongExplanations ?? null,
    vocabulary_word: q.vocabulary_word ?? null,
    vocabulary_pos: q.vocabulary_pos ?? null,
    source: 'ai_generated',
  }))

  const { error } = await supabase.from('questions').insert(rows)
  if (error) throw error
}
