'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const router = useRouter()
  const { user, signInWithGoogle } = useAuth()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Give useAuth a moment to sync profile to localStorage after sign-in
    const timer = setTimeout(() => {
      const level = localStorage.getItem('lexitree_level')
      if (level) router.replace('/session')
      else setChecked(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [user])

  if (!checked) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .landing-hero { animation: fadeUp 0.4s ease both; }
        .landing-cta-primary:hover  { opacity: 0.88; }
        .landing-cta-secondary:hover { border-color: var(--dark) !important; }
        .landing-nav-signin:hover { color: var(--dark) !important; }
      `}</style>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '17px', fontWeight: 600, color: 'var(--dark)', letterSpacing: '-0.02em' }}>
          Lexitree<span style={{ color: 'var(--terracotta)' }}>.</span>
        </span>
        {user === null && (
          <button
            className="landing-nav-signin"
            onClick={signInWithGoogle}
            style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 500, color: 'var(--mid)', cursor: 'pointer', transition: 'color 0.12s' }}
          >
            Sign in →
          </button>
        )}
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
        <div className="landing-hero" style={{ width: '100%', maxWidth: '520px', textAlign: 'center' }}>

          {/* Level badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '32px' }}>
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
              <span
                key={lvl}
                style={{ fontSize: '11px', fontWeight: 500, padding: '3px 9px', borderRadius: '4px', background: 'var(--terracotta-bg)', color: 'var(--terracotta)', letterSpacing: '0.02em' }}
              >
                {lvl}
              </span>
            ))}
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '42px', fontWeight: 600, lineHeight: 1.15, color: 'var(--dark)', marginBottom: '16px', letterSpacing: '-0.02em' }}>
            Master French grammar,<br />one concept at a time.
          </h1>

          {/* Subtext */}
          <p style={{ fontSize: '17px', color: 'var(--mid)', lineHeight: 1.65, marginBottom: '40px', maxWidth: '400px', margin: '0 auto 40px' }}>
            AI-powered lessons and exercises matched to your CEFR level. Learn systematically from A1 to C2.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '340px', margin: '0 auto 48px' }}>
            <button
              className="landing-cta-primary"
              onClick={() => router.push('/assess')}
              style={{ width: '100%', padding: '15px 24px', background: 'var(--dark)', color: 'var(--white)', border: 'none', borderRadius: 'var(--radius)', fontSize: '15px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.12s', letterSpacing: '-0.01em' }}
            >
              Check my French level →
            </button>

            <button
              className="landing-cta-secondary"
              onClick={signInWithGoogle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '14px 24px', background: 'var(--white)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '14px', fontWeight: 500, color: 'var(--dark)', cursor: 'pointer', transition: 'border-color 0.12s', boxShadow: 'var(--shadow)' }}
            >
              <GoogleIcon size={16} />
              Continue with Google
            </button>
          </div>

          {/* Proof points */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
            {[
              { icon: '📖', title: 'Visual lesson', sub: 'per concept' },
              { icon: '✓',  title: '7 exercises',  sub: 'per session' },
              { icon: '📈', title: 'Level tracking', sub: 'as you progress' },
            ].map((item, i) => (
              <div
                key={i}
                style={{ flex: 1, textAlign: 'center', padding: '0 16px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--dark)', marginBottom: '2px' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--light)' }}>{item.sub}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '20px 40px', textAlign: 'center', flexShrink: 0 }}>
        <p style={{ fontSize: '12px', color: 'var(--light)' }}>
          French grammar from A1 to C2 · CEFR aligned
        </p>
      </footer>

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
