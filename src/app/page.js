'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

// ── Static map data for demo ──────────────────────────────────────────────────

const MOBILE_LEVELS = {
  A1: [
    { label: 'Subject pronouns', dot: 'good' },
    { label: 'être / avoir',      dot: 'good' },
    { label: '-er verbs',          dot: 'good' },
    { label: 'Articles',           dot: 'good' },
    { label: 'Négation',           dot: 'medium' },
    { label: 'Questions',          dot: 'good' },
    { label: 'Nombres',            dot: 'good' },
    { label: 'Impératif',          dot: 'poor' },
    { label: 'Adjectifs',          dot: 'good' },
    { label: 'Prépositions',       dot: 'good' },
    { label: '+4 more ✓',          dot: 'empty', muted: true },
  ],
  A2: [
    { label: 'Passé composé',      dot: 'good' },
    { label: 'Imparfait intro',    dot: 'good' },
    { label: 'Futur proche',       dot: 'good' },
    { label: 'Verbes irréguliers', dot: 'medium' },
    { label: 'Verbes réfléchis',   dot: 'good' },
    { label: 'Pronoms COD/COI',    dot: 'poor' },
    { label: 'Comparatif',         dot: 'good' },
    { label: 'Démonstratifs',      dot: 'open' },
    { label: 'Articles contractés',dot: 'good' },
    { label: '+6 more ✓',          dot: 'empty', muted: true },
  ],
  B1: [
    { label: 'Imparfait vs passé composé', dot: 'good' },
    { label: 'Futur simple',               dot: 'good' },
    { label: 'Pronoms relatifs',           dot: 'good' },
    { label: 'Conditionnel présent',       dot: 'medium' },
    { label: 'Subjonctif présent',         dot: 'open', selected: true },
    { label: 'Pronoms y / en',             dot: 'open' },
    { label: 'Superlatif',                 dot: 'open' },
    { label: 'Double pronoms',             dot: 'empty', greyed: true },
    { label: 'Négation étendue',           dot: 'empty', greyed: true },
    { label: '+6 more locked',             dot: 'empty', greyed: true, muted: true },
  ],
  B2: [
    { label: 'Plus-que-parfait', dot: 'empty', greyed: true },
    { label: 'Futur antérieur',  dot: 'empty', greyed: true },
    { label: 'Voix passive',     dot: 'empty', greyed: true },
    { label: 'Si clauses 2–3',   dot: 'empty', greyed: true },
    { label: '+10 more locked',  dot: 'empty', greyed: true, muted: true },
  ],
  C1: [
    { label: 'Subjonctif passé', dot: 'empty', greyed: true },
    { label: 'Passé simple',     dot: 'empty', greyed: true },
    { label: '+10 more locked',  dot: 'empty', greyed: true, muted: true },
  ],
  C2: [
    { label: 'Styles littéraires', dot: 'empty', greyed: true },
    { label: '+7 more locked',     dot: 'empty', greyed: true, muted: true },
  ],
}

const BORDER = '#3a2f26'
const BORDER_LIGHT = 'rgba(58,47,38,0.2)'
const BG = '#f4ece0'
const WHITE = '#fffdf8'
const DARK = '#1a1410'
const MID = '#5a4535'
const LIGHT = '#9a8070'
const RUST = '#c1440e'
const GOLD = '#d99a2b'

const DOT_STYLE = {
  good:   { background: '#0E8345' },
  medium: { background: '#D97706' },
  poor:   { background: '#D1293D' },
  open:   { border: `1.5px solid ${BORDER}`, background: 'transparent' },
  empty:  { border: `1.5px solid ${BORDER_LIGHT}`, background: 'transparent' },
}

const CHEVRON = (color = LIGHT) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M4.5 3l3 3-3 3" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()
  const { user, signInWithGoogle } = useAuth()
  const [checked, setChecked]   = useState(false)
  const [hasLevel, setHasLevel] = useState(false)
  const [mapTab, setMapTab]     = useState('B1')

  useEffect(() => {
    if (user === undefined) return

    if (user === null) {
      const level = localStorage.getItem('lagram_level')
      if (level) setHasLevel(true)
      setChecked(true)
      return
    }

    const timer = setTimeout(() => {
      const level = localStorage.getItem('lagram_level')
      if (level) router.replace('/session')
      else setChecked(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [user])

  if (!checked) return null

  return (
    <div style={{ minHeight: '100vh', color: DARK, fontFamily: 'var(--font-sans)' }}>
      <style>{`
        /* ── Nav ── */
        .landing-nav { display:flex; align-items:center; justify-content:space-between; padding:16px 40px; border-bottom:1px solid ${BORDER_LIGHT}; background:${WHITE}; }
        .landing-logo { font-family:'Fraunces',Georgia,serif; font-size:18px; font-weight:600; color:${DARK}; letter-spacing:0; text-decoration:none; }
        .landing-nav-signin { font-size:12px; font-weight:400; color:${MID}; background:none; border:none; cursor:pointer; letter-spacing:0.02em; }
        .landing-nav-signin:hover { color:${DARK}; }
        .landing-nav-cta { font-size:12px; font-weight:500; color:${WHITE}; background:${RUST}; border:none; border-radius:2px; padding:9px 18px; cursor:pointer; letter-spacing:0.04em; }
        .landing-nav-cta:hover { opacity:0.85; }

        /* ── Hero ── */
        .landing-hero { display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:start; max-width:1100px; margin:0 auto; padding:64px 40px 60px; }

        .cefr-row { display:flex; gap:5px; margin-bottom:24px; }
        .cefr-badge { font-size:10px; font-weight:500; letter-spacing:0.08em; padding:3px 8px; border-radius:2px; background:transparent; color:${DARK}; border:2px solid ${BORDER}; }
        .cefr-badge-active { background:${DARK}; color:${WHITE}; border-color:${DARK}; }

        .landing-h1 { font-family:'Fraunces',Georgia,serif; font-size:40px; font-weight:600; line-height:1.1; letter-spacing:-0.02em; color:${DARK}; margin-bottom:16px; }
        .landing-sub { font-size:14px; color:${MID}; line-height:1.75; margin-bottom:32px; max-width:400px; }

        .cta-stack { display:flex; flex-direction:column; gap:8px; max-width:340px; }
        .btn-primary-land { display:flex; align-items:center; justify-content:center; min-height:48px; padding:0 28px; background:${RUST}; color:${WHITE}; border:none; border-radius:2px; font-family:var(--font-sans); font-size:13px; font-weight:500; letter-spacing:0.04em; cursor:pointer; width:100%; }
        .btn-ghost-land   { display:flex; align-items:center; justify-content:center; gap:8px; min-height:48px; padding:0 28px; background:transparent; color:${DARK}; border:2px solid ${BORDER}; border-radius:2px; font-family:var(--font-sans); font-size:13px; font-weight:400; cursor:pointer; width:100%; }
        .btn-primary-land:hover { opacity:0.85; }
        .btn-ghost-land:hover { background:rgba(58,47,38,0.06); }

        .cred-row { display:flex; gap:16px; margin-top:24px; padding-top:24px; border-top:1px solid ${BORDER_LIGHT}; flex-wrap:wrap; }
        .cred-item { display:flex; align-items:center; gap:6px; font-size:11px; color:${LIGHT}; letter-spacing:0.04em; }
        .cred-dot  { width:5px; height:5px; border-radius:50%; background:${RUST}; flex-shrink:0; }

        /* ── Session card demo ── */
        .session-card { background:${WHITE}; border:2px solid ${BORDER}; border-radius:3px; overflow:hidden; box-shadow:0 2px 12px rgba(26,20,16,0.08); }
        .card-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:2px solid ${BORDER}; }
        .concept-eyebrow { font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:${LIGHT}; margin-bottom:4px; }
        .concept-name { font-family:'Fraunces',Georgia,serif; font-size:15px; font-weight:600; color:${DARK}; }
        .level-bdg { font-size:10px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:3px 8px; border-radius:2px; background:transparent; color:${RUST}; border:2px solid ${RUST}; }
        .rule-callout { margin:20px 20px 0; padding:12px 14px; background:rgba(217,154,43,0.08); border-left:4px solid ${GOLD}; border-radius:0 2px 2px 0; font-size:12px; line-height:1.7; color:${MID}; }
        .rule-label { font-size:9px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:${LIGHT}; margin-bottom:4px; }
        .rule-callout em { font-family:'Fraunces',Georgia,serif; font-style:italic; color:${DARK}; }
        .card-body { padding:20px; }
        .q-label { font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:${LIGHT}; margin-bottom:10px; }
        .q-text  { font-family:'Fraunces',Georgia,serif; font-size:17px; font-weight:400; line-height:1.7; color:${DARK}; margin-bottom:18px; }
        .blank   { display:inline-block; width:72px; border-bottom:2px solid ${DARK}; vertical-align:baseline; margin:0 4px; }
        .opts    { display:flex; flex-direction:column; gap:7px; }
        .opt     { width:100%; text-align:left; padding:10px 14px; border-radius:2px; border:2px solid ${BORDER}; background:transparent; font-family:'Fraunces',Georgia,serif; font-size:14px; color:${DARK}; }
        .opt-correct   { border-color:#0E8345; background:#D4EDDA; }
        .opt-incorrect { border-color:#D1293D; background:#FDECEA; color:#D1293D; opacity:0.7; text-decoration:line-through; }
        .opt-dim       { opacity:0.35; }
        .expl { margin-top:14px; padding:11px 14px; background:rgba(217,154,43,0.08); border-left:4px solid ${GOLD}; border-radius:0 2px 2px 0; font-family:var(--font-sans); font-size:12px; line-height:1.65; color:${MID}; }
        .expl em { font-family:'Fraunces',Georgia,serif; font-style:italic; color:${DARK}; }
        .card-footer { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-top:2px solid ${BORDER}; }
        .prog-dots { display:flex; gap:5px; }
        .pdot { width:7px; height:7px; border-radius:50%; background:${BORDER_LIGHT}; }
        .pdot-done { background:${RUST}; }
        .pdot-current { background:#e8855f; outline:2px solid ${RUST}; outline-offset:1px; }
        .btn-next { font-size:11px; font-weight:500; letter-spacing:0.04em; padding:0 16px; min-height:34px; background:${DARK}; color:${WHITE}; border:none; border-radius:2px; cursor:pointer; font-family:var(--font-sans); }

        /* ── Grammar map section ── */
        .map-section { background:rgba(58,47,38,0.04); border-top:1px solid ${BORDER_LIGHT}; border-bottom:1px solid ${BORDER_LIGHT}; padding:56px 40px; }
        .sec-eyebrow { font-size:10px; font-weight:500; letter-spacing:0.12em; text-transform:uppercase; color:${RUST}; text-align:center; margin-bottom:10px; }
        .sec-title   { font-family:'Fraunces',Georgia,serif; font-size:26px; font-weight:600; letter-spacing:-0.015em; color:${DARK}; text-align:center; margin-bottom:8px; }
        .sec-sub     { font-size:13px; color:${MID}; text-align:center; max-width:460px; margin:0 auto 44px; line-height:1.7; }

        .gm-desktop { display:flex; align-items:flex-start; gap:0; max-width:960px; margin:0 auto; }
        .gm-mobile  { display:none; }

        .lvl-col  { flex-shrink:0; display:flex; flex-direction:column; align-items:stretch; width:140px; }
        .lvl-hdr-accessible { font-size:11px; font-weight:500; letter-spacing:0.06em; padding:5px 10px; border-radius:2px; text-align:center; margin-bottom:12px; align-self:center; min-width:70px; background:transparent; color:${DARK}; border:2px solid ${BORDER}; }
        .lvl-hdr-current    { font-size:11px; font-weight:500; letter-spacing:0.06em; padding:5px 10px; border-radius:2px; text-align:center; margin-bottom:12px; align-self:center; min-width:70px; background:${DARK}; color:${WHITE}; border:2px solid ${DARK}; }
        .lvl-hdr-locked     { font-size:11px; font-weight:500; letter-spacing:0.06em; padding:5px 10px; border-radius:2px; text-align:center; margin-bottom:12px; align-self:center; min-width:70px; background:transparent; color:${LIGHT}; border:2px solid ${BORDER_LIGHT}; opacity:0.7; }
        .lvl-sub  { font-size:10px; color:${LIGHT}; text-align:center; margin-bottom:14px; letter-spacing:0.04em; }
        .lvl-nodes { display:flex; flex-direction:column; gap:5px; align-items:stretch; }
        .gm-node { font-size:11px; padding:5px 9px; border-radius:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; border:2px solid; text-align:left; font-family:var(--font-sans); }
        .gm-node-grey   { background:transparent; border-color:${BORDER_LIGHT}; color:${LIGHT}; opacity:0.55; }
        .gm-node-open   { background:${WHITE};   border-color:${BORDER}; color:${DARK}; }
        .gm-node-good   { background:#D4EDDA;    border-color:#0E8345; color:#0E8345; }
        .gm-node-medium { background:#FEF3C7;    border-color:#D97706; color:#92400E; }
        .gm-node-poor   { background:#FDECEA;    border-color:#D1293D; color:#D1293D; }
        .gm-node-selected { background:${DARK}; border-color:${DARK}; color:${WHITE}; font-weight:500; }
        .lvl-arrow { width:24px; flex-shrink:0; display:flex; align-items:flex-start; justify-content:center; padding-top:28px; }

        /* mobile map tabs */
        .gm-tabs { display:flex; gap:6px; padding:10px 16px; border-bottom:2px solid ${BORDER}; overflow-x:auto; -webkit-overflow-scrolling:touch; background:${WHITE}; }
        .gm-tabs::-webkit-scrollbar { display:none; }
        .gm-tab { flex-shrink:0; padding:5px 14px; border-radius:2px; font-family:var(--font-sans); font-size:12px; border:2px solid ${BORDER}; background:transparent; color:${DARK}; cursor:pointer; }
        .gm-tab-active  { background:${DARK}; color:${WHITE}; border-color:${DARK}; font-weight:500; }
        .gm-tab-locked  { color:${LIGHT}; border-color:${BORDER_LIGHT}; opacity:0.6; }
        .gm-concept-list { background:${WHITE}; }
        .gm-row { display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid ${BORDER_LIGHT}; }
        .gm-row-selected { background:rgba(58,47,38,0.05); }
        .gm-row-greyed   { opacity:0.4; }
        .gm-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .gm-name { flex:1; font-size:14px; color:${DARK}; font-family:var(--font-sans); }
        .gm-row-selected .gm-name { font-weight:500; }

        /* map legend */
        .map-legend { display:flex; justify-content:center; gap:20px; margin-top:28px; flex-wrap:wrap; }
        .legend-item { display:flex; align-items:center; gap:6px; font-size:11px; color:${MID}; letter-spacing:0.02em; }
        .legend-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

        /* ── Vocabulary section ── */
        .vocab-section { border-bottom:1px solid ${BORDER_LIGHT}; }
        .vocab-inner   { display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:start; max-width:1100px; margin:0 auto; padding:64px 40px; }
        .vocab-card    { background:${WHITE}; border:2px solid ${BORDER}; border-radius:3px; overflow:hidden; box-shadow:0 2px 12px rgba(26,20,16,0.08); }
        .vocab-word-hdr { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:2px solid ${BORDER}; }
        .vocab-word-display { font-family:'Fraunces',Georgia,serif; font-size:22px; font-weight:600; color:${DARK}; letter-spacing:-0.01em; }
        .vocab-badges { display:flex; align-items:center; gap:6px; }
        .pos-tag { font-size:10px; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:3px 8px; border-radius:2px; background:transparent; color:${MID}; border:2px solid ${BORDER}; }
        .vocab-body { padding:20px; }
        .vocab-prompt { font-size:10px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:${LIGHT}; margin-bottom:14px; }
        .vocab-opts { display:flex; flex-direction:column; gap:7px; }
        .vocab-opt { width:100%; text-align:left; padding:10px 14px; border-radius:2px; border:2px solid ${BORDER}; background:transparent; font-family:'Fraunces',Georgia,serif; font-size:13.5px; color:${DARK}; cursor:default; }
        .vocab-opt-correct   { border-color:#0E8345; background:#D4EDDA; color:#0E8345; font-weight:500; }
        .vocab-opt-incorrect { border-color:#D1293D; background:#FDECEA; color:#D1293D; opacity:0.7; text-decoration:line-through; }
        .vocab-opt-dim       { opacity:0.3; }

        /* ── How it works ── */
        .how-wrap { border-bottom:1px solid ${BORDER_LIGHT}; }
        .how-section { padding:64px 40px; max-width:1100px; margin:0 auto; }
        .steps { display:grid; grid-template-columns:1fr 1fr 1fr; gap:40px; margin-top:44px; }
        .step-num   { width:26px; height:26px; border-radius:2px; background:${RUST}; color:${WHITE}; font-size:11px; font-weight:500; display:flex; align-items:center; justify-content:center; margin-bottom:14px; letter-spacing:0.04em; }
        .step-title { font-family:'Fraunces',Georgia,serif; font-size:15px; font-weight:600; letter-spacing:-0.01em; color:${DARK}; margin-bottom:6px; }
        .step-desc  { font-size:13px; color:${MID}; line-height:1.7; margin-bottom:14px; }
        .step-detail { padding:12px 14px; background:${WHITE}; border:2px solid ${BORDER}; border-radius:2px; font-size:12px; color:${MID}; line-height:1.55; }
        .step-detail strong { color:${DARK}; font-weight:500; }

        /* ── Proof ── */
        .proof-section { background:rgba(58,47,38,0.04); border-top:1px solid ${BORDER_LIGHT}; border-bottom:1px solid ${BORDER_LIGHT}; padding:48px 40px; }
        .proof-grid  { display:grid; grid-template-columns:repeat(3,1fr); max-width:960px; margin:0 auto; }
        .proof-item  { padding:8px 36px; border-right:1px solid ${BORDER_LIGHT}; }
        .proof-item:first-child { padding-left:0; }
        .proof-item:last-child  { border-right:none; }
        .proof-val   { font-family:'Fraunces',Georgia,serif; font-size:34px; font-weight:600; letter-spacing:-0.03em; color:${DARK}; margin-bottom:4px; line-height:1; }
        .proof-label { font-size:12px; font-weight:500; color:${DARK}; margin-bottom:4px; letter-spacing:0.02em; }
        .proof-sub   { font-size:12px; color:${LIGHT}; line-height:1.55; }

        /* ── Final CTA ── */
        .final-cta  { padding:72px 40px; max-width:520px; margin:0 auto; text-align:center; }
        .final-cta h2 { font-family:'Fraunces',Georgia,serif; font-size:28px; font-weight:600; letter-spacing:-0.02em; color:${DARK}; margin-bottom:12px; }
        .final-cta p  { font-size:13px; color:${MID}; line-height:1.75; margin-bottom:28px; }
        .final-btns { display:flex; flex-direction:column; gap:8px; max-width:320px; margin:0 auto; }

        /* ── Footer ── */
        .landing-footer { border-top:1px solid ${BORDER_LIGHT}; padding:18px 40px; text-align:center; font-size:11px; color:${LIGHT}; letter-spacing:0.04em; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .landing-nav { padding:14px 20px; }
          .landing-nav-cta { display:none; }
          .landing-hero { grid-template-columns:1fr; gap:36px; padding:40px 20px 48px; }
          .landing-h1 { font-size:28px; }
          .landing-sub { font-size:13px; max-width:100%; }
          .cta-stack { max-width:100%; }
          .map-section { padding:44px 0; }
          .sec-eyebrow,.sec-title,.sec-sub { padding:0 20px; }
          .sec-sub { margin-bottom:0; }
          .gm-desktop { display:none !important; }
          .gm-mobile  { display:block !important; }
          .map-legend { padding:0 20px; margin-top:20px; }
          .vocab-inner { grid-template-columns:1fr; gap:32px; padding:44px 20px; }
          .how-section { padding:44px 20px; }
          .sec-title  { font-size:22px; }
          .steps { grid-template-columns:1fr; gap:32px; }
          .proof-section { padding:36px 20px; }
          .proof-grid { grid-template-columns:1fr; }
          .proof-item { padding:16px 0; border-right:none; border-bottom:1px solid ${BORDER_LIGHT}; }
          .proof-item:last-child { border-bottom:none; }
          .proof-val  { font-size:28px; }
          .final-cta  { padding:52px 20px; }
          .final-cta h2 { font-size:22px; }
          .final-btns { max-width:100%; }
          .landing-footer { padding:18px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav className="landing-nav">
        <a className="landing-logo" href="/">Lagram</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {user === null && (
            <button className="landing-nav-signin" onClick={signInWithGoogle}>Sign in →</button>
          )}
          <button
            className="landing-nav-cta"
            onClick={() => router.push(hasLevel ? '/session' : '/assess')}
          >
            {hasLevel ? 'Continue to session' : 'Check my French level'}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ borderBottom: `1px solid ${BORDER_LIGHT}` }}>
        <div className="landing-hero">

          {/* Left: copy */}
          <div>
            <div className="cefr-row">
              {['A1','A2','B1','B2','C1','C2'].map(l => (
                <span key={l} className={`cefr-badge${l === 'B1' ? ' cefr-badge-active' : ''}`}>{l}</span>
              ))}
            </div>

            <h1 className="landing-h1">Master every corner of French grammar.</h1>

            <p className="landing-sub">
              Get placed at your CEFR level with a 7-question assessment.
              Practice one grammar concept per day. Watch your knowledge map
              light up — concept by concept, A1 to C2.
            </p>

            <div className="cta-stack">
              <button
                className="btn-primary-land"
                onClick={() => router.push(user && hasLevel ? '/assess?retake=true' : '/assess')}
              >
                Check my French level →
              </button>
              <button className="btn-ghost-land" onClick={signInWithGoogle}>
                <GoogleIcon size={15} />
                Continue with Google
              </button>
            </div>

            <div className="cred-row">
              <div className="cred-item"><div className="cred-dot" />CEFR-aligned A1–C2</div>
              <div className="cred-item"><div className="cred-dot" />DELF / DALF scope</div>
            </div>
          </div>

          {/* Right: hardcoded session card demo */}
          <div>
            <div className="session-card">

              <div className="card-hdr">
                <div>
                  <div className="concept-eyebrow">Today's concept</div>
                  <div className="concept-name">Le subjonctif présent</div>
                </div>
                <span className="level-bdg">B1</span>
              </div>

              <div className="rule-callout">
                <div className="rule-label">Rule</div>
                Use <em>le subjonctif</em> after expressions of necessity, doubt, or emotion —
                especially after <em>il faut que, bien que,</em> and <em>vouloir que.</em>{' '}
                Each clause must have a different subject.
              </div>

              <div className="card-body">
                <div className="q-label">Question 4 of 7</div>
                <div className="q-text">
                  Il faut que tu <span className="blank" /> tes devoirs avant de sortir.
                </div>
                <div className="opts">
                  <div className="opt opt-incorrect">feras</div>
                  <div className="opt opt-correct">fasses</div>
                  <div className="opt opt-dim">as fait</div>
                  <div className="opt opt-dim">ferait</div>
                </div>
                <div className="expl">
                  <em>Il faut que</em> always triggers the subjunctive.{' '}
                  <em>Feras</em> is futur simple — ruled out by the <em>il faut que</em> cue.{' '}
                  <em>Ferait</em> is conditionnel, also indicative.
                </div>
              </div>

              <div className="card-footer">
                <div className="prog-dots">
                  {[0,1,2,3,4,5,6].map(i => (
                    <div key={i} className={`pdot${i < 3 ? ' pdot-done' : i === 3 ? ' pdot-current' : ''}`} />
                  ))}
                </div>
                <button className="btn-next">Next →</button>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* GRAMMAR MAP */}
      <div className="map-section">
        <div className="sec-eyebrow">Spatial progress</div>
        <div className="sec-title">Your grammar map — 78 concepts, A1 to C2.</div>
        <div className="sec-sub">
          Every French grammar concept is named, placed, and trackable.
          Each node you complete lights up. You always know where you are and what's ahead.
        </div>

        {/* Desktop map */}
        <div className="gm-desktop">
          <DesktopLevelCol type="accessible" label="A1" sub="14 concepts" nodes={[
            ['good','Subject pronouns'],['good','être / avoir'],['good','-er verbs'],
            ['good','Articles'],['medium','Négation'],['good','Questions'],
            ['good','Nombres'],['poor','Impératif'],['good','+6 more ✓',true],
          ]} />
          <LvlArrow color={BORDER_LIGHT} />
          <DesktopLevelCol type="accessible" label="A2" sub="15 concepts" nodes={[
            ['good','Passé composé'],['good','Imparfait intro'],['good','Futur proche'],
            ['medium','Verbes irréguliers'],['good','Verbes réfléchis'],['poor','Pronoms COD/COI'],
            ['good','Comparatif'],['open','Démonstratifs'],['good','+7 more ✓',true],
          ]} />
          <LvlArrow color={DARK} />
          <DesktopLevelCol type="current" label="B1 · now" sub="15 concepts" subDark nodes={[
            ['good','Imparfait vs PC'],['good','Futur simple'],['good','Pronoms relatifs'],
            ['medium','Conditionnel'],['selected','Subjonctif présent'],
            ['open','Pronoms y / en'],['open','Superlatif'],['grey','+8 locked',true],
          ]} />
          <LvlArrow color={BORDER_LIGHT} />
          <DesktopLevelCol type="locked" label="B2" sub="14 concepts" nodes={[
            ['grey','Plus-que-parfait'],['grey','Futur antérieur'],
            ['grey','Voix passive'],['grey','Si clauses 2–3'],['grey','+10 locked',true],
          ]} />
          <LvlArrow color={BORDER_LIGHT} />
          <div className="lvl-col" style={{ width: 130 }}>
            <div className="lvl-hdr-locked" style={{ marginBottom: 8 }}>C1</div>
            <div className="lvl-sub">12 concepts</div>
            <div className="lvl-nodes" style={{ marginBottom: 20 }}>
              {[['grey','Subjonctif passé'],['grey','Passé simple'],['grey','+10 locked',true]].map(([s,l,sm]) => (
                <div key={l} className={`gm-node gm-node-${s}`} style={sm ? { fontSize: 10 } : {}}>{l}</div>
              ))}
            </div>
            <div className="lvl-hdr-locked" style={{ marginBottom: 8 }}>C2</div>
            <div className="lvl-sub">8 concepts</div>
            <div className="lvl-nodes">
              {[['grey','Styles littéraires'],['grey','+7 locked',true]].map(([s,l,sm]) => (
                <div key={l} className={`gm-node gm-node-${s}`} style={sm ? { fontSize: 10 } : {}}>{l}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile map */}
        <div className="gm-mobile">
          <div className="gm-tabs">
            {['A1','A2','B1','B2','C1','C2'].map(lvl => (
              <button
                key={lvl}
                className={`gm-tab${mapTab === lvl ? ' gm-tab-active' : ''}${['B2','C1','C2'].includes(lvl) ? ' gm-tab-locked' : ''}`}
                onClick={() => setMapTab(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          <div className="gm-concept-list">
            {MOBILE_LEVELS[mapTab].map((row, i) => (
              <div key={i} className={`gm-row${row.selected ? ' gm-row-selected' : ''}${row.greyed ? ' gm-row-greyed' : ''}`}>
                <div className="gm-dot" style={DOT_STYLE[row.dot] ?? DOT_STYLE.empty} />
                <span className="gm-name" style={row.muted ? { color: LIGHT } : {}}>{row.label}</span>
                {!row.greyed && !row.muted && CHEVRON(row.selected ? DARK : LIGHT)}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="map-legend">
          {[
            { dot: { background: '#0E8345' },                                        label: 'good (≥70%)' },
            { dot: { background: '#D97706' },                                        label: 'needs work' },
            { dot: { background: '#D1293D' },                                        label: 'struggling' },
            { dot: { border: `1.5px solid ${BORDER}`, background: 'transparent' },  label: 'not practiced' },
            { dot: { background: BORDER_LIGHT },                                     label: 'locked' },
          ].map(({ dot, label }) => (
            <div key={label} className="legend-item">
              <div className="legend-dot" style={dot} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* VOCABULARY */}
      <div className="vocab-section">
        <div className="vocab-inner">

          {/* Left: copy */}
          <div>
            <div className="sec-eyebrow" style={{ textAlign:'left', marginBottom:10 }}>Vocabulary</div>
            <h2 style={{ fontFamily:"'Fraunces',Georgia,serif", fontSize:26, fontWeight:600, letterSpacing:'-0.015em', color:DARK, marginBottom:10, lineHeight:1.2 }}>
              Grammar-critical words,<br />A1 to C2.
            </h2>
            <p style={{ fontSize:13, color:MID, lineHeight:1.75, marginBottom:28, maxWidth:380 }}>
              Verbs, adjectives, and adverbs — the words that determine whether
              your sentences are grammatically right or wrong. 7 words per session,
              served least-practised first. POS-matched distractors so you can't
              guess by part of speech.
            </p>
          </div>

          {/* Right: hardcoded vocab card */}
          <div className="vocab-card">

            <div className="vocab-word-hdr">
              <div>
                <div className="concept-eyebrow" style={{ marginBottom:4 }}>What does this word mean?</div>
                <div className="vocab-word-display">paraître</div>
              </div>
              <div className="vocab-badges">
                <span className="pos-tag">verb</span>
                <span className="level-bdg">B1</span>
              </div>
            </div>

            <div className="vocab-body">
              <div className="vocab-prompt">Question 4 of 7</div>
              <div className="vocab-opts">
                <div className="vocab-opt vocab-opt-incorrect">to accomplish / to carry out</div>
                <div className="vocab-opt vocab-opt-correct">to seem / to appear</div>
                <div className="vocab-opt vocab-opt-dim">to promise</div>
                <div className="vocab-opt vocab-opt-dim">to suppose / to assume</div>
              </div>
            </div>

            <div className="card-footer">
              <div className="prog-dots">
                {[0,1,2,3,4,5,6].map(i => (
                  <div key={i} className={`pdot${i < 3 ? ' pdot-done' : i === 3 ? ' pdot-current' : ''}`} />
                ))}
              </div>
              <button className="btn-next">Next →</button>
            </div>

          </div>

        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="how-wrap">
        <div className="how-section">
          <div className="sec-eyebrow" style={{ textAlign:'left' }}>How it works</div>
          <div className="sec-title" style={{ textAlign: 'left' }}>Three steps to systematic fluency.</div>
          <div className="steps">
            <div>
              <div className="step-num">1</div>
              <div className="step-title">Get placed at your level</div>
              <div className="step-desc">
                Answer 7 questions spanning A1 to C1. Your accuracy pattern places you
                at the right CEFR level — no questionnaire, no self-reporting.
              </div>
              <div className="step-detail">
                <strong>~5 minutes.</strong> Questions ramp in difficulty so the test
                finds your exact ceiling, not just your floor.
              </div>
            </div>
            <div>
              <div className="step-num">2</div>
              <div className="step-title">Practice one concept per day</div>
              <div className="step-desc">
                Each session: a visual lesson followed by 7 exercises, all scoped to one
                grammar concept. Fresh questions every time, seeded from the lesson you just read.
              </div>
              <div className="step-detail">
                <strong>Wrong answers come with explanations</strong> that name exactly
                why each distractor is wrong — not just "incorrect."
              </div>
            </div>
            <div>
              <div className="step-num">3</div>
              <div className="step-title">Watch your map light up</div>
              <div className="step-desc">
                Your grammar map tracks mastery across all 78 concepts. As you progress,
                nodes change colour. Level advancement requires mastery across the full level.
              </div>
              <div className="step-detail">
                <strong>Promotion gate:</strong> ≥70% overall accuracy + no concept
                below 50% + all concepts attempted at least once.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PROOF POINTS */}
      <div className="proof-section">
        <div className="proof-grid">
          <div className="proof-item">
            <div className="proof-val">78</div>
            <div className="proof-label">Grammar concepts</div>
            <div className="proof-sub">A1 through C2 — MECE taxonomy. Every concept named, placed, trackable.</div>
          </div>
          <div className="proof-item">
            <div className="proof-val">7</div>
            <div className="proof-label">Exercises per session</div>
            <div className="proof-sub">Seeded from the lesson you just read — targeted, never generic.</div>
          </div>
          <div className="proof-item">
            <div className="proof-val">TCF</div>
            <div className="proof-label">Score-based level tracking</div>
            <div className="proof-sub">Progress on the real Test de Connaissance du Français scale — externally interpretable.</div>
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="final-cta">
        <h2>Know exactly where your French stands.</h2>
        <p>
          A 7-question assessment places you at your CEFR level.
          Then you practice — one concept at a time, every day.
        </p>
        <div className="final-btns">
          <button
            className="btn-primary-land"
            onClick={() => router.push(user && hasLevel ? '/assess?retake=true' : '/assess')}
          >
            Check my French level →
          </button>
          <button className="btn-ghost-land" onClick={signInWithGoogle}>
            <GoogleIcon size={15} />
            Continue with Google
          </button>
        </div>
      </div>

      <footer className="landing-footer">
        French grammar A1–C2 · CEFR aligned · DELF / DALF scope · TCF scoring
      </footer>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DesktopLevelCol({ type, label, sub, subDark, nodes }) {
  const hdrClass = `lvl-hdr-${type}`
  return (
    <div className="lvl-col">
      <div className={hdrClass}>{label}</div>
      <div className="lvl-sub" style={subDark ? { color: DARK } : {}}>{sub}</div>
      <div className="lvl-nodes">
        {nodes.map(([state, text, small]) => (
          <div key={text} className={`gm-node gm-node-${state}`} style={small ? { fontSize: 10 } : {}}>
            {text}
          </div>
        ))}
      </div>
    </div>
  )
}

function LvlArrow({ color }) {
  return (
    <div className="lvl-arrow">
      <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
        <path d="M1 7h12M9 3l4 4-4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
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
