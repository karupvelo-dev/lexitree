'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { addEclairs } from '@/lib/eclairs'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { getVocabularyForLevel } from '@/data/vocabulary-map'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const TOTAL = 7

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getWordsWithLevel(upToLevel) {
  const idx = LEVEL_ORDER.indexOf(upToLevel)
  if (idx === -1) return []
  return LEVEL_ORDER.slice(0, idx + 1).flatMap(l =>
    getVocabularyForLevel(l).map(w => ({ ...w, level: l }))
  )
}

function selectWords(allWords, seen, correct, lastSeen) {
  if (!seen || Object.keys(seen).length === 0) return shuffle(allWords).slice(0, TOTAL)
  const now = Date.now()
  return allWords
    .map(w => {
      const s = seen[w.word] ?? 0
      if (s === 0) return { ...w, needScore: 0.5 }
      const c = correct?.[w.word] ?? 0
      const ts = lastSeen?.[w.word]
      const daysSince = ts ? (now - new Date(ts).getTime()) / 86400000 : 30
      const accuracy = c / s
      const halfLife = 2 + accuracy * 12
      const strength = accuracy * Math.exp(-Math.LN2 * daysSince / halfLife)
      return { ...w, needScore: 1 - strength }
    })
    .sort((a, b) => b.needScore - a.needScore)
    .slice(0, TOTAL)
}

function buildQuestions(words, allWords) {
  return words.map(word => {
    const pool = allWords.filter(w => w.pos === word.pos && w.word !== word.word)
    const distractors = shuffle(pool).slice(0, 3).map(d => d.definition)
    const fallback = allWords.filter(w => w.word !== word.word)
    while (distractors.length < 3) {
      const pick = shuffle(fallback)[0]
      if (pick && !distractors.includes(pick.definition)) distractors.push(pick.definition)
    }
    const options = shuffle([word.definition, ...distractors])
    return { word: word.word, level: word.level, pos: word.pos, answer: word.definition, options }
  })
}

function calcVocabScore(allWords, seen, correct) {
  const seenWords = allWords.filter(w => (seen[w.word] ?? 0) > 0)
  if (!seenWords.length) return 0
  const scores = seenWords.map(w => {
    const s = seen[w.word]
    const c = correct[w.word] ?? 0
    const weight = Math.min(s, 5) / 5
    const accuracy = c / s
    return weight * accuracy
  })
  return Math.round(scores.reduce((a, b) => a + b, 0) / seenWords.length * 100)
}

export default function VocabPracticePage() {
  const router = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()

  const [questions, setQuestions]     = useState([])
  const [allWords, setAllWords]       = useState([])
  const [level, setLevel]             = useState(null)
  const [scoreBefore, setScoreBefore]         = useState(null)
  const [scoreAfter, setScoreAfter]           = useState(null)
  const [wordsSeenCount, setWordsSeenCount]   = useState(null)
  const [index, setIndex]             = useState(0)
  const [phase, setPhase]             = useState('question')
  const [selected, setSelected]       = useState(null)
  const [results, setResults]         = useState([])
  const [shareUrl, setShareUrl]       = useState(null)
  const [eclairsOverride, setEclairsOverride] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)

  useEffect(() => {
    const lvl = localStorage.getItem('lagram_level')
    if (!lvl) { router.replace('/assess'); return }
    setLevel(lvl)
    const words = getWordsWithLevel(lvl)
    setAllWords(words)

    if (user) {
      supabaseBrowser
        .from('profiles')
        .select('vocabulary_seen, vocabulary_correct, vocabulary_last_seen')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const seen     = data?.vocabulary_seen      ?? {}
          const correct  = data?.vocabulary_correct   ?? {}
          const lastSeen = data?.vocabulary_last_seen ?? {}
          setScoreBefore(calcVocabScore(words, seen, correct))
          setQuestions(buildQuestions(selectWords(words, seen, correct, lastSeen), words))
        })
        .catch(() => setQuestions(buildQuestions(selectWords(words, null, null, null), words)))
    } else {
      setQuestions(buildQuestions(selectWords(words, null), words))
    }
  }, [user?.id])

  function handleSelect(option) {
    if (phase === 'feedback') return
    const isCorrect = option === questions[index].answer
    if (isCorrect) setEclairsOverride(addEclairs(100))
    setSelected(option)
    setResults(prev => [...prev, {
      correct:    isCorrect,
      word:       questions[index].word,
      definition: questions[index].answer,
    }])
    setPhase('feedback')
  }

  function restart() {
    const level = localStorage.getItem('lagram_level')
    if (!level) return
    const words = getWordsWithLevel(level)
    setAllWords(words)
    setIndex(0)
    setSelected(null)
    setResults([])
    setScoreAfter(null)
    setPhase('question')
    setShareUrl(null)
    setShareLoading(false)

    if (user) {
      supabaseBrowser
        .from('profiles')
        .select('vocabulary_seen, vocabulary_correct, vocabulary_last_seen')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const seen     = data?.vocabulary_seen      ?? {}
          const correct  = data?.vocabulary_correct   ?? {}
          const lastSeen = data?.vocabulary_last_seen ?? {}
          setScoreBefore(calcVocabScore(words, seen, correct))
          setQuestions(buildQuestions(selectWords(words, seen, correct, lastSeen), words))
        })
        .catch(() => setQuestions(buildQuestions(selectWords(words, null, null, null), words)))
    } else {
      setQuestions(buildQuestions(selectWords(words, null), words))
    }
  }

  function handleNext() {
    if (index < TOTAL - 1) {
      setIndex(i => i + 1)
      setSelected(null)
      setPhase('question')
    } else {
      setPhase('complete')
      if (user) saveProgress()
    }
  }

  async function saveProgress() {
    try {
      const { data: profile } = await supabaseBrowser
        .from('profiles')
        .select('vocabulary_seen, vocabulary_correct, vocabulary_last_seen')
        .eq('id', user.id)
        .single()

      const seen     = { ...(profile?.vocabulary_seen      ?? {}) }
      const correct  = { ...(profile?.vocabulary_correct   ?? {}) }
      const lastSeen = { ...(profile?.vocabulary_last_seen ?? {}) }
      const now = new Date().toISOString()

      for (let i = 0; i < questions.length; i++) {
        const word       = questions[i].word
        const wasCorrect = results[i]?.correct ?? false
        seen[word]     = (seen[word] ?? 0) + 1
        lastSeen[word] = now
        if (wasCorrect) correct[word] = (correct[word] ?? 0) + 1
      }

      const newScore = calcVocabScore(allWords, seen, correct)
      const newWordsSeenCount = Object.keys(seen).length
      setScoreAfter(newScore)
      setWordsSeenCount(newWordsSeenCount)

      await supabaseBrowser
        .from('profiles')
        .update({ vocabulary_seen: seen, vocabulary_correct: correct, vocabulary_last_seen: lastSeen, vocab_score: newScore, vocab_words_seen: newWordsSeenCount })
        .eq('id', user.id)

      // Count vocab session towards streak
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (session?.access_token) {
        fetch('/api/update-streak', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Failed to save vocab progress:', err)
    }
  }

  async function handleShare() {
    if (!user) { signInWithGoogle(); return }
    setShareLoading(true)
    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      const level       = localStorage.getItem('lagram_level') ?? ''
      const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? null
      const correct     = results.filter(r => r.correct).length
      const delta       = scoreAfter !== null && scoreBefore !== null ? scoreAfter - scoreBefore : null

      const res = await fetch('/api/create-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          type: 'vocab',
          score: correct,
          total: TOTAL,
          level,
          words: results.map(r => ({ word: r.word, correct: r.correct, definition: r.definition })),
          vocab_score: scoreAfter ?? null,
          vocab_score_delta: delta,
          display_name: displayName,
        }),
      })
      const { id } = await res.json()
      const url = `${window.location.origin}/share/${id}`
      await navigator.clipboard.writeText(url)
      setShareUrl(url)
    } catch (err) {
      console.error('share error:', err)
    } finally {
      setShareLoading(false)
    }
  }

  if (questions.length === 0) return null

  const q = questions[index]

  return (
    <div className="app-shell">
      <Sidebar active="vocab" user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} vocabScoreOverride={scoreAfter} vocabWordsSeenOverride={wordsSeenCount} eclairsOverride={eclairsOverride} />

      <div className="main-content">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Vocabulaire</h1>
        </div>

        {phase !== 'complete' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div className="progress-dots">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <span key={i} className={`dot ${i < index ? 'done' : i === index ? 'current' : ''}`} />
                ))}
              </div>
              <span style={{ fontSize: '13px', color: 'var(--mid)' }}>{index + 1} / {TOTAL}</span>
            </div>

            <div className="exercise-card">
              <div style={{ textAlign: 'center', padding: '8px 16px 8px' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--mid)', textTransform: 'capitalize' }}>{q.pos}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--dark)', marginBottom: '4px' }}>{q.word}</div>
                <div style={{ fontSize: '12px', color: 'var(--light)' }}>What does this mean?</div>
              </div>

              <div className="options-grid">
                {q.options.map(opt => {
                  const isCorrect = phase === 'feedback' && opt === q.answer
                  const isWrong   = phase === 'feedback' && opt === selected && opt !== q.answer
                  let cls = 'option-btn'
                  if (isCorrect) cls += ' correct'
                  else if (isWrong) cls += ' incorrect'
                  return (
                    <button
                      key={opt}
                      className={cls}
                      disabled={phase === 'feedback'}
                      onClick={() => handleSelect(opt)}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>

              {phase === 'feedback' && (
                <div className="explanation">
                  {selected === q.answer
                    ? `✓ Correct — ${q.word} means "${q.answer}"`
                    : `The correct meaning is "${q.answer}"`}
                </div>
              )}
            </div>

            {phase === 'feedback' && (
              <div className="session-footer">
                <div style={{ fontSize: '13px', fontWeight: 500, color: selected === q.answer ? 'var(--green)' : 'var(--red)' }}>
                  {selected === q.answer ? '✓ Correct' : '✗ Incorrect'}
                </div>
                <button className="btn-primary" onClick={handleNext}>
                  {index < TOTAL - 1 ? 'Next →' : 'See results →'}
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'complete' && (
          <VocabSummary
            results={results}
            total={TOTAL}
            scoreBefore={scoreBefore}
            scoreAfter={scoreAfter}
            onRetry={restart}
            onShare={handleShare}
            shareUrl={shareUrl}
            shareLoading={shareLoading}
            user={user}
            level={level}
          />
        )}
      </div>
    </div>
  )
}

function VocabSummary({ results, total, scoreBefore, scoreAfter, onRetry, onShare, shareUrl, shareLoading, user, level }) {
  const correct = results.filter(r => r.correct).length
  const pct     = Math.round((correct / total) * 100)
  const delta   = scoreAfter !== null && scoreBefore !== null ? scoreAfter - scoreBefore : null
  const perfect = correct === total

  useEffect(() => {
    if (correct < 5) return
    import('canvas-confetti').then(({ default: confetti }) => {
      if (perfect) {
        const burst = (origin) => confetti({ particleCount: 120, spread: 80, origin, colors: ['#ffffff', '#cbd5e1', '#94a3b8', '#000000'], startVelocity: 55, ticks: 200 })
        burst({ x: 0.2, y: 0.6 })
        setTimeout(() => burst({ x: 0.8, y: 0.6 }), 150)
        setTimeout(() => burst({ x: 0.5, y: 0.5 }), 350)
      } else {
        confetti({ particleCount: 70, spread: 60, origin: { x: 0.5, y: 0.6 }, colors: ['#000000', '#ADADAD', '#16A34A', '#ffffff'], ticks: 150 })
      }
    })
  }, [])

  if (perfect) {
    return (
      <div className="exercise-card" style={{ padding: 0, background: '#0d0d0d', border: '1px solid #1e1e1e', overflow: 'hidden' }}>
        <style>{`
          @keyframes lx-fadein { from { opacity:0 } to { opacity:1 } }
          @keyframes lx-fadeup { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        `}</style>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #64748b 30%, #cbd5e1 50%, #64748b 70%, transparent)', animation: 'lx-fadein 0.6s ease 0.1s both' }} />
        <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '10px', animation: 'lx-fadein 0.4s ease 0.3s both' }}>👑</div>
          <div style={{ fontSize: '68px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '8px', animation: 'lx-fadeup 0.5s ease 0.65s both' }}>7/7</div>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '10px', animation: 'lx-fadein 0.5s ease 0.9s both' }}>Acquis</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.15)', marginBottom: '28px' }}>Vocabulary · {level}</div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '20px' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '20px' }}>
            {results.map((r, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: '12px', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.05)', borderRadius: '4px', padding: '3px 8px' }}>
                {r.word}
              </span>
            ))}
          </div>
          {scoreAfter !== null && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '24px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Vocab Score</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#cbd5e1' }}>{scoreAfter}</span>
              {delta !== null && delta !== 0 && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{delta > 0 ? `+${delta}` : delta}</span>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <button onClick={onRetry} style={{ padding: '11px 28px', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '500px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              Practice again →
            </button>
            {shareUrl ? (
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>✓ Link copied to clipboard</span>
            ) : (
              <button onClick={onShare} disabled={shareLoading} style={{ background: 'none', border: 'none', padding: 0, fontSize: '13px', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontWeight: 500 }}>
                {shareLoading ? 'Creating link…' : user ? 'Share result ↗' : 'Sign in to share ↗'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="exercise-card" style={{ padding: '40px 28px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>{correct >= 5 ? '🎉' : '💪'}</div>
      <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--dark)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
        {correct >= 5 ? 'Great work!' : 'Keep practising!'}
      </h2>
      <p style={{ fontSize: '15px', color: 'var(--mid)', marginBottom: '12px' }}>{correct} of {total} correct</p>

      {scoreAfter !== null && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--mid)' }}>Vocab Score</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--indigo)' }}>{scoreAfter}</span>
          {delta !== null && delta !== 0 && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
      )}

      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: correct >= 5 ? 'var(--green)' : 'var(--terracotta)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '28px', textAlign: 'left' }}>
        {results.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: r.correct ? 'var(--green-light)' : 'var(--red-light)', borderRadius: 'var(--radius)', border: `1px solid ${r.correct ? 'var(--green)' : 'var(--red)'}` }}>
            <span style={{ fontSize: '13px', color: r.correct ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>{r.correct ? '✓' : '✗'}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--dark)', fontWeight: 500 }}>{r.word}</span>
            {!r.correct && (
              <span style={{ fontSize: '13px', color: 'var(--mid)', marginLeft: '2px' }}>— {r.definition}</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <button className="btn-primary" onClick={onRetry}>Practice again →</button>
        {shareUrl ? (
          <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 500 }}>✓ Link copied to clipboard</span>
        ) : (
          <button onClick={onShare} disabled={shareLoading} style={{ background: 'none', border: 'none', padding: 0, fontSize: '13px', color: 'var(--light)', cursor: 'pointer', fontWeight: 500 }}>
            {shareLoading ? 'Creating link…' : user ? 'Share result ↗' : 'Sign in to share ↗'}
          </button>
        )}
      </div>
    </div>
  )
}
