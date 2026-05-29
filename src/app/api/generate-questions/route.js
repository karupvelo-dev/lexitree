import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { callMistral } from '@/lib/mistral'
import { callClaude } from '@/lib/anthropic'

const SESSION_SIZE = 7
const CANDIDATE_SIZE = SESSION_SIZE * 2   // generate more, filter to quality
const BANK_SERVE_THRESHOLD = 7
const BANK_TARGET = 70

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export async function POST(request) {
  try {
    const { level, concept, lesson: clientLesson = null, vocabularyWords = [] } = await request.json()

    // 1. Check question bank — fetch by least-used first
    const { data: banked } = await supabase
      .from('questions')
      .select('id, question, options, answer, explanation, wrong_explanations, use_count, vocabulary_word, vocabulary_pos')
      .eq('level', level)
      .eq('concept', concept.slug)
      .order('use_count', { ascending: true })

    const bankSize = banked?.length ?? 0

    if (bankSize >= BANK_SERVE_THRESHOLD) {
      const pool = banked.slice(0, Math.max(SESSION_SIZE * 3, bankSize))
      const questions = pickRandom(pool, SESSION_SIZE).map(q => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5),
      })).filter(q => validateQuestion(q))

      const ids = questions.map(q => q.id)
      supabase.rpc('increment_use_counts', { p_ids: ids })
        .then(({ error }) => { if (error) console.error('increment_use_counts error:', error) })

      // Background: grow bank toward target — generate, validate, verify, save all that pass
      if (bankSize < BANK_TARGET) {
        const lesson = clientLesson ?? await fetchCachedLesson(level, concept.slug)
        generateAndVerify(level, concept, lesson, SESSION_SIZE, vocabularyWords)
          .then(({ questions, metrics }) => {
            logGeneration(metrics)
            if (questions.length > 0) return saveDedupedToBank(level, concept.slug, questions, banked ?? [])
          })
          .catch(err => console.error('Background bank growth error:', err))
      }

      return NextResponse.json({ questions, source: 'bank' })
    }

    // 2. Bank insufficient — generate CANDIDATE_SIZE, validate, verify, serve SESSION_SIZE
    const lesson = clientLesson ?? await fetchCachedLesson(level, concept.slug)
    const { questions: verified, metrics } = await generateAndVerify(level, concept, lesson, CANDIDATE_SIZE, vocabularyWords)
    logGeneration(metrics)

    if (verified.length === 0) {
      return NextResponse.json({ error: 'No verified questions available', source: metrics.source }, { status: 503 })
    }

    // Save ALL verified to bank before gap-fill so dedup check is accurate
    saveDedupedToBank(level, concept.slug, verified, banked ?? []).catch(err =>
      console.error('Failed to save to bank:', err)
    )

    // Boris: gap-fill from bank if live generation produced fewer than SESSION_SIZE
    let toServe = verified.slice(0, SESSION_SIZE)
    if (toServe.length < SESSION_SIZE && banked?.length > 0) {
      const verifiedTexts = new Set(verified.map(q => q.question))
      const available = banked
        .filter(q => !verifiedTexts.has(q.question))
        .map(q => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }))
      const filler = pickRandom(available, SESSION_SIZE - toServe.length)
      if (filler.length > 0) {
        supabase.rpc('increment_use_counts', { p_ids: filler.map(q => q.id) })
          .then(({ error }) => { if (error) console.error('increment_use_counts error:', error) })
        toServe = [...toServe, ...filler]
      }
    }

    if (toServe.length < SESSION_SIZE) {
      return NextResponse.json({ error: 'Not enough verified questions available', source: metrics.source }, { status: 503 })
    }

    return NextResponse.json({ questions: toServe, source: metrics.source })
  } catch (error) {
    console.error('[tier-4] generation failed completely:', error)
    return NextResponse.json({ error: 'Failed to generate questions', tier: 4 }, { status: 500 })
  }
}

/**
 * Full pipeline: generate candidates → structural validate → circuit breaker check → Claude verify.
 * Returns { questions, metrics }. Falls back gracefully at each layer.
 *
 * Degradation tiers:
 *   Tier 1 — bank serve (handled in POST above)
 *   Tier 2 — generated + verified (normal path)
 *   Tier 3 — generated + structural only (circuit open or verifier error)
 *   Tier 4 — complete generation failure (caught in POST catch block)
 */
async function generateAndVerify(level, concept, lesson, count, vocabularyWords) {
  const { questions: rawQuestions } = await generateQuestions(level, concept, lesson, count, vocabularyWords)

  const normalised = rawQuestions.map(q => ({
    ...q,
    options: [...q.options].sort(() => Math.random() - 0.5),
    all_correct: q.allCorrect ?? null,
    wrong_explanations: q.wrongExplanations ?? null,
    vocabulary_word: q.vocabularyWord ?? null,
    vocabulary_pos: q.vocabularyWord
      ? (vocabularyWords.find(v => v.word === q.vocabularyWord)?.pos ?? null)
      : null,
  }))

  const structural = normalised.filter(q => validateQuestion(q, concept.slug))

  const metrics = {
    level,
    concept: concept.slug,
    candidates_generated: rawQuestions.length,
    structural_passed: structural.length,
    verifier_passed: 0,
    verifier_rejected: 0,
    source: 'generated_structural',
    circuit_breaker_triggered: false,
  }

  if (structural.length === 0) return { questions: [], metrics }

  // Circuit breaker: if recent rejection rate > 80%, concept is broken — do not serve
  const circuitOpen = await isCircuitOpen(level, concept.slug)
  if (circuitOpen) {
    metrics.circuit_breaker_triggered = true
    metrics.source = 'circuit_breaker'
    console.warn(`[circuit-breaker] open for ${level}/${concept.slug} — concept flagged, no questions served`)
    return { questions: [], metrics }
  }

  // Claude verification — unverified questions are never served or saved
  try {
    const verified = await verifyQuestions(structural)
    metrics.verifier_passed = verified.length
    metrics.verifier_rejected = structural.length - verified.length
    metrics.source = 'generated_verified'
    return { questions: verified, metrics }
  } catch (err) {
    console.error('[verifier-error] verifyQuestions threw — no questions served:', err)
    metrics.source = 'verifier_error'
    return { questions: [], metrics }
  }
}

/**
 * Claude haiku verifier: one batch call for all candidates.
 * Two criteria must both pass: sentence validity AND explanation accuracy.
 */
async function verifyQuestions(questions) {
  const payload = questions.map((q, i) => ({
    index: i,
    sentence: q.question,
    options: q.options,
    answer: q.answer,
    wrongExplanations: q.wrong_explanations ?? q.wrongExplanations ?? {},
  }))

  const prompt = `You are a strict French grammar and fact checker. For each question you must verify TWO things.

PRELIMINARY CHECK — run this before anything else:
- Count the number of ___ in the sentence. If there is more than one ___, fail the question immediately without further evaluation.

CHECK 1 — Sentence validity:
Substitute ___ with EACH of the 4 options. Ask: is the completed sentence correct, natural French that a native speaker would accept?
- FAIL if zero options produce valid French
- FAIL if two or more options produce valid French (ambiguous)
- FAIL if the completed sentence repeats the same content word twice

CHECK 2 — Explanation accuracy:
For each wrong option, a wrongExplanation is provided. Ask: is the explanation factually correct? Does it accurately identify why that option is wrong in this sentence?
- FAIL if any explanation contains a factual error about French grammar
- FAIL if any explanation contradicts the actual rule being tested
- FAIL if any explanation describes the wrong noun gender, verb form, or grammatical property

A question PASSES only if it passes BOTH checks.
Be strict. When in doubt, fail. A rejected question is simply regenerated at no cost.

Questions:
${JSON.stringify(payload, null, 2)}

Return ONLY this JSON — no markdown, no extra text:
{"results":[{"index":0,"pass":true},{"index":1,"pass":false,"reason":"..."}]}`

  const raw = await callClaude({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    maxTokens: 1536,
  })

  const text = raw.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '')
  const { results } = JSON.parse(text)

  const passing = new Set(results.filter(r => r.pass).map(r => r.index))
  const failed = results.filter(r => !r.pass)
  if (failed.length > 0) {
    console.log(`verifyQuestions: rejected ${failed.length}/${questions.length}`,
      failed.map(r => ({ index: r.index, reason: r.reason, q: questions[r.index]?.question }))
    )
  }

  return questions.filter((_, i) => passing.has(i))
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

  const conceptKeyRuleNum = lessonContext ? '13' : '12'
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
1. Identify ALL grammatically valid answers. If multiple options correctly complete the sentence, list every valid option in an "allCorrect" array (e.g. ["Commences-tu", "Est-ce que tu commences"]). The "answer" field must still hold one canonical form. "wrongExplanations" must only cover options NOT in "allCorrect" — do not write an explanation for a valid answer.
2. Design a forcing cue that fits this specific concept and level. The cue must make exactly one option grammatically correct based on the grammar being tested. Do not use grammar structures from levels above ${level}.
   - Use exactly one blank (___). Never put two blanks in one question.
   - The forcing cue must come from sentence context only (words around the blank) — not from a second blank testing a different grammar point.
3. Every wrong option must fail for a specific grammatical reason tied to ${concept.name}.
4. Do not write contexts where two options are pragmatically interchangeable.
5. Tests ONLY ${concept.name} — no other grammar.
6. Mark blank(s) with ___. The "question" field must contain ONLY the sentence — never embed the options or any list of choices inside the question text, as they are displayed separately in the UI.
7. Exactly 4 options per question. All 4 must be distinct strings — no two options may be identical.
8. Answer must exactly match one of the 4 options character-for-character.
9. Vary contexts: dialogue, short narrative, everyday situation. No two questions with the same context type.
10. Explanation in English, 1–2 sentences explaining why the correct answer is right. Reference the specific word in the sentence that determines the answer — write it naturally as part of the explanation, not as a labelled term (e.g. "after 'peux', the next verb…" not "the forcing cue is 'peux'").
11. wrongExplanations: REQUIRED. For each wrong option, write in this exact format: "[wrong word(s)] → [correct word(s)] — [one sentence]". The swap shows only the key differing word(s), not the full option. Write like a fluent speaker explaining to a friend — name the actual word in the sentence that forces the answer and say what it means in plain terms. Never name the grammar category. Good: "expliques → expliquer — after 'peux', the second verb stays in its plain dictionary shape". Good: "allons → irons — 'demain' points ahead in time, so the verb has to match". Keys must exactly match the option strings character-for-character. This field must always be present with exactly 3 entries (one per wrong option).
${lessonContext ? '12. Use different verbs and vocabulary from the lesson examples — test the same patterns, not the same sentences.' : ''}
${conceptKeyRuleNum}. CONCEPT KEY — every question must include a "conceptKey" field set to exactly: "${concept.slug}". Do not change this value. If you find yourself writing a question that does not test ${concept.name}, discard it and write a new one.${vocabInstruction}

Return ONLY this JSON — no markdown, no extra text:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":"...","allCorrect":["..."],"explanation":"...","wrongExplanations":{"wrong option 1":"why wrong","wrong option 2":"why wrong","wrong option 3":"why wrong"},"conceptKey":"${concept.slug}","vocabularyWord":"..."}]}
Note: "allCorrect" must include the canonical answer plus any other valid options. If only one option is valid, "allCorrect" should contain just that one answer.`

  const raw = await callMistral({ messages: [{ role: 'user', content: prompt }], temperature: 0.5, timeout: 90000, retries: 1 })
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

// Strip accents for accent-insensitive comparisons
function stripAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function validateQuestion(q, expectedSlug) {
  if (typeof q.question !== 'string' || !q.question.includes('___')) return false
  if (!Array.isArray(q.options) || q.options.length !== 4) return false
  if (q.options.some(o => typeof o !== 'string' || !o.trim())) return false
  if (typeof q.answer !== 'string' || !q.options.includes(q.answer)) return false
  if (typeof q.explanation !== 'string' || !q.explanation.trim()) return false
  const validAnswers = new Set([q.answer, ...(q.all_correct ?? q.allCorrect ?? [])])
  const wrongOptions = q.options.filter(o => !validAnswers.has(o))
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

  // Check 3: all options must be distinct strings
  if (new Set(q.options).size !== q.options.length) return false

  // Check 4: concept gate
  if (expectedSlug !== undefined && q.conceptKey !== expectedSlug) return false

  // Check 5: exactly one blank required — generation contract, no exceptions
  const numBlanks = (q.question.match(/___/g) ?? []).length
  if (numBlanks !== 1) return false

  // Check 6: stem/option root overlap — word after blank must not share a 5-char prefix
  // with any token in any option (catches négliger / Négliges-tu class errors)
  if (afterBlank && afterBlank.length >= 5) {
    const stemRoot = stripAccents(afterBlank).slice(0, 5)
    const allOptionTokens = q.options.flatMap(o => o.toLowerCase().split(/[\s\-]+/))
    if (allOptionTokens.some(t => stripAccents(t).startsWith(stemRoot))) return false
  }

  return true
}

/**
 * Circuit breaker: returns true if the verifier rejection rate for this concept
 * exceeds 80% over the last 5 logged generation attempts.
 * Fails open (returns false) on any DB error so we never block generation.
 */
async function isCircuitOpen(level, concept) {
  try {
    const { data } = await supabase
      .from('generation_logs')
      .select('verifier_passed, verifier_rejected')
      .eq('level', level)
      .eq('concept', concept)
      .eq('circuit_breaker_triggered', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!data || data.length < 3) return false

    const totalPassed   = data.reduce((s, r) => s + r.verifier_passed, 0)
    const totalRejected = data.reduce((s, r) => s + r.verifier_rejected, 0)
    const total = totalPassed + totalRejected

    if (total === 0) return false
    return (totalRejected / total) > 0.8
  } catch {
    return false
  }
}

/** Fire-and-forget: persist generation metrics to generation_logs. */
function logGeneration(metrics) {
  supabase.from('generation_logs').insert(metrics)
    .then(({ error }) => { if (error) console.error('logGeneration error:', error) })
}

/**
 * Save questions to bank, skipping any whose question text already exists
 * to avoid duplicates as the bank grows.
 */
async function saveDedupedToBank(level, conceptSlug, questions, existingBanked) {
  const existingTexts = new Set((existingBanked ?? []).map(q => q.question))
  const fresh = questions.filter(q => !existingTexts.has(q.question))
  const skipped = questions.length - fresh.length
  console.log(`[bank] ${level}/${conceptSlug} — generated: ${questions.length}, saving: ${fresh.length}, skipped as duplicate: ${skipped}`)
  if (fresh.length === 0) return

  const rows = fresh.map(q => ({
    level,
    concept: conceptSlug,
    type: 'multiple_choice',
    question: q.question,
    options: q.options,
    answer: q.answer,
    all_correct: q.all_correct ?? null,
    explanation: q.explanation,
    wrong_explanations: q.wrong_explanations ?? q.wrongExplanations ?? null,
    vocabulary_word: q.vocabulary_word ?? null,
    vocabulary_pos: q.vocabulary_pos ?? null,
    source: 'ai_generated',
  }))

  const { error } = await supabase.from('questions').insert(rows)
  if (error) throw error
}
