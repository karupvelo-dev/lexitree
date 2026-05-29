'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { supabaseBrowser } from '@/lib/supabase-browser'
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

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const LEVEL_META = Object.fromEntries(
  LEVEL_ORDER.map(lvl => [lvl, { label: lvl, concepts: LEVEL_DATA[lvl].order.length }])
)

export default function MapPage() {
  const router = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()
  const [selected, setSelected] = useState(null)
  const [performance, setPerformance] = useState({})
  const [userLevel, setUserLevel] = useState(null)
  const [mobileLevel, setMobileLevel] = useState(null)
  const [levelLoaded, setLevelLoaded] = useState(false)
  const graphRef = useRef(null)

  useEffect(() => {
    const level = localStorage.getItem('lagram_level')
    setLevelLoaded(true)
    if (!level) return
    setUserLevel(level)
    setMobileLevel(level ?? 'A1')

    // Scroll so the current level column is roughly centred
    if (graphRef.current) {
      const idx = LEVEL_ORDER.indexOf(level)
      graphRef.current.scrollLeft = Math.max(0, idx * 154 - 60)
    }
  }, [])

  // Fetch latest session per concept across all levels to colour nodes
  useEffect(() => {
    if (!user) {
      setPerformance({})
      return
    }
    supabaseBrowser
      .from('sessions')
      .select('concept, score, total')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const seen = {}
        data.forEach(s => {
          if (seen[s.concept]) return
          seen[s.concept] = true
          const pct = s.score / s.total
          setPerformance(prev => ({
            ...prev,
            [s.concept]: pct >= 0.7 ? 'good' : pct >= 0.4 ? 'medium' : 'poor',
          }))
        })
      })
  }, [user, userLevel])

  function handlePractice(concept) {
    // Don't overwrite the user's level — just set the concept override
    localStorage.setItem('lagram_concept', JSON.stringify(concept))
    router.push('/session')
  }

  const isSignedOut = user === null

  const mobileNodes = (() => {
    if (!mobileLevel || !LEVEL_DATA[mobileLevel]) return []
    const isLocked = isSignedOut && mobileLevel !== 'A1'
    const effectiveLevel = isSignedOut ? 'A1' : userLevel
    const isAccessible = !isLocked && !!effectiveLevel && LEVEL_ORDER.indexOf(mobileLevel) <= LEVEL_ORDER.indexOf(effectiveLevel)
    const { order, concepts } = LEVEL_DATA[mobileLevel]
    return order.map(slug => ({
      slug,
      label: concepts[slug].mapLabel,
      state: isLocked ? 'locked' : isAccessible ? (performance[slug] ?? 'open') : 'grey',
      concept: isLocked ? { locked: true, level: mobileLevel } : isAccessible ? { ...concepts[slug], level: mobileLevel } : null,
    }))
  })()

  return (
    <div className="mobile-header-offset" style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        .gm-scrollbar::-webkit-scrollbar { height: 5px; width: 5px; }
        .gm-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .gm-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dp-scrollbar::-webkit-scrollbar { width: 4px; }
        .dp-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .gm-node:hover { filter: brightness(0.96); }
        .gm-map-mobile { display: none; }
        @media (max-width: 768px) {
          .gm-desktop-panel { display: none !important; }
          .gm-map-desktop { display: none !important; }
          .gm-map-mobile { display: flex !important; flex-direction: column; flex: 1; overflow: hidden; }
          .gm-level-tabs::-webkit-scrollbar { display: none; }
          .gm-summary-bar span { display: none; }
          .gm-summary-bar { padding: 6px 8px; gap: 6px; }
          .gm-mobile-sheet {
            position: fixed; left: 0; right: 0; bottom: 60px; z-index: 150;
            background: var(--white); border-top: 1px solid var(--border);
            border-radius: 3px 3px 0 0; max-height: 65vh; overflow-y: auto;
            box-shadow: 0 -2px 12px rgba(26,20,16,0.12);
            transform: translateY(100%); transition: transform 0.25s ease;
            pointer-events: none;
          }
          .gm-mobile-sheet.open { transform: translateY(0); pointer-events: auto; }
        }
        @media (min-width: 769px) {
          .gm-mobile-sheet { display: none !important; }
        }
      `}</style>

      {/* ── SIDEBAR ── */}
      <Sidebar active="map" user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} />

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ padding: '44px 52px 0', flexShrink: 0 }}>
          <h1 className="page-title">Carte de grammaire</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 52px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--light)' }}>
            {selected && <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="var(--light)" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span style={{ color: 'var(--dark)', fontWeight: 500 }}>{selected.nameFr}</span>
            </>}
          </div>
          {selected && (
            <button onClick={() => handlePractice(selected)} style={{ fontSize: 12, fontFamily: 'var(--font-sans)', padding: '5px 14px', borderRadius: 2, border: 'none', background: 'var(--dark)', color: 'var(--white)', cursor: 'pointer', fontWeight: 500 }}>
              Practice now
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div className="gm-summary-bar" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--white)' }}>
          <SummaryDot color="var(--border)" label="not practiced" />
          <SummaryDot color="var(--green)" label="good (≥70%)" />
          <SummaryDot color="#D97706" label="needs work" />
          <SummaryDot color="var(--red)" label="struggling" />
          <div style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: 11, color: 'var(--light)' }}>
            {userLevel ? `${userLevel} · ${LEVEL_META[userLevel]?.concepts ?? '–'} concepts` : null}
          </div>
        </div>

        {/* Map body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* Graph scroll — desktop only */}
          <div ref={graphRef} className="gm-scrollbar gm-map-desktop" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', gap: 0 }}>

              {LEVEL_ORDER.map((lvl, i) => {
                const isLocked = isSignedOut && lvl !== 'A1'
                const effectiveLevel = isSignedOut ? 'A1' : userLevel
                const isCurrent = !isSignedOut && lvl === userLevel
                const isAccessible = !isLocked && !!effectiveLevel && LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(effectiveLevel)
                const isBeforeCurrent = !isSignedOut && LEVEL_ORDER.indexOf(userLevel) === i + 1
                const meta = LEVEL_META[lvl]

                const { order, concepts } = LEVEL_DATA[lvl]
                const nodes = order.map(slug => ({
                  slug,
                  label: concepts[slug].mapLabel,
                  state: isLocked ? 'locked' : isAccessible ? (performance[slug] ?? 'open') : 'grey',
                  concept: isLocked ? { locked: true, level: lvl } : isAccessible ? { ...concepts[slug], level: lvl } : null,
                }))

                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <LevelCol
                      level={isCurrent ? `${lvl} · now` : lvl}
                      badge={isLocked ? 'locked' : isCurrent ? 'current' : isAccessible ? 'accessible' : 'grey'}
                      sublabel={`${meta.concepts} concepts`}
                      sublabelColor={isCurrent ? 'var(--terracotta)' : 'var(--light)'}
                      nodes={nodes}
                      selected={selected}
                      onSelect={setSelected}
                    />
                    {i < LEVEL_ORDER.length - 1 && (
                      <Arrow color={isBeforeCurrent ? 'var(--terracotta)' : 'var(--border)'} />
                    )}
                  </div>
                )
              })}

            </div>
          </div>

          {/* Mobile: level tabs + vertical concept list */}
          <div className="gm-map-mobile">
            {/* Level tab strip */}
            <div className="gm-level-tabs" style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0, WebkitOverflowScrolling: 'touch' }}>
              {LEVEL_ORDER.map(lvl => {
                const isTab = lvl === mobileLevel
                const isLocked = isSignedOut && lvl !== 'A1'
                const effectiveLevel = isSignedOut ? 'A1' : userLevel
                const isAccessible = !isLocked && !!effectiveLevel && LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(effectiveLevel)
                return (
                  <button
                    key={lvl}
                    onClick={() => { setMobileLevel(lvl); setSelected(null) }}
                    style={{
                      flexShrink: 0,
                      padding: '5px 14px',
                      borderRadius: 2,
                      fontSize: 12,
                      fontWeight: isTab ? 500 : 400,
                      fontFamily: 'var(--font-sans)',
                      border: isTab ? '2px solid var(--dark)' : '2px solid var(--border)',
                      background: isTab ? (isLocked ? 'var(--light)' : 'var(--dark)') : 'transparent',
                      color: isTab ? 'var(--white)' : isLocked ? 'var(--light)' : isAccessible ? 'var(--dark)' : 'var(--light)',
                      cursor: 'pointer',
                      opacity: (!isAccessible && !isLocked && !isTab) ? 0.5 : 1,
                    }}
                  >
                    {isLocked ? `🔒 ${lvl}` : lvl}
                  </button>
                )
              })}
            </div>

            {/* Vertical concept list */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--white)' }}>
              {mobileNodes.map((node, i) => {
                const isSelected = selected?.slug === node.slug
                const dotColor = { open: 'transparent', good: 'var(--green)', medium: '#D97706', poor: 'var(--red)', grey: 'transparent' }[node.state] ?? 'transparent'
                const dotBorder = (node.state === 'open' || node.state === 'grey') ? '1.5px solid var(--border)' : 'none'
                return (
                  <div
                    key={i}
                    onClick={node.concept ? () => setSelected(isSelected ? null : node.concept) : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 16px',
                      borderBottom: '1px solid var(--border)',
                      background: isSelected ? 'var(--terracotta-bg)' : 'var(--white)',
                      cursor: node.concept ? 'pointer' : 'default',
                      opacity: node.state === 'grey' ? 0.5 : 1,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, border: dotBorder, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: isSelected ? 'var(--terracotta)' : node.state === 'grey' ? 'var(--light)' : 'var(--dark)', fontWeight: isSelected ? 500 : 400 }}>
                      {node.label}
                    </span>
                    {node.concept && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M4.5 3l3 3-3 3" stroke={isSelected ? 'var(--terracotta)' : 'var(--light)'} strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail panel — desktop only */}
          <div className="dp-scrollbar gm-desktop-panel" style={{ width: 230, minWidth: 230, borderLeft: '1px solid var(--border)', background: 'var(--white)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {selected?.locked
              ? <LockedDetail onSignIn={signInWithGoogle} />
              : selected
                ? <DetailPanel concept={selected} onPractice={handlePractice} />
                : <EmptyDetail />}
          </div>

          {/* Mobile bottom sheet */}
          <div className={`gm-mobile-sheet${selected ? ' open' : ''}`}>
            <div style={{ padding: '10px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2 }} />
              <button
                onClick={() => setSelected(null)}
                style={{ position: 'absolute', right: 16, top: 10, background: 'none', border: 'none', fontSize: 20, color: 'var(--light)', cursor: 'pointer', lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>
            {selected && (selected.locked
              ? <LockedDetail onSignIn={signInWithGoogle} />
              : <DetailPanel concept={selected} onPractice={handlePractice} />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Level column ─────────────────────────────────────────────────────────────

function LevelCol({ level, badge, sublabel, sublabelColor, nodes, selected, onSelect }) {
  const badgeColors = {
    current:    { background: 'var(--terracotta-bg)', color: 'var(--terracotta)' },
    accessible: { background: 'var(--white)',          color: 'var(--mid)',        border: '1px solid var(--border)' },
    grey:       { background: 'var(--bg)',             color: 'var(--light)',      border: '1px solid var(--border)', opacity: 0.6 },
    locked:     { background: 'var(--bg)',             color: 'var(--light)',      border: '1px solid var(--border)', opacity: 0.5 },
  }

  return (
    <div style={{ width: 134, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 2, letterSpacing: '0.3px', marginBottom: 3, ...badgeColors[badge] }}>
          {level}
        </div>
        <div style={{ fontSize: 10, color: sublabelColor }}>{sublabel}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {nodes.map((node, i) => (
          <Node key={i} node={node} isSelected={node.slug !== undefined && selected?.slug === node.slug} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

// ─── Node pill ────────────────────────────────────────────────────────────────

function Node({ node, isSelected, onSelect }) {
  const styles = {
    grey:   { background: 'var(--bg)',        border: '1px solid var(--border)', color: 'var(--light)', opacity: 0.55, cursor: 'default' },
    locked: { background: 'var(--bg)',        border: '1px solid var(--border)', color: 'var(--light)', opacity: 0.55 },
    open:   { background: 'var(--white)',     border: '1px solid var(--border)', color: 'var(--dark)' },
    good:   { background: 'var(--green-light)', border: '1px solid var(--green)', color: 'var(--green)' },
    medium: { background: '#FEF3C7',          border: '1px solid #D97706',       color: '#92400E' },
    poor:   { background: 'var(--red-light)', border: '1px solid var(--red)',    color: 'var(--red)' },
  }

  const base = styles[node.state] ?? styles.open
  const isInteractive = node.state !== 'grey'
  const selectedExtra = isSelected
    ? { boxShadow: '0 0 0 2px var(--terracotta)', position: 'relative', zIndex: 1, border: '1.5px solid var(--terracotta)', color: 'var(--terracotta)', background: 'var(--terracotta-bg)', fontWeight: 500, opacity: 1 }
    : {}

  return (
    <div
      className={isInteractive ? 'gm-node' : ''}
      onClick={isInteractive && node.concept ? () => onSelect(isSelected ? null : node.concept) : undefined}
      style={{ fontSize: 11, padding: '5px 9px', borderRadius: 2, cursor: isInteractive && node.concept ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', transition: 'filter 0.1s', ...base, ...selectedExtra }}
    >
      {node.label}
    </div>
  )
}

// ─── Level arrow ──────────────────────────────────────────────────────────────

function Arrow({ color }) {
  return (
    <div style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 30 }}>
      <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
        <path d="M1 7h12M9 3l4 4-4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ─── Summary bar item ─────────────────────────────────────────────────────────

function SummaryDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#5C5850', padding: '9px 16px', borderRight: '0.5px solid #E3E2DF' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ concept, onPractice }) {
  return (
    <>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={dpEyebrow}>Selected concept</div>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--dark)', lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.02em' }}>
          {concept.nameFr}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <Tag bg="var(--terracotta-bg)" color="var(--terracotta)">{concept.level}</Tag>
          <Tag bg="var(--bg)" color="var(--mid)">open</Tag>
        </div>
      </div>

      <div style={dpSec}>
        <div style={dpSecLabel}>Rule</div>
        <p style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.6 }}>{concept.rule}</p>
      </div>

      <div style={dpSec}>
        <div style={dpSecLabel}>Formula</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          {concept.formula.map((part, i) =>
            ['+', '→', '/'].includes(part)
              ? <span key={i} style={{ fontSize: 11, color: 'var(--light)' }}>{part}</span>
              : <span key={i} style={{ fontSize: 10, fontWeight: 500, padding: '3px 7px', borderRadius: 2, background: 'var(--bg)', border: '2px solid var(--border)', color: 'var(--dark)', whiteSpace: 'nowrap' }}>{part}</span>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 16px', marginTop: 'auto' }}>
        <button
          onClick={() => onPractice(concept)}
          style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, padding: '0 16px', minHeight: 40, borderRadius: 2, background: 'var(--dark)', color: 'var(--white)', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          Practice this concept
        </button>
        <div style={{ fontSize: 10, color: 'var(--light)', textAlign: 'center', marginTop: 5 }}>~10 min · 7 questions</div>
      </div>
    </>
  )
}

function EmptyDetail() {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={dpEyebrow}>Selected concept</div>
      <p style={{ fontSize: 12, color: 'var(--light)', lineHeight: 1.5, marginTop: 8 }}>
        Click any concept card to see its rule, formula, and examples.
      </p>
    </div>
  )
}

function LockedDetail({ onSignIn }) {
  return (
    <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 8 }}>Locked</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--dark)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>Sign in to unlock A2–C2</div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--mid)', lineHeight: 1.65, margin: 0 }}>
        Create a free account, take the 7-question placement test, and unlock the levels that match your French.
      </p>
      <button
        onClick={onSignIn}
        style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, padding: '0 16px', minHeight: 40, borderRadius: '500px', background: 'var(--dark)', color: 'var(--white)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.15s' }}
        onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
        onMouseOut={e => e.currentTarget.style.opacity = '1'}
      >
        Sign in with Google
      </button>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Tag({ bg, color, children }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 2, background: bg, color }}>{children}</span>
}

// ─── Style constants ──────────────────────────────────────────────────────────

const dpEyebrow = { fontSize: 10, fontWeight: 500, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 8 }
const dpSec = { padding: '12px 16px', borderBottom: '1px solid var(--border)' }
const dpSecLabel = { fontSize: 10, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 10 }
