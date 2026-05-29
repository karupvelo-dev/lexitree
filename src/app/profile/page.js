'use client'
import { useState, useEffect } from 'react'
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['','M','','W','','F','']

const LEVEL_MAP = [
  { level: 'A1', order: A1_ORDER, concepts: A1_CONCEPTS },
  { level: 'A2', order: A2_ORDER, concepts: A2_CONCEPTS },
  { level: 'B1', order: B1_ORDER, concepts: B1_CONCEPTS },
  { level: 'B2', order: B2_ORDER, concepts: B2_CONCEPTS },
  { level: 'C1', order: C1_ORDER, concepts: C1_CONCEPTS },
  { level: 'C2', order: C2_ORDER, concepts: C2_CONCEPTS },
]
const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function buildHeatmap(sessions) {
  const counts = {}
  for (const s of sessions) {
    const d = s.created_at.slice(0, 10)
    counts[d] = (counts[d] ?? 0) + 1
  }

  // Build 52 weeks ending today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDay = new Date(today)
  startDay.setDate(startDay.getDate() - 363) // ~52 weeks back, align to Sunday
  const dow = startDay.getDay()
  startDay.setDate(startDay.getDate() - dow)

  const weeks = []
  const monthLabels = [] // { label, colIndex }
  let lastMonth = -1
  let col = new Date(startDay)

  for (let w = 0; w < 53; w++) {
    const days = []
    for (let d = 0; d < 7; d++) {
      const dateStr = col.toISOString().slice(0, 10)
      const count = counts[dateStr] ?? 0
      const isFuture = col > today
      days.push({ date: dateStr, count, isFuture })
      if (d === 0 && col.getMonth() !== lastMonth && !isFuture) {
        monthLabels.push({ label: MONTHS[col.getMonth()], col: w })
        lastMonth = col.getMonth()
      }
      col.setDate(col.getDate() + 1)
    }
    weeks.push(days)
  }

  return { weeks, monthLabels }
}

function cellLevel(count, isFuture) {
  if (isFuture || count === 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

const CELL_BG = ['#EBEBEB', '#C8C8C8', '#888888', '#3D3D3D', '#000000']

export default function ProfilePage() {
  const router  = useRouter()
  const { user, signInWithGoogle, signOut } = useAuth()
  const [tab,         setTab]        = useState('overview')
  const [filter,      setFilter]     = useState('all')
  const [loading,     setLoading]    = useState(true)
  const [stats,       setStats]      = useState(null)
  const [heatmap,     setHeatmap]    = useState(null)
  const [concepts,    setConcepts]   = useState({})
  const [allSessions, setAllSessions] = useState([])
  const [profile,     setProfile]    = useState(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function load() {
      const { data: prof } = await supabaseBrowser
        .from('profiles')
        .select('current_streak, longest_streak, vocab_score, vocab_words_seen')
        .eq('id', user.id)
        .single()

      const { data: sessions } = await supabaseBrowser
        .from('sessions')
        .select('concept, concept_name, level, score, total, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      const rows = sessions ?? []
      setProfile(prof)
      setAllSessions(rows)
      setHeatmap(buildHeatmap(rows))
      computeConcepts(rows)
      setLoading(false)
    }

    load()
  }, [user?.id])

  useEffect(() => {
    if (allSessions.length > 0 || !loading) {
      computeStats(allSessions, profile, filter)
    }
  }, [filter, allSessions, profile])

  function computeStats(allSessions, profile, f) {
    const cutoff = f === '7d'
      ? new Date(Date.now() - 7  * 86400000).toISOString()
      : f === '30d'
      ? new Date(Date.now() - 30 * 86400000).toISOString()
      : null

    const rows = cutoff ? allSessions.filter(s => s.created_at >= cutoff) : allSessions
    const totalQ   = rows.reduce((s, r) => s + r.total, 0)
    const totalHit = rows.reduce((s, r) => s + r.score, 0)
    const activeDays = new Set(rows.map(s => s.created_at.slice(0, 10))).size

    setStats({
      sessions:   rows.length,
      questions:  totalQ,
      accuracy:   totalQ > 0 ? Math.round(totalHit / totalQ * 100) : 0,
      activeDays,
      streak:     profile?.current_streak  ?? 0,
      longestStreak: profile?.longest_streak ?? 0,
      vocabScore: profile?.vocab_score ?? 0,
      vocabWordsSeen: profile?.vocab_words_seen ?? 0,
    })
  }

  function computeConcepts(allSessions) {
    // slug → { level, score, total, sessions, acc }
    // Use the level stored in each session row, not the grammar map definition,
    // so concepts appear under whichever level the user actually practiced them at.
    const map = {}
    for (const s of allSessions) {
      const key = s.concept
      if (!map[key]) map[key] = { level: s.level, score: 0, total: 0, sessions: 0 }
      map[key].score   += s.score
      map[key].total   += s.total
      map[key].sessions += 1
    }
    for (const key of Object.keys(map)) {
      const c = map[key]
      map[key].acc = c.total > 0 ? Math.round(c.score / c.total * 100) : 0
    }
    setConcepts(map)
  }

  const level = typeof window !== 'undefined' ? (localStorage.getItem('lagram_level') ?? 'B1') : 'B1'
  const name  = user?.user_metadata?.full_name ?? user?.email ?? '?'
  const initial = name[0].toUpperCase()

  return (
    <div className="mobile-header-offset" style={{ display: 'flex', height: '100vh', fontFamily: 'var(--font-sans)', background: 'var(--bg)', overflow: 'hidden' }}>
      <style>{`
        .profile-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }
        @media (max-width: 768px) {
          .profile-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .profile-content { padding: 16px 16px 100px !important; }
          .profile-main { overflow-y: auto !important; }
          .profile-topbar { display: none !important; }
          .heatmap-scroll { overflow-x: auto; }
          .heatmap-inner { min-width: 560px; }
          .profile-header-row { margin-bottom: 16px !important; }
          .concept-acc-bar { display: none !important; }
        }
        .stat-card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 16px;
        }
        .stat-label { font-size: 12px; color: var(--mid); margin-bottom: 4px; }
        .stat-value { font-size: 22px; font-weight: 700; color: var(--dark); letter-spacing: -0.02em; line-height: 1.1; }
        .profile-tab { padding: 6px 14px; border-radius: var(--radius); font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid transparent; background: none; color: var(--mid); }
        .profile-tab.active { background: var(--white); color: var(--dark); border-color: var(--border); }
        .profile-filter { padding: 5px 12px; border-radius: var(--radius); font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid transparent; background: none; color: var(--light); }
        .profile-filter.active { background: var(--white); color: var(--dark); border-color: var(--border); }
        .concept-row {
          background: var(--white); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 10px 14px; display: flex; align-items: center; gap: 12px;
        }
        .concept-name { font-size: 13px; color: var(--dark); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .concept-bar-wrap { width: 72px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
        .concept-acc-val { font-size: 11px; font-weight: 600; width: 32px; text-align: right; flex-shrink: 0; }
        .section-eyebrow { font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--light); margin-bottom: 10px; margin-top: 20px; }
        .back-btn { display: none; }
        @media (max-width: 768px) { .back-btn { display: flex; } }
      `}</style>

      <Sidebar active={null} user={user} signInWithGoogle={signInWithGoogle} signOut={signOut} />

      <div className="profile-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Desktop topbar */}
        <div className="profile-topbar" style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--white)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--light)' }}>Profile</span>
        </div>

        <div className="profile-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 40px' }}>

          {/* Mobile back */}
          <button
            className="back-btn"
            onClick={() => router.back()}
            style={{ alignItems: 'center', gap: 4, background: 'none', border: 'none', fontSize: 13, color: 'var(--mid)', cursor: 'pointer', padding: '0 0 16px' }}
          >
            ← Back
          </button>

          {/* Profile header */}
          <div className="profile-header-row" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#000', color: '#fff', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {initial}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--dark)', letterSpacing: '-0.02em' }}>{name}</div>
              <div style={{ display: 'inline-flex', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'var(--bg)', color: 'var(--mid)', border: '1px solid var(--border)', marginTop: 3 }}>
                {level} · Current level
              </div>
              <a
                href="/assess?retake=true"
                style={{ display: 'block', fontSize: 11, color: 'var(--light)', marginTop: 5, textDecoration: 'none', cursor: 'pointer' }}
              >
                Retake placement test →
              </a>
            </div>
          </div>

          {!user ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 16 }}>Sign in to see your stats</p>
              <button onClick={signInWithGoogle} style={{ padding: '10px 24px', background: '#000', color: '#fff', border: 'none', borderRadius: '500px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Sign in with Google
              </button>
            </div>
          ) : loading ? (
            <div style={{ fontSize: 13, color: 'var(--light)', padding: '40px 0', textAlign: 'center' }}>Loading…</div>
          ) : (
            <>
              {/* Tabs + filters */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button className={`profile-tab${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
                  <button className={`profile-tab${tab === 'concepts' ? ' active' : ''}`} onClick={() => setTab('concepts')}>Concepts</button>
                </div>
                {tab === 'overview' && (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {['all','30d','7d'].map(f => (
                      <button key={f} className={`profile-filter${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'All' : f}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {tab === 'overview' && stats && (
                <>
                  {/* Stats grid row 1 */}
                  <div className="profile-stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">Sessions</div>
                      <div className="stat-value">{stats.sessions}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Questions answered</div>
                      <div className="stat-value">{stats.questions.toLocaleString()}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Accuracy</div>
                      <div className="stat-value" style={{ color: stats.accuracy >= 70 ? 'var(--green)' : stats.accuracy >= 50 ? '#D97706' : 'var(--red)' }}>
                        {stats.accuracy}%
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Active days</div>
                      <div className="stat-value">{stats.activeDays}</div>
                    </div>
                  </div>

                  {/* Stats grid row 2 */}
                  <div className="profile-stats-grid">
                    <div className="stat-card">
                      <div className="stat-label">Current streak</div>
                      <div className="stat-value">{stats.streak > 0 ? `🔥 ${stats.streak}d` : '—'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Longest streak</div>
                      <div className="stat-value">{stats.longestStreak > 0 ? `${stats.longestStreak}d` : '—'}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Concepts practiced</div>
                      <div className="stat-value">{Object.keys(concepts).length}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Vocab score</div>
                      <div className="stat-value">
                        {stats.vocabScore}
                        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--light)' }}>/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Heatmap */}
                  {heatmap && (
                    <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px 20px 16px', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)' }}>Practice activity</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--light)' }}>
                          <span>Less</span>
                          {CELL_BG.map((bg, i) => (
                            <div key={i} style={{ width: 9, height: 9, borderRadius: 2, background: bg }} />
                          ))}
                          <span>More</span>
                        </div>
                      </div>

                      <div className="heatmap-scroll">
                        <div className="heatmap-inner">
                          {/* Month row */}
                          <div style={{ display: 'flex', paddingLeft: 18, marginBottom: 4 }}>
                            {heatmap.weeks.map((_, wi) => {
                              const lbl = heatmap.monthLabels.find(m => m.col === wi)
                              return (
                                <div key={wi} style={{ width: 11, flexShrink: 0, marginRight: 3, fontSize: 9, color: 'var(--light)', fontWeight: 500 }}>
                                  {lbl ? lbl.label : ''}
                                </div>
                              )
                            })}
                          </div>

                          {/* Grid */}
                          <div style={{ display: 'flex', gap: 0 }}>
                            {/* Day labels */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
                              {DAYS.map((d, i) => (
                                <div key={i} style={{ fontSize: 9, color: 'var(--light)', width: 14, height: 11, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
                                  {d}
                                </div>
                              ))}
                            </div>
                            {/* Week columns */}
                            {heatmap.weeks.map((week, wi) => (
                              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 3 }}>
                                {week.map((day, di) => (
                                  <div
                                    key={di}
                                    title={`${day.date}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                                    style={{ width: 11, height: 11, borderRadius: 2, background: CELL_BG[cellLevel(day.count, day.isFuture)], flexShrink: 0 }}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {stats.sessions > 0 && (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--light)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                          {stats.questions >= 500
                            ? <>You've answered more questions than a typical <strong style={{ fontStyle: 'normal', fontFamily: 'var(--font-sans)' }}>DELF B1</strong> exam requires.</>
                            : stats.questions >= 200
                            ? <>You've answered more questions than a typical <strong style={{ fontStyle: 'normal', fontFamily: 'var(--font-sans)' }}>DELF A2</strong> exam requires.</>
                            : <>Keep going — consistency beats intensity every time.</>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === 'concepts' && (
                <>
                  {Object.keys(concepts).length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--light)', paddingTop: 8 }}>No sessions yet — start a session to see your concept breakdown.</p>
                  ) : (
                    LEVEL_MAP.filter(({ level: lvl }) => LEVEL_ORDER.indexOf(lvl) <= LEVEL_ORDER.indexOf(level)).map(({ level, order, concepts: defs }) => {
                      // Only include slugs whose session-stored level matches this level group,
                      // ordered by the grammar map ORDER array for this level.
                      const practiced = order.filter(
                        slug => concepts[slug] && concepts[slug].level === level
                      )
                      // Also catch any slugs at this level not in the ORDER array (edge case)
                      const extra = Object.entries(concepts)
                        .filter(([slug, c]) => c.level === level && !order.includes(slug))
                        .map(([slug]) => slug)
                      const all = [...practiced, ...extra]
                      if (all.length === 0) return null
                      return (
                        <div key={level} style={{ marginBottom: 24 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--light)', marginBottom: 8, marginTop: 16 }}>
                            {level}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {all.map(slug => {
                              const c = concepts[slug]
                              const def = defs[slug]
                              const name = def?.nameFr ?? slug
                              const barColor = c.acc >= 70 ? 'var(--green)' : c.acc >= 50 ? '#D97706' : 'var(--red)'
                              return (
                                <div key={slug} className="concept-row">
                                  <div className="concept-name">{name}</div>
                                  <div className="concept-acc-bar concept-bar-wrap">
                                    <div style={{ height: '100%', borderRadius: 2, background: barColor, width: `${c.acc}%` }} />
                                  </div>
                                  <div className="concept-acc-val" style={{ color: barColor }}>{c.acc}%</div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </>
              )}

              {/* Sign out */}
              <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={signOut}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '500px', padding: '9px 20px', fontSize: 13, color: 'var(--mid)', cursor: 'pointer' }}
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
