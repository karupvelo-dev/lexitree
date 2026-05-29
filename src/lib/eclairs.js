const KEY = 'lagram_eclairs'
const DAILY_GOAL = 1000

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function getDailyEclairs() {
  if (typeof window === 'undefined') return 0
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!stored || stored.date !== today()) return 0
    return stored.points
  } catch {
    return 0
  }
}

export function addEclairs(n) {
  if (typeof window === 'undefined') return 0
  const current = getDailyEclairs()
  const next = current + n
  localStorage.setItem(KEY, JSON.stringify({ date: today(), points: next }))
  return next
}

export { DAILY_GOAL }
