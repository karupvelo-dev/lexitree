'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
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

const LEVEL_META = {
  A1:  { label: 'A1',  concepts: 14 },
  A2:  { label: 'A2',  concepts: 15 },
  B1:  { label: 'B1',  concepts: 15 },
  B2:  { label: 'B2',  concepts: 14 },
  C1:  { label: 'C1',  concepts: 12 },
  C2:  { label: 'C2',  concepts: 8  },
}

export default function MapPage() {
  const router = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()
  const [selected, setSelected] = useState(null)
  const [performance, setPerformance] = useState({})
  const [userLevel, setUserLevel] = useState('B1')
  const graphRef = useRef(null)

  useEffect(() => {
    const level = localStorage.getItem('lexitree_level') ?? 'B1'
    setUserLevel(level)

    // Scroll so the current level column is roughly centred
    if (graphRef.current) {
      const idx = LEVEL_ORDER.indexOf(level)
      graphRef.current.scrollLeft = Math.max(0, idx * 154 - 60)
    }
  }, [])

  // Fetch latest session per concept for the user's current level to colour nodes
  useEffect(() => {
    if (!user) return
    supabaseBrowser
      .from('sessions')
      .select('concept, score, total')
      .eq('level', userLevel)
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
    localStorage.setItem('lexitree_concept', JSON.stringify(concept))
    router.push('/session')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        .gm-scrollbar::-webkit-scrollbar { height: 5px; width: 5px; }
        .gm-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .gm-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dp-scrollbar::-webkit-scrollbar { width: 4px; }
        .dp-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .gm-node:hover { filter: brightness(0.96); }
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 220, minWidth: 220, background: 'var(--white)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px 16px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--dark)' }}>
            Lexitree<span style={{ color: 'var(--terracotta)', fontStyle: 'italic' }}>.</span>
          </span>
        </div>

        <div style={{ padding: '0 8px', marginBottom: 4 }}>
          <div style={sbLabel}>Learn</div>
          <SbItem href="/session" label="Today's session" icon={<TodayIcon />} />
          <SbItem href="/map"     label="Grammar map"    icon={<MapIcon />}   active />
          <SbItem href="/archive" label="Archive"        icon={<ArchiveIcon />} />
        </div>

        <div style={{ marginTop: 'auto', padding: '12px 14px 4px', borderTop: '1px solid var(--border)' }}>
          {user === null && (
            <button onClick={signInWithGoogle} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--mid)', cursor: 'pointer' }}>
              <GoogleIcon size={13} /> Sign in to save progress
            </button>
          )}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <UserAvatar user={user} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.user_metadata?.full_name ?? user.email}
                </div>
                <button onClick={signOut} style={{ fontSize: 11, color: 'var(--light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--light)' }}>
            Grammar map
            {selected && <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 3l3 3-3 3" stroke="var(--light)" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span style={{ color: 'var(--dark)', fontWeight: 500 }}>{selected.nameFr}</span>
            </>}
          </div>
          {selected && (
            <button onClick={() => handlePractice(selected)} style={{ fontSize: 12, fontFamily: 'var(--font-sans)', padding: '5px 12px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--dark)', color: 'var(--white)', cursor: 'pointer' }}>
              Practice now
            </button>
          )}
        </div>

        {/* Summary bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--white)' }}>
          <SummaryDot color="var(--border)" label="not practiced" />
          <SummaryDot color="var(--green)" label="good (≥70%)" />
          <SummaryDot color="#D97706" label="needs work" />
          <SummaryDot color="var(--red)" label="struggling" />
          <div style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: 11, color: 'var(--light)' }}>
            {userLevel} · {LEVEL_META[userLevel]?.concepts ?? '–'} concepts
          </div>
        </div>

        {/* Map body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Graph scroll */}
          <div ref={graphRef} className="gm-scrollbar" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content', gap: 0 }}>

              {LEVEL_ORDER.map((lvl, i) => {
                const isCurrent = lvl === userLevel
                const isBeforeCurrent = LEVEL_ORDER.indexOf(userLevel) === i + 1
                const meta = LEVEL_META[lvl]

                const { order, concepts } = LEVEL_DATA[lvl]
                const nodes = order.map(slug => ({
                  slug,
                  label: concepts[slug].mapLabel,
                  state: isCurrent ? (performance[slug] ?? 'open') : 'grey',
                  concept: isCurrent ? { ...concepts[slug], level: lvl } : null,
                }))

                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <LevelCol
                      level={isCurrent ? `${lvl} · now` : lvl}
                      badge={isCurrent ? 'current' : 'grey'}
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

          {/* Detail panel */}
          <div className="dp-scrollbar" style={{ width: 230, minWidth: 230, borderLeft: '1px solid var(--border)', background: 'var(--white)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {selected ? <DetailPanel concept={selected} onPractice={handlePractice} /> : <EmptyDetail />}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Level column ─────────────────────────────────────────────────────────────

function LevelCol({ level, badge, sublabel, sublabelColor, nodes, selected, onSelect }) {
  const badgeColors = {
    current: { background: 'var(--terracotta-bg)', color: 'var(--terracotta)' },
    grey:    { background: 'var(--bg)',             color: 'var(--light)',      border: '1px solid var(--border)' },
  }

  return (
    <div style={{ width: 134, display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 4, letterSpacing: '0.3px', marginBottom: 3, ...badgeColors[badge] }}>
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
      style={{ fontSize: 11, padding: '5px 9px', borderRadius: 5, cursor: isInteractive && node.concept ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', transition: 'filter 0.1s', ...base, ...selectedExtra }}
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
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 400, color: 'var(--dark)', lineHeight: 1.3, marginBottom: 8 }}>
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
              : <span key={i} style={{ fontSize: 10, fontWeight: 500, padding: '3px 7px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--dark)', whiteSpace: 'nowrap' }}>{part}</span>
          )}
        </div>
      </div>

      <div style={dpSec}>
        <div style={dpSecLabel}>Examples</div>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--dark)', lineHeight: 1.7 }}>
          {concept.keyTerms}
        </p>
      </div>

      <div style={{ padding: '12px 16px', marginTop: 'auto' }}>
        <button
          onClick={() => onPractice(concept)}
          style={{ width: '100%', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, padding: 9, borderRadius: 'var(--radius)', background: 'var(--dark)', color: 'var(--white)', border: 'none', cursor: 'pointer', transition: 'opacity 0.15s' }}
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

// ─── Sidebar helpers ──────────────────────────────────────────────────────────

function SbItem({ href, label, icon, active }) {
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 'var(--radius)', fontSize: 13, color: active ? 'var(--dark)' : 'var(--mid)', fontWeight: active ? 500 : 400, background: active ? 'var(--terracotta-bg)' : 'transparent', textDecoration: 'none' }}>
      {icon}
      {label}
    </a>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Tag({ bg, color, children }) {
  return <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: bg, color }}>{children}</span>
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

function UserAvatar({ user }) {
  const name = user.user_metadata?.full_name ?? user.email ?? '?'
  const avatar = user.user_metadata?.avatar_url
  if (avatar) return <img src={avatar} alt={name} width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} />
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#C4603A', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  )
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const iconStyle = { width: 14, height: 14, flexShrink: 0 }

function TodayIcon() {
  return <svg viewBox="0 0 14 14" fill="none" style={iconStyle}><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5h6M4 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}
function MapIcon() {
  return <svg viewBox="0 0 14 14" fill="none" style={iconStyle}><path d="M2 11L5 2l3 6 2-3 2 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ArchiveIcon() {
  return <svg viewBox="0 0 14 14" fill="none" style={iconStyle}><path d="M1.5 4.5h11M1.5 4.5a1 1 0 011-1h9a1 1 0 011 1M1.5 4.5v7a1 1 0 001 1h9a1 1 0 001-1v-7M5.5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
}

// ─── Style constants ──────────────────────────────────────────────────────────

const sbLabel = { fontSize: 10, fontWeight: 500, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--light)', padding: '6px 8px 4px' }
const dpEyebrow = { fontSize: 10, fontWeight: 500, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 8 }
const dpSec = { padding: '12px 16px', borderBottom: '1px solid var(--border)' }
const dpSecLabel = { fontSize: 10, fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 10 }
