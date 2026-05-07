'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { LEVEL_INFO } from '@/data/concepts'

export default function ArchivePage() {
  const router = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user === null) { setLoading(false); return }
    if (user === undefined) return // still resolving auth

    supabaseBrowser
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setSessions(data)
        setLoading(false)
      })
  }, [user])

  return (
    <div className="app-shell">
      <Sidebar user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} />

      <div className="main-content">
        <h1 className="page-title">Archive</h1>
        <p className="page-subtitle">Your full session history</p>

        {loading && <LoadingState />}

        {!loading && user === null && (
          <GuestState onSignIn={signInWithGoogle} />
        )}

        {!loading && user && sessions.length === 0 && (
          <EmptyState onGoToSession={() => router.push('/session')} />
        )}

        {!loading && user && sessions.length > 0 && (
          <SessionList sessions={sessions} />
        )}
      </div>
    </div>
  )
}

function SessionList({ sessions }) {
  const groups = groupByMonth(sessions)

  return (
    <div>
      {groups.map(({ label, items }) => (
        <div key={label} style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: '12px' }}>
            {label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(s => <SessionRow key={s.id} session={s} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionRow({ session }) {
  const pct = Math.round((session.score / session.total) * 100)
  const great = pct >= 70
  const date = new Date(session.created_at)
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Score circle */}
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: great ? 'var(--green-light)' : 'var(--terracotta-bg)', border: `2px solid ${great ? 'var(--green)' : 'var(--terracotta-light)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: great ? 'var(--green)' : 'var(--terracotta)' }}>{pct}%</span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--dark)', marginBottom: '2px', fontFamily: 'var(--font-serif)' }}>
          {session.concept_name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="level-badge" style={{ fontSize: '10px', padding: '2px 6px' }}>{session.level}</span>
          <span style={{ fontSize: '13px', color: 'var(--light)' }}>{session.score}/{session.total} correct</span>
        </div>
      </div>

      {/* Date */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '13px', color: 'var(--mid)' }}>{dateStr}</div>
        <div style={{ fontSize: '12px', color: 'var(--light)' }}>{timeStr}</div>
      </div>
    </div>
  )
}

function groupByMonth(sessions) {
  const map = new Map()
  sessions.forEach(s => {
    const d = new Date(s.created_at)
    const key = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(s)
  })
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

function LoadingState() {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '2px solid var(--border)', borderTop: '2px solid var(--terracotta)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GuestState({ onSignIn }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center' }}>
      <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--dark)', marginBottom: '8px' }}>Sign in to see your history</p>
      <p style={{ fontSize: '14px', color: 'var(--mid)', marginBottom: '24px' }}>Your completed sessions will appear here once you're signed in.</p>
      <button
        onClick={onSignIn}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '11px 22px', background: 'var(--dark)', border: 'none', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 500, color: 'var(--white)', cursor: 'pointer' }}
      >
        <GoogleIcon size={16} />
        Continue with Google
      </button>
    </div>
  )
}

function EmptyState({ onGoToSession }) {
  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '40px', textAlign: 'center' }}>
      <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--dark)', marginBottom: '8px' }}>No sessions yet</p>
      <p style={{ fontSize: '14px', color: 'var(--mid)', marginBottom: '24px' }}>Complete your first session and it will appear here.</p>
      <button className="btn-primary" onClick={onGoToSession}>Go to today's session →</button>
    </div>
  )
}

function Sidebar({ user, signInWithGoogle, signOut }) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">Lexitree<span>.</span></div>
      <nav className="sidebar-nav">
        <a className="nav-item" href="/session">
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
        <a className="nav-item active" href="/archive">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archive
        </a>
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {user === null && (
          <button onClick={signInWithGoogle} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 12px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--mid)', cursor: 'pointer' }}>
            <GoogleIcon size={14} />
            Sign in to save progress
          </button>
        )}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <UserAvatar user={user} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: 'var(--dark)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.user_metadata?.full_name ?? user.email}</div>
              <button onClick={signOut} style={{ fontSize: '11px', color: 'var(--light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign out</button>
            </div>
          </div>
        )}
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

function UserAvatar({ user }) {
  const name = user.user_metadata?.full_name ?? user.email ?? '?'
  const avatar = user.user_metadata?.avatar_url
  if (avatar) return <img src={avatar} alt={name} width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} />
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--terracotta)', color: 'var(--white)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {name[0].toUpperCase()}
    </div>
  )
}
