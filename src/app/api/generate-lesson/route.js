import { NextResponse } from 'next/server'
import { callMistral } from '@/lib/mistral'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { level, concept } = await request.json()

    // 1. Check cache
    const { data: cached } = await supabase
      .from('concept_lessons')
      .select('lesson')
      .eq('level', level)
      .eq('concept', concept.slug)
      .single()

    if (cached?.lesson) {
      return NextResponse.json({ lesson: cached.lesson, source: 'cache' })
    }

    // 2. Cache miss — generate from Mistral
    const prompt = buildPrompt(level, concept)
    const raw = await callMistral({ messages: [{ role: 'user', content: prompt }] })
    const lesson = JSON.parse(raw)

    // 3. Save to cache (fire and forget)
    supabase
      .from('concept_lessons')
      .upsert({ level, concept: concept.slug, lesson }, { onConflict: 'level,concept' })
      .then(({ error }) => { if (error) console.error('Failed to cache lesson:', error) })

    return NextResponse.json({ lesson, source: 'generated' })
  } catch (err) {
    console.error('generate-lesson error:', err)
    return NextResponse.json({ error: 'Failed to generate lesson' }, { status: 500 })
  }
}

function buildPrompt(level, concept) {
  return `You are an expert French grammar teacher creating a visual lesson for a web app.

CONCEPT: ${concept.nameFr} (${concept.name})
CEFR LEVEL: ${level}
GRAMMAR RULE: ${concept.rule}
FORMULA: ${concept.formula.join(' ')}
KEY EXAMPLES: ${concept.keyTerms}

Your task: design a visual lesson using 2–4 panels that build understanding progressively.
Choose the number of panels that best suits this concept — use fewer panels for simple concepts, more for complex multi-part rules.

AVAILABLE PANEL COLORS (pick semantically, each panel gets one):
- "#2563EB" — blue   → introduction, context, basic form, present moment
- "#D97706" — amber  → main rule in action, primary example, key contrast
- "#16A34A" — green  → completion, positive result, confirmation
- "#7C3AED" — purple → nuance, combined usage, full sentence, advanced case
- "#DC2626" — red    → negation, error contrast, unfulfilled or impossible condition

Return ONLY a valid JSON object with this structure:

{
  "panels": [
    {
      "num": 1,
      "color": "#hex",
      "title": "SHORT UPPERCASE ENGLISH LABEL (2–4 words)",
      "titleFr": "INTITULÉ EN FRANÇAIS (MAJUSCULES)",
      "fr": "Grammatically perfect French example sentence.",
      "en": "Accurate English translation.",
      "highlight": "exact substring of 'fr' to visually emphasize — the key verb or construction",
      "note": "Concrete teaching tip, 12 words or fewer."
    }
  ],
  "conjugation": {
    "verb": "example verb in infinitive",
    "rows": [
      { "pronoun": "je", "form": "conjugated form" },
      { "pronoun": "tu", "form": "conjugated form" },
      { "pronoun": "il/elle", "form": "conjugated form" },
      { "pronoun": "nous", "form": "conjugated form" },
      { "pronoun": "vous", "form": "conjugated form" },
      { "pronoun": "ils/elles", "form": "conjugated form" }
    ]
  },
  "timelinePoints": [
    { "label": "event label in French", "sublabel": "tense name", "color": "#hex" }
  ],
  "keyIdea": "One sharp sentence capturing the core insight of this concept.",
  "takeaway": "One memorable rule the learner will recall when writing French."
}

Rules:
- "conjugation": Include for any concept where verb endings are the core thing being learned — tenses, moods, and verb forms (e.g. imparfait, subjonctif, conditionnel, futur simple, passé composé, plus-que-parfait). Omit for non-verb concepts (pronouns, articles, negation, word order). Use a common regular verb as the example (parler, finir, or avoir/être if the concept is specifically about those). For subjonctif, use "que" as prefix in each pronoun (e.g. "que je", "que tu"). Rows must always have exactly 6 entries covering all persons.
- Choose the panel count (2–4) that best matches the concept structure. Do not force 3 panels if 2 or 4 is more natural.
- Each panel must illustrate exactly one idea. Never combine two teaching points in one panel.
- "highlight" must be a verbatim substring of "fr" (exact characters, accents, spacing). Never highlight text that is not in "fr".
- All French must be grammatically flawless and use natural, contemporary usage.
- Notes must be concrete and actionable — avoid abstract metalinguistic terms like "morphological alternation".
- "timelinePoints": Include ONLY for concepts whose meaning is fundamentally about temporal position on a time axis. Eligible: imparfait (alone or vs passé composé), passé composé (alone), plus-que-parfait, futur simple, futur antérieur, conditionnel passé, si-clause sequences. Omit for modal/mood concepts that do not express a fixed time position — this includes conditionnel présent, subjonctif, imperative, pronouns, articles, negation, and any concept whose core meaning is about how rather than when.
  When included, always follow these rules:
  1. Always include TWO fixed anchor points: { "label": "passé", "sublabel": "référence", "color": "#9CA3AF" } and { "label": "maintenant", "sublabel": "présent", "color": "#9CA3AF" }. These are grey reference anchors, never coloured.
  2. ONE focus point per tense being taught. If this concept teaches only one tense (e.g. futur simple, imparfait, passé composé alone), include exactly ONE coloured focus point — do NOT create multiple focus points for different example verbs. Multiple focus points are only appropriate when the concept explicitly contrasts two different tenses.
  3. Give each focus point a distinct accent color (use the same color as the relevant panel: #2563EB, #D97706, #16A34A, or #7C3AED). Use a short tense label (e.g. "futur simple", "imparfait") not a specific verb form.
  4. List ALL points in strict chronological order, earliest first.
  5. For past tenses: passé → [focus event] → maintenant
  6. For future tenses: passé → maintenant → [focus event]
  7. For mixed/contrast concepts: place each focus tense at its correct position between the anchors.
- Return only the JSON object — no markdown, no explanation, no extra text.`
}
