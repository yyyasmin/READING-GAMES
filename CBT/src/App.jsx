import React, { useMemo, useState, useCallback, useEffect, useRef, useId } from 'react'
import {
  ROUNDS,
  STORY_TITLE,
  TAGLINE,
  INTERCEPTOR_LABEL,
  ROUND_TIME_MS,
  normalizeThought,
  isOwnInterceptorWording
} from './cbtRounds.js'
import {
  resumeBattleAudio,
  playInterceptorWhoosh,
  playExplosionSuccess,
  playExplosionFail,
  playFallTension
} from './cbtBattleSfx.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function feedbackClass(feedback) {
  if (!feedback) return ''
  if (feedback.includes('יירוט מוצלח')) return 'cbt-feedback-good'
  if (feedback.includes('פג הזמן')) return 'cbt-feedback-timeout'
  return 'cbt-feedback-bad'
}

export default function App() {
  const rid = useId().replace(/:/g, '')
  const successExpGradId = `cbt-sxg-${rid}`
  const failExpGradId = `cbt-fxg-${rid}`
  const ironMetalId = `cbt-im-${rid}`
  const ironGreenId = `cbt-ig-${rid}`
  const [phase, setPhase] = useState('welcome')
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [interceptFlash, setInterceptFlash] = useState(false)
  const [wrongShake, setWrongShake] = useState(false)
  const [roundBlocking, setRoundBlocking] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [interceptCrash, setInterceptCrash] = useState(false)
  const [customInterceptorText, setCustomInterceptorText] = useState('')

  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { email: '', subject: '', age_group: '' }
    }
    const p = new URLSearchParams(window.location.search)
    return {
      email: (p.get('email') || '').trim(),
      subject: (p.get('subject') || '').trim(),
      age_group: (p.get('age_group') || '').trim()
    }
  }, [])

  const timeoutFiredRef = useRef(false)
  const roundIndexRef = useRef(roundIndex)
  roundIndexRef.current = roundIndex

  const current = ROUNDS[roundIndex]
  const choices = useMemo(() => {
    if (!current) return []
    const others = ROUNDS.filter((r) => r.id !== current.id).map((r) => r.balancedThought)
    const picked = shuffle(others).slice(0, 2)
    return shuffle([current.balancedThought, ...picked])
  }, [current])

  const advanceAfterDelay = useCallback((delayMs) => {
    setTimeout(() => {
      const idx = roundIndexRef.current
      if (idx >= ROUNDS.length - 1) {
        setPhase('done')
        setFeedback('')
      } else {
        setRoundIndex((i) => i + 1)
        setFeedback('')
      }
      setRoundBlocking(false)
      setInterceptCrash(false)
      setCustomInterceptorText('')
      timeoutFiredRef.current = false
    }, delayMs)
  }, [])

  const handleTimeout = useCallback(() => {
    if (timeoutFiredRef.current) return
    timeoutFiredRef.current = true
    setRoundBlocking(true)
    setScore((s) => s - 1)
    setFeedback('פג הזמן – המיירט נפל והתפוצץ. איבדת נקודה.')
    setInterceptCrash(true)
    setWrongShake(true)
    setTimeout(() => setWrongShake(false), 500)
    advanceAfterDelay(2600)
  }, [advanceAfterDelay])

  useEffect(() => {
    if (!interceptFlash) return undefined
    playInterceptorWhoosh()
    const t = window.setTimeout(() => playExplosionSuccess(), 110)
    return () => window.clearTimeout(t)
  }, [interceptFlash])

  useEffect(() => {
    if (!interceptCrash) return undefined
    playFallTension()
    const t = window.setTimeout(() => playExplosionFail(), 400)
    return () => window.clearTimeout(t)
  }, [interceptCrash])

  useEffect(() => {
    if (phase !== 'play' || !current || roundBlocking) return undefined

    const deadline = Date.now() + ROUND_TIME_MS
    timeoutFiredRef.current = false
    setSecondsLeft(Math.ceil(ROUND_TIME_MS / 1000))

    const id = setInterval(() => {
      const ms = deadline - Date.now()
      const sec = Math.max(0, Math.ceil(ms / 1000))
      setSecondsLeft(sec)
      if (ms <= 0) {
        clearInterval(id)
        handleTimeout()
      }
    }, 200)

    return () => clearInterval(id)
  }, [phase, current?.id, roundIndex, roundBlocking, handleTimeout])

  const startGame = () => {
    setRoundIndex(0)
    setScore(0)
    setFeedback('')
    setRoundBlocking(false)
    setInterceptCrash(false)
    setCustomInterceptorText('')
    timeoutFiredRef.current = false
    const em = urlParams.email
    if (em && typeof window !== 'undefined') {
      const key = 'cbt_game_login_email_logged'
      if (sessionStorage.getItem(key) !== em) {
        fetch('/api/game-login-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: em,
            game_type: 'cbt_war',
            subject: urlParams.subject || undefined,
            age_group: urlParams.age_group || undefined
          })
        })
          .then((res) => {
            if (res.ok) sessionStorage.setItem(key, em)
          })
          .catch(() => {})
      }
    }
    resumeBattleAudio()
    setPhase('play')
  }

  const onPick = useCallback(
    (text) => {
      if (!current || phase !== 'play' || roundBlocking) return
      if (text === current.balancedThought) {
        timeoutFiredRef.current = true
        setRoundBlocking(true)
        setScore((s) => s + 1)
        setFeedback('יירוט מוצלח! +1 נקודה.')
        setInterceptFlash(true)
        setTimeout(() => setInterceptFlash(false), 1500)
        advanceAfterDelay(1900)
      } else {
        setFeedback('לא מתאים לטיל הזה. נסה מיירט אחר – אין כאן ניחוש אקראי, צריך התאמה.')
        setWrongShake(true)
        setTimeout(() => setWrongShake(false), 500)
      }
    },
    [current, phase, roundBlocking, advanceAfterDelay]
  )

  const onFireCustom = useCallback(async () => {
    if (!current || phase !== 'play' || roundBlocking) return
    const typed = normalizeThought(customInterceptorText)
    if (typed.length === 0) {
      setFeedback('חובה לכתוב מחשבה חלופית משלך על המיירט לפני היירוט.')
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
      return
    }
    const words = typed.split(/\s+/).filter(Boolean)
    if (words.length < 3) {
      setFeedback('כתוב לפחות שלוש מילים – משפט מלא של מחשבה מחליפה מקורית שלך, לא עותק.')
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
      return
    }
    const hostileN = normalizeThought(current.hostileThought)
    const choiceNorms = choices.map((t) => normalizeThought(t))
    if (!isOwnInterceptorWording(typed, hostileN, choiceNorms)) {
      if (typed === hostileN) {
        setFeedback(
          'זה אותו ניסוח כמו על הטיל. המצא מחשבה **מחליפה משלך** – לא להעתיק את המחשבה הלא מועילה.'
        )
      } else {
        setFeedback(
          'לא להעתיק ניסוח מאחד משלושת המשגרים. כתוב במילים שלך מחשבה מחליפה שמתאימה לרוח של יירוט הטיל הזה.'
        )
      }
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
      return
    }
    const em = urlParams.email
    if (!em) {
      setFeedback(
        'חסר אימייל בכתובת. הזן אימייל בתפריט READING (שדה «אימייל») ובחר שוב את משחק «מלחמה», כדי לשמור מיירט עצמי ולזכות בנקודות.'
      )
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
      return
    }

    setRoundBlocking(true)
    timeoutFiredRef.current = true
    try {
      const res = await fetch('/api/cbt-custom-interceptor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          custom_text: typed,
          round_id: current.id,
          subject: urlParams.subject || undefined,
          age_group: urlParams.age_group || undefined
        })
      })
      let payload = {}
      try {
        payload = await res.json()
      } catch (_) {
        payload = {}
      }
      if (!res.ok) {
        setRoundBlocking(false)
        timeoutFiredRef.current = false
        const errMsg =
          typeof payload.error === 'string' ? payload.error : `שמירה נכשלה (${res.status})`
        setFeedback(errMsg)
        setWrongShake(true)
        setTimeout(() => setWrongShake(false), 500)
        return
      }
      setScore((s) => s + 2)
      setFeedback('יירוט מוצלח! מיירט בייצור עצמי (המחשבה שלך) – +2 נקודות (נשמר בשרת).')
      setInterceptFlash(true)
      setTimeout(() => setInterceptFlash(false), 1500)
      advanceAfterDelay(1900)
    } catch (_) {
      setRoundBlocking(false)
      timeoutFiredRef.current = false
      setFeedback('שגיאת רשת – לא נשמרו הנתונים לשרת.')
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
    }
  }, [current, phase, roundBlocking, customInterceptorText, advanceAfterDelay, urlParams, choices])

  return (
    <div className="cbt-app">
      <header className="cbt-header">
        <h1>{STORY_TITLE}</h1>
        <p className="cbt-tagline">{TAGLINE}</p>
      </header>

      {phase === 'welcome' && (
        <section className="cbt-panel">
          <h2>איך משחקים?</h2>
          <ul className="cbt-rules">
            <li>זו סימולציה בסגנון מתח אזורי: על גוף הטיל כתובה <strong>מחשבה לא מועילה</strong>.</li>
            <li>לכל סבב יש <strong>זמן מוגבל</strong> – אם לא תבחר מיירט בזמן, המיירט נופל ומתפוצץ ו<strong>מאבדים נקודה</strong>.</li>
            <li>יירוט נכון ממשגר מוכן = <strong>+1 נקודה</strong>.</li>
            <li>
              <strong>מיירט בייצור עצמי:</strong> כתוב <strong>מחשבה מחליפה במילים שלך</strong> (לא להעתיק מהטיל ולא מאחד המשגרים), לפחות שלוש מילים, ולחץ «יירה מיירט» –{' '}
              <strong>+2 נקודות</strong> (נשמר בשרת).
            </li>
            <li>שלושה משגרים – כיפת ברזל / חץ – עם מחשבות חלופיות; בחר את ההתאמה לתוכן הטיל.</li>
          </ul>
          <p className="cbt-note">
            משחק חשיבה לנוער; אם משהו מעלה אצלך מצוקה – דבר עם מבוגר אמין או עם יועצת בבית הספר.
          </p>
          <button type="button" className="cbt-primary" onClick={startGame}>
            התחלת משחק
          </button>
        </section>
      )}

      {phase === 'play' && current && (
        <section
          key={`${current.id}-${roundIndex}`}
          className={`cbt-play ${interceptFlash ? 'cbt-intercept-hit' : ''} ${wrongShake ? 'cbt-shake' : ''} ${interceptCrash ? 'cbt-intercept-crash' : ''}`}
        >
          <div className="cbt-progress">
            <span className="cbt-score">ניקוד: {score}</span>
            {' · '}
            סבב {roundIndex + 1} מתוך {ROUNDS.length}
            {' · '}
            <span className={secondsLeft <= 5 && secondsLeft > 0 ? 'cbt-time-urgent' : ''}>
              נותרו {secondsLeft} שניות
            </span>
          </div>

          <div className="cbt-timer-bar" aria-hidden>
            <div
              className="cbt-timer-bar-fill"
              style={{
                width: `${Math.min(100, Math.max(0, (secondsLeft / (ROUND_TIME_MS / 1000)) * 100))}%`
              }}
            />
          </div>

          <div className="cbt-sky">
            <div className="cbt-sky-stars" aria-hidden />
            <div
              className="cbt-missile"
              style={{ '--missile-color': current.missileColor, '--missile-accent': current.missileColor }}
              role="img"
              aria-label={`טיל מחשבה: ${current.hostileThought}`}
            >
              <div className="cbt-missile-visual" aria-hidden>
                <svg className="cbt-rocket-svg" viewBox="0 0 72 200" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <linearGradient id="cbtRocketBody" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#64748b" />
                      <stop offset="50%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="cbtRocketNose" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--missile-accent, #b91c1c)" />
                      <stop offset="100%" stopColor="#7f1d1d" />
                    </linearGradient>
                    <radialGradient id="cbtFlameOuter" cx="50%" cy="0%" r="100%">
                      <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                      <stop offset="45%" stopColor="#f97316" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="cbtFlameInner" cx="50%" cy="0%" r="100%">
                      <stop offset="0%" stopColor="#fff" stopOpacity="1" />
                      <stop offset="40%" stopColor="#fde047" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <g className="cbt-rocket-group">
                    <path d="M36 6 L52 38 L48 42 L24 42 L20 38 Z" fill="url(#cbtRocketNose)" />
                    <rect x="22" y="40" width="28" height="72" rx="3" fill="url(#cbtRocketBody)" />
                    <path d="M22 100 L8 118 L22 112 Z" fill="#334155" />
                    <path d="M50 100 L64 118 L50 112 Z" fill="#334155" />
                    <path d="M26 112 L46 112 L42 124 L30 124 Z" fill="#1e293b" />
                    <ellipse className="cbt-rocket-flame-outer" cx="36" cy="138" rx="18" ry="34" fill="url(#cbtFlameOuter)" />
                    <ellipse className="cbt-rocket-flame-inner" cx="36" cy="132" rx="10" ry="22" fill="url(#cbtFlameInner)" />
                  </g>
                </svg>
                <div className="cbt-rocket-trail" />
              </div>
              <div className="cbt-missile-fuselage">
                <span className="cbt-missile-badge">טיל · מחשבה לא מועילה</span>
                <p className="cbt-missile-body-text">{current.hostileThought}</p>
              </div>
            </div>
            <div className="cbt-dome-hint" aria-hidden>
              <span className="cbt-dome-ico" aria-hidden>
                <svg className="cbt-dome-svg" viewBox="0 0 64 40" aria-hidden>
                  <path
                    d="M4 32 Q32 6 60 32"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                  <path d="M8 32 L56 32" stroke="#0ea5e9" strokeWidth="2" />
                </svg>
              </span>
              מיירטים: כיפת ברזל / חץ – התאם מחשבה חלופית לטיל
            </div>
          </div>

          {interceptFlash && (
            <div className="cbt-battle-fx cbt-battle-fx--success" aria-hidden>
              <div className="cbt-iron-dome-launch">
                <div className="cbt-beam-slot">
                  <div className="cbt-interceptor-beam" />
                  <div className="cbt-interceptor-bolt" />
                </div>
                <svg
                  className="cbt-iron-dome-launcher-svg"
                  viewBox="0 0 220 118"
                  preserveAspectRatio="xMidYMax meet"
                  aria-hidden
                >
                  <defs>
                    <radialGradient id="cbtRadarDome" cx="50%" cy="85%" r="75%">
                      <stop offset="0%" stopColor="#86efac" />
                      <stop offset="45%" stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#166534" />
                    </radialGradient>
                    <linearGradient id="cbtTruckBed" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4a5c3e" />
                      <stop offset="55%" stopColor="#2f3d24" />
                      <stop offset="100%" stopColor="#1a2214" />
                    </linearGradient>
                    <linearGradient id="cbtLauncherMetal" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#9ca3af" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                  </defs>
                  <rect x="4" y="96" width="212" height="20" rx="4" fill="url(#cbtTruckBed)" stroke="#243018" strokeWidth="1" />
                  <rect x="24" y="90" width="172" height="8" rx="2" fill="#35442c" stroke="#2a3622" strokeWidth="0.6" />
                  <path
                    d="M 50 92 A 60 60 0 0 1 170 92 Z"
                    fill="url(#cbtRadarDome)"
                    stroke="#14532d"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M 68 88 A 42 42 0 0 1 152 88"
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <g className="cbt-dome-sweep-arm">
                    <line
                      x1="110"
                      y1="48"
                      x2="168"
                      y2="52"
                      stroke="rgba(220,252,231,0.92)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <polygon
                      points="110,48 168,52 162,58"
                      fill="rgba(134,239,172,0.28)"
                      stroke="none"
                    />
                  </g>
                  <g transform="translate(118, 88) rotate(-42)">
                    <rect x="-44" y="-5" width="88" height="14" rx="2" fill="#3d4a2e" stroke="#2a3320" strokeWidth="1" />
                    <rect x="-36" y="-46" width="10" height="43" rx="1.5" fill="url(#cbtLauncherMetal)" stroke="#475569" strokeWidth="0.75" />
                    <rect x="-22" y="-46" width="10" height="43" rx="1.5" fill="url(#cbtLauncherMetal)" stroke="#475569" strokeWidth="0.75" />
                    <rect x="-8" y="-46" width="10" height="43" rx="1.5" fill="url(#cbtLauncherMetal)" stroke="#475569" strokeWidth="0.75" />
                    <rect x="6" y="-46" width="10" height="43" rx="1.5" fill="url(#cbtLauncherMetal)" stroke="#475569" strokeWidth="0.75" />
                    <rect x="-40" y="-52" width="80" height="7" rx="1.5" fill="#525c40" />
                    <circle className="cbt-launcher-muzzle-glow" cx="-31" cy="-50" r="3.2" fill="#facc15" />
                  </g>
                  <text
                    x="110"
                    y="110"
                    textAnchor="middle"
                    fill="#c8d4b0"
                    fontSize="9"
                    fontFamily="Heebo, sans-serif"
                    fontWeight="700"
                  >
                    כיפת ברזל
                  </text>
                </svg>
              </div>
              <div className="cbt-exp-white-flash" />
              <div className="cbt-exp-core-wrap">
                <svg
                  className="cbt-exp-fireball"
                  viewBox="0 0 200 200"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  <defs>
                    <radialGradient id={successExpGradId} cx="50%" cy="45%" r="55%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="12%" stopColor="#fef9c3" stopOpacity="1" />
                      <stop offset="35%" stopColor="#facc15" stopOpacity="1" />
                      <stop offset="58%" stopColor="#f97316" stopOpacity="0.95" />
                      <stop offset="82%" stopColor="#dc2626" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="100" cy="100" r="92" fill={`url(#${successExpGradId})`} />
                </svg>
              </div>
              <div className="cbt-exp-shockwave cbt-exp-shockwave--ok" />
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className="cbt-exp-spark cbt-exp-spark--ok" style={{ '--cbt-spark': i }} />
              ))}
              <div className="cbt-exp-smoke-ring" />
            </div>
          )}

          {interceptCrash && (
            <div className="cbt-crash-overlay" aria-live="assertive">
              <div className="cbt-crash-fx" aria-hidden>
                <div className="cbt-crash-missile-fall">
                  <svg
                    className="cbt-interceptor-fail-svg"
                    viewBox="0 0 48 120"
                    aria-hidden
                  >
                    <path
                      d="M24 4 L34 28 L38 72 L32 88 L16 88 L10 72 L14 28 Z"
                      fill="url(#cbtFailInt)"
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                    <defs>
                      <linearGradient id="cbtFailInt" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#cbd5e1" />
                        <stop offset="100%" stopColor="#475569" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="cbt-exp-white-flash cbt-exp-white-flash--fail" />
                <div className="cbt-crash-fire-wrap">
                  <svg
                    className="cbt-exp-fireball cbt-exp-fireball--fail"
                    viewBox="0 0 200 200"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden
                  >
                    <defs>
                      <radialGradient id={failExpGradId} cx="50%" cy="50%" r="55%">
                        <stop offset="0%" stopColor="#fecaca" stopOpacity="1" />
                        <stop offset="25%" stopColor="#f97316" stopOpacity="1" />
                        <stop offset="55%" stopColor="#991b1b" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#1c1917" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <circle cx="100" cy="100" r="95" fill={`url(#${failExpGradId})`} />
                  </svg>
                </div>
                <div className="cbt-exp-shockwave cbt-exp-shockwave--fail" />
                {Array.from({ length: 18 }, (_, i) => (
                  <span key={i} className="cbt-exp-spark cbt-exp-spark--fail" style={{ '--cbt-spark': i }} />
                ))}
              </div>
              <p className="cbt-crash-caption">המיירט נפל – פיצוץ על הקרקע</p>
            </div>
          )}

          <h3 className="cbt-intercept-title">בחר משגר יירוט (מחשבה חלופית על המשגר)</h3>
          <div className="cbt-choices">
            {choices.map((text) => {
              const roundForText = ROUNDS.find((r) => r.balancedThought === text)
              const sys = roundForText?.interceptorSystem
              const launcher =
                sys && INTERCEPTOR_LABEL[sys] ? `משגר · ${INTERCEPTOR_LABEL[sys]}` : 'משגר יירוט'
              return (
                <button
                  key={text}
                  type="button"
                  className="cbt-choice"
                  disabled={roundBlocking}
                  onClick={() => onPick(text)}
                >
                  <span className="cbt-choice-code">{launcher}</span>
                  <span className="cbt-choice-text">{text}</span>
                </button>
              )
            })}
          </div>

          <div className="cbt-custom-launcher">
            <h3 className="cbt-intercept-title">מיירט בייצור עצמי (+2 נקודות)</h3>
            <p className="cbt-custom-hint">
              המצא <strong>מחשבה מחליפה משלך</strong> – לא להעתיק את הטיל ולא אחד משלושת הניסוחים על המשגרים. לפחות שלוש מילים במשפט מלא; התאם לרוח של מחשבה תומכת ומציאותית כמו במשגרים.
            </p>
            <textarea
              className="cbt-custom-input"
              rows={3}
              value={customInterceptorText}
              onChange={(e) => setCustomInterceptorText(e.target.value)}
              disabled={roundBlocking}
              placeholder="למשל: במילים שלי, אני יכול ל..."
            />
            <button
              type="button"
              className="cbt-primary cbt-fire-custom"
              disabled={roundBlocking}
              onClick={onFireCustom}
            >
              יירה מיירט
            </button>
          </div>

          {feedback && <p className={`cbt-feedback ${feedbackClass(feedback)}`}>{feedback}</p>}
        </section>
      )}

      {phase === 'done' && (
        <section className="cbt-panel cbt-done">
          <h2>סיימת את כל הסבבים</h2>
          <p>
            ניקוד סופי: <strong>{score}</strong>
          </p>
          <p>כל הכבוד – תרגלת זיהוי של מחשבות קשות ובחירה במחשבות חלופיות מועילות.</p>
          <button
            type="button"
            className="cbt-primary"
            onClick={() => {
              setPhase('welcome')
              setRoundIndex(0)
              setScore(0)
            }}
          >
            חזרה לפתיחה
          </button>
          <button type="button" className="cbt-secondary" onClick={startGame}>
            שוב מאפס
          </button>
        </section>
      )}
    </div>
  )
}
