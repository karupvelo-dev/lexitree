'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { getDailyEclairs, DAILY_GOAL } from '@/lib/eclairs'

const NAV = [
  {
    key: 'session',
    href: '/session',
    label: 'Today',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: 'map',
    href: '/map',
    label: 'Grammar Map',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    key: 'vocab',
    href: '/vocab',
    label: 'Vocabulaire',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
      </svg>
    ),
  },
  {
    key: 'archive',
    href: '/archive',
    label: 'Archive',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
]

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
}

export function Sidebar({ active, user, signInWithGoogle, signOut, children, vocabScoreOverride, vocabWordsSeenOverride, eclairsOverride }) {
  const router = useRouter()
  const [streak, setStreak] = useState(0)
  const [vocabScore, setVocabScore] = useState(null)
  const [vocabWordsSeen, setVocabWordsSeen] = useState(null)
  const [sessionDates, setSessionDates] = useState(new Set())
  const [eclairs, setEclairs] = useState(0)

  useEffect(() => { setEclairs(getDailyEclairs()) }, [])

  useEffect(() => {
    if (!user) {
      setStreak(0)
      setVocabScore(null)
      setVocabWordsSeen(null)
      setSessionDates(new Set())
      return
    }

    supabaseBrowser
      .from('profiles')
      .select('current_streak, vocab_score, vocab_words_seen, last_session_date')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const currentStreak = data?.current_streak ?? 0
        setStreak(currentStreak)
        setVocabScore(data?.vocab_score ?? 0)
        setVocabWordsSeen(data?.vocab_words_seen ?? 0)

        // Derive the filled bar days from streak + last_session_date.
        // Both streak.js and getLast7Days use UTC, so we stay UTC here.
        const filled = new Set()
        if (currentStreak > 0 && data?.last_session_date) {
          for (let i = 0; i < Math.min(currentStreak, 7); i++) {
            const d = new Date(data.last_session_date + 'T12:00:00Z')
            d.setUTCDate(d.getUTCDate() - i)
            filled.add(d.toISOString().slice(0, 10))
          }
        }
        setSessionDates(filled)
      })
      .catch(() => {})
  }, [user?.id])

  return (
    <>
    <header className="mobile-header">
      <a
        href={user ? '/session' : '/'}
        style={{ fontFamily: 'var(--font-sans)', fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.05em', textDecoration: 'none' }}
      >
        Lagram
      </a>
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.12)', borderRadius: '500px', padding: '5px 10px' }}>
              <span style={{ fontSize: '13px' }}>🔥</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{streak}</span>
            </div>
          )}
          <button
            onClick={() => router.push('/profile')}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <UserAvatar user={user} size={24} />
          </button>
        </div>
      ) : (
        <button
          onClick={signInWithGoogle}
          style={{ background: '#fff', border: 'none', borderRadius: '500px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, color: '#000', cursor: 'pointer', lineHeight: 1 }}
        >
          Sign in
        </button>
      )}
    </header>
    <nav className="mobile-nav">
      {NAV.filter(({ key }) => key !== 'archive').map(({ key, href, label, icon }) => (
        <a key={key} className={`mobile-nav-item${active === key ? ' active' : ''}`} href={href}>
          {icon}
          <span>{key === 'map' ? 'Map' : label}</span>
        </a>
      ))}
    </nav>
    <div className="sidebar">
      <a className="sidebar-logo" href={user ? '/session' : '/'}>Lagram</a>
      <nav className="sidebar-nav">
        {NAV.map(({ key, href, label, icon }) => (
          <a key={key} className={`nav-item${active === key ? ' active' : ''}`} href={href}>
            {icon}
            {label}
          </a>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}

        <EclairsWidget points={eclairsOverride ?? eclairs} goal={DAILY_GOAL} />

        {(vocabScoreOverride ?? vocabScore) > 0 && (
          <div style={{ padding: '10px 12px', background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: '6px' }}>Vocab Score</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '3px' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--indigo)', lineHeight: 1 }}>{vocabScoreOverride ?? vocabScore}</span>
              <span style={{ fontSize: '11px', color: 'var(--light)' }}>/100</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--light)' }}>{vocabWordsSeenOverride ?? vocabWordsSeen ?? 0} words seen</div>
          </div>
        )}

        {streak > 0 && (
          <div style={{ padding: '12px', background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>🔥</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--dark)' }}>{streak}</span>
              <span style={{ fontSize: '11px', color: 'var(--mid)' }}>day streak</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
              {getLast7Days().map((date, i) => (
                <div key={i} style={{ flex: 1, height: '6px', borderRadius: '3px', background: sessionDates.has(date) ? 'var(--terracotta)' : 'var(--border)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '9px', color: 'var(--light)' }}>7d ago</span>
              <span style={{ fontSize: '9px', color: 'var(--light)' }}>today</span>
            </div>
          </div>
        )}

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
            <a href="/profile" style={{ display: 'flex', flexShrink: 0 }}>
              <UserAvatar user={user} />
            </a>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a href="/profile" style={{ fontSize: '12px', color: 'var(--dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>
                {user.user_metadata?.full_name ?? user.email}
              </a>
              <button onClick={signOut} style={{ fontSize: '11px', color: 'var(--light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

function lerpN(a, b, t) { return a + (b - a) * t }
function clamp01(v) { return Math.max(0, Math.min(1, v)) }
function rnd(v) { return Math.round(v) }

function EclairsWidget({ points, goal }) {
  const over = points > goal
  const done = points >= goal

  // ── fixed-size shell shared by all states ──────────────────────────
  const shell = {
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    position: 'relative',
    overflow: 'hidden',
    // fixed layout: label row (~22px) + sub row (~14px) + gap(13px) + bar(3px) + padding(22px) = ~74px
  }

  // ── row styles (identical across states for fixed sizing) ──────────
  const topRow  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }
  const subRow  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }
  const labelSz = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }
  const numSz   = { fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }
  const subSz   = { fontSize: '10px', fontVariantNumeric: 'tabular-nums' }

  // ── OVER GOAL ──────────────────────────────────────────────────────
  if (over) {
    const multiplier    = points / goal
    const t             = clamp01((multiplier - 1) / 2)  // 0 at ×1.0, 1.0 at ×3.0

    // number color: white → gold-light
    const numColor = `rgb(${rnd(lerpN(255,240,t))},${rnd(lerpN(255,220,t))},${rnd(lerpN(255,138,t))})`

    // multiplier label color: dim gold → bright gold
    const multColor = `rgb(${rnd(lerpN(180,240,t))},${rnd(lerpN(140,220,t))},${rnd(lerpN(60,138,t))})`

    // éclairs label: white at ×1.0 → gold at ×3.0
    const labelColor = `rgb(${rnd(lerpN(255,201,t))},${rnd(lerpN(255,168,t))},${rnd(lerpN(255,76,t))})`

    // hairline: centre stop slides gold → white
    const hlOp  = lerpN(0.45, 1.0, t).toFixed(2)
    const hlCR  = rnd(lerpN(201, 255, t))
    const hlCG  = rnd(lerpN(168, 255, t))
    const hlCB  = rnd(lerpN(76,  255, t))
    const hlGold    = `rgba(201,168,76,${hlOp})`
    const hlCentre  = `rgb(${hlCR},${hlCG},${hlCB})`
    const hairline  = `linear-gradient(90deg,transparent,${hlGold} 20%,${hlCentre} 50%,${hlGold} 80%,transparent)`

    // bar segment colors
    const bR = rnd(lerpN(160, 240, t)), bG = rnd(lerpN(128, 220, t)), bB = rnd(lerpN(50, 138, t))
    const barColor      = `rgb(${bR},${bG},${bB})`
    const completeColor = `rgb(${rnd(bR*.4)},${rnd(bG*.4)},${rnd(bB*.4)})`

    // glow on active bar tip
    const glowR   = lerpN(3,  14, t).toFixed(1)
    const glowS   = lerpN(1,   5, t).toFixed(1)
    const glowOp  = lerpN(0.35, 0.85, t).toFixed(2)
    const tipGlow = `0 0 ${glowR}px ${glowS}px rgba(${hlCR},${hlCG},${hlCB},${glowOp})`
    const pulseDur = lerpN(2.2, 1.0, t).toFixed(2) + 's'

    // bar segments: cap complete loops at 3 to avoid layout overflow
    const completeLoops = Math.min(Math.floor(multiplier), 3)
    const activeWidthPct = ((points % goal) / goal * 100).toFixed(1) + '%'
    const hasActiveSeg  = (points % goal) > 0

    return (
      <div style={{ ...shell, background: '#4a1a06', border: '1.5px solid #6b2a0d' }}>
        <style>{`@keyframes eclairs-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(1.6)}}`}</style>

        <div style={topRow}>
          <span style={{ ...labelSz, color: labelColor }}>Éclairs</span>
          <span style={{ ...numSz, color: numColor }}>{points}</span>
        </div>
        <div style={subRow}>
          <span style={{ fontSize: '9px' }}>{/* spacer */}</span>
          <span style={{ ...subSz, color: multColor, fontWeight: 700 }}>
            ×{multiplier.toFixed(1)} <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>objectif</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '2px', height: '3px' }}>
          {Array.from({ length: completeLoops }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: completeColor }} />
          ))}
          <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.12)', overflow: 'visible', position: 'relative' }}>
            <div style={{ height: '100%', width: activeWidthPct, borderRadius: '2px', background: barColor, position: 'relative' }}>
              {hasActiveSeg && (
                <div style={{
                  position: 'absolute', right: '-3px', top: '-2px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: barColor, boxShadow: tipGlow,
                  animation: `eclairs-pulse ${pulseDur} ease-in-out infinite`,
                }} />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── UNDER / AT GOAL ────────────────────────────────────────────────
  const pct = Math.min((points / goal) * 100, 100)
  return (
    <div style={{ ...shell, background: 'var(--white)', border: done ? '1.5px solid rgba(193,68,14,0.4)' : '1.5px solid var(--border)' }}>
      <div style={topRow}>
        <span style={{ ...labelSz, color: done ? 'var(--terracotta)' : 'var(--light)' }}>Éclairs</span>
        <span style={{ ...numSz, color: done ? 'var(--terracotta)' : 'var(--dark)' }}>{points}</span>
      </div>
      <div style={subRow}>
        <span style={{ fontSize: '9px' }}>{/* spacer */}</span>
        <span style={{ ...subSz, color: done ? 'var(--terracotta)' : 'var(--light)', fontWeight: done ? 600 : 400 }}>
          {done ? '✓ objectif' : `/ ${goal}`}
        </span>
      </div>
      <div style={{ height: '3px', background: 'rgba(58,47,38,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: done ? 'var(--terracotta)' : 'var(--gold)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
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

export function UserAvatar({ user, size = 24 }) {
  const name = user.user_metadata?.full_name ?? user.email ?? '?'
  const avatar = user.user_metadata?.avatar_url
  const [imgFailed, setImgFailed] = useState(false)

  if (avatar && !imgFailed) {
    return (
      <img
        src={avatar}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        onError={() => setImgFailed(true)}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--terracotta)', color: 'var(--white)', fontSize: size < 28 ? '11px' : '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  )
}
