const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

// questions is the array returned by /api/generate-assessment
// answers is [{correct: bool}, ...] in the same order as questions
export function estimateLevel(questions, answers) {
  const scores = {}
  LEVEL_ORDER.forEach(l => { scores[l] = { c: 0, t: 0 } })

  answers.forEach((a, i) => {
    const lvl = questions[i]?.level
    if (!lvl || !scores[lvl]) return
    scores[lvl].t++
    if (a.correct) scores[lvl].c++
  })

  let result = 'A1'

  for (const lvl of LEVEL_ORDER) {
    if (scores[lvl].t === 0) continue
    const accuracy = scores[lvl].c / scores[lvl].t
    if (accuracy >= 0.5) result = lvl
    else break
  }

  return result
}
