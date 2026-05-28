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
  "labelledSentence": {
    "tokens": [
      { "text": "word or phrase", "label": "plain English label", "isKey": false },
      { "text": "key form", "label": "what changes here", "isKey": true },
      { "text": "filler word", "label": null, "isKey": false }
    ]
  },
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
- "labelledSentence": Required on every lesson. Use the exact same sentence as panel 1's "fr" field — same words, same punctuation. Split it into 3–6 natural phrase-chunks. Rules for tokens:
  1. Exactly ONE token must have "isKey": true — this is the word or phrase the concept is teaching (the conjugated verb form, the construction, the key word). It must contain the actual form being taught.
  2. Labels are plain English, 1–3 words, no grammar jargon. Use functional descriptions a learner would understand: "trigger", "subject", "verb changes here", "who does it", "connects the clauses", "the key part". Never use terms like "subjonctif", "participe", "morphological".
  3. Set "label": null for connectors, articles, and filler words that don't need explanation (que, de, à, le, la, les, un, une). Do not label every word.
  4. The isKey token's label should describe WHAT is happening, not name the grammar: "verb changes here" not "subjunctive form".
- "conjugation": Include for any concept where verb endings are the core thing being learned — tenses, moods, and verb forms (e.g. imparfait, subjonctif, conditionnel, futur simple, passé composé, plus-que-parfait). Omit for non-verb concepts (pronouns, articles, negation, word order). Use a common regular verb as the example (parler, finir, or avoir/être if the concept is specifically about those). For subjonctif, use "que" as prefix in each pronoun (e.g. "que je", "que tu"). Rows must always have exactly 6 entries covering all persons.
- ONE VERB THROUGHOUT: Before writing anything else, pick a single verb for the entire lesson. Every field that contains a French verb — "labelledSentence", "conjugation", and every panel's "fr" field — must use this same verb. The only thing that may change across panels is the trigger phrase or surrounding sentence context. Never use a different verb in any panel or in the labelledSentence from the one in the conjugation table. This rule has no exceptions: do not substitute être, faire, aller, avoir, or any other verb in any panel or sentence if the lesson verb is something else.
- Choose the panel count (2–4) that best matches the concept structure. Do not force 3 panels if 2 or 4 is more natural.
- Each panel must illustrate the SAME core grammatical pattern with a different example — not a different grammar rule. All panels must be variations of the same concept, not a tour of related concepts. If this concept has only one trigger type, show 2–3 sentences that all use that trigger. Never introduce a new grammar construction in panel 2 or 3 that wasn't already established in panel 1.
- "titleFr" leads visually — make it the primary label (short, vivid, 2–4 French words). "title" is the English gloss below it (2–4 words, plain language, not grammar jargon). Both uppercase.
- "highlight" must be a verbatim substring of "fr" (exact characters, accents, spacing). Highlight the MINIMUM substring that shows exactly what is being taught — typically just the conjugated verb form, the pronoun, the article, or the key construction. Do not highlight surrounding context words (que, de, à, ne, subject pronouns, auxiliary verbs) unless the concept is specifically about those words. For negation concepts, use "highlight" for the first particle (ne) and "highlight2" for the second (pas/jamais/rien etc.). Never highlight text that is not in "fr".
- All French must be grammatically flawless and use natural, contemporary usage.
- Notes must add information not already visible in the title or the French sentence. Do not restate the title in different words. Instead: name 2–3 other triggers that follow the same pattern, flag a common mistake, or give a contrast that aids memory. Keep it under 12 words. No grammar jargon.
- "timelinePoints": Apply this three-part test before including a timeline. All three must be true — if any one fails, omit "timelinePoints" entirely:
  1. IS IT A TENSE? The concept must be a verb tense — not a mood, not a pronoun, not an article, not a conjunction, not a structural or agreement rule. Moods (subjonctif, conditionnel présent, impératif) are not tenses and never get a timeline regardless of how the lesson is framed.
  2. DOES IT HAVE A FIXED TEMPORAL POSITION? The tense must place an action at a learnable, specific point relative to the past or present. The learner should be able to ask "when did/will this happen?" and the timeline answers it. If the tense is about attitude, politeness, probability, or structure rather than WHEN, it fails this test.
  3. DOES THE VISUAL ADD ANYTHING? A learner looking at the timeline alone — without reading the panels — should immediately understand something about timing that they could not have understood from the sentence alone. If the timeline would just show two grey anchor dots with nothing in between, it adds nothing and must be omitted.
  If in doubt, omit. The concepts that pass all three tests are: imparfait, passé composé, plus-que-parfait, futur simple, futur antérieur, conditionnel passé, and si-clause tense contrast sequences. Every other concept fails at least one test.
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
