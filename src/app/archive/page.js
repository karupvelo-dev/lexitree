'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Sidebar } from '@/components/Sidebar'
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
      <Sidebar active="archive" user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} />

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

