import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }) {
  const { data } = await supabase
    .from('shared_results')
    .select('display_name, score, total, level')
    .eq('id', params.id)
    .single()

  if (!data) return { title: 'Lagram' }

  const firstName = data.display_name?.split(' ')[0] ?? 'Someone'
  const perfect   = data.score === data.total
  return {
    title: perfect
      ? `${firstName} got a perfect 7/7 on French vocab · Lagram`
      : `${firstName} got ${data.score}/${data.total} on French vocab · Lagram`,
    description: `${data.level} French vocabulary practice on Lagram — free personalised French learning.`,
  }
}

export default async function SharePage({ params }) {
  const { data, error } = await supabase
    .from('shared_results')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  const { display_name, score, total, level, words, vocab_score, vocab_score_delta } = data
  const pct       = Math.round((score / total) * 100)
  const firstName = display_name?.split(' ')[0] ?? 'Someone'
  const great     = score >= 5
  const perfect   = score === total

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 800, fontSize: '17px', color: 'var(--dark)', letterSpacing: '-0.02em' }}>Lagram</span>
        <a href="/assess" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--dark)', textDecoration: 'none', padding: '7px 16px', border: '1px solid var(--border)', borderRadius: '500px', background: 'var(--white)' }}>
          Try it free →
        </a>
      </div>

      <div style={{ maxWidth: '420px', margin: '36px auto', padding: '0 16px 60px' }}>

        {perfect ? (
          /* ── Perfect card ── */
          <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '14px' }}>
            <style>{`
              @keyframes lx-fadein { from { opacity:0 } to { opacity:1 } }
              @keyframes lx-fadeup { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
            `}</style>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #64748b 30%, #cbd5e1 50%, #64748b 70%, transparent)', animation: 'lx-fadein 0.6s ease 0.1s both' }} />
            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: '20px' }}>
                {firstName}'s vocab session · {level}
              </div>
              <div style={{ fontSize: '28px', lineHeight: 1, marginBottom: '10px', animation: 'lx-fadein 0.4s ease 0.3s both' }}>👑</div>
              <div style={{ fontSize: '68px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '8px', animation: 'lx-fadeup 0.5s ease 0.65s both' }}>7/7</div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '28px', animation: 'lx-fadein 0.5s ease 0.9s both' }}>Acquis</div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '20px' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '20px' }}>
                {words.map((r, i) => (
                  <span key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: '12px', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(148,163,184,0.05)', borderRadius: 'var(--radius)', padding: '3px 8px' }}>
                    {r.word}
                  </span>
                ))}
              </div>
              {vocab_score !== null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Vocab Score</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#cbd5e1' }}>{vocab_score}</span>
                  {vocab_score_delta !== null && vocab_score_delta !== 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{vocab_score_delta > 0 ? `+${vocab_score_delta}` : vocab_score_delta}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Standard card ── */
          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mid)' }}>{firstName}'s vocab session</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span style={{ fontSize: '12px', color: 'var(--light)', fontWeight: 500, padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>{level}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--dark)', letterSpacing: '-0.03em', marginBottom: '4px' }}>{score} / {total}</div>
            <div style={{ fontSize: '13px', color: 'var(--light)', marginBottom: '18px' }}>{pct}% correct</div>
            <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginBottom: '24px' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: great ? 'var(--green)' : 'var(--terracotta)', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: vocab_score !== null ? '20px' : '0' }}>
              {words.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: r.correct ? 'var(--green-light)' : 'var(--red-light)', borderRadius: 'var(--radius)', border: `1px solid ${r.correct ? 'var(--green)' : 'var(--red)'}` }}>
                  <span style={{ fontSize: '12px', color: r.correct ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>{r.correct ? '✓' : '✗'}</span>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: '14px', color: 'var(--dark)', fontWeight: 500 }}>{r.word}</span>
                  {!r.correct && <span style={{ fontSize: '12px', color: 'var(--light)', marginLeft: '2px' }}>— {r.definition}</span>}
                </div>
              ))}
            </div>
            {vocab_score !== null && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <span style={{ fontSize: '12px', color: 'var(--light)' }}>Vocab Score</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--terracotta)' }}>{vocab_score}</span>
                {vocab_score_delta !== null && vocab_score_delta !== 0 && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: vocab_score_delta > 0 ? 'var(--green)' : 'var(--red)' }}>{vocab_score_delta > 0 ? `+${vocab_score_delta}` : vocab_score_delta}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--dark)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
            What's your French level?
          </div>
          <div style={{ fontSize: '13px', color: 'var(--mid)', marginBottom: '22px', lineHeight: 1.6 }}>
            Lagram places you on the CEFR scale and builds personalised practice from there.
          </div>
          <a
            href="/assess"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '13px 28px', background: 'var(--terracotta)', color: '#fff', borderRadius: '500px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', letterSpacing: '0.01em' }}
          >
            Check my level — it's free →
          </a>
        </div>

      </div>
    </div>
  )
}
