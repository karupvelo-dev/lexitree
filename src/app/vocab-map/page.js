'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { getVocabularyForLevel } from '@/data/vocabulary-map'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const POS_ORDER   = ['verb', 'adjective', 'adverb']
const POS_LABEL   = { verb: 'Verbs', adjective: 'Adjectives', adverb: 'Adverbs' }

export default function VocabPage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [selected, setSelected] = useState(null)
  const [seen, setSeen]         = useState({})
  const [userLevel, setUserLevel] = useState('B1')
  const graphRef = useRef(null)

  useEffect(() => {
    const level = localStorage.getItem('lagram_level') ?? 'B1'
    setUserLevel(level)
    if (graphRef.current) {
      const idx = LEVEL_ORDER.indexOf(level)
      graphRef.current.scrollLeft = Math.max(0, idx * 154 - 60)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    supabaseBrowser
      .from('profiles')
      .select('vocabulary_seen')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setSeen(data?.vocabulary_seen ?? {}))
  }, [user?.id])

  return (
    <div className="mobile-header-offset" style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        .gm-scrollbar::-webkit-scrollbar { height: 5px; width: 5px; }
        .gm-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .gm-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dp-scrollbar::-webkit-scrollbar { width: 4px; }
        .dp-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .gm-node:hover { filter: brightness(0.96); }
        @media (max-width: 768px) {
          .gm-desktop-panel { display: none !important; }
          .gm-mobile-sheet {
            position: fixed; left: 0; right: 0; bottom: 60px; z-index: 150;
            background: var(--white); border-top: 1px solid var(--border);
            border-radius: 3px 3px 0 0; max-height: 55vh; overflow-y: auto;
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
      <Sidebar active={null} user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} />

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--light)' }}>
            <h1 style={{ fontSize: 13, fontWeight: 'inherit', color: 'inherit', margin: 0 }}>Vocabulary map</h1>
            {selected && <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="var(--light)" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span style={{ color: 'var(--dark)', fontWeight: 500 }}>{selected.word}</span>
            </>}
          </div>
        </div>

        {/* Legend bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--white)' }}>
          <SummaryDot color="var(--border)" label="not seen" />
          <SummaryDot color="#D97706"       label="seen 1–2×" />
          <SummaryDot color="var(--green)"  label="seen 3+×" />
          <div style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: 11, color: 'var(--light)' }}>
            {userLevel} · {getVocabularyForLevel(userLevel).length} words
          </div>
        </div>

        {/* Map body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Graph scroll */}
          <div ref={graphRef} className="gm-scrollbar" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', gap: 0 }}>
              {LEVEL_ORDER.map((lvl, i) => {
                const isCurrent      = lvl === userLevel
                const isAccessible   = LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(userLevel)
                const isBeforeCurrent = LEVEL_ORDER.indexOf(userLevel) === i + 1
                const words = getVocabularyForLevel(lvl)

                const byPos = {}
                for (const w of words) {
                  if (!byPos[w.pos]) byPos[w.pos] = []
                  byPos[w.pos].push(w)
                }

                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <LevelCol
                      level={isCurrent ? `${lvl} · now` : lvl}
                      badge={isCurrent ? 'current' : isAccessible ? 'accessible' : 'grey'}
                      sublabel={`${words.length} words`}
                      sublabelColor={isCurrent ? 'var(--terracotta)' : 'var(--light)'}
                      byPos={byPos}
                      isAccessible={isAccessible}
                      seen={seen}
                      selected={selected}
                      onSelect={setSelected}
                      lvl={lvl}
                    />
                    {i < LEVEL_ORDER.length - 1 && (
                      <Arrow color={isBeforeCurrent ? 'var(--terracotta)' : 'var(--border)'} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail panel — desktop only */}
          <div className="dp-scrollbar gm-desktop-panel" style={{ width: 230, minWidth: 230, borderLeft: '1px solid var(--border)', background: 'var(--white)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {selected
              ? <DetailPanel word={selected} seenCount={seen[selected.word] ?? 0} />
              : <EmptyDetail />
            }
          </div>

          {/* Mobile bottom sheet */}
          <div className={`gm-mobile-sheet${selected ? ' open' : ''}`}>
            <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 2, margin: '12px auto 4px' }} />
            {selected
              ? <DetailPanel word={selected} seenCount={seen[selected.word] ?? 0} />
              : null}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Level column ─────────────────────────────────────────────────────────────

function LevelCol({ level, badge, sublabel, sublabelColor, byPos, isAccessible, seen, selected, onSelect, lvl }) {
  const badgeColors = {
    current:    { background: 'var(--terracotta-bg)', color: 'var(--terracotta)' },
    accessible: { background: 'var(--white)',          color: 'var(--mid)',        border: '1px solid var(--border)' },
    grey:       { background: 'var(--bg)',             color: 'var(--light)',      border: '1px solid var(--border)', opacity: 0.6 },
  }

  return (
    <div style={{ width: 134, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 2, letterSpacing: '0.3px', marginBottom: 3, ...badgeColors[badge] }}>
          {level}
        </div>
        <div style={{ fontSize: 10, color: sublabelColor }}>{sublabel}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {POS_ORDER.filter(pos => byPos[pos]).map(pos => (
          <div key={pos}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 5 }}>
              {POS_LABEL[pos]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {byPos[pos].map((w, i) => {
                const count = seen[w.word] ?? 0
                const state = !isAccessible ? 'grey' : count >= 3 ? 'good' : count >= 1 ? 'medium' : 'open'
                const wordObj = { ...w, level: lvl }
                const isSelected = selected?.word === w.word
                return (
                  <WordNode
                    key={i}
                    label={w.word}
                    state={state}
                    isSelected={isSelected}
                    onClick={isAccessible ? () => onSelect(isSelected ? null : wordObj) : undefined}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Word node pill ───────────────────────────────────────────────────────────

function WordNode({ label, state, isSelected, onClick }) {
  const styles = {
    grey:   { background: 'var(--bg)',         border: '1px solid var(--border)', color: 'var(--light)', opacity: 0.45, cursor: 'default' },
    open:   { background: 'var(--white)',       border: '1px solid var(--border)', color: 'var(--dark)' },
    good:   { background: 'var(--green-light)', border: '1px solid var(--green)', color: 'var(--green)' },
    medium: { background: '#FEF3C7',            border: '1px solid #D97706',      color: '#92400E' },
  }

  const base = styles[state] ?? styles.open
  const selectedExtra = isSelected
    ? { boxShadow: '0 0 0 2px var(--terracotta)', border: '1.5px solid var(--terracotta)', color: 'var(--terracotta)', background: 'var(--terracotta-bg)', fontWeight: 500, opacity: 1 }
    : {}

  return (
    <div
      className={state !== 'grey' ? 'gm-node' : ''}
      onClick={onClick}
      style={{ fontSize: 11, padding: '5px 9px', borderRadius: 2, cursor: onClick ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', transition: 'filter 0.1s', ...base, ...selectedExtra }}
    >
      {label}
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

// ─── Legend dot ───────────────────────────────────────────────────────────────

function SummaryDot({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#5C5850', padding: '9px 16px', borderRight: '0.5px solid #E3E2DF' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ word, seenCount }) {
  return (
    <>
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={dpEyebrow}>Selected word</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: 'var(--dark)', lineHeight: 1.3, marginBottom: 10 }}>
          {word.word}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <Tag bg="var(--terracotta-bg)" color="var(--terracotta)">{word.level}</Tag>
          <Tag bg="var(--bg)" color="var(--mid)">{POS_LABEL[word.pos]?.slice(0, -1)}</Tag>
        </div>
      </div>

      <div style={dpSec}>
        <div style={dpSecLabel}>Definition</div>
        <p style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.65 }}>{word.definition}</p>
      </div>

      <div style={dpSec}>
        <div style={dpSecLabel}>Encountered</div>
        {seenCount > 0
          ? <p style={{ fontSize: 13, color: 'var(--mid)' }}>{seenCount} {seenCount === 1 ? 'session' : 'sessions'}</p>
          : <p style={{ fontSize: 13, color: 'var(--light)', lineHeight: 1.5 }}>Not yet seen — comes up in {word.level} sessions</p>
        }
      </div>
    </>
  )
}

function EmptyDetail() {
  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={dpEyebrow}>Selected word</div>
      <p style={{ fontSize: 12, color: 'var(--light)', lineHeight: 1.5, marginTop: 8 }}>
        Click any word to see its definition and how often you've encountered it.
      </p>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Tag({ bg, color, children }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 2, background: bg, color }}>{children}</span>
}

// ─── Style constants ──────────────────────────────────────────────────────────

const dpEyebrow  = { fontSize: 10, fontWeight: 500, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 8 }
const dpSec      = { padding: '12px 16px', borderBottom: '1px solid var(--border)' }
const dpSecLabel = { fontSize: 10, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 10 }
