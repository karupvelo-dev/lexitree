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

// Recency weight for a session based on age in days.
// ≤30 days → 1.0, 31–60 days → 0.5, 61–90 days → 0.2, >90 days → 0 (excluded).
function sessionWeight(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 30) return 1.0
  if (days <= 60) return 0.5
  if (days <= 90) return 0.2
  return 0
}

// Check if user is eligible for level promotion.
// conceptsInLevel: string[] of all concept slugs for the current level.
// sessionRows: rows from sessions table — { concept, score, total, created_at }[]
// Accuracy is recency-weighted: recent sessions count more, sessions older than 90 days are excluded.
// Requires minimum 50 weighted attempts before the gate is evaluable.
export function checkPromotion(conceptsInLevel, sessionRows) {
  if (!sessionRows.length) return { eligible: false, allCompleted: false, avgAccuracy: 0, weakConcepts: [] }

  // allCompleted uses all sessions regardless of age — concept ever attempted counts
  const attempted = new Set(sessionRows.map(r => r.concept))
  const allCompleted = conceptsInLevel.every(c => attempted.has(c))

  // Weighted per-concept accuracy (sessions >90 days excluded)
  const byConceptMap = {}
  for (const row of sessionRows) {
    const w = sessionWeight(row.created_at)
    if (w === 0) continue
    if (!byConceptMap[row.concept]) byConceptMap[row.concept] = { correct: 0, total: 0 }
    byConceptMap[row.concept].correct += row.score * w
    byConceptMap[row.concept].total   += row.total * w
  }

  // Concepts attempted but with no sessions in the last 90 days count as accuracy=0
  for (const slug of attempted) {
    if (!byConceptMap[slug]) byConceptMap[slug] = { correct: 0, total: 0 }
  }

  const conceptStats = Object.entries(byConceptMap).map(([concept, { correct, total }]) => ({
    concept,
    accuracy: total > 0 ? correct / total : 0,
  }))

  const weakConcepts = conceptStats.filter(s => s.accuracy < 0.5).map(s => s.concept)

  // Weighted overall accuracy
  let weightedCorrect = 0, weightedTotal = 0
  for (const row of sessionRows) {
    const w = sessionWeight(row.created_at)
    if (w === 0) continue
    weightedCorrect += row.score * w
    weightedTotal   += row.total * w
  }
  const avgAccuracy = weightedTotal > 0 ? weightedCorrect / weightedTotal : 0

  // Require minimum weighted attempts before the gate is evaluable (guards against hot streaks on thin data)
  const MIN_WEIGHTED_ATTEMPTS = 50
  const eligible = allCompleted && weightedTotal >= MIN_WEIGHTED_ATTEMPTS && avgAccuracy >= 0.7 && weakConcepts.length === 0

  return { eligible, allCompleted, avgAccuracy, weakConcepts }
}
