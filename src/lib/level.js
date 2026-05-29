// TCF score bands mapped to CEFR levels
export const BANDS = [
  { level: 'A1', min: 100, max: 199, mid: 150 },
  { level: 'A2', min: 200, max: 299, mid: 250 },
  { level: 'B1', min: 300, max: 399, mid: 350 },
  { level: 'B2', min: 400, max: 499, mid: 450 },
  { level: 'C1', min: 500, max: 599, mid: 550 },
  { level: 'C2', min: 600, max: 699, mid: 650 },
]

export function levelToScore(level) {
  return BANDS.find(b => b.level === level)?.mid ?? 350
}

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

export function clampScore(score) {
  return Math.max(100, Math.min(699, score))
}

// Recency weight: ≤30d → 1.0, 31–60d → 0.5, 61–90d → 0.2, >90d → 0 (excluded)
function sessionWeight(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days <= 30) return 1.0
  if (days <= 60) return 0.5
  if (days <= 90) return 0.2
  return 0
}

// Level-specific promotion gate thresholds. All four signals must pass simultaneously.
// coverageDays   — how recently each concept must have been practised (Infinity = ever)
// conceptFloor   — minimum weighted accuracy per individual concept
// overallMin     — minimum weighted accuracy across all sessions in the window
// minPerConcept  — minimum sessions per concept before the gate is evaluable
// consistencyMin — fraction of in-window sessions that must meet consistencyThreshold
// consistencyThreshold — minimum score/total for a session to count as consistent
export const PROMOTION_CONFIG = {
  A1: { coverageDays: Infinity, conceptFloor: 0.40, overallMin: 0.60, minPerConcept: 2, consistencyMin: 0.50, consistencyThreshold: 4 / 7 },
  A2: { coverageDays: 60,       conceptFloor: 0.45, overallMin: 0.65, minPerConcept: 3, consistencyMin: 0.55, consistencyThreshold: 4 / 7 },
  B1: { coverageDays: 60,       conceptFloor: 0.50, overallMin: 0.70, minPerConcept: 4, consistencyMin: 0.60, consistencyThreshold: 4 / 7 },
  B2: { coverageDays: 45,       conceptFloor: 0.55, overallMin: 0.72, minPerConcept: 5, consistencyMin: 0.65, consistencyThreshold: 5 / 7 },
  C1: { coverageDays: 30,       conceptFloor: 0.60, overallMin: 0.75, minPerConcept: 6, consistencyMin: 0.70, consistencyThreshold: 5 / 7 },
}

// Check if a user is eligible for level promotion.
// conceptsInLevel: string[] of all concept slugs for the level.
// sessionRows: { concept, score, total, created_at }[] from the sessions table.
// level: current CEFR level string — selects the gate config.
export function checkPromotion(conceptsInLevel, sessionRows, level) {
  const config = PROMOTION_CONFIG[level]
  const empty = { eligible: false, allCovered: false, avgAccuracy: 0, weakConcepts: [], missingCoverage: [], thinConcepts: [], consistencyMet: false, consistencyRate: 0, config: config ?? null }
  if (!config || !sessionRows.length) return empty

  const now = Date.now()
  const coverageCutoff = config.coverageDays === Infinity ? 0 : now - config.coverageDays * 86400000

  // Gate 1 — Coverage: every concept must have a session within the coverage window
  const recentAttempted = new Set(
    sessionRows
      .filter(r => new Date(r.created_at).getTime() >= coverageCutoff)
      .map(r => r.concept)
  )
  const missingCoverage = conceptsInLevel.filter(c => !recentAttempted.has(c))
  const allCovered = missingCoverage.length === 0

  // Gate 2 — Per-concept mastery: weighted accuracy above conceptFloor, min sessions met
  const byConceptMap = {}
  for (const row of sessionRows) {
    const w = sessionWeight(row.created_at)
    if (w === 0) continue
    if (!byConceptMap[row.concept]) byConceptMap[row.concept] = { correct: 0, total: 0, count: 0 }
    byConceptMap[row.concept].correct += row.score * w
    byConceptMap[row.concept].total   += row.total * w
    byConceptMap[row.concept].count   += 1
  }
  // Concepts covered but decayed out of the 90d weight window count as 0 accuracy
  for (const slug of recentAttempted) {
    if (!byConceptMap[slug]) byConceptMap[slug] = { correct: 0, total: 0, count: 0 }
  }

  const conceptStats = Object.entries(byConceptMap).map(([concept, { correct, total, count }]) => ({
    concept, count, accuracy: total > 0 ? correct / total : 0,
  }))
  const weakConcepts  = conceptStats.filter(s => s.accuracy < config.conceptFloor).map(s => s.concept)
  const thinConcepts  = conceptsInLevel.filter(slug => (byConceptMap[slug]?.count ?? 0) < config.minPerConcept)

  // Gate 3 — Overall weighted accuracy
  let weightedCorrect = 0, weightedTotal = 0
  for (const row of sessionRows) {
    const w = sessionWeight(row.created_at)
    if (w === 0) continue
    weightedCorrect += row.score * w
    weightedTotal   += row.total * w
  }
  const avgAccuracy = weightedTotal > 0 ? weightedCorrect / weightedTotal : 0

  // Gate 4 — Consistency: fraction of in-window sessions above the score threshold
  const windowSessions   = sessionRows.filter(r => new Date(r.created_at).getTime() >= coverageCutoff)
  const consistentCount  = windowSessions.filter(r => r.score / r.total >= config.consistencyThreshold).length
  const consistencyRate  = windowSessions.length > 0 ? consistentCount / windowSessions.length : 0
  const consistencyMet   = consistencyRate >= config.consistencyMin

  const eligible = allCovered && weakConcepts.length === 0 && thinConcepts.length === 0 && avgAccuracy >= config.overallMin && consistencyMet

  return { eligible, allCovered, avgAccuracy, weakConcepts, missingCoverage, thinConcepts, consistencyMet, consistencyRate, config }
}
