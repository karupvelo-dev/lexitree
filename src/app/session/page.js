'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LEVEL_INFO } from '@/data/concepts'
import {
  A1_ORDER, A1_CONCEPTS,
  A2_ORDER, A2_CONCEPTS,
  B1_ORDER, B1_CONCEPTS,
  B2_ORDER, B2_CONCEPTS,
  C1_ORDER, C1_CONCEPTS,
  C2_ORDER, C2_CONCEPTS,
} from '@/data/grammar-map'

const LEVEL_DATA = {
  A1: { order: A1_ORDER, concepts: A1_CONCEPTS },
  A2: { order: A2_ORDER, concepts: A2_CONCEPTS },
  B1: { order: B1_ORDER, concepts: B1_CONCEPTS },
  B2: { order: B2_ORDER, concepts: B2_CONCEPTS },
  C1: { order: C1_ORDER, concepts: C1_CONCEPTS },
  C2: { order: C2_ORDER, concepts: C2_CONCEPTS },
}
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { scoreToLevel } from '@/lib/level'
import { getVocabularyUpToLevel } from '@/data/vocabulary-map'

const LEVEL_SEQUENCE = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
function nextLevel(level) {
  const i = LEVEL_SEQUENCE.indexOf(level)
  return i >= 0 && i < LEVEL_SEQUENCE.length - 1 ? LEVEL_SEQUENCE[i + 1] : null
}

const TOTAL = 7

// Returns the concept to practice today, rotating daily through available grammar map concepts.
// Falls back to the hardcoded concept if the level has no grammar map yet.
function getDailyConcept(level) {
  const data = LEVEL_DATA[level]
  if (data) {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24))
    const slug = data.order[dayIndex % data.order.length]
    return data.concepts[slug]
  }
  return A1_CONCEPTS[A1_ORDER[0]]
}

function selectVocabularyWords(level, vocabularySeen) {
  const words = getVocabularyUpToLevel(level)
  if (!vocabularySeen) return [...words].sort(() => Math.random() - 0.5).slice(0, 7)
  return [...words]
    .sort((a, b) => (vocabularySeen[a.word] ?? 0) - (vocabularySeen[b.word] ?? 0))
    .slice(0, 7)
}

export default function SessionPage() {
  const router = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()

  const [level, setLevel] = useState(null)
  const [concept, setConcept] = useState(null)
  // scenario removed — no longer used
  const [questions, setQuestions] = useState([])
  const [lesson, setLesson] = useState(null)
  const [loadState, setLoadState] = useState('idle')
  const [phase, setPhase] = useState('confirm') // confirm | loading | scenario | question | feedback | complete
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)       // set when correct answer found
  const [triedWrong, setTriedWrong] = useState(new Set()) // wrong options already attempted
  const [firstPick, setFirstPick] = useState(null)      // first selection per question (for scoring)
  const [lastWrongPick, setLastWrongPick] = useState(null) // most recent wrong pick (for explanation)
  const [results, setResults] = useState([])
  const [promotion, setPromotion] = useState(null)
  const [recalibration, setRecalibration] = useState(null)
  const [vocabularySeen, setVocabularySeen] = useState(null)
  const didFetch = useRef(false)

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true

    const storedLevel = localStorage.getItem('lexitree_level')
    if (!storedLevel) { router.replace('/assess'); return }

    const overrideRaw = localStorage.getItem('lexitree_concept')
    const c = overrideRaw ? JSON.parse(overrideRaw) : getDailyConcept(storedLevel)

    setLevel(storedLevel)
    setConcept(c)
    // Don't auto-start — show confirm screen first
  }, [])

  useEffect(() => {
    if (!user) return
    supabaseBrowser
      .from('profiles')
      .select('vocabulary_seen')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setVocabularySeen(data?.vocabulary_seen ?? {}))
      .catch(() => setVocabularySeen({}))
  }, [user?.id])

  async function fetchSession(lvl, c) {
    setLoadState('loading')
    setPhase('loading')
    setLesson(null)
    try {
      // Fetch lesson first so questions can be seeded from it
      let lesson = null
      try {
        const lessonRes = await fetch('/api/generate-lesson', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: lvl, concept: c }),
        })
        if (lessonRes.ok) {
          const lessonData = await lessonRes.json()
          lesson = lessonData.lesson
          setLesson(lesson)
        }
      } catch {
        // lesson is optional — continue without it
      }

      // Use concept's native level for question generation (may differ from user's stored level)
      const conceptLevel = c.level ?? lvl
      const vocabularyWords = selectVocabularyWords(lvl, vocabularySeen)
      const questionsRes = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: conceptLevel, concept: c, lesson, vocabularyWords }),
      })

      if (!questionsRes.ok) throw new Error()
      const questionsData = await questionsRes.json()
      setQuestions(questionsData.questions)

      setLoadState('ready')
      setPhase('scenario')
    } catch {
      setLoadState('error')
      setPhase('loading')
    }
  }

  function handleSelect(option) {
    if (phase === 'feedback') return
    const correct = option === questions[index].answer

    // Record score on first pick only
    if (firstPick === null) {
      setFirstPick(option)
      setResults(prev => [...prev, { correct }])
    }

    if (correct) {
      setSelected(option)
      setPhase('feedback')
    } else {
      setTriedWrong(prev => new Set([...prev, option]))
      setLastWrongPick(option)
    }
  }

  function handleNext() {
    if (index < TOTAL - 1) {
      setIndex(i => i + 1)
      setSelected(null)
      setTriedWrong(new Set())
      setFirstPick(null)
      setLastWrongPick(null)
      setPhase('question')
    } else {
      setPhase('complete')
      saveSession(results)
    }
  }

  async function saveSession(finalResults) {
    if (!user) return
    try {
      const { data: { session: authSession } } = await supabaseBrowser.auth.getSession()
      if (!authSession?.access_token) return

      const servedVocabWords = questions
        .map(q => q.vocabulary_word ?? q.vocabularyWord)
        .filter(Boolean)

      const res = await fetch('/api/save-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          level: concept.level ?? level,
          concept: concept.slug,
          concept_name: concept.nameFr,
          score: finalResults.filter(r => r.correct).length,
          total: finalResults.length,
          vocabularyWords: servedVocabWords,
        }),
      })
      const data = await res.json()
      if (data.promotion) setPromotion(data.promotion)
      if (data.recalibration) setRecalibration(data.recalibration)

      if (servedVocabWords.length > 0) {
        setVocabularySeen(prev => {
          const updated = { ...(prev ?? {}) }
          for (const word of servedVocabWords) {
            updated[word] = (updated[word] ?? 0) + 1
          }
          return updated
        })
      }
    } catch (err) {
      console.error('Failed to save session:', err)
    }
  }

  async function handleAcceptRecalibration(suggestedLevel) {
    try {
      const { data: { session: authSession } } = await supabaseBrowser.auth.getSession()
      if (!authSession?.access_token) return
      await fetch('/api/accept-recalibration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({ suggestedLevel }),
      })
      localStorage.setItem('lexitree_level', suggestedLevel)
      router.push('/session')
    } catch (err) {
      console.error('Failed to accept recalibration:', err)
    }
  }

  async function handleDismissRecalibration() {
    setRecalibration(null)
    try {
      const { data: { session: authSession } } = await supabaseBrowser.auth.getSession()
      if (!authSession?.access_token) return
      await fetch('/api/dismiss-recalibration', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authSession.access_token}` },
      })
    } catch (err) {
      console.error('Failed to dismiss recalibration:', err)
    }
  }

  function handleStart() {
    fetchSession(level, concept)
  }

  function handleNewSession() {
    setIndex(0)
    setSelected(null)
    setTriedWrong(new Set())
    setFirstPick(null)
    setLastWrongPick(null)
    setResults([])
    setPromotion(null)
    setRecalibration(null)
    setQuestions([])
    fetchSession(level, concept) // skip confirm on repeat sessions
  }

  async function handleChangeLevel() {
    localStorage.removeItem('lexitree_level')
    localStorage.removeItem('lexitree_concept')
    // Clear level from profile so returning sign-in doesn't restore old level
    if (user) {
      try {
        await supabaseBrowser.from('profiles').update({ level_score: 0, updated_at: new Date().toISOString() }).eq('id', user.id)
      } catch { /* non-critical */ }
    }
    router.push('/assess')
  }

  if (!level || !concept) return null

  const cumulativeWordSet = level ? new Set(getVocabularyUpToLevel(level).map(v => v.word)) : new Set()
  const vocabCount = user && vocabularySeen
    ? Object.keys(vocabularySeen).filter(w => cumulativeWordSet.has(w)).length
    : null

  return (
    <div className="app-shell">
      <Sidebar
        level={level}
        levelInfo={LEVEL_INFO[level]}
        user={user}
        signInWithGoogle={signInWithGoogle}
        signOut={signOut}
        vocabCount={vocabCount}
      />

      <div className="main-content">
        <div style={{ marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--mid)' }}>Today's session</span>
        </div>
        <h1 className="page-title">{concept.nameFr}</h1>
        <p className="page-subtitle">{concept.name}</p>

        {phase === 'confirm' && (
          <ConfirmCard concept={concept} level={level} onStart={handleStart} />
        )}

        {loadState === 'loading' && <LoadingCard />}
        {loadState === 'error' && <ErrorCard onRetry={() => fetchSession(level, concept)} />}

        {loadState === 'ready' && phase === 'scenario' && (
          <ScenarioCard
            concept={concept}
            lesson={lesson}
            onStart={() => setPhase('question')}
          />
        )}

        {loadState === 'ready' && (phase === 'question' || phase === 'feedback') && (
          <ExerciseCard
            q={questions[index]}
            index={index}
            total={TOTAL}
            selected={selected}
            triedWrong={triedWrong}
            firstPick={firstPick}
            lastWrongPick={lastWrongPick}
            phase={phase}
            onSelect={handleSelect}
            onNext={handleNext}
          />
        )}

        {loadState === 'ready' && phase === 'complete' && (
          <SummaryCard
            results={results}
            total={TOTAL}
            concept={concept}
            level={level}
            promotion={promotion}
            recalibration={recalibration}
            user={user}
            signInWithGoogle={signInWithGoogle}
            onNewSession={handleNewSession}
            onChangeLevel={handleChangeLevel}
            onAcceptRecalibration={handleAcceptRecalibration}
            onDismissRecalibration={handleDismissRecalibration}
          />
        )}
      </div>
    </div>
  )
}

// ─── Confirm card ────────────────────────────────────────────────────────────

function ConfirmCard({ concept, level, onStart }) {
  return (
    <div className="exercise-card" style={{ padding: '36px 28px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <span className="level-badge" style={{ marginBottom: '14px', display: 'inline-block' }}>{level}</span>
        <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--dark)', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          {concept.nameFr}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--mid)', marginBottom: '0' }}>{concept.name}</p>
      </div>

      {/* Rule preview */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '24px', borderLeft: '3px solid var(--terracotta-light)' }}>
        <p style={{ fontSize: '13px', color: 'var(--mid)', lineHeight: 1.6 }}>{concept.rule}</p>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        style={{ width: '100%', padding: '13px 24px', background: 'var(--terracotta)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', transition: 'opacity 0.15s', marginBottom: '16px' }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        Start today's lesson →
      </button>

      {/* Alternate concept hint */}
      <p style={{ fontSize: '12px', color: 'var(--light)', textAlign: 'center', lineHeight: 1.6 }}>
        Want to practice something else?{' '}
        <a href="/map" style={{ color: 'var(--terracotta)', textDecoration: 'none', fontWeight: 500 }}>
          Visit the Grammar Map
        </a>
        {' '}and tap any card to choose a concept.
      </p>
    </div>
  )
}

// ─── Scenario card ────────────────────────────────────────────────────────────

function ScenarioCard({ concept, lesson, onStart }) {
  return (
    <div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <VisualLesson concept={concept} lesson={lesson} onStart={onStart} />
    </div>
  )
}

// ─── Visual lesson ────────────────────────────────────────────────────────────

const ANCHOR_PASSE =     { label: 'passé',      sublabel: 'référence', color: '#9CA3AF' }
const ANCHOR_MAINTENANT = { label: 'maintenant', sublabel: 'présent',   color: '#9CA3AF' }

function withAnchors(points) {
  const hasPasse     = points.some(p => /^passé$|^passe$|^past$/i.test(p.label?.trim() ?? ''))
  const hasMaintenant = points.some(p => /maintenant|présent|present|now/i.test(p.label ?? ''))

  let result = [...points]

  // Inject missing anchors at the correct ends
  if (!hasPasse)      result = [ANCHOR_PASSE, ...result]
  if (!hasMaintenant) result = [...result, ANCHOR_MAINTENANT]

  // Enforce grey on any point labelled as an anchor (in case Mistral coloured them)
  return result.map(p => {
    const isAnchor = /^passé$|^passe$|^past$|^maintenant$|^présent$|^present$|^now$/i.test(p.label?.trim() ?? '')
    return isAnchor ? { ...p, color: '#9CA3AF' } : p
  })
}

function VisualLesson({ concept, lesson: mistralLesson, onStart }) {
  // Mistral lesson takes precedence; fall back to hardcoded data in concepts.js
  const lesson = mistralLesson ?? concept.lesson ?? null
  if (!lesson) return null

  // Adaptive grid: 4 panels → 2×2, otherwise fill up to 3 per row
  const panelCount = lesson.panels.length
  const cols = panelCount === 4 ? 2 : Math.min(panelCount, 3)

  // Always cap the timeline with a "maintenant" point so the present anchor is visible
  const timelinePoints = lesson.timelinePoints
    ? withAnchors(lesson.timelinePoints)
    : null

  return (
    <div style={{ animation: 'fadeIn 0.35s ease' }}>

      {/* Key idea callout — shown first to frame the lesson */}
      <KeyIdeaBox text={lesson.keyIdea} />

      {/* Formula */}
      <SectionLabel>Formula</SectionLabel>
      <FormulaStrip parts={concept.formula} />

      {/* Conjugation table */}
      {lesson.conjugation && <ConjugationTable data={lesson.conjugation} />}

      {/* Numbered panels */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '10px', marginBottom: '16px', marginTop: '20px' }}>
        {lesson.panels.map(panel => <PanelCard key={panel.num} panel={panel} />)}
      </div>

      {/* Timeline (only when the lesson includes timeline points) */}
      {timelinePoints && <TimelineViz points={timelinePoints} />}

      {/* Takeaway footer */}
      <div style={{ background: 'var(--dark)', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>🧠</span>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
          <strong style={{ color: '#fff' }}>One-line takeaway: </strong>
          {lesson.takeaway}
        </p>
      </div>

      <button
        onClick={onStart}
        style={{ width: '100%', textAlign: 'center', padding: '13px 24px', background: 'var(--terracotta)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', transition: 'opacity 0.15s' }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        Begin exercises →
      </button>
    </div>
  )
}

function PanelCard({ panel }) {
  const { color, num, title, titleFr, fr, en, highlight, highlight2, context, note } = panel
  const bg = color + '12' // ~7% opacity tint

  // Split sentence into segments around all highlight strings, return React nodes
  function renderFr(sentence, hl, hl2) {
    if (!sentence) return sentence
    const marks = [hl, hl2].filter(Boolean)
    if (marks.length === 0) return sentence

    // Build sorted list of match ranges
    const ranges = []
    for (const m of marks) {
      const idx = sentence.indexOf(m)
      if (idx !== -1) ranges.push({ start: idx, end: idx + m.length, word: m })
    }
    ranges.sort((a, b) => a.start - b.start)

    const nodes = []
    let cursor = 0
    for (const r of ranges) {
      if (r.start > cursor) nodes.push(sentence.slice(cursor, r.start))
      nodes.push(
        <mark key={r.start} style={{ background: color + '30', color, borderRadius: '3px', padding: '0 2px', fontStyle: 'normal' }}>
          {r.word}
        </mark>
      )
      cursor = r.end
    }
    if (cursor < sentence.length) nodes.push(sentence.slice(cursor))
    return nodes
  }

  return (
    <div style={{ background: bg, border: `1.5px solid ${color}30`, borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: color, color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color }}>{title}</div>
          <div style={{ fontSize: '9px', color: 'var(--mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{titleFr}</div>
        </div>
      </div>

      {/* French sentence or context */}
      {fr ? (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', lineHeight: 1.55, color: 'var(--dark)', fontWeight: 400 }}>
          {renderFr(fr, highlight, highlight2)}
        </p>
      ) : context ? (
        <p style={{ fontSize: '13px', color: 'var(--mid)', lineHeight: 1.5 }}>{context}</p>
      ) : null}

      {/* English */}
      {en && <p style={{ fontSize: '12px', color: 'var(--mid)', lineHeight: 1.45 }}>{en}</p>}

      {/* Note tag */}
      {note && (
        <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${color}20`, fontSize: '10px', color, fontWeight: 500 }}>
          ☞ {note}
        </div>
      )}
    </div>
  )
}

function TimelineViz({ points }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: '16px' }}>Timeline</div>

      {/* Labels above */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        {points.map((p, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: p.color, fontFamily: 'var(--font-sans)' }}>{p.label}</div>
          </div>
        ))}
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
        {/* Line */}
        <div style={{ position: 'absolute', left: '6%', right: '6%', height: '2px', background: 'var(--border)' }} />
        {/* Arrow head */}
        <div style={{ position: 'absolute', right: '4%', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '7px solid var(--border)' }} />
        {/* Dots */}
        {points.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${10 + i * (80 / (points.length - 1))}%`, transform: 'translateX(-50%)', width: '12px', height: '12px', borderRadius: '50%', background: p.color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${p.color}40`, zIndex: 1 }} />
        ))}
      </div>

      {/* Sublabels below */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        {points.map((p, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1 }}>
            {p.sublabel && <div style={{ fontSize: '11px', color: 'var(--light)', letterSpacing: '0.02em' }}>({p.sublabel})</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function KeyIdeaBox({ text }) {
  return (
    <div style={{ background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>💡</span>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--terracotta)', marginBottom: '4px' }}>Key idea</div>
        <p style={{ fontSize: '14px', lineHeight: 1.55, color: 'var(--dark)' }}>{text}</p>
      </div>
    </div>
  )
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: '8px', ...style }}>
      {children}
    </div>
  )
}

function FormulaStrip({ parts }) {
  const tokenColors = [
    { bg: 'var(--dark)', color: '#fff', border: 'none' },
    null,
    { bg: 'var(--terracotta-bg)', color: 'var(--terracotta)', border: '1.5px solid var(--terracotta-light)' },
    null,
    { bg: 'var(--green-light)', color: 'var(--green)', border: '1.5px solid var(--green)' },
  ]

  let tokenIdx = 0
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      {parts.map((part, i) => {
        const isOp = part === '+' || part === '→'
        if (isOp) {
          return <span key={i} style={{ fontSize: '15px', color: 'var(--light)', fontWeight: 300, lineHeight: 1 }}>{part}</span>
        }
        const style = tokenColors[tokenIdx] ?? tokenColors[2]
        tokenIdx++
        return (
          <span key={i} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-sans)', background: style.bg, color: style.color, border: style.border ?? 'none' }}>
            {part}
          </span>
        )
      })}
    </div>
  )
}

function ConjugationTable({ data }) {
  const { verb, rows } = data
  return (
    <div style={{ marginTop: '16px', marginBottom: '4px' }}>
      <SectionLabel>Conjugation — <em style={{ fontStyle: 'normal', color: 'var(--dark)', textTransform: 'none', fontSize: '11px', fontWeight: 500, letterSpacing: 0 }}>{verb}</em></SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '16px' }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '8px 14px', background: 'var(--white)' }}>
            <span style={{ fontSize: '12px', color: 'var(--light)', minWidth: '72px', flexShrink: 0 }}>{row.pronoun}</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--dark)', fontFamily: 'var(--font-sans)' }}>{row.form}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

function ExerciseCard({ q, index, total, selected, triedWrong, firstPick, lastWrongPick, phase, onSelect, onNext }) {
  if (!q) return null

  const wrongExplanation = lastWrongPick
    ? (q.wrong_explanations?.[lastWrongPick] ?? 'Not quite — try another option.')
    : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="progress-dots">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`dot ${i < index ? 'done' : i === index ? 'current' : ''}`} />
          ))}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--mid)' }}>{index + 1} / {total}</span>
      </div>

      <div className="exercise-card">
        <p className="question-text">{q.question}</p>

        {/* Wrong option explanation — shown after each wrong attempt */}
        {wrongExplanation && phase !== 'feedback' && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'var(--red-light)', borderLeft: '3px solid var(--red)', borderRadius: '0 var(--radius) var(--radius) 0', fontSize: '13px', color: 'var(--dark)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--red)' }}>✗ {lastWrongPick}</strong> — {wrongExplanation}
          </div>
        )}

        <div className="options-grid">
          {q.options.map(opt => {
            const isTried = triedWrong.has(opt)
            const isCorrect = phase === 'feedback' && opt === q.answer

            let cls = 'option-btn'
            if (isCorrect) cls += ' correct'
            else if (isTried) cls += ' incorrect'

            return (
              <button
                key={opt}
                className={cls}
                disabled={isTried || phase === 'feedback'}
                style={isTried ? { opacity: 0.45, textDecoration: 'line-through', cursor: 'default' } : {}}
                onClick={() => onSelect(opt)}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Correct answer explanation shown once right answer is found */}
        {phase === 'feedback' && <div className="explanation">{q.explanation}</div>}
      </div>

      {phase === 'feedback' && (
        <div className="session-footer">
          <div style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 500 }}>
            ✓ Correct
          </div>
          <button className="btn-primary" onClick={onNext}>
            {index < total - 1 ? 'Next →' : 'See results →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Loading / error ──────────────────────────────────────────────────────────

const ALL_LOADING_LINES = [
  { fr: 'Conjugaison en cours…',                  en: 'Conjugating verbs at full speed.' },
  { fr: 'Le subjonctif réfléchit…',               en: 'The subjunctive is thinking hard.' },
  { fr: 'Accord des adjectifs…',                  en: 'Making adjectives agree with everyone.' },
  { fr: 'Interrogation des pronoms…',             en: 'Questioning the pronouns.' },
  { fr: 'Négation appliquée…',                    en: 'Saying non to bad exercises.' },
  { fr: 'Vérification des accents…',              en: 'Checking every accent, even the tricky ones.' },
  { fr: 'Le passé composé se souvient…',          en: 'The passé composé is recalling past events.' },
  { fr: 'Mise en scène grammaticale…',            en: 'Setting the grammatical scene.' },
  { fr: 'Les verbes irréguliers résistent…',      en: 'Irregular verbs are being difficult, as usual.' },
  { fr: 'Patience, s\'il vous plaît…',            en: 'Almost there — nearly ready.' },
  { fr: 'Le conditionnel hésite…',                en: 'The conditional is having second thoughts.' },
  { fr: 'Consultation du dictionnaire…',          en: 'Checking the dictionary, just to be sure.' },
  { fr: 'Les liaisons sont en négociation…',      en: 'Liaisons are being negotiated.' },
  { fr: 'L\'imparfait se souvient de tout…',      en: 'The imparfait remembers everything, vaguely.' },
  { fr: 'Discipline des participes passés…',      en: 'Past participles are being brought into line.' },
  { fr: 'Le gérondif s\'active…',                 en: 'The gérondif is multitasking, as always.' },
  { fr: 'Révision des exceptions…',               en: 'There are always exceptions. Always.' },
  { fr: 'Les pronoms toniques se vantent…',       en: 'Stressed pronouns are feeling very important right now.' },
  { fr: 'Le futur simple prévoit tout…',          en: 'The futur simple has already planned this.' },
  { fr: 'Placement des adverbes en cours…',       en: 'Placing adverbs in precisely the right spot.' },
  { fr: 'Le passé simple est très occupé…',       en: 'The passé simple only appears in formal texts — and here.' },
  { fr: 'Accord du participe passé…',             en: "Making the past participle agree. It's complicated." },
  { fr: 'Négation double en construction…',       en: 'Building a double negation, which is not nothing.' },
  { fr: 'Les articles définis insistent…',        en: 'Definite articles insisting on their presence.' },
  { fr: 'Le subjonctif passé cherche ses clés…',  en: "The subjonctif passé can't find its keys." },
  { fr: 'Vérification de la concordance…',        en: 'Checking that tenses agree with each other.' },
  { fr: 'Le dont fait des siennes…',              en: '"Dont" is doing its thing again.' },
  { fr: 'Les verbes pronominaux se réfléchissent…', en: 'Reflexive verbs are reflecting on themselves.' },
  { fr: 'L\'élision vérifie les voyelles…',       en: 'Élision is checking for vowels at the door.' },
  { fr: 'Le plus-que-parfait a tout anticipé…',   en: 'The plus-que-parfait had already anticipated this.' },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function LoadingCard() {
  const [lines] = useState(() => shuffle(ALL_LOADING_LINES))
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % lines.length)
        setVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(cycle)
  }, [])

  const line = lines[idx]

  return (
    <div className="exercise-card" style={{ textAlign: 'center', padding: '52px 28px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeMsg { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ display: 'inline-block', width: '34px', height: '34px', border: '2px solid var(--border)', borderTop: '2px solid var(--terracotta)', borderRadius: '50%', animation: 'spin 0.9s linear infinite', marginBottom: '28px' }} />

      <div style={{ minHeight: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <p
          key={idx}
          style={{
            fontFamily: 'var(--font-sans)',
            fontStyle: 'normal',
            fontSize: '17px',
            color: 'var(--dark)',
            marginBottom: '8px',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
          }}
        >
          {line.fr}
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--light)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          {line.en}
        </p>
      </div>
    </div>
  )
}

function ErrorCard({ onRetry }) {
  return (
    <div className="exercise-card" style={{ textAlign: 'center', padding: '40px 28px' }}>
      <p style={{ fontSize: '15px', color: 'var(--mid)', marginBottom: '20px' }}>
        Something went wrong generating your questions.
      </p>
      <button className="btn-primary" onClick={onRetry}>Try again</button>
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ results, total, concept, level, promotion, recalibration, user, signInWithGoogle, onNewSession, onChangeLevel, onAcceptRecalibration, onDismissRecalibration }) {
  const correct = results.filter(r => r.correct).length
  const pct = Math.round((correct / total) * 100)
  const great = pct >= 70
  const next = nextLevel(level)

  return (
    <div className="exercise-card" style={{ padding: '40px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{great ? '🎉' : '💪'}</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--dark)', marginBottom: '8px' }}>
          {great ? 'Great session!' : 'Keep practising!'}
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--mid)', marginBottom: '4px' }}>{correct} of {total} correct on first attempt</p>
        <p style={{ fontSize: '13px', color: 'var(--light)', marginBottom: '20px' }}>{concept.nameFr}</p>
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: great ? 'var(--green)' : 'var(--terracotta)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Recalibration nudge — shown when rolling accuracy is clearly mismatched */}
      {recalibration && user && (
        <RecalibrationNudge
          direction={recalibration.direction}
          currentLevel={level}
          suggestedLevel={recalibration.suggestedLevel}
          onAccept={onAcceptRecalibration}
          onDismiss={onDismissRecalibration}
        />
      )}

      {/* Promotion banner */}
      {promotion && next && (
        promotion.eligible ? (
          <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--radius)' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dark)', marginBottom: '4px' }}>
              Ready to advance to {next}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '12px', lineHeight: 1.5 }}>
              You've completed all {level} concepts with strong accuracy. You can move up when ready.
            </p>
            <button className="btn-primary" onClick={onChangeLevel} style={{ fontSize: '13px', padding: '8px 16px' }}>
              Advance to {next} →
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--dark)', marginBottom: '8px' }}>Progress to {next}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <ProgressRow
                done={promotion.allCompleted}
                label={promotion.allCompleted ? `All ${level} concepts attempted` : `Complete all ${level} concepts on the grammar map`}
              />
              <ProgressRow
                done={promotion.avgAccuracy >= 0.7}
                label={promotion.avgAccuracy >= 0.7
                  ? `Overall accuracy ${Math.round(promotion.avgAccuracy * 100)}% ✓`
                  : `Reach 70% accuracy (currently ${Math.round(promotion.avgAccuracy * 100)}%)`}
              />
              {promotion.weakConcepts?.length > 0 && (
                <ProgressRow
                  done={false}
                  label={`Strengthen weak areas: ${promotion.weakConcepts.join(', ')}`}
                />
              )}
            </div>
          </div>
        )
      )}

      {user === null && (
        <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', fontWeight: 600, color: 'var(--dark)', marginBottom: '6px' }}>Save your progress</p>
          <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '16px', lineHeight: 1.5 }}>Sign in to track your streak and pick up where you left off.</p>
          <button
            onClick={signInWithGoogle}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '11px 22px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 500, color: 'var(--dark)', cursor: 'pointer', boxShadow: 'var(--shadow)' }}
          >
            <GoogleIcon size={18} />
            Continue with Google
          </button>
        </div>
      )}

      {user && (
        <div style={{ marginBottom: '24px', padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserAvatar user={user} />
          <p style={{ fontSize: '13px', color: 'var(--dark)' }}>
            Progress saved to <strong>{user.user_metadata?.full_name ?? user.email}</strong>
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={onNewSession}>New session →</button>
      </div>
    </div>
  )
}

function RecalibrationNudge({ direction, currentLevel, suggestedLevel, onAccept, onDismiss }) {
  const isDown = direction === 'down'
  return (
    <div style={{
      marginBottom: '20px',
      padding: '16px 20px',
      background: isDown ? 'var(--bg)' : 'var(--green-light)',
      border: `1px solid ${isDown ? 'var(--border)' : 'var(--green)'}`,
      borderRadius: 'var(--radius)',
    }}>
      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dark)', marginBottom: '6px' }}>
        {isDown
          ? `${currentLevel} is a tough stretch right now`
          : `You're flying through ${currentLevel}`}
      </p>
      <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '14px', lineHeight: 1.55 }}>
        {isDown
          ? `Your recent sessions suggest moving to ${suggestedLevel} to build stronger foundations before returning to ${currentLevel}.`
          : `Your recent accuracy suggests you're ready to move up to ${suggestedLevel}.`}
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onAccept(suggestedLevel)}
          style={{ padding: '8px 16px', background: 'var(--dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Move to {suggestedLevel} →
        </button>
        <button
          onClick={onDismiss}
          style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--mid)', cursor: 'pointer' }}
        >
          Stay at {currentLevel}
        </button>
      </div>
    </div>
  )
}

function ProgressRow({ done, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: done ? 'var(--green)' : 'var(--light)', flexShrink: 0, marginTop: '1px' }}>
        {done ? '✓' : '○'}
      </span>
      <span style={{ fontSize: '13px', color: done ? 'var(--mid)' : 'var(--dark)', lineHeight: 1.4 }}>{label}</span>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ level, levelInfo, user, signInWithGoogle, signOut, vocabCount }) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">Lexitree<span>.</span></div>
      <nav className="sidebar-nav">
        <a className="nav-item active" href="/session">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Today
        </a>
        <a className="nav-item" href="/map">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Grammar Map
        </a>
        <a className="nav-item" href="/archive">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archive
        </a>
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ padding: '12px', background: 'var(--terracotta-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--terracotta-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--terracotta)', marginBottom: '4px' }}>Your level</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 600, color: 'var(--dark)' }}>{level}</div>
          <div style={{ fontSize: '12px', color: 'var(--mid)', marginTop: '2px' }}>{levelInfo?.name}</div>
          {vocabCount !== null && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--terracotta-light)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--dark)' }}>{vocabCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--mid)', lineHeight: 1.4 }}>
                {vocabCount === 1 ? 'word' : 'words'} encountered up to {level}
              </div>
            </div>
          )}
        </div>

        {user === undefined && null}

        {user === null && (
          <button
            onClick={signInWithGoogle}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--mid)', cursor: 'pointer' }}
          >
            <GoogleIcon size={14} />
            Sign in to save progress
          </button>
        )}

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <UserAvatar user={user} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: 'var(--dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.user_metadata?.full_name ?? user.email}
              </div>
              <button onClick={signOut} style={{ fontSize: '11px', color: 'var(--light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

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

function UserAvatar({ user }) {
  const name = user.user_metadata?.full_name ?? user.email ?? '?'
  const avatar = user.user_metadata?.avatar_url
  if (avatar) {
    return <img src={avatar} alt={name} width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--terracotta)', color: 'var(--white)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  )
}
