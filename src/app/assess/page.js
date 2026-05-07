'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { estimateLevel } from '@/data/assessment'
import { LEVEL_INFO } from '@/data/concepts'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { levelToScore } from '@/lib/level'

export default function AssessPage() {
  const router = useRouter()
  const { user, signInWithGoogle } = useAuth()
  const [phase, setPhase] = useState('intro') // intro | question | feedback | result

  // Redirect returning users who already have a level
  useEffect(() => {
    const level = localStorage.getItem('lexitree_level')
    if (level) router.replace('/session')
  }, [])
  const [questions, setQuestions] = useState([])
  const [fetchState, setFetchState] = useState('loading') // loading | ready | error
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [estimatedLevel, setEstimatedLevel] = useState(null)

  // Fetch in background while user reads intro — hides LLM latency
  useEffect(() => {
    fetch('/api/generate-assessment')
      .then(r => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(data => {
        setQuestions(data.questions)
        setFetchState('ready')
      })
      .catch(() => setFetchState('error'))
  }, [])

  const total = questions.length
  const q = questions[index]

  function handleBegin() {
    if (fetchState === 'ready') setPhase('question')
  }

  function handleSelect(option) {
    if (selected !== null) return
    const correct = option === q.answer
    setAnswers(prev => [...prev, { correct }])
    setSelected(option)
    setPhase('feedback')
  }

  function handleNext() {
    if (index < total - 1) {
      setIndex(i => i + 1)
      setSelected(null)
      setPhase('question')
    } else {
      const level = estimateLevel(questions, [...answers])
      setEstimatedLevel(level)
      setPhase('result')
    }
  }

  async function handleBeginSession() {
    localStorage.setItem('lexitree_level', estimatedLevel)

    // Save profile if signed in
    if (user) {
      await saveProfile(user, estimatedLevel)
    }

    router.push('/session')
  }

  async function saveProfile(u, level) {
    try {
      await supabaseBrowser.from('profiles').upsert({
        id: u.id,
        email: u.email,
        level_score: levelToScore(level),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    } catch (err) {
      console.error('Failed to save profile:', err)
    }
  }

  function handleRetake() {
    setPhase('intro')
    setIndex(0)
    setSelected(null)
    setAnswers([])
    setEstimatedLevel(null)
    setQuestions([])
    setFetchState('loading')
    fetch('/api/generate-assessment')
      .then(r => r.json())
      .then(data => { setQuestions(data.questions); setFetchState('ready') })
      .catch(() => setFetchState('error'))
  }

  const correctCount = answers.filter(a => a.correct).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>

        {phase === 'intro' && (
          <IntroCard fetchState={fetchState} onBegin={handleBegin} />
        )}

        {(phase === 'question' || phase === 'feedback') && q && (
          <QuestionCard
            q={q}
            index={index}
            total={total}
            selected={selected}
            phase={phase}
            onSelect={handleSelect}
            onNext={handleNext}
          />
        )}

        {phase === 'result' && (
          <ResultCard
            level={estimatedLevel}
            info={LEVEL_INFO[estimatedLevel]}
            correct={correctCount}
            total={total}
            user={user}
            signInWithGoogle={signInWithGoogle}
            onBegin={handleBeginSession}
            onRetake={handleRetake}
          />
        )}

      </div>
    </div>
  )
}

function IntroCard({ fetchState, onBegin }) {
  const ready = fetchState === 'ready'
  const failed = fetchState === 'error'

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '40px', boxShadow: 'var(--shadow)' }}>
      <div style={{ marginBottom: '8px' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--dark)' }}>
          Lexitree<span style={{ color: 'var(--terracotta)' }}>.</span>
        </span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 600, lineHeight: 1.3, color: 'var(--dark)', marginBottom: '12px' }}>
        What's your level in French?
      </h1>
      <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--mid)', marginBottom: '24px' }}>
        Answer 7 grammar questions across a range of concepts and levels. No time pressure — we'll place you accurately.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {['A1', 'A2', 'B1', 'B2', 'C1'].map(lvl => (
          <span key={lvl} className="level-badge">{lvl}</span>
        ))}
      </div>

      {failed ? (
        <p style={{ fontSize: '14px', color: 'var(--red)' }}>Failed to load questions. Please refresh.</p>
      ) : (
        <button
          className="btn-primary"
          onClick={onBegin}
          disabled={!ready}
          style={{ width: '100%', textAlign: 'center', opacity: ready ? 1 : 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', borderRadius: 'var(--radius)' }}
        >
          {ready ? 'Begin assessment →' : (
            <>
              <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Preparing questions…
            </>
          )}
        </button>
      )}
    </div>
  )
}

function QuestionCard({ q, index, total, selected, phase, onSelect, onNext }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div />
        <span style={{ fontSize: '13px', color: 'var(--mid)' }}>{index + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((index + (phase === 'feedback' ? 1 : 0)) / total) * 100}%`, background: 'var(--terracotta)', borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>

      <div className="exercise-card">
        <p className="question-text">{q.question}</p>
        <div className="options-grid">
          {q.options.map(opt => {
            let cls = 'option-btn'
            if (phase === 'feedback') {
              if (opt === q.answer) cls += ' correct'
              else if (opt === selected) cls += ' incorrect'
            }
            return (
              <button key={opt} className={cls} disabled={phase === 'feedback'} onClick={() => onSelect(opt)}>
                {opt}
              </button>
            )
          })}
        </div>
        {phase === 'feedback' && (
          <div className="explanation">{q.explanation}</div>
        )}
      </div>

      {phase === 'feedback' && (
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn-primary" onClick={onNext}>
            {index < total - 1 ? 'Next question →' : 'See my level →'}
          </button>
        </div>
      )}
    </div>
  )
}

function ResultCard({ level, info, correct, total, user, signInWithGoogle, onBegin, onRetake }) {
  const pct = Math.round((correct / total) * 100)

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '40px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
      <span className="level-badge" style={{ fontSize: '13px', padding: '5px 14px', marginBottom: '20px', display: 'inline-block' }}>
        {level}
      </span>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--dark)', marginBottom: '10px' }}>
        {info?.name ?? level}
      </h2>
      <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--mid)', marginBottom: '8px' }}>
        {info?.desc}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--light)', marginBottom: '28px' }}>
        {correct} of {total} correct ({pct}%)
      </p>

      {/* Sign-in prompt for guests — saves level to profile */}
      {!user && (
        <div style={{ marginBottom: '24px', padding: '16px 20px', background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: 'var(--radius)', textAlign: 'left' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--dark)', marginBottom: '4px' }}>Save your level</p>
          <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '14px', lineHeight: 1.5 }}>Sign in so your level and progress are remembered across devices.</p>
          <button
            onClick={signInWithGoogle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 500, color: 'var(--dark)', cursor: 'pointer', boxShadow: 'var(--shadow)' }}
          >
            <GoogleIcon size={15} />
            Sign in with Google
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={onBegin}>
          Begin today's session →
        </button>
        <button className="btn-ghost" onClick={onRetake}>
          Retake assessment
        </button>
      </div>
    </div>
  )
}

function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}
