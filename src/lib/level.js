// TCF score bands mapped to CEFR levels
export const BANDS = [
  { level: 'A1', min: 100, max: 199, mid: 150 },
  { level: 'A2', min: 200, max: 299, mid: 250 },
  { level: 'B1', min: 300, max: 399, mid: 350 },
  { level: 'B2', min: 400, max: 499, mid: 450 },
  { level: 'C1', min: 500, max: 599, mid: 550 },
  { level: 'C2', min: 600, max: 699, mid: 650 },
]

// CEFR label → mid-band TCF score (used when setting initial score from assessment)
export function levelToScore(level) {
  return BANDS.find(b => b.level === level)?.mid ?? 350
}

// TCF score → CEFR label
export function scoreToLevel(score) {
  const clamped = Math.max(100, Math.min(699, score))
  return BANDS.find(b => clamped >= b.min && clamped <= b.max)?.level ?? 'A1'
}

// Score delta based on first-attempt accuracy in a session
export function sessionDelta(correct, total) {
  const pct = correct / total
  if (pct === 1)       return 15   // 7/7
  if (pct >= 0.85)     return 10   // 6/7
  if (pct >= 0.70)     return  5   // 5/7
  if (pct >= 0.57)     return  0   // 4/7
  return -5                        // 3/7 or below
}

// Clamp score within valid TCF range
export function clampScore(score) {
  return Math.max(100, Math.min(699, score))
}

// Check if user is eligible for level promotion.
// conceptsInLevel: string[] of all concept slugs for the current level.
// sessionRows: rows from sessions table — { concept, score, total }[]
export function checkPromotion(conceptsInLevel, sessionRows) {
  if (!sessionRows.length) return { eligible: false, allCompleted: false, avgAccuracy: 0, weakConcepts: [] }

  // Which concepts has the user attempted at least once?
  const attempted = new Set(sessionRows.map(r => r.concept))
  const allCompleted = conceptsInLevel.every(c => attempted.has(c))

  // Per-concept accuracy
  const byConceptMap = {}
  for (const row of sessionRows) {
    if (!byConceptMap[row.concept]) byConceptMap[row.concept] = { correct: 0, total: 0 }
    byConceptMap[row.concept].correct += row.score
    byConceptMap[row.concept].total   += row.total
  }

  const conceptStats = Object.entries(byConceptMap).map(([concept, { correct, total }]) => ({
    concept,
    accuracy: total > 0 ? correct / total : 0,
  }))

  const weakConcepts = conceptStats.filter(s => s.accuracy < 0.5).map(s => s.concept)

  const totalCorrect = sessionRows.reduce((s, r) => s + r.score, 0)
  const totalQ       = sessionRows.reduce((s, r) => s + r.total, 0)
  const avgAccuracy  = totalQ > 0 ? totalCorrect / totalQ : 0

  const eligible = allCompleted && avgAccuracy >= 0.7 && weakConcepts.length === 0

  return { eligible, allCompleted, avgAccuracy, weakConcepts }
}
