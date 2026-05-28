'use client'
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar, UserAvatar } from '@/components/Sidebar'
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
  const [isMapSession, setIsMapSession] = useState(false)
  const [streak, setStreak] = useState(0)
  const [guestSessions, setGuestSessions] = useState(0)
  const didFetch    = useRef(false)
  const loadingRef  = useRef(null)   // ref to LoadingCard's accelerate() handle
  const skipScenario = useRef(false)

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true

    const storedLevel = localStorage.getItem('lexitree_level')
    if (!storedLevel) { router.replace('/assess'); return }

    const overrideRaw = localStorage.getItem('lexitree_concept')
    const c = overrideRaw ? JSON.parse(overrideRaw) : getDailyConcept(storedLevel)
    const mapSession = !!overrideRaw

    setLevel(storedLevel)
    setConcept(c)
    setIsMapSession(mapSession)
    setGuestSessions(parseInt(localStorage.getItem('lexitree_guest_sessions') ?? '0', 10))

    // If today's daily concept was already completed, skip to todayDone
    if (!mapSession) {
      const today = new Date().toISOString().slice(0, 10)
      if (
        localStorage.getItem('lexitree_session_date') === today &&
        localStorage.getItem('lexitree_session_concept') === c.slug
      ) {
        setPhase('todayDone')
        return
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return
    supabaseBrowser
      .from('profiles')
      .select('vocabulary_seen, current_streak')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setVocabularySeen(data?.vocabulary_seen ?? {})
        setStreak(data?.current_streak ?? 0)
      })
      .catch(() => setVocabularySeen({}))

  }, [user?.id])

  function handleLoadComplete() {
    setLoadState('ready')
    if (skipScenario.current) {
      skipScenario.current = false
      setPhase('question')
    } else {
      setPhase('scenario')
    }
  }

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

      // Signal the jigsaw to accelerate; it calls handleLoadComplete when done
      loadingRef.current?.accelerate()
    } catch {
      setLoadState('error')
      setPhase('loading')
    }
  }

  async function fetchQuestionsOnly(lvl, c) {
    setLoadState('loading')
    setPhase('loading')
    try {
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
      loadingRef.current?.accelerate()
    } catch {
      setLoadState('error')
      setPhase('loading')
    }
  }

  function handleTryMore() {
    skipScenario.current = true
    setIndex(0)
    setSelected(null)
    setTriedWrong(new Set())
    setFirstPick(null)
    setLastWrongPick(null)
    setResults([])
    setPromotion(null)
    setRecalibration(null)
    setQuestions([])
    fetchQuestionsOnly(level, concept)
  }

  function handleSelect(option) {
    if (phase === 'feedback') return
    const q = questions[index]
    const validAnswers = q.all_correct ?? [q.answer]
    const correct = validAnswers.includes(option)

    // Record score on first pick only
    if (firstPick === null) {
      setFirstPick(option)
      setResults(prev => [...prev, { correct, answer: q.answer }])
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
    if (index < questions.length - 1) {
      setIndex(i => i + 1)
      setSelected(null)
      setTriedWrong(new Set())
      setFirstPick(null)
      setLastWrongPick(null)
      setPhase('question')
    } else {
      // Mark daily concept as done for today
      if (!isMapSession) {
        const today = new Date().toISOString().slice(0, 10)
        localStorage.setItem('lexitree_session_date', today)
        localStorage.setItem('lexitree_session_concept', concept.slug)
      }
      // Track guest session count for gating
      if (!user) {
        const prev = parseInt(localStorage.getItem('lexitree_guest_sessions') ?? '0', 10)
        const updated = prev + 1
        localStorage.setItem('lexitree_guest_sessions', String(updated))
        setGuestSessions(updated)
      }
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
      if (data.streak) setStreak(data.streak.current)

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

  function handleGoToMap() {
    localStorage.removeItem('lexitree_concept')
    router.push('/map')
  }

  function handleNewSession() {
    // Clear map override and return to daily concept flow
    localStorage.removeItem('lexitree_concept')
    setIsMapSession(false)

    const freshConcept = getDailyConcept(level)
    setConcept(freshConcept)

    setIndex(0)
    setSelected(null)
    setTriedWrong(new Set())
    setFirstPick(null)
    setLastWrongPick(null)
    setResults([])
    setPromotion(null)
    setRecalibration(null)
    setQuestions([])

    // If today's daily concept is already done, show the done card instead
    const today = new Date().toISOString().slice(0, 10)
    if (
      localStorage.getItem('lexitree_session_date') === today &&
      localStorage.getItem('lexitree_session_concept') === freshConcept.slug
    ) {
      setPhase('todayDone')
      return
    }

    setPhase('confirm')
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
      <Sidebar active="session" user={user} signInWithGoogle={signInWithGoogle} signOut={signOut}>
        <div style={{ padding: '12px', background: 'var(--terracotta-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--terracotta-light)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--terracotta)', marginBottom: '4px' }}>Your level</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--dark)', letterSpacing: '-0.02em' }}>{level}</div>
          <div style={{ fontSize: '12px', color: 'var(--mid)', marginTop: '2px' }}>{LEVEL_INFO[level]?.name}</div>
          {vocabCount !== null && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--terracotta-light)' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--dark)' }}>{vocabCount}</div>
              <div style={{ fontSize: '11px', color: 'var(--mid)', lineHeight: 1.4 }}>
                {vocabCount === 1 ? 'word' : 'words'} encountered up to {level}
              </div>
            </div>
          )}
        </div>
      </Sidebar>

      <div className="main-content">
        {phase === 'todayDone' && (
          <TodayDoneCard onGoToMap={() => router.push('/map')} onGoToArchive={() => router.push('/archive')} />
        )}

        {phase === 'confirm' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 140px)' }}>
            {user === null && guestSessions >= 2 ? (
              <GuestGateCard signInWithGoogle={signInWithGoogle} />
            ) : (
              <ConfirmCard concept={concept} level={level} onStart={handleStart} showLastSessionWarning={user === null && guestSessions === 1} />
            )}
          </div>
        )}

        {loadState === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 140px)' }}>
            <LoadingCard ref={loadingRef} onComplete={handleLoadComplete} />
          </div>
        )}
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
            key={index}
            q={questions[index]}
            index={index}
            total={questions.length}
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
            total={questions.length}
            concept={concept}
            level={level}
            promotion={promotion}
            recalibration={recalibration}
            user={user}
            signInWithGoogle={signInWithGoogle}
            isMapSession={isMapSession}
            streak={streak}
            guestSessions={guestSessions}
            onNewSession={handleNewSession}
            onGoToMap={handleGoToMap}
            onChangeLevel={handleChangeLevel}
            onAcceptRecalibration={handleAcceptRecalibration}
            onDismissRecalibration={handleDismissRecalibration}
            onTryMore={handleTryMore}
          />
        )}
      </div>
    </div>
  )
}

// ─── Confirm card ────────────────────────────────────────────────────────────

function ConfirmCard({ concept, level, onStart, showLastSessionWarning }) {
  return (
    <div className="exercise-card" style={{ padding: '20px', width: '100%' }}>
      {/* Last free session warning banner */}
      {showLastSessionWarning && (
        <div style={{ marginBottom: '16px', padding: '11px 14px', background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ fontSize: '13px' }}>⚠️</span>
          <p style={{ fontSize: '12px', color: 'var(--terracotta)', lineHeight: 1.5, margin: 0 }}>
            <strong>Last free session.</strong> Sign in after this to keep your level and continue.
          </p>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <span className="level-badge" style={{ marginBottom: '12px', display: 'inline-block' }}>{level}</span>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--dark)', letterSpacing: '-0.03em', marginBottom: '4px' }}>
          {concept.mapLabel ?? concept.nameFr}
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--mid)', marginBottom: '0' }}>{concept.name}</p>
      </div>

      {/* Rule preview */}
      <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 'var(--radius)', marginBottom: '20px', borderLeft: '3px solid var(--terracotta-light)' }}>
        <p style={{ fontSize: '13px', color: 'var(--mid)', lineHeight: 1.6 }}>{concept.rule}</p>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        style={{ width: '100%', padding: '0 24px', minHeight: '48px', background: 'var(--terracotta)', color: '#fff', border: 'none', borderRadius: '500px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.01em', cursor: 'pointer', transition: 'opacity 0.15s', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--light)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Today's concept</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--dark)' }}>{concept.mapLabel ?? concept.nameFr}</div>
      </div>

      {/* Anchor sentence first — learner sees the language before the explanation */}
      {lesson.labelledSentence
        ? <LabelledSentence data={lesson.labelledSentence} />
        : <><SectionLabel>Formula</SectionLabel><FormulaStrip parts={concept.formula} /></>
      }

      {/* Key idea follows the example — acts as the aha explanation */}
      <KeyIdeaBox text={lesson.keyIdea} />

      {/* Conjugation table */}
      {lesson.conjugation && <ConjugationTable data={lesson.conjugation} />}

      {/* Numbered panels */}
      <div className="lesson-panels-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '10px', marginBottom: '16px', marginTop: '20px' }}>
        {lesson.panels.map(panel => <PanelCard key={panel.num} panel={panel} />)}
      </div>

      {/* Timeline — only render when there is at least one coloured focus point beyond the grey anchors */}
      {timelinePoints && timelinePoints.some(p => p.color !== '#9CA3AF') && <TimelineViz points={timelinePoints} />}

      {/* Takeaway footer */}
      <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px' }}>🧠</span>
        <p style={{ fontSize: '14px', color: 'var(--dark)', lineHeight: 1.5, margin: 0 }}>
          <strong>One-line takeaway: </strong>
          {lesson.takeaway}
        </p>
      </div>

      <button
        onClick={onStart}
        style={{ width: '100%', padding: '0 24px', minHeight: '48px', background: 'var(--terracotta)', color: '#fff', border: 'none', borderRadius: '500px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.01em', cursor: 'pointer', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color }}>{titleFr}</div>
          <div style={{ fontSize: '9px', color: 'var(--mid)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
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
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>💡</span>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: '4px' }}>Key idea</div>
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

function LabelledSentence({ data }) {
  if (!data?.tokens?.length) return null
  const keyToken = data.tokens.find(t => t.isKey)

  return (
    <div style={{ marginBottom: '32px' }}>
      <SectionLabel>In a sentence</SectionLabel>
      <div style={{ paddingBottom: keyToken?.label ? '36px' : '4px' }}>
        {data.tokens.map((token, i) => {
          const spacer = i < data.tokens.length - 1 ? ' ' : ''
          if (token.isKey) {
            return (
              <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ fontSize: '22px', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--terracotta)', borderBottom: '2.5px solid var(--terracotta)', paddingBottom: '2px', lineHeight: 1.7 }}>
                  {token.text}
                </span>
                {token.label && (
                  <span style={{ position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', fontWeight: 600, color: 'var(--terracotta)', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                    {token.label}
                  </span>
                )}
                <span style={{ fontSize: '22px', fontFamily: 'var(--font-sans)', color: 'var(--dark)' }}>{spacer}</span>
              </span>
            )
          }
          return (
            <span key={i} style={{ fontSize: '22px', fontFamily: 'var(--font-sans)', color: 'var(--dark)', fontWeight: 400, lineHeight: 1.7 }}>
              {token.text}{spacer}
            </span>
          )
        })}
      </div>
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
  const footerRef = useRef(null)

  useEffect(() => {
    if (phase === 'feedback' && footerRef.current) {
      footerRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [phase])

  if (!q) return null

  const wrongExplanation = lastWrongPick
    ? (q.wrong_explanations?.[lastWrongPick] ?? 'Not quite — try another option.')
    : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div className="progress-dots">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`dot ${i < index ? 'done' : i === index ? 'current' : ''}`} />
          ))}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--mid)' }}>{index + 1} / {total}</span>
      </div>

      <div className="exercise-card">
        <p className="question-text">{renderQuestion(q.question)}</p>

        {/* Wrong option explanation — shown after each wrong attempt */}
        {wrongExplanation && phase !== 'feedback' && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'var(--red-light)', borderLeft: '3px solid var(--red)', borderRadius: '0 var(--radius) var(--radius) 0', fontSize: '13px', color: 'var(--dark)', lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--red)' }}>✗ {lastWrongPick}</strong> — {wrongExplanation}
          </div>
        )}

        <div className="options-grid">
          {q.options.map(opt => {
            const isTried = triedWrong.has(opt)
            const isCorrect = phase === 'feedback' && opt === selected

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
        {phase === 'feedback' && (
          <>
            <div className="explanation">{q.explanation}</div>
            {(() => {
              const validAnswers = q.all_correct ?? [q.answer]
              const others = validAnswers.filter(a => a !== selected)
              if (others.length === 0) return null
              return (
                <div style={{ marginTop: '8px', padding: '9px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', color: 'var(--mid)', lineHeight: 1.5 }}>
                  Also correct: <span style={{ color: 'var(--dark)', fontWeight: 500 }}>{others.join(', ')}</span>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {phase === 'feedback' && (
        <div ref={footerRef} className="session-footer">
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

function renderQuestion(text) {
  const parts = text.split('___')
  if (parts.length === 1) return text
  return parts.reduce((acc, part, i) => {
    acc.push(part)
    if (i < parts.length - 1) {
      acc.push(
        <span key={i} style={{ display: 'inline-block', width: '72px', borderBottom: '2px solid #000', verticalAlign: 'baseline', margin: '0 4px' }} />
      )
    }
    return acc
  }, [])
}

// ─── Loading / error ──────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const JIGSAW_MSGS = [
  { fr: 'Votre leçon se prépare…',           en: 'Preparing your lesson.' },
  { fr: 'Analyse de votre niveau…',           en: 'Reading your level.' },
  { fr: 'Concept du jour sélectionné…',       en: "Today's concept selected." },
  { fr: 'Construction des exercices…',        en: 'Building your exercises.' },
  { fr: "Les questions s'assemblent…",        en: 'Questions coming together.' },
  { fr: 'Vérification des contenus…',         en: 'Checking everything.' },
  { fr: 'Tout prend forme…',                  en: 'Taking shape.' },
  { fr: 'Dernière mise au point…',            en: 'Final touches.' },
  { fr: 'Presque prêt…',                      en: 'Almost ready.' },
]

// Static SVG defs: CSS transitions, sky gradients, moon mask, 5 illustrations.
// Injected once via dangerouslySetInnerHTML; clip paths + piece groups added imperatively.
const JIGSAW_DEFS = `
<style>
  .jig-piece { transition: opacity 0.22s ease, transform 0.42s cubic-bezier(0.34,1.4,0.64,1); }
  .jig-piece.jig-h { opacity: 0; transform: translateY(-14px) scale(0.92); }
  .jig-piece.jig-p { opacity: 1; transform: translateY(0) scale(1); }
</style>
<defs>
  <linearGradient id="jg0" x1="0" y1="-14" x2="0" y2="148" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#14304e"/><stop offset="52%" stop-color="#346889"/><stop offset="100%" stop-color="#c07545"/>
  </linearGradient>
  <linearGradient id="jg1" x1="0" y1="-14" x2="0" y2="150" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#2474b4"/><stop offset="58%" stop-color="#88c0da"/><stop offset="100%" stop-color="#ddd4a8"/>
  </linearGradient>
  <linearGradient id="jg2" x1="0" y1="-14" x2="0" y2="142" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#c03818"/><stop offset="48%" stop-color="#f07830"/><stop offset="100%" stop-color="#fcc040"/>
  </linearGradient>
  <linearGradient id="jg3" x1="0" y1="-14" x2="0" y2="100" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#3a9ed4"/><stop offset="65%" stop-color="#80c4e4"/><stop offset="100%" stop-color="#b4ddf0"/>
  </linearGradient>
  <linearGradient id="jg4" x1="0" y1="-14" x2="0" y2="126" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#788898"/><stop offset="55%" stop-color="#a8b8c8"/><stop offset="100%" stop-color="#d8ccb8"/>
  </linearGradient>
  <mask id="jmoon">
    <circle cx="140" cy="30" r="19" fill="white"/><circle cx="149" cy="25" r="16" fill="black"/>
  </mask>
  <!-- 0: Eiffel Tower, dusk -->
  <g id="ji0">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg0)"/>
    <circle cx="20" cy="16" r="1.3" fill="#f0e8d8" opacity="0.75"/>
    <circle cx="46" cy="5" r="0.9" fill="#f0e8d8" opacity="0.60"/>
    <circle cx="152" cy="11" r="1.1" fill="#f0e8d8" opacity="0.70"/>
    <circle cx="163" cy="37" r="0.8" fill="#f0e8d8" opacity="0.55"/>
    <circle cx="8" cy="52" r="0.9" fill="#f0e8d8" opacity="0.50"/>
    <circle cx="68" cy="4" r="0.7" fill="#f0e8d8" opacity="0.50"/>
    <circle cx="108" cy="7" r="0.8" fill="#f0e8d8" opacity="0.45"/>
    <circle cx="140" cy="30" r="19" fill="#f2e6cc" mask="url(#jmoon)"/>
    <rect x="-14" y="148" width="202" height="54" fill="#2b4720"/>
    <ellipse cx="87" cy="159" rx="78" ry="9" fill="#355a72" opacity="0.75"/>
    <line x1="54" y1="157" x2="74" y2="157" stroke="#6a9ab8" stroke-width="0.9" opacity="0.45"/>
    <line x1="96" y1="161" x2="120" y2="161" stroke="#6a9ab8" stroke-width="0.9" opacity="0.40"/>
    <rect x="-14" y="132" width="30" height="16" fill="#1e3d54" opacity="0.55"/>
    <rect x="12" y="124" width="15" height="24" fill="#1e3d54" opacity="0.55"/>
    <rect x="136" y="128" width="18" height="20" fill="#1e3d54" opacity="0.55"/>
    <rect x="148" y="136" width="38" height="12" fill="#1e3d54" opacity="0.55"/>
    <rect x="156" y="118" width="14" height="30" fill="#1e3d54" opacity="0.55"/>
    <g fill="#0c1420">
      <polygon points="87,10 89.5,42 96,70 78,70 84.5,42"/>
      <rect x="69" y="70" width="36" height="8"/>
      <polygon points="69,78 58,102 116,102 105,78"/>
      <rect x="52" y="102" width="70" height="8"/>
      <polygon points="52,110 26,152 48,152 66,110"/>
      <polygon points="108,110 126,152 148,152 122,110"/>
      <rect x="26" y="136" width="122" height="8"/>
    </g>
    <circle cx="87" cy="10" r="2.8" fill="#ffca4a" opacity="0.92"/>
    <circle cx="87" cy="10" r="5.5" fill="#ffca4a" opacity="0.16"/>
  </g>
  <!-- 1: Arc de Triomphe, afternoon -->
  <g id="ji1">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg1)"/>
    <rect x="-14" y="90" width="34" height="60" fill="#2a4e20"/>
    <ellipse cx="6" cy="86" rx="14" ry="10" fill="#336028"/>
    <ellipse cx="-4" cy="96" rx="10" ry="8" fill="#3a6830"/>
    <rect x="154" y="90" width="34" height="60" fill="#2a4e20"/>
    <ellipse cx="168" cy="86" rx="14" ry="10" fill="#336028"/>
    <ellipse cx="178" cy="96" rx="10" ry="8" fill="#3a6830"/>
    <rect x="-14" y="150" width="202" height="38" fill="#3e3828"/>
    <rect x="82" y="155" width="10" height="4" fill="#58503e" opacity="0.7"/>
    <rect x="82" y="163" width="10" height="4" fill="#58503e" opacity="0.7"/>
    <rect x="30" y="148" width="114" height="6" fill="#6a5e48"/>
    <path d="M 32,40 L 142,40 L 142,150 L 109,150 L 109,108 A 22,22 0 0,1 65,108 L 65,150 L 32,150 Z" fill="#c4a56c"/>
    <rect x="32" y="40" width="110" height="22" fill="#d4b57c"/>
    <rect x="38" y="66" width="26" height="32" fill="#a88c55" opacity="0.5" rx="1"/>
    <rect x="110" y="66" width="26" height="32" fill="#a88c55" opacity="0.5" rx="1"/>
    <path d="M 65,108 A 22,22 0 0,0 109,108 L 109,115 A 22,22 0 0,1 65,115 Z" fill="#8a7040" opacity="0.4"/>
  </g>
  <!-- 2: Notre-Dame, sunset -->
  <g id="ji2">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg2)"/>
    <rect x="-14" y="144" width="202" height="44" fill="#6a2810"/>
    <ellipse cx="87" cy="154" rx="58" ry="6" fill="#e07828" opacity="0.28"/>
    <line x1="38" y1="150" x2="62" y2="150" stroke="#f09040" stroke-width="1" opacity="0.3"/>
    <line x1="108" y1="156" x2="138" y2="156" stroke="#f09040" stroke-width="1" opacity="0.25"/>
    <rect x="-14" y="140" width="202" height="8" fill="#1e1808"/>
    <g fill="#140e04">
      <rect x="16" y="120" width="142" height="22"/>
      <rect x="16" y="28" width="40" height="92"/>
      <rect x="118" y="28" width="40" height="92"/>
      <rect x="56" y="60" width="62" height="60"/>
      <polygon points="82,60 87,34 92,60"/>
    </g>
    <circle cx="87" cy="84" r="12" fill="#d8501e" opacity="0.5"/>
    <circle cx="87" cy="84" r="7" fill="none" stroke="#f07028" stroke-width="1" opacity="0.4"/>
    <line x1="87" y1="72" x2="87" y2="96" stroke="#f07028" stroke-width="0.7" opacity="0.35"/>
    <line x1="75" y1="84" x2="99" y2="84" stroke="#f07028" stroke-width="0.7" opacity="0.35"/>
    <rect x="22" y="110" width="28" height="6" fill="#f07830" opacity="0.12"/>
    <rect x="124" y="110" width="28" height="6" fill="#f07830" opacity="0.12"/>
  </g>
  <!-- 3: Louvre Pyramid, midday -->
  <g id="ji3">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg3)"/>
    <rect x="-14" y="68" width="70" height="62" fill="#d4c090"/>
    <rect x="-14" y="60" width="70" height="10" fill="#6a7880"/>
    <rect x="118" y="68" width="70" height="62" fill="#d4c090"/>
    <rect x="118" y="60" width="70" height="10" fill="#6a7880"/>
    <rect x="52" y="62" width="70" height="68" fill="#d4c090"/>
    <rect x="52" y="54" width="70" height="10" fill="#6a7880"/>
    <g fill="#9a8a6a" opacity="0.45">
      <rect x="-2" y="74" width="5" height="7"/><rect x="8" y="74" width="5" height="7"/>
      <rect x="18" y="74" width="5" height="7"/><rect x="28" y="74" width="5" height="7"/>
      <rect x="38" y="74" width="5" height="7"/><rect x="48" y="74" width="5" height="7"/>
      <rect x="-2" y="88" width="5" height="7"/><rect x="8" y="88" width="5" height="7"/>
      <rect x="18" y="88" width="5" height="7"/><rect x="28" y="88" width="5" height="7"/>
      <rect x="38" y="88" width="5" height="7"/><rect x="48" y="88" width="5" height="7"/>
      <rect x="122" y="74" width="5" height="7"/><rect x="132" y="74" width="5" height="7"/>
      <rect x="142" y="74" width="5" height="7"/><rect x="152" y="74" width="5" height="7"/>
      <rect x="162" y="74" width="5" height="7"/>
      <rect x="122" y="88" width="5" height="7"/><rect x="132" y="88" width="5" height="7"/>
      <rect x="142" y="88" width="5" height="7"/><rect x="152" y="88" width="5" height="7"/>
      <rect x="162" y="88" width="5" height="7"/>
      <rect x="60" y="70" width="5" height="7"/><rect x="70" y="70" width="5" height="7"/>
      <rect x="80" y="70" width="5" height="7"/><rect x="90" y="70" width="5" height="7"/>
      <rect x="100" y="70" width="5" height="7"/><rect x="110" y="70" width="5" height="7"/>
      <rect x="60" y="84" width="5" height="7"/><rect x="70" y="84" width="5" height="7"/>
      <rect x="80" y="84" width="5" height="7"/><rect x="90" y="84" width="5" height="7"/>
      <rect x="100" y="84" width="5" height="7"/><rect x="110" y="84" width="5" height="7"/>
    </g>
    <rect x="-14" y="130" width="202" height="58" fill="#c8bca8"/>
    <polygon points="87,48 132,130 42,130" fill="#b4d8ec" opacity="0.52"/>
    <polygon points="87,48 132,130 42,130" fill="none" stroke="#7ab0cc" stroke-width="1.8"/>
    <g stroke="#7ab0cc" stroke-width="0.9" opacity="0.55">
      <line x1="87" y1="48" x2="87" y2="130"/>
      <line x1="87" y1="48" x2="65" y2="130"/>
      <line x1="87" y1="48" x2="109" y2="130"/>
      <line x1="65" y1="89" x2="109" y2="89"/>
      <line x1="54" y1="109" x2="120" y2="109"/>
    </g>
    <circle cx="87" cy="145" r="16" fill="none" stroke="#8ab0c8" stroke-width="1.5" opacity="0.5"/>
    <circle cx="87" cy="145" r="9" fill="#a4c4dc" opacity="0.22"/>
  </g>
  <!-- 4: Mont Saint-Michel, dawn -->
  <g id="ji4">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg4)"/>
    <rect x="-14" y="124" width="202" height="64" fill="#5e7888"/>
    <line x1="18" y1="133" x2="52" y2="133" stroke="#8ab0c0" stroke-width="0.8" opacity="0.45"/>
    <line x1="118" y1="138" x2="158" y2="138" stroke="#8ab0c0" stroke-width="0.8" opacity="0.45"/>
    <line x1="24" y1="150" x2="66" y2="150" stroke="#8ab0c0" stroke-width="0.7" opacity="0.35"/>
    <line x1="100" y1="158" x2="150" y2="158" stroke="#8ab0c0" stroke-width="0.7" opacity="0.35"/>
    <ellipse cx="87" cy="128" rx="68" ry="7" fill="#9aaa98" opacity="0.30"/>
    <rect x="-14" y="114" width="202" height="18" fill="#c4ccc8" opacity="0.28"/>
    <path d="M 28,126 C 36,118 50,107 62,98 C 68,92 74,86 80,81 L 87,77 L 94,81 C 100,86 106,92 112,98 C 124,107 138,118 146,126 Z" fill="#1e2430"/>
    <path d="M 50,112 L 66,96" stroke="#262e3a" stroke-width="6" stroke-linecap="butt"/>
    <path d="M 124,112 L 108,96" stroke="#262e3a" stroke-width="6" stroke-linecap="butt"/>
    <rect x="38" y="100" width="20" height="18" fill="#20262e"/>
    <rect x="34" y="110" width="14" height="10" fill="#20262e"/>
    <rect x="116" y="100" width="20" height="18" fill="#20262e"/>
    <rect x="126" y="110" width="14" height="10" fill="#20262e"/>
    <rect x="62" y="70" width="50" height="12" fill="#252c38"/>
    <rect x="62" y="62" width="10" height="20" fill="#252c38"/>
    <rect x="102" y="62" width="10" height="20" fill="#252c38"/>
    <rect x="72" y="58" width="30" height="24" fill="#252c38"/>
    <polygon points="83,58 87,24 91,58" fill="#252c38"/>
    <circle cx="87" cy="22" r="2.5" fill="#c4b090" opacity="0.85"/>
    <path d="M 42,126 C 56,132 72,135 87,135 C 102,135 118,132 132,126 Z" fill="#2a3240" opacity="0.28"/>
  </g>
  <linearGradient id="jg5" x1="0" y1="-14" x2="0" y2="90" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#2a0e44"/><stop offset="40%" stop-color="#7c3468"/><stop offset="100%" stop-color="#f07880"/>
  </linearGradient>
  <linearGradient id="jg6" x1="0" y1="-14" x2="0" y2="90" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#384e62"/><stop offset="55%" stop-color="#6890a8"/><stop offset="100%" stop-color="#b0c8cc"/>
  </linearGradient>
  <linearGradient id="jg7" x1="0" y1="-14" x2="0" y2="60" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#1558a8"/><stop offset="60%" stop-color="#3a88c8"/><stop offset="100%" stop-color="#80c0e0"/>
  </linearGradient>
  <linearGradient id="jg8" x1="0" y1="-14" x2="0" y2="96" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#c04818"/><stop offset="45%" stop-color="#f08830"/><stop offset="100%" stop-color="#fcc060"/>
  </linearGradient>
  <linearGradient id="jg9" x1="0" y1="-14" x2="0" y2="86" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#7888a0"/><stop offset="50%" stop-color="#b0c0cc"/><stop offset="100%" stop-color="#d8e4e8"/>
  </linearGradient>
  <!-- 5: Sacré-Cœur, evening -->
  <g id="ji5">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg5)"/>
    <circle cx="18" cy="24" r="1" fill="#fde0f8" opacity="0.6"/>
    <circle cx="150" cy="16" r="0.8" fill="#fde0f8" opacity="0.55"/>
    <circle cx="34" cy="50" r="0.7" fill="#fde0f8" opacity="0.50"/>
    <circle cx="162" cy="38" r="0.8" fill="#fde0f8" opacity="0.50"/>
    <path d="M -14,188 L -14,112 C 20,100 52,94 87,88 C 122,94 154,100 188,112 L 188,188 Z" fill="#242e18"/>
    <rect x="80" y="95" width="14" height="4" fill="#2c2a1e" opacity="0.6"/>
    <rect x="78" y="99" width="18" height="4" fill="#2c2a1e" opacity="0.5"/>
    <rect x="44" y="86" width="86" height="7" fill="#e2d8c0"/>
    <rect x="50" y="66" width="74" height="22" fill="#ded2b8"/>
    <path d="M 56,88 L 56,79 A 4,4 0 0,0 64,79 L 64,88 Z" fill="#9a8868" opacity="0.45"/>
    <path d="M 72,88 L 72,79 A 4,4 0 0,0 80,79 L 80,88 Z" fill="#9a8868" opacity="0.45"/>
    <path d="M 88,88 L 88,79 A 4,4 0 0,0 96,79 L 96,88 Z" fill="#9a8868" opacity="0.45"/>
    <path d="M 104,88 L 104,79 A 4,4 0 0,0 112,79 L 112,88 Z" fill="#9a8868" opacity="0.45"/>
    <rect x="50" y="56" width="20" height="12" fill="#dcd0b8"/>
    <path d="M 50,56 Q 60,42 70,56 Z" fill="#d0c4ac"/>
    <rect x="104" y="56" width="20" height="12" fill="#dcd0b8"/>
    <path d="M 104,56 Q 114,42 124,56 Z" fill="#d0c4ac"/>
    <rect x="68" y="46" width="38" height="22" fill="#e4d8c0"/>
    <path d="M 68,46 Q 87,12 106,46 Z" fill="#d8ccb4"/>
    <rect x="83" y="12" width="8" height="12" fill="#ccc0a0"/>
    <polygon points="82,12 87,4 92,12" fill="#c4b898"/>
    <line x1="87" y1="4" x2="87" y2="-2" stroke="#c4b898" stroke-width="1.5"/>
    <line x1="84" y1="1" x2="90" y2="1" stroke="#c4b898" stroke-width="1.5"/>
  </g>
  <!-- 6: Château de Chambord, autumn -->
  <g id="ji6">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg6)"/>
    <ellipse cx="-2" cy="82" rx="18" ry="20" fill="#b84e18"/>
    <ellipse cx="12" cy="72" rx="12" ry="16" fill="#c86020"/>
    <rect x="-5" y="84" width="6" height="36" fill="#4a3020"/>
    <ellipse cx="176" cy="84" rx="18" ry="20" fill="#a84818"/>
    <ellipse cx="162" cy="74" rx="12" ry="16" fill="#c05828"/>
    <rect x="173" y="86" width="6" height="34" fill="#4a3020"/>
    <rect x="-14" y="140" width="202" height="48" fill="#7a9858"/>
    <rect x="30" y="148" width="114" height="10" fill="#6888a0" opacity="0.45"/>
    <rect x="16" y="96" width="142" height="46" fill="#d0c49c"/>
    <g fill="#5a4e38" opacity="0.3">
      <rect x="22" y="102" width="6" height="10"/><rect x="33" y="102" width="6" height="10"/>
      <rect x="52" y="102" width="6" height="10"/><rect x="63" y="102" width="6" height="10"/>
      <rect x="74" y="102" width="6" height="10"/><rect x="85" y="102" width="6" height="10"/>
      <rect x="96" y="102" width="6" height="10"/><rect x="107" y="102" width="6" height="10"/>
      <rect x="116" y="102" width="6" height="10"/><rect x="127" y="102" width="6" height="10"/>
      <rect x="138" y="102" width="6" height="10"/><rect x="149" y="102" width="6" height="10"/>
    </g>
    <rect x="8" y="82" width="18" height="60" fill="#c8bc98"/>
    <ellipse cx="17" cy="82" rx="9" ry="5" fill="#c8bc98"/>
    <rect x="148" y="82" width="18" height="60" fill="#c8bc98"/>
    <ellipse cx="157" cy="82" rx="9" ry="5" fill="#c8bc98"/>
    <rect x="66" y="70" width="42" height="72" fill="#d4c8a0"/>
    <g fill="#5a4e38" opacity="0.28">
      <rect x="72" y="78" width="5" height="8"/><rect x="82" y="78" width="5" height="8"/><rect x="92" y="78" width="5" height="8"/>
      <rect x="72" y="92" width="5" height="8"/><rect x="82" y="92" width="5" height="8"/><rect x="92" y="92" width="5" height="8"/>
    </g>
    <g fill="#988c70">
      <rect x="10" y="74" width="4" height="10"/><rect x="20" y="70" width="3" height="14"/>
      <rect x="36" y="86" width="3" height="12"/><rect x="44" y="84" width="3" height="12"/>
      <rect x="58" y="84" width="3" height="12"/><rect x="64" y="82" width="3" height="12"/>
      <rect x="70" y="58" width="3" height="14"/><rect x="79" y="54" width="3" height="16"/>
      <rect x="87" y="52" width="3" height="18"/><rect x="96" y="54" width="3" height="16"/>
      <rect x="104" y="58" width="3" height="14"/>
      <rect x="110" y="82" width="3" height="12"/><rect x="118" y="84" width="3" height="12"/>
      <rect x="130" y="84" width="3" height="12"/><rect x="138" y="86" width="3" height="12"/>
      <rect x="151" y="70" width="3" height="14"/><rect x="160" y="74" width="4" height="10"/>
    </g>
    <rect x="82" y="38" width="10" height="16" fill="#b0a47c"/>
    <polygon points="82,38 87,28 92,38" fill="#a89870"/>
  </g>
  <!-- 7: Pont du Gard, Mediterranean summer -->
  <g id="ji7">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg7)"/>
    <rect x="-14" y="152" width="202" height="36" fill="#40a098"/>
    <line x1="8" y1="163" x2="52" y2="163" stroke="#70c8c0" stroke-width="0.9" opacity="0.4"/>
    <line x1="120" y1="168" x2="165" y2="168" stroke="#70c8c0" stroke-width="0.9" opacity="0.35"/>
    <ellipse cx="4" cy="150" rx="20" ry="9" fill="#3a6828"/>
    <ellipse cx="170" cy="150" rx="20" ry="9" fill="#3a6828"/>
    <rect x="10" y="118" width="5" height="34" fill="#2a4a18"/>
    <ellipse cx="12" cy="114" rx="5" ry="14" fill="#3a5820"/>
    <rect x="158" y="120" width="5" height="32" fill="#2a4a18"/>
    <ellipse cx="160" cy="116" rx="5" ry="14" fill="#3a5820"/>
    <rect x="-14" y="108" width="202" height="44" fill="#c8a85e"/>
    <path d="M 8,152 L 8,118 A 27,26 0 0,0 62,118 L 62,152 Z" fill="#60b8e0"/>
    <path d="M 76,152 L 76,122 A 17,17 0 0,0 110,122 L 110,152 Z" fill="#60b8e0"/>
    <path d="M 124,152 L 124,122 A 18,18 0 0,0 160,122 L 160,152 Z" fill="#60b8e0"/>
    <rect x="-14" y="80" width="202" height="28" fill="#c0a056"/>
    <g fill="#4aacd8">
      <path d="M -6,108 L -6,93 A 7,7 0 0,0 8,93 L 8,108 Z"/>
      <path d="M 16,108 L 16,93 A 7,7 0 0,0 30,93 L 30,108 Z"/>
      <path d="M 38,108 L 38,93 A 7,7 0 0,0 52,93 L 52,108 Z"/>
      <path d="M 60,108 L 60,93 A 7,7 0 0,0 74,93 L 74,108 Z"/>
      <path d="M 82,108 L 82,93 A 7,7 0 0,0 96,93 L 96,108 Z"/>
      <path d="M 100,108 L 100,93 A 7,7 0 0,0 114,93 L 114,108 Z"/>
      <path d="M 120,108 L 120,93 A 7,7 0 0,0 134,93 L 134,108 Z"/>
      <path d="M 140,108 L 140,93 A 7,7 0 0,0 154,93 L 154,108 Z"/>
      <path d="M 158,108 L 158,93 A 7,7 0 0,0 172,93 L 172,108 Z"/>
    </g>
    <rect x="-14" y="58" width="202" height="22" fill="#b89848"/>
    <g fill="#3898cc">
      <path d="M -8,80 L -8,70 A 5,5 0 0,0 2,70 L 2,80 Z"/>
      <path d="M 10,80 L 10,70 A 5,5 0 0,0 20,70 L 20,80 Z"/>
      <path d="M 28,80 L 28,70 A 5,5 0 0,0 38,70 L 38,80 Z"/>
      <path d="M 46,80 L 46,70 A 5,5 0 0,0 56,70 L 56,80 Z"/>
      <path d="M 64,80 L 64,70 A 5,5 0 0,0 74,70 L 74,80 Z"/>
      <path d="M 82,80 L 82,70 A 5,5 0 0,0 92,70 L 92,80 Z"/>
      <path d="M 100,80 L 100,70 A 5,5 0 0,0 110,70 L 110,80 Z"/>
      <path d="M 118,80 L 118,70 A 5,5 0 0,0 128,70 L 128,80 Z"/>
      <path d="M 136,80 L 136,70 A 5,5 0 0,0 146,70 L 146,80 Z"/>
      <path d="M 154,80 L 154,70 A 5,5 0 0,0 164,70 L 164,80 Z"/>
      <path d="M 172,80 L 172,70 A 5,5 0 0,0 182,70 L 182,80 Z"/>
    </g>
  </g>
  <!-- 8: Provence lavender fields, golden hour -->
  <g id="ji8">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg8)"/>
    <circle cx="87" cy="90" r="18" fill="#fce060" opacity="0.65"/>
    <circle cx="87" cy="90" r="11" fill="#fef088" opacity="0.55"/>
    <path d="M -14,96 C 30,82 60,80 87,82 C 114,80 144,82 188,96 L 188,-14 L -14,-14 Z" fill="#d05a28" opacity="0.22"/>
    <rect x="116" y="78" width="30" height="18" fill="#382010"/>
    <polygon points="116,78 131,68 146,78" fill="#2e1a0c"/>
    <rect x="134" y="58" width="5" height="12" fill="#2c180a"/>
    <rect x="148" y="68" width="4" height="28" fill="#1c2c10"/>
    <ellipse cx="150" cy="62" rx="4" ry="14" fill="#243818"/>
    <rect x="154" y="72" width="3" height="24" fill="#1c2c10"/>
    <ellipse cx="155" cy="67" rx="3" ry="12" fill="#243818"/>
    <rect x="-14" y="96" width="202" height="10" fill="#8858b8"/>
    <rect x="-14" y="106" width="202" height="2" fill="#c0884a"/>
    <rect x="-14" y="108" width="202" height="12" fill="#8050b0"/>
    <rect x="-14" y="120" width="202" height="2" fill="#c0884a"/>
    <rect x="-14" y="122" width="202" height="15" fill="#7848a8"/>
    <rect x="-14" y="137" width="202" height="2" fill="#c0884a"/>
    <rect x="-14" y="139" width="202" height="18" fill="#7040a0"/>
    <rect x="-14" y="157" width="202" height="2" fill="#c0884a"/>
    <rect x="-14" y="159" width="202" height="29" fill="#6438a0"/>
    <line x1="-14" y1="102" x2="188" y2="102" stroke="#9460c0" stroke-width="0.6" opacity="0.4"/>
    <line x1="-14" y1="115" x2="188" y2="115" stroke="#9460c0" stroke-width="0.6" opacity="0.4"/>
    <line x1="-14" y1="130" x2="188" y2="130" stroke="#9460c0" stroke-width="0.6" opacity="0.4"/>
    <line x1="-14" y1="148" x2="188" y2="148" stroke="#9460c0" stroke-width="0.6" opacity="0.4"/>
    <line x1="-14" y1="168" x2="188" y2="168" stroke="#9460c0" stroke-width="0.6" opacity="0.4"/>
    <path d="M 20,188 L 100,96" stroke="#c0884a" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
    <path d="M 44,188 L 116,96" stroke="#c0884a" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
  </g>
  <!-- 9: Château de Chenonceau, misty morning -->
  <g id="ji9">
    <rect x="-14" y="-14" width="202" height="202" fill="url(#jg9)"/>
    <rect x="-14" y="80" width="202" height="14" fill="#c8d4d8" opacity="0.45"/>
    <rect x="-14" y="86" width="202" height="8" fill="#8a9c80"/>
    <rect x="-14" y="94" width="202" height="58" fill="#8cacb4"/>
    <line x1="14" y1="110" x2="58" y2="110" stroke="#b0c4cc" stroke-width="0.7" opacity="0.4"/>
    <line x1="108" y1="124" x2="158" y2="124" stroke="#b0c4cc" stroke-width="0.7" opacity="0.35"/>
    <line x1="24" y1="138" x2="80" y2="138" stroke="#b0c4cc" stroke-width="0.7" opacity="0.3"/>
    <rect x="-14" y="152" width="202" height="36" fill="#7a9870"/>
    <rect x="-14" y="88" width="202" height="10" fill="#ccc0a2"/>
    <g fill="#8cacb4">
      <path d="M 12,152 L 12,112 A 12,12 0 0,0 36,112 L 36,152 Z"/>
      <path d="M 48,152 L 48,112 A 12,12 0 0,0 72,112 L 72,152 Z"/>
      <path d="M 86,152 L 86,112 A 12,12 0 0,0 110,112 L 110,152 Z"/>
      <path d="M 124,152 L 124,112 A 12,12 0 0,0 148,112 L 148,152 Z"/>
    </g>
    <rect x="8" y="46" width="158" height="44" fill="#c8c0a2"/>
    <g fill="#8a7c64" opacity="0.32">
      <rect x="14" y="54" width="7" height="11"/><rect x="25" y="54" width="7" height="11"/>
      <rect x="38" y="54" width="7" height="11"/><rect x="49" y="54" width="7" height="11"/>
      <rect x="62" y="54" width="7" height="11"/><rect x="73" y="54" width="7" height="11"/>
      <rect x="86" y="54" width="7" height="11"/><rect x="97" y="54" width="7" height="11"/>
      <rect x="110" y="54" width="7" height="11"/><rect x="121" y="54" width="7" height="11"/>
      <rect x="134" y="54" width="7" height="11"/><rect x="145" y="54" width="7" height="11"/>
    </g>
    <rect x="8" y="36" width="158" height="12" fill="#b0a886"/>
    <g fill="#a09870">
      <polygon points="16,36 23,26 30,36"/>
      <polygon points="44,36 51,26 58,36"/>
      <polygon points="72,36 79,26 86,36"/>
      <polygon points="100,36 107,26 114,36"/>
      <polygon points="128,36 135,26 142,36"/>
      <polygon points="154,36 161,26 168,36"/>
    </g>
    <rect x="4" y="22" width="16" height="68" fill="#c4bc9e"/>
    <ellipse cx="12" cy="22" rx="8" ry="5" fill="#c4bc9e"/>
    <polygon points="4,22 12,8 20,22" fill="#aca880"/>
    <rect x="154" y="22" width="16" height="68" fill="#c4bc9e"/>
    <ellipse cx="162" cy="22" rx="8" ry="5" fill="#c4bc9e"/>
    <polygon points="154,22 162,8 170,22" fill="#aca880"/>
    <rect x="8" y="94" width="158" height="22" fill="#b8b09a" opacity="0.16"/>
    <rect x="170" y="140" width="5" height="14" fill="#4e6038"/>
    <path d="M 172,140 Q 166,154 162,170" stroke="#7a9060" stroke-width="2" fill="none" opacity="0.5"/>
    <path d="M 172,140 Q 178,156 178,174" stroke="#7a9060" stroke-width="2" fill="none" opacity="0.45"/>
  </g>
</defs>`

const LoadingCard = forwardRef(function LoadingCard({ onComplete }, ref) {
  const svgRef  = useRef(null)
  const frRef   = useRef(null)
  const enRef   = useRef(null)
  const state   = useRef({ order: [], step: 0, msgIdx: 0, timer: null, pieceGroups: [], pieceUses: [] })

  useImperativeHandle(ref, () => ({
    accelerate() {
      const s = state.current
      clearTimeout(s.timer)
      if (frRef.current) frRef.current.style.opacity = '0'
      if (enRef.current) enRef.current.style.opacity = '0'
      const FAST = 180
      function ft() {
        if (s.step >= s.order.length) { setTimeout(onComplete, 500); return }
        const g = s.pieceGroups[s.order[s.step++]]
        g.classList.remove('jig-h')
        g.classList.add('jig-p')
        s.timer = setTimeout(ft, FAST)
      }
      ft()
    }
  }), [onComplete])

  useEffect(() => {
    const svg = svgRef.current
    const s   = state.current
    const NS  = 'http://www.w3.org/2000/svg'
    const S = 58, R = 11, D = 11
    const ILLUS_COUNT = 10

    // Wipe the SVG and rebuild from scratch every time the effect runs.
    // This is the standard pattern for imperative SVG with React (à la D3):
    // React owns the container element, useEffect owns all the content.
    // Avoids the dangerouslySetInnerHTML vs imperative-DOM conflict entirely.
    svg.innerHTML = JIGSAW_DEFS

    s.pieceGroups = []
    s.pieceUses   = []
    s.step   = 0
    s.msgIdx = 0
    clearTimeout(s.timer)
    const INTERVAL    = 4200

    function hEdge(x0, x1, y, type, ltr) {
      if (type === 'flat') return `L ${x1},${y} `
      const mid = (x0 + x1) / 2
      const dy = type === 'out' ? (ltr ? -D : D) : (ltr ? D : -D)
      return `L ${mid-R},${y} C ${mid-R},${y+dy} ${mid+R},${y+dy} ${mid+R},${y} L ${x1},${y} `
    }
    function vEdge(x, y0, y1, type, ttb) {
      if (type === 'flat') return `L ${x},${y1} `
      const mid = (y0 + y1) / 2
      const dx = type === 'out' ? (ttb ? D : -D) : (ttb ? -D : D)
      return `L ${x},${mid-R} C ${x+dx},${mid-R} ${x+dx},${mid+R} ${x},${mid+R} L ${x},${y1} `
    }
    function makePath(col, row, t) {
      const x = col * S, y = row * S
      return [`M ${x},${y} `,
        hEdge(x,   x+S, y,   t.top,    true),
        vEdge(x+S, y,   y+S, t.right,  true),
        hEdge(x+S, x,   y+S, t.bottom, false),
        vEdge(x,   y+S, y,   t.left,   false), 'Z'].join('')
    }

    const PIECES = [
      { row:0, col:0, top:'flat', right:'out',  bottom:'out',  left:'flat' },
      { row:0, col:1, top:'flat', right:'out',  bottom:'in',   left:'in'   },
      { row:0, col:2, top:'flat', right:'flat', bottom:'out',  left:'in'   },
      { row:1, col:0, top:'in',   right:'in',   bottom:'in',   left:'flat' },
      { row:1, col:1, top:'out',  right:'out',  bottom:'out',  left:'out'  },
      { row:1, col:2, top:'in',   right:'flat', bottom:'in',   left:'in'   },
      { row:2, col:0, top:'out',  right:'out',  bottom:'flat', left:'flat' },
      { row:2, col:1, top:'in',   right:'in',   bottom:'flat', left:'in'   },
      { row:2, col:2, top:'out',  right:'flat', bottom:'flat', left:'out'  },
    ]

    // Clip paths in a separate defs block (avoids touching React-managed defs)
    const clipDefs = document.createElementNS(NS, 'defs')
    PIECES.forEach((p, i) => {
      const cp = document.createElementNS(NS, 'clipPath')
      cp.setAttribute('id', `jcp${i}`)
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', makePath(p.col, p.row, p))
      cp.appendChild(path)
      clipDefs.appendChild(cp)
    })
    svg.appendChild(clipDefs)

    // Empty outlines (visible before a piece is placed)
    const emptyG = document.createElementNS(NS, 'g')
    PIECES.forEach(p => {
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d',             makePath(p.col, p.row, p))
      path.setAttribute('fill',          '#e8e3dc')
      path.setAttribute('stroke',        '#cdc8c0')
      path.setAttribute('stroke-width',  '1')
      path.setAttribute('stroke-linejoin', 'round')
      emptyG.appendChild(path)
    })
    svg.appendChild(emptyG)

    // Piece groups — each clips the active illustration
    PIECES.forEach((p, i) => {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('class', 'jig-piece jig-h')

      const clipG = document.createElementNS(NS, 'g')
      clipG.setAttribute('clip-path', `url(#jcp${i})`)
      const use = document.createElementNS(NS, 'use')
      use.setAttribute('href', '#ji0')
      clipG.appendChild(use)

      const seam = document.createElementNS(NS, 'path')
      seam.setAttribute('d',               makePath(p.col, p.row, p))
      seam.setAttribute('fill',            'none')
      seam.setAttribute('stroke',          'rgba(255,255,255,0.32)')
      seam.setAttribute('stroke-width',    '1.2')
      seam.setAttribute('stroke-linejoin', 'round')

      g.appendChild(clipG)
      g.appendChild(seam)
      svg.appendChild(g)
      s.pieceGroups.push(g)
      s.pieceUses.push(use)
    })

    // Pick a random illustration each session (avoid repeating on quick remounts)
    let lastIllus = -1
    function pickIllus() {
      let i
      do { i = Math.floor(Math.random() * ILLUS_COUNT) } while (i === lastIllus)
      lastIllus = i
      return i
    }

    function setMsg(idx) {
      const fr = frRef.current, en = enRef.current
      if (!fr || !en) return
      fr.style.opacity = '0'
      en.style.opacity = '0'
      setTimeout(() => {
        const m = JIGSAW_MSGS[idx % JIGSAW_MSGS.length]
        fr.textContent = m.fr
        en.textContent = m.en
        fr.style.opacity = '1'
        en.style.opacity = '1'
      }, 300)
    }

    // Pick illustration, shuffle order, place pieces one by one
    const illus = pickIllus()
    s.pieceUses.forEach(u => u.setAttribute('href', `#ji${illus}`))
    s.order = shuffle(PIECES.map((_, i) => i))
    s.step  = 0

    function tick() {
      setMsg(s.msgIdx++)
      const g = s.pieceGroups[s.order[s.step++]]
      g.classList.remove('jig-h')
      g.classList.add('jig-p')
      if (s.step < s.order.length) {
        s.timer = setTimeout(tick, INTERVAL)
      }
      // Puzzle complete — stays on finished image until accelerate() is called
    }
    tick()

    return () => {
      clearTimeout(s.timer)
      svg.innerHTML = ''
      s.pieceGroups = []
      s.pieceUses   = []
    }
  }, [])

  return (
    <div className="exercise-card" style={{
      width: '100%',
      padding: '48px 28px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '28px',
    }}>
      <svg
        ref={svgRef}
        width="174"
        height="174"
        viewBox="-14 -14 200 200"
        style={{ display: 'block', flexShrink: 0 }}
      />
      <div style={{ textAlign: 'center', width: '100%' }}>
        <p
          ref={frRef}
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '17px',
            fontWeight: 500,
            color: 'var(--dark)',
            lineHeight: 1.5,
            marginBottom: '5px',
            minHeight: '26px',
            transition: 'opacity 0.3s ease',
          }}
        >
          Votre leçon se prépare…
        </p>
        <p
          ref={enRef}
          style={{
            fontSize: '13px',
            color: 'var(--light)',
            minHeight: '20px',
            transition: 'opacity 0.3s ease',
          }}
        >
          Preparing your lesson.
        </p>
      </div>
    </div>
  )
})

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

function TodayDoneCard({ onGoToMap, onGoToArchive }) {
  return (
    <div className="exercise-card" style={{ padding: '40px 28px', textAlign: 'center' }}>
      <div style={{ fontSize: '40px', marginBottom: '16px' }}>✓</div>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--dark)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
        Today's session complete
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--mid)', lineHeight: 1.6, marginBottom: '28px', maxWidth: '340px', margin: '0 auto 28px' }}>
        You've already done today's concept. Come back tomorrow for a new one, or explore the grammar map to practice a specific topic.
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={onGoToMap}>Explore Grammar Map →</button>
        <button className="btn-ghost" onClick={onGoToArchive}>View Archive</button>
      </div>
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ results, total, concept, level, promotion, recalibration, user, signInWithGoogle, isMapSession, streak, guestSessions, onNewSession, onGoToMap, onChangeLevel, onAcceptRecalibration, onDismissRecalibration, onTryMore }) {
  const correct = results.filter(r => r.correct).length
  const pct = Math.round((correct / total) * 100)
  const great = pct >= 70
  const next = nextLevel(level)
  const [shareState, setShareState] = useState('idle') // idle | loading | copied

  async function handleShare() {
    setShareState('loading')
    try {
      const res = await fetch('/api/share-grammar-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: user?.user_metadata?.full_name ?? user?.email ?? null,
          score: correct,
          total,
          level,
          concept_name: concept.nameFr,
          results: results.map(r => ({ correct: r.correct, answer: r.answer })),
          streak: streak ?? 0,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.id) throw new Error(json.error ?? 'No id returned')
      await navigator.clipboard.writeText(`${window.location.origin}/share/grammar/${json.id}`)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    } catch {
      setShareState('idle')
    }
  }

  useEffect(() => {
    if (correct < 5) return
    import('canvas-confetti').then(({ default: confetti }) => {
      if (correct === total) {
        // 100% — three bursts from both sides
        const burst = (origin) => confetti({
          particleCount: 120,
          spread: 80,
          origin,
          colors: ['#000000', '#ADADAD', '#16A34A', '#DCFCE7', '#ffffff'],
          startVelocity: 55,
          ticks: 200,
        })
        burst({ x: 0.2, y: 0.6 })
        setTimeout(() => burst({ x: 0.8, y: 0.6 }), 150)
        setTimeout(() => burst({ x: 0.5, y: 0.5 }), 350)
      } else {
        // 5–6/7 — single moderate burst from centre
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { x: 0.5, y: 0.6 },
          colors: ['#000000', '#ADADAD', '#16A34A', '#ffffff'],
          ticks: 150,
        })
      }
    })
  }, [])

  const perfect = correct === total

  return (
    <div className="exercise-card" style={{
      padding: perfect ? '0' : '40px 28px',
      position: 'relative',
      overflow: 'hidden',
      background: perfect ? '#0d0d0d' : 'var(--white)',
      border: perfect ? '1px solid #1e1e1e' : '1px solid var(--border)',
    }}>
      <style>{`
        @keyframes lx-fadein { from { opacity:0 } to { opacity:1 } }
        @keyframes lx-fadeup { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {perfect ? (
        /* ── Gold hallmark card (Option A) ── */
        <>
          {/* Gold hairline */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #F0DC8A 50%, #C9A84C 70%, transparent)', animation: 'lx-fadein 0.6s ease 0.1s both' }} />

          <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
            {/* Crown */}
            <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '10px', animation: 'lx-fadein 0.4s ease 0.1s both' }}>👑</div>

            {/* Score */}
            <div style={{ fontSize: '68px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '10px', animation: 'lx-fadeup 0.5s ease 0.2s both' }}>
              {correct}/{total}
            </div>

            {/* PARFAIT hallmark */}
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: '12px', animation: 'lx-fadein 0.5s ease 0.4s both' }}>
              Parfait
            </div>

            {/* Concept name */}
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginBottom: '28px', animation: 'lx-fadein 0.4s ease 0.5s both' }}>
              {concept.mapLabel ?? concept.nameFr}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '20px', animation: 'lx-fadein 0.4s ease 0.55s both' }} />

            {/* Answer chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '20px', animation: 'lx-fadein 0.4s ease 0.58s both' }}>
              {results.map((r, i) => (
                <span key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: '12px', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.05)', borderRadius: '4px', padding: '3px 8px' }}>
                  {r.answer}
                </span>
              ))}
            </div>

            {/* Saved row */}
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 'var(--radius)', padding: '11px 14px', marginBottom: '20px', animation: 'lx-fadein 0.4s ease 0.6s both' }}>
                <UserAvatar user={user} />
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
                  Saved to <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{user.user_metadata?.full_name ?? user.email}</strong>
                </p>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', animation: 'lx-fadeup 0.4s ease 0.65s both' }}>
              {isMapSession ? (
                <>
                  <button className="btn-primary" onClick={onGoToMap} style={{ background: '#C9A84C', color: '#000', border: 'none' }}>Back to Grammar Map →</button>
                  <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '6px', paddingTop: '2px' }}>
                    <button onClick={onTryMore} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Try again</button>
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)', margin: '6px 0' }} />
                    <button onClick={onNewSession} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>Today's lesson</button>
                  </div>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={onNewSession} style={{ background: '#C9A84C', color: '#000', border: 'none' }}>New session →</button>
                  <button onClick={onTryMore} style={{ padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', width: '100%' }}>Try more questions</button>
                </>
              )}
              <button
                onClick={handleShare}
                disabled={shareState === 'loading'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%', padding: '8px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.2)', cursor: shareState === 'loading' ? 'default' : 'pointer', marginTop: '2px' }}
              >
                {shareState === 'copied' ? '✓ Copied' : shareState === 'loading' ? 'Saving…' : 'Share result'}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ── Normal session card ── */
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>{great ? '🎉' : '💪'}</div>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--dark)', marginBottom: '8px', letterSpacing: '-0.03em' }}>
            {great ? 'Great session!' : 'Keep practising!'}
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--mid)', marginBottom: '4px' }}>{correct} of {total} correct on first attempt</p>
          <p style={{ fontSize: '13px', color: 'var(--light)', marginBottom: streak > 0 ? '10px' : '20px' }}>{concept.mapLabel ?? concept.nameFr}</p>
          {streak > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: '20px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px' }}>🔥</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--terracotta)' }}>{streak} day streak</span>
            </div>
          )}
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: great ? 'var(--green)' : 'var(--terracotta)', borderRadius: '3px', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {!perfect && (
        <>
          {recalibration && user && (
            <RecalibrationNudge
              direction={recalibration.direction}
              currentLevel={level}
              suggestedLevel={recalibration.suggestedLevel}
              onAccept={onAcceptRecalibration}
              onDismiss={onDismissRecalibration}
            />
          )}

          {promotion && next && (
            promotion.eligible ? (
              <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--radius)' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dark)', marginBottom: '4px' }}>Ready to advance to {next}</p>
                <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '12px', lineHeight: 1.5 }}>You've completed all {level} concepts with strong accuracy. You can move up when ready.</p>
                <button className="btn-primary" onClick={onChangeLevel} style={{ fontSize: '13px', padding: '8px 16px' }}>Advance to {next} →</button>
              </div>
            ) : (
              <div style={{ marginBottom: '20px', padding: '16px 20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--dark)', marginBottom: '8px' }}>Progress to {next}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <ProgressRow done={promotion.allCompleted} label={promotion.allCompleted ? `All ${level} concepts attempted` : `Complete all ${level} concepts on the grammar map`} />
                  <ProgressRow done={promotion.avgAccuracy >= 0.7} label={promotion.avgAccuracy >= 0.7 ? `Overall accuracy ${Math.round(promotion.avgAccuracy * 100)}% ✓` : `Reach 70% accuracy (currently ${Math.round(promotion.avgAccuracy * 100)}%)`} />
                  {promotion.weakConcepts?.length > 0 && <ProgressRow done={false} label={`Strengthen weak areas: ${promotion.weakConcepts.join(', ')}`} />}
                </div>
              </div>
            )
          )}

          {user === null && (
            <div style={{ marginBottom: '24px', padding: '20px', background: 'var(--terracotta-bg)', border: '1px solid var(--terracotta-light)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--dark)', marginBottom: '6px', letterSpacing: '-0.02em' }}>
                {guestSessions >= 2 ? 'You\'ve used your free sessions' : 'Save your progress'}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '16px', lineHeight: 1.5 }}>
                {guestSessions >= 2
                  ? 'Sign in to keep going — your level is saved, no placement test needed.'
                  : guestSessions === 1
                  ? '1 free session remaining. Sign in now to keep your level and continue after next time.'
                  : 'Sign in to track your streak and pick up where you left off.'}
              </p>
              <button onClick={signInWithGoogle} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '10px 22px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: '500px', fontSize: '14px', fontWeight: 500, color: 'var(--dark)', cursor: 'pointer' }}>
                <GoogleIcon size={18} />
                Continue with Google
              </button>
            </div>
          )}

          {user && (
            <div style={{ marginBottom: '24px', padding: '14px 16px', background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserAvatar user={user} />
              <p style={{ fontSize: '13px', color: 'var(--dark)' }}>Progress saved to <strong>{user.user_metadata?.full_name ?? user.email}</strong></p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {isMapSession ? (
              <>
                <button className="btn-primary" onClick={onGoToMap}>Back to Grammar Map →</button>
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '2px' }}>
                  <button onClick={onTryMore} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--light)', cursor: 'pointer' }}>Try again</button>
                  <div style={{ width: '1px', background: 'var(--border)', margin: '6px 0' }} />
                  <button onClick={onNewSession} style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--light)', cursor: 'pointer' }}>Today's lesson</button>
                </div>
              </>
            ) : (
              <>
                <button className="btn-primary" onClick={onNewSession}>New session →</button>
                <button onClick={onTryMore} style={{ padding: '10px 0', background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--light)', cursor: 'pointer', width: '100%' }}>Try more questions</button>
              </>
            )}
            <button
              onClick={handleShare}
              disabled={shareState === 'loading'}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%', padding: '8px', background: 'none', border: 'none', fontSize: '12px', fontWeight: 500, color: 'var(--light)', cursor: shareState === 'loading' ? 'default' : 'pointer', marginTop: '2px' }}
            >
              {shareState === 'copied' ? '✓ Copied' : shareState === 'loading' ? 'Saving…' : 'Share result'}
            </button>
          </div>
        </>
      )}
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
          style={{ padding: '8px 18px', background: 'var(--dark)', color: '#fff', border: 'none', borderRadius: '500px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Move to {suggestedLevel} →
        </button>
        <button
          onClick={onDismiss}
          style={{ padding: '8px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: '500px', fontSize: '13px', color: 'var(--mid)', cursor: 'pointer' }}
        >
          Stay at {currentLevel}
        </button>
      </div>
    </div>
  )
}

function GuestGateCard({ signInWithGoogle }) {
  return (
    <div className="exercise-card" style={{ padding: '32px 28px', width: '100%', textAlign: 'center' }}>
      <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--dark)', letterSpacing: '-0.03em', marginBottom: '10px' }}>
        Sign in to continue
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--mid)', lineHeight: 1.65, marginBottom: '8px' }}>
        You've had 2 free sessions.
      </p>
      <p style={{ fontSize: '14px', color: 'var(--mid)', lineHeight: 1.65, marginBottom: '28px' }}>
        Sign in with Google — it's free — and your level is saved so you never have to redo the placement test.
      </p>
      <button
        onClick={signInWithGoogle}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '12px 28px', background: 'var(--dark)', color: '#fff', border: 'none', borderRadius: '500px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center', marginBottom: '12px' }}
      >
        <GoogleIcon size={18} />
        Continue with Google
      </button>
      <a href="/" style={{ fontSize: '12px', color: 'var(--light)', textDecoration: 'none' }}>← Back to home</a>
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


