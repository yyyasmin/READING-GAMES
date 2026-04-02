import React, { useMemo, useState, useCallback, useEffect, useRef, useId } from 'react'
import {
  ROUNDS,
  STORY_TITLE,
  TAGLINE,
  ROUND_TIME_MS,
  normalizeThought,
  isOwnInterceptorWording
} from './cbtRounds.js'
import {
  resumeBattleAudio,
  playLaunchIgnition,
  playInterceptorWhoosh,
  playExplosionSuccess,
  playExplosionFail,
  playFallTension,
  startEnemyMissileApproachAmbient
} from './cbtBattleSfx.js'

const RENDER_BACKEND = 'https://ndfa-memory-match-game.onrender.com'
const COMBAT_VIDEO_SRC = `${import.meta.env.BASE_URL}videos/rocket%20flight.mp4`
/** כש־true — וידאו משגר אמיתי מתחת לשכבת טיל האויב (קובץ: public/videos/rocket flight.mp4).
 * במצב “משגר אמיתי בלי רקע” חייבים להשאיר את זה `false`, כי אי אפשר לבודד משגר מתוך פריים שטוח בלי אלפא/שכבות. */
const CBT_SHOW_LAUNCHER_COMBAT_VIDEO = false
/** פיתוח: true — משתיק רשרש טיל מתקרב (להחזיר false לפני שחרור / בדיקת חוויית משחק). */
const CBT_DEV_DISABLE_ENEMY_APPROACH_SFX = true
/** Local: relative /api → Vite proxy. Production (Netlify etc.): full URL to Render. */
function apiUrl(apiPath) {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (typeof window === 'undefined') return path
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return path
  const fromEnv = import.meta.env.VITE_BACKEND_URL
  if (fromEnv && typeof fromEnv === 'string' && (fromEnv.startsWith('http://') || fromEnv.startsWith('https://'))) {
    return `${fromEnv.replace(/\/$/, '')}${path}`
  }
  return `${RENDER_BACKEND.replace(/\/$/, '')}${path}`
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** הפרש זווית קצר בין כיוון משגר לכיוון לטיל (מעלות). */
function shortestAngleDeg(fromDeg, toDeg) {
  let d = (((toDeg - fromDeg) % 360) + 360) % 360
  if (d > 180) d -= 360
  return d
}

/** מעלות בטווח [0, 360) — סיבוב מלא; ב-CSS מוחל rotateZ (מישור המסך) כדי שלא ייראה כמו כיווץ של rotateY */
function normalizeAngle360(deg) {
  let a = deg % 360
  if (a < 0) a += 360
  return a
}

/** כמה שלבי זום לטקסט מחשבה על הארגז (לחיצה = +1, אחרי המקסימום חוזר ל־0) */
const CBT_CRATE_ZOOM_MAX = 10

const CBT_LAUNCHER_AIM_TOLERANCE_DEG = 90
const CBT_LAUNCHER_PITCH_TOLERANCE_DEG = 45
const CBT_LAUNCHER_PITCH_MIN = -34
const CBT_LAUNCHER_PITCH_MAX = 34

function clampLauncherPitchDeg(deg) {
  return Math.min(CBT_LAUNCHER_PITCH_MAX, Math.max(CBT_LAUNCHER_PITCH_MIN, deg))
}

/** יואו לפי מיקום X בלבד על מסגרת הקרב: 0° = קצה שמאל, 360° = קצה ימין — רציף, בלי "חזרה לאמצע" של atan2 מול ציר בפינה */
function horizontalScreenYawDeg(wr, clientX) {
  const t = (clientX - wr.left) / Math.max(wr.width, 1)
  const clamped = Math.max(0, Math.min(1, t))
  return normalizeAngle360(clamped * 360)
}

/** עומק: למטה במסגרת = אל השחקן (חיובי), למעלה = פנימה למסך (שלילי) */
function pitchDegFromClientY(wr, clientY) {
  const mid = wr.top + wr.height * 0.5
  const half = Math.max(wr.height * 0.5, 1)
  const ny = (clientY - mid) / half
  const clamped = Math.max(-1, Math.min(1, ny))
  return clampLauncherPitchDeg(clamped * CBT_LAUNCHER_PITCH_MAX)
}

/** מסלול מיירט במרחב הפריים – מטיל מתוך הארגז אל מרכז טיל האויב, או לכיוון השחקן (מיירט «עוין»). */
function computeLaunchFlightWorldStyle(wrapEl, deckEl, rocketEl, flyTowardPlayer) {
  if (!wrapEl || !deckEl || !rocketEl) return null
  const wr = wrapEl.getBoundingClientRect()
  const dr = deckEl.getBoundingClientRect()
  const rr = rocketEl.getBoundingClientRect()
  // בסיס הטיל מתוך הארגז: מרכז הטיל בשורה הקדמית, מעט מעל תחתיתו
  const mx = dr.left + dr.width * 0.5
  const my = dr.bottom - dr.height * 0.12
  let tx = rr.left + rr.width * 0.5
  let ty = rr.top + rr.height * 0.45
  if (flyTowardPlayer) {
    tx = wr.left + wr.width * 0.5
    ty = wr.bottom - Math.max(24, wr.height * 0.04)
  }
  const dx = tx - mx
  const dy = ty - my
  const leftPct = ((mx - wr.left) / Math.max(wr.width, 1)) * 100
  const topPct = ((my - wr.top) / Math.max(wr.height, 1)) * 100
  // זווית הטיל: וקטור מהמיירט מעלה־אל היעד (atan2 על dy, dx)
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  return {
    left: `${leftPct}%`,
    top: `${topPct}%`,
    '--cbt-launch-dx': `${dx}px`,
    '--cbt-launch-dy': `${dy}px`,
    '--cbt-launch-angle': `${angleDeg}deg`
  }
}

/** משך אנימציית טיסת המיירט במסך (לפני כיבוי שכבת השיגור) */
const CBT_LAUNCH_FLIGHT_VISUAL_MS = 1000

export default function App() {
  const rid = useId().replace(/:/g, '')
  const successExpGradId = `cbt-sxg-${rid}`
  const failExpGradId = `cbt-fxg-${rid}`
  const ironMetalId = `cbt-im-${rid}`
  const ironGreenId = `cbt-ig-${rid}`
  const [phase, setPhase] = useState('welcome')
  /** מזהה סבב מ־ROUNDS — נבחר במסך «בחרו סיטואציה» לפני הכניסה ל־play */
  const [selectedSituationId, setSelectedSituationId] = useState(null)
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [interceptFlash, setInterceptFlash] = useState(false)
  const [wrongShake, setWrongShake] = useState(false)
  const [roundBlocking, setRoundBlocking] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [interceptCrash, setInterceptCrash] = useState(false)
  const [customInterceptorText, setCustomInterceptorText] = useState('')
  const [launcherChoiceIndex, setLauncherChoiceIndex] = useState(0)
  const [launcherSpinPulse, setLauncherSpinPulse] = useState(0)
  const [isLauncherSpinning, setIsLauncherSpinning] = useState(false)
  const [isLauncherSettling, setIsLauncherSettling] = useState(false)
  const [launcherLaunchFx, setLauncherLaunchFx] = useState({ active: false, token: 0, thought: '', hostile: false })
  const [videoLoadError, setVideoLoadError] = useState('')
  const [launcherAimDeg, setLauncherAimDeg] = useState(0)
  const [launcherPitchDeg, setLauncherPitchDeg] = useState(0)
  const [combatFrozen, setCombatFrozen] = useState(false)
  const [crateThoughtZoomStep, setCrateThoughtZoomStep] = useState(0)
  const [launchFlightStyle, setLaunchFlightStyle] = useState(undefined)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const combatFrameRef = useRef(null)
  const launchDeckAimRef = useRef(null)
  const enemyRocketRef = useRef(null)
  const crateMissileRef = useRef(null)
  const missileBearingRef = useRef(0)
  const missilePitchRef = useRef(0)
  const launcherAimDegRef = useRef(0)
  const launcherPitchDegRef = useRef(0)
  const aimDragRef = useRef(false)
  const aimRafRef = useRef(0)

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
  const roundDeadlineRef = useRef(Date.now())
  const freezeRemainingMsRef = useRef(0)
  const combatFrozenRef = useRef(false)
  const roundIndexRef = useRef(roundIndex)
  const playSessionRoundsLengthRef = useRef(0)
  const launcherSpinTimerRef = useRef(null)
  const launcherSettleTimerRef = useRef(null)
  roundIndexRef.current = roundIndex
  launcherAimDegRef.current = launcherAimDeg
  launcherPitchDegRef.current = launcherPitchDeg
  combatFrozenRef.current = combatFrozen

  const toggleCombatFreeze = useCallback(() => {
    if (roundBlocking || launcherLaunchFx.active) return
    setCombatFrozen((was) => {
      if (!was) {
        freezeRemainingMsRef.current = Math.max(0, roundDeadlineRef.current - Date.now())
      } else {
        roundDeadlineRef.current = Date.now() + freezeRemainingMsRef.current
      }
      return !was
    })
  }, [roundBlocking, launcherLaunchFx.active])
  const openSituationPicker = useCallback(() => {
    setPhase('choose_situation')
    setIsMenuOpen(false)
  }, [])

  const resumePlay = useCallback(() => {
    setIsMenuOpen(false)
  }, [])

  const playSessionRounds = useMemo(() => {
    if (!selectedSituationId) return []
    const r = ROUNDS.find((x) => x.id === selectedSituationId)
    return r ? [r] : []
  }, [selectedSituationId])
  playSessionRoundsLengthRef.current = playSessionRounds.length

  const current = playSessionRounds[roundIndex]
  const choices = useMemo(() => {
    if (!current) return []
    const others = ROUNDS.filter((r) => r.id !== current.id).map((r) => r.balancedThought)
    const picked = shuffle(others).slice(0, 2)
    return shuffle([current.balancedThought, ...picked])
  }, [current])
  const activeLauncherThought = choices[launcherChoiceIndex] || ''

  const advanceAfterDelay = useCallback((delayMs) => {
    setTimeout(() => {
      const idx = roundIndexRef.current
      if (idx >= playSessionRoundsLengthRef.current - 1) {
        setPhase('done')
        setFeedback('')
      } else {
        setRoundIndex((i) => i + 1)
        setFeedback('')
      }
      setRoundBlocking(false)
      setInterceptCrash(false)
      setCustomInterceptorText('')
      setLauncherLaunchFx({ active: false, token: 0, thought: '', hostile: false })
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
    setLauncherLaunchFx({ active: false, token: 0, thought: '', hostile: false })
    setWrongShake(true)
    setTimeout(() => setWrongShake(false), 500)
    advanceAfterDelay(2600)
  }, [advanceAfterDelay])

  useEffect(() => {
    if (!interceptFlash) return undefined
    const t = window.setTimeout(() => playExplosionSuccess(), 90)
    return () => window.clearTimeout(t)
  }, [interceptFlash])

  useEffect(() => {
    if (!launcherLaunchFx.active) return undefined
    playLaunchIgnition()
    playInterceptorWhoosh()
  }, [launcherLaunchFx.active, launcherLaunchFx.token])

  useEffect(() => {
    setLaunchFlightStyle(undefined)
  }, [roundIndex, current?.id])

  useEffect(() => {
    if (!interceptCrash) return undefined
    playFallTension()
    const t = window.setTimeout(() => playExplosionFail(), 400)
    return () => window.clearTimeout(t)
  }, [interceptCrash])

  useEffect(() => {
    if (phase !== 'play' || CBT_DEV_DISABLE_ENEMY_APPROACH_SFX) return undefined
    const ctrl = startEnemyMissileApproachAmbient()
    return () => ctrl.stop()
  }, [phase])

  const syncLauncherAimToMissile = useCallback(() => {
    const wrap = combatFrameRef.current
    const rocket = enemyRocketRef.current
    if (!wrap || !rocket) return
    const wr = wrap.getBoundingClientRect()
    const rr = rocket.getBoundingClientRect()
    const cx = rr.left + rr.width / 2
    const cy = rr.top + rr.height / 2
    setLauncherAimDeg(horizontalScreenYawDeg(wr, cx))
    setLauncherPitchDeg(pitchDegFromClientY(wr, cy))
  }, [])

  const nudgeLauncherAim = useCallback((deltaDeg) => {
    setLauncherAimDeg((d) => normalizeAngle360(d + deltaDeg))
  }, [])

  const nudgeLauncherPitch = useCallback((deltaDeg) => {
    setLauncherPitchDeg((p) => clampLauncherPitchDeg(p + deltaDeg))
  }, [])

  useEffect(() => {
    if (phase !== 'play' || roundBlocking) return undefined
    let cancelled = false
    const loop = () => {
      if (cancelled) return
      const wrap = combatFrameRef.current
      const rocket = enemyRocketRef.current
      if (wrap && rocket) {
        const wr = wrap.getBoundingClientRect()
        const rr = rocket.getBoundingClientRect()
        const cx = rr.left + rr.width / 2
        missileBearingRef.current = horizontalScreenYawDeg(wr, cx)
        missilePitchRef.current = pitchDegFromClientY(wr, rr.top + rr.height / 2)
      }
      aimRafRef.current = requestAnimationFrame(loop)
    }
    aimRafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(aimRafRef.current)
    }
  }, [phase, roundBlocking, roundIndex, current?.id])

  useEffect(() => {
    if (phase !== 'play' || roundBlocking) return undefined
    const onKeyDown = (e) => {
      const el = e.target
      if (el instanceof HTMLElement) {
        const tag = el.tagName
        if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || el.isContentEditable) return
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (launcherLaunchFx.active) return
        toggleCombatFreeze()
        return
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown')
        return
      e.preventDefault()
      if (launcherLaunchFx.active) return
      if (!combatFrozen) return
      const step = e.shiftKey ? 3.2 : 1.1
      const pitchStep = e.shiftKey ? 2.4 : 0.85
      if (e.key === 'ArrowLeft') nudgeLauncherAim(-step)
      else if (e.key === 'ArrowRight') nudgeLauncherAim(step)
      else if (e.key === 'ArrowUp') nudgeLauncherPitch(pitchStep)
      else nudgeLauncherPitch(-pitchStep)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    phase,
    roundBlocking,
    launcherLaunchFx.active,
    combatFrozen,
    toggleCombatFreeze,
    nudgeLauncherAim,
    nudgeLauncherPitch
  ])

  useEffect(() => {
    if (phase !== 'play') return undefined
    const id = requestAnimationFrame(() => {
      syncLauncherAimToMissile()
    })
    return () => cancelAnimationFrame(id)
  }, [phase, roundIndex, current?.id, syncLauncherAimToMissile])

  useEffect(() => {
    if (phase !== 'play' || !current || roundBlocking) return undefined

    roundDeadlineRef.current = Date.now() + ROUND_TIME_MS
    freezeRemainingMsRef.current = 0
    timeoutFiredRef.current = false
    setSecondsLeft(Math.ceil(ROUND_TIME_MS / 1000))

    const id = setInterval(() => {
      if (combatFrozenRef.current) {
        const rem = Math.max(0, freezeRemainingMsRef.current)
        setSecondsLeft(Math.ceil(rem / 1000))
        return
      }
      const ms = roundDeadlineRef.current - Date.now()
      const sec = Math.max(0, Math.ceil(ms / 1000))
      setSecondsLeft(sec)
      if (ms <= 0) {
        clearInterval(id)
        handleTimeout()
      }
    }, 200)

    return () => clearInterval(id)
  }, [phase, current?.id, roundIndex, roundBlocking, handleTimeout])

  useEffect(() => {
    setLauncherChoiceIndex(0)
    setLauncherSpinPulse(0)
    setIsLauncherSpinning(false)
    setIsLauncherSettling(false)
    setLauncherLaunchFx({ active: false, token: 0, thought: '', hostile: false })
    setCombatFrozen(false)
    setCrateThoughtZoomStep(0)
  }, [roundIndex, current?.id])

  useEffect(() => {
    return () => {
      if (launcherSpinTimerRef.current) {
        clearTimeout(launcherSpinTimerRef.current)
        launcherSpinTimerRef.current = null
      }
      if (launcherSettleTimerRef.current) {
        clearTimeout(launcherSettleTimerRef.current)
        launcherSettleTimerRef.current = null
      }
    }
  }, [])

  const logGameLoginEmail = useCallback(() => {
    const em = urlParams.email
    if (!em || typeof window === 'undefined') return
    const key = 'cbt_game_login_email_logged'
    if (sessionStorage.getItem(key) === em) return
    fetch(apiUrl('/api/game-login-email'), {
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
  }, [urlParams])

  const goToSituationPicker = useCallback(() => {
    setSelectedSituationId(null)
    setRoundIndex(0)
    setScore(0)
    setFeedback('')
    setRoundBlocking(false)
    setInterceptCrash(false)
    setCustomInterceptorText('')
    timeoutFiredRef.current = false
    setCombatFrozen(false)
    logGameLoginEmail()
    resumeBattleAudio()
    setPhase('choose_situation')
  }, [logGameLoginEmail])

  const beginSituationRound = useCallback((roundId) => {
    const found = ROUNDS.find((r) => r.id === roundId)
    if (!found) {
      setFeedback('הסיטואציה שנבחרה לא נמצאה.')
      return
    }
    setSelectedSituationId(roundId)
    setRoundIndex(0)
    setScore(0)
    setFeedback('')
    setRoundBlocking(false)
    setInterceptCrash(false)
    setCustomInterceptorText('')
    timeoutFiredRef.current = false
    setCombatFrozen(false)
    setPhase('play')
  }, [])

  const onPick = useCallback(
    (text) => {
      if (!current || phase !== 'play' || roundBlocking || isLauncherSpinning || launcherLaunchFx.active) return
      if (!combatFrozen) {
        setFeedback('הקפיאו את המסך כדי לעצור את טיל האויב, ואז כוונו את המשגר ושגרו.')
        setWrongShake(true)
        setTimeout(() => setWrongShake(false), 500)
        return
      }
      {
        const yawDiff = Math.abs(shortestAngleDeg(launcherAimDegRef.current, missileBearingRef.current))
        const pitchDiff = Math.abs(launcherPitchDegRef.current - missilePitchRef.current)
        if (yawDiff > CBT_LAUNCHER_AIM_TOLERANCE_DEG || pitchDiff > CBT_LAUNCHER_PITCH_TOLERANCE_DEG) {
          setFeedback(
            'כוון את המשגר לטיל: עכבר = רק ימין/שמאל; חיצים למעלה/למטה = פנימה/החוצה; חיצים ימין/שמאל = סיבוב עדין.'
          )
          setWrongShake(true)
          setTimeout(() => setWrongShake(false), 500)
          return
        }
      }
      const isCorrect = text === current.balancedThought
      const hostile = !isCorrect
      /** שני rAF אחרי לייאאוט — מסלול השיגור מחושב לפי getBoundingClientRect של הארגז והטיל */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const flightStyle = CBT_SHOW_LAUNCHER_COMBAT_VIDEO
            ? undefined
            : computeLaunchFlightWorldStyle(
                combatFrameRef.current,
                crateMissileRef.current || launchDeckAimRef.current,
                enemyRocketRef.current,
                hostile
              )
          if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO && flightStyle == null) {
            setFeedback('לא ניתן לחשב מסלול שיגור (אלמנטי המסך חסרים). רענן את הדף ונסה שוב.')
            return
          }
          const nowToken = Date.now()
          if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO) {
            setLaunchFlightStyle(flightStyle)
          }
          setRoundBlocking(true)
          setLauncherLaunchFx({ active: true, token: nowToken, thought: text, hostile })
          window.setTimeout(() => {
            if (isCorrect) {
              timeoutFiredRef.current = true
              setScore((s) => s + 1)
              setFeedback('יירוט מוצלח! +1 נקודה.')
              setInterceptFlash(true)
              window.setTimeout(() => setInterceptFlash(false), 2400)
              advanceAfterDelay(2600)
              return
            }
            setFeedback('לא מתאים לטיל הזה. נסה מיירט אחר – אין כאן ניחוש אקראי, צריך התאמה.')
            setWrongShake(true)
            setRoundBlocking(false)
            window.setTimeout(() => setWrongShake(false), 500)
          }, isCorrect ? 820 : 1150)
          const clearLaunchMs = Math.max(CBT_LAUNCH_FLIGHT_VISUAL_MS, isCorrect ? 820 : 1150)
          window.setTimeout(() => {
            setLauncherLaunchFx({ active: false, token: 0, thought: '', hostile: false })
            if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO) {
              setLaunchFlightStyle(undefined)
            }
          }, clearLaunchMs)
        })
      })
    },
    [current, phase, roundBlocking, isLauncherSpinning, launcherLaunchFx.active, combatFrozen, advanceAfterDelay]
  )

  const onFireCustom = useCallback(async () => {
    if (!current || phase !== 'play' || roundBlocking || isLauncherSpinning || launcherLaunchFx.active) return
    const typed = normalizeThought(customInterceptorText)
    if (typed.length === 0) {
      setFeedback('חובה לכתוב מחשבה חלופית משלך על המיירט לפני היירוט.')
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
      return
    }
    if (!combatFrozen) {
      setFeedback('הקפיאו את המסך כדי לעצור את טיל האויב, ואז כוונו את המשגר ושגרו.')
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

    {
      const yawDiff = Math.abs(shortestAngleDeg(launcherAimDegRef.current, missileBearingRef.current))
      const pitchDiff = Math.abs(launcherPitchDegRef.current - missilePitchRef.current)
      if (yawDiff > CBT_LAUNCHER_AIM_TOLERANCE_DEG || pitchDiff > CBT_LAUNCHER_PITCH_TOLERANCE_DEG) {
        setFeedback(
          'כוון את המשגר לטיל: עכבר = רק ימין/שמאל; חיצים למעלה/למטה = פנימה/החוצה; חיצים ימין/שמאל = סיבוב עדין.'
        )
        setWrongShake(true)
        setTimeout(() => setWrongShake(false), 500)
        return
      }
    }

    const clearLaunchVisual = () => {
      setLauncherLaunchFx({ active: false, token: 0, thought: '', hostile: false })
      if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO) {
        setLaunchFlightStyle(undefined)
      }
    }

    const launchVisualOk = await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const flightStyle = CBT_SHOW_LAUNCHER_COMBAT_VIDEO
            ? undefined
            : computeLaunchFlightWorldStyle(
                combatFrameRef.current,
                crateMissileRef.current || launchDeckAimRef.current,
                enemyRocketRef.current,
                false
              )
          if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO && flightStyle == null) {
            setFeedback('לא ניתן לחשב מסלול שיגור (אלמנטי המסך חסרים). רענן את הדף ונסה שוב.')
            resolve(false)
            return
          }
          const nowToken = Date.now()
          if (!CBT_SHOW_LAUNCHER_COMBAT_VIDEO) {
            setLaunchFlightStyle(flightStyle)
          }
          setLauncherLaunchFx({ active: true, token: nowToken, thought: typed, hostile: false })
          window.setTimeout(() => {
            clearLaunchVisual()
          }, CBT_LAUNCH_FLIGHT_VISUAL_MS)
          resolve(true)
        })
      })
    })

    if (!launchVisualOk) return

    setRoundBlocking(true)
    timeoutFiredRef.current = true
    try {
      const res = await fetch(apiUrl('/api/cbt-custom-interceptor'), {
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
        clearLaunchVisual()
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
      setTimeout(() => setInterceptFlash(false), 2400)
      advanceAfterDelay(2600)
    } catch (_) {
      setRoundBlocking(false)
      timeoutFiredRef.current = false
      clearLaunchVisual()
      setFeedback('שגיאת רשת – לא נשמרו הנתונים לשרת.')
      setWrongShake(true)
      setTimeout(() => setWrongShake(false), 500)
    }
  }, [
    current,
    phase,
    roundBlocking,
    launcherLaunchFx.active,
    isLauncherSpinning,
    combatFrozen,
    customInterceptorText,
    advanceAfterDelay,
    urlParams,
    choices
  ])

  /** כפתור יחיד «שגר»: טקסט חופשי בשדה → מיירט מותאם; אחרת → המחשבה מהארגז */
  const onLaunchPress = useCallback(() => {
    const typed = normalizeThought(customInterceptorText)
    if (typed.length > 0) {
      void onFireCustom()
    } else {
      onPick(activeLauncherThought)
    }
  }, [customInterceptorText, onFireCustom, onPick, activeLauncherThought])

  const rotateLauncher = useCallback(() => {
    if (!Array.isArray(choices) || choices.length === 0 || roundBlocking || isLauncherSettling || launcherLaunchFx.active) return
    if (isLauncherSpinning) {
      if (launcherSpinTimerRef.current) {
        clearTimeout(launcherSpinTimerRef.current)
        launcherSpinTimerRef.current = null
      }
      setIsLauncherSpinning(false)
      return
    }
    setIsLauncherSpinning(true)
    setIsLauncherSettling(false)
    setLauncherSpinPulse((p) => p + 1)
    launcherSpinTimerRef.current = setTimeout(() => {
      setLauncherChoiceIndex((i) => (i + 1) % choices.length)
      setIsLauncherSpinning(false)
      setIsLauncherSettling(false)
      launcherSpinTimerRef.current = null
    }, 2400)
  }, [
    choices,
    roundBlocking,
    isLauncherSpinning,
    isLauncherSettling,
    launcherLaunchFx.active
  ])

  const cycleLauncherThought = useCallback(
    (delta) => {
      if (!Array.isArray(choices) || choices.length === 0) return
      if (roundBlocking || isLauncherSpinning || isLauncherSettling || launcherLaunchFx.active) return
      setLauncherChoiceIndex((i) => (i + delta + choices.length) % choices.length)
    },
    [choices, roundBlocking, isLauncherSpinning, isLauncherSettling, launcherLaunchFx.active]
  )

  const onAimPointerDown = useCallback(
    (e) => {
      if (roundBlocking || launcherLaunchFx.active || !combatFrozen) return
      e.currentTarget.setPointerCapture(e.pointerId)
      aimDragRef.current = true
      const wrap = combatFrameRef.current
      if (wrap) {
        const wr = wrap.getBoundingClientRect()
        setLauncherAimDeg(horizontalScreenYawDeg(wr, e.clientX))
      }
    },
    [roundBlocking, launcherLaunchFx.active, combatFrozen]
  )

  const onAimPointerMove = useCallback((e) => {
    if (!aimDragRef.current) return
    const wrap = combatFrameRef.current
    if (!wrap) return
    const wr = wrap.getBoundingClientRect()
    setLauncherAimDeg(horizontalScreenYawDeg(wr, e.clientX))
  }, [])

  const onAimPointerUp = useCallback((e) => {
    if (!aimDragRef.current) return
    aimDragRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (_) {
      /* ignore */
    }
  }, [])

  return (
    <div className="cbt-app">
      {phase !== 'play' && (
        <header className="cbt-header">
          <h1>{STORY_TITLE}</h1>
          <p className="cbt-tagline">{TAGLINE}</p>
        </header>
      )}

      <div className={`cbt-side-menu-toggle ${isMenuOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="cbt-menu-button"
          onClick={() => setIsMenuOpen((v) => !v)}
        >
          ☰
        </button>
        <div className={`cbt-side-menu ${isMenuOpen ? 'cbt-side-menu--open' : ''}`}>
          <p className="cbt-side-score">
            ניקוד: <strong>{score}</strong>
          </p>
          <button
            type="button"
            className="cbt-side-item"
            onClick={openSituationPicker}
          >
            סיטואציה חדשה
          </button>
          {phase === 'play' && (
            <button
              type="button"
              className="cbt-side-item"
              onClick={resumePlay}
            >
              המשך משחק
            </button>
          )}
        </div>
      </div>

      {phase === 'welcome' && (
        <section className="cbt-panel">
          <h2>איך משחקים?</h2>
          <ul className="cbt-rules">
            <li>
              קודם <strong>בוחרים מצב מהחיים</strong> מהרשימה — תיאור קונקרטי שאפשר להיזדהות איתו; המחשבות על הטיל והמשגר יתאימו אליו.
            </li>
            <li>זו סימולציה בסגנון מתח אזורי: על גוף הטיל כתובה <strong>מחשבה לא מועילה</strong> שמתאימה לסיטואציה שבחרת.</li>
            <li>לכל סבב יש <strong>זמן מוגבל</strong> – אם לא תבחר מיירט בזמן, המיירט נופל ומתפוצץ ו<strong>מאבדים נקודה</strong>.</li>
            <li>יירוט נכון ממשגר מוכן = <strong>+1 נקודה</strong>.</li>
            <li>
              <strong>מיירט בייצור עצמי:</strong> כתוב <strong>מחשבה מחליפה במילים שלך</strong> (לא להעתיק מהטיל ולא מאחד המשגרים), לפחות שלוש מילים, ולחץ «יירה מיירט» –{' '}
              <strong>+2 נקודות</strong> (נשמר בשרת).
            </li>
            <li>
              על המשגר מוצגות שלוש מחשבות חלופיות: אחת נכונה למצב שבחרת ושתיים ממצבים אחרים. החצים ליד הטקסט מחליפים ביניהן; לחיצה על הטקסט מגדילה/מקטינה את הגופן. אחרי שבחרת את המחשבה המתאימה — שגרי.
            </li>
          </ul>
          <p className="cbt-note">
            משחק חשיבה לנוער; אם משהו מעלה אצלך מצוקה – דבר עם מבוגר אמין או עם יועצת בבית הספר.
          </p>
          <button type="button" className="cbt-primary" onClick={goToSituationPicker}>
            התחלת משחק
          </button>
        </section>
      )}

      {phase === 'choose_situation' && (
        <section className="cbt-panel cbt-situation-picker">
          <h2>בחרו מצב מהחיים</h2>
          <p className="cbt-situation-picker-hint">
            כל כפתור הוא רגע מהחיים שאפשר להיזדהות איתו — לא כותרת כללית. בחרו מה שקרוב אליכן עכשיו. אחרי הבחירה: טיל עם מחשבה לא מועילה ומשגר עם מחשבות מיירט (כולל שתי
            הסחות דעת ממצבים אחרים).
          </p>
          <ul className="cbt-situation-grid" dir="rtl">
            {ROUNDS.map((r) => (
              <li key={r.id}>
                <button type="button" className="cbt-situation-card" onClick={() => beginSituationRound(r.id)}>
                  {r.situationText}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {phase === 'play' && current && (
        <section
          key={`${current.id}-${roundIndex}`}
          className={`cbt-play cbt-play--compact-bottom ${combatFrozen ? 'cbt-combat-frozen' : ''} ${interceptFlash ? 'cbt-intercept-hit' : ''} ${interceptCrash ? 'cbt-intercept-crash' : ''} ${launcherLaunchFx.active ? 'cbt-launching' : ''}`}
        >
          <p className="cbt-launcher-aim-hint">
            <strong>חיצים</strong> – כיוון טילים · <strong>רווח</strong> – עצירת תמונה · <strong>שגר</strong> – שיגור מיירט ·{' '}
            <strong>סיטואציה חדשה / המשך</strong> – דרך תפריט ☰ בצד.
          </p>
          <div className="cbt-active-situation" role="status">
            <span className="cbt-active-situation-label">המצב שבחרת</span>
            <p className="cbt-active-situation-text">{current.situationText}</p>
          </div>
          {interceptFlash && (
            <div className="cbt-battle-fx cbt-battle-fx--success" aria-hidden>
              <div className="cbt-collision-meet">
                <svg
                  className="cbt-collision-rocket cbt-collision-rocket--enemy"
                  viewBox="0 0 72 200"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={`cbtColEn-${rid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#991b1b" />
                    </linearGradient>
                  </defs>
                  <g>
                    <path d="M36 6 L52 38 L48 42 L24 42 L20 38 Z" fill={`url(#cbtColEn-${rid})`} />
                    <rect x="22" y="40" width="28" height="72" rx="3" fill="#57534e" />
                  </g>
                </svg>
                <svg
                  className="cbt-collision-rocket cbt-collision-rocket--intercept"
                  viewBox="0 0 72 200"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id={`cbtColInt-${rid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#e2e8f0" />
                      <stop offset="100%" stopColor="#64748b" />
                    </linearGradient>
                  </defs>
                  <g>
                    <path d="M36 6 L52 38 L48 42 L24 42 L20 38 Z" fill={`url(#cbtColInt-${rid})`} />
                    <rect x="22" y="40" width="28" height="72" rx="3" fill="#475569" />
                  </g>
                </svg>
                <div className="cbt-collision-x" />
              </div>
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
            </div>
          )}

          <div className="cbt-play-combat-stack">
          <div className="cbt-launcher-selector">
                <div
                  className={`cbt-launcher-tube ${launcherSpinPulse % 2 === 1 ? 'cbt-launcher-tube-spin' : ''} ${isLauncherSpinning ? 'cbt-launcher-tube-active-spin' : ''} ${isLauncherSettling ? 'cbt-launcher-tube-settling' : ''} ${wrongShake ? 'cbt-shake' : ''}`}
                  aria-live="polite"
                >
                  <div
                    ref={combatFrameRef}
                    className={`cbt-launcher-photo-wrap ${CBT_SHOW_LAUNCHER_COMBAT_VIDEO ? 'cbt-photo-wrap--combat-video' : 'cbt-photo-wrap--enemy-sky-only'} ${combatFrozen ? 'cbt-combat-frozen' : ''}`}
                  >
                    <div className="cbt-scene-enemy-layer">
                      <div className="cbt-scene-enemy-stage">
                        <div className="cbt-scene-enemy-sky" aria-hidden />
                        <div
                          ref={enemyRocketRef}
                          className={`cbt-scene-enemy-rocket ${launcherLaunchFx.active && launcherLaunchFx.hostile ? 'cbt-scene-enemy-rocket--threat' : ''}`}
                        >
                          <span className="cbt-enemy-meteor-sparkle" aria-hidden />
                          <svg viewBox="0 0 72 216" className="cbt-scene-enemy-svg" preserveAspectRatio="xMidYMid meet">
                          <defs>
                            <linearGradient id={`cbtMeteorTail-${rid}`} x1="50%" y1="0%" x2="50%" y2="100%">
                              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.98)" />
                              <stop offset="6%" stopColor="rgba(254, 249, 195, 0.85)" />
                              <stop offset="22%" stopColor="rgba(186, 230, 253, 0.55)" />
                              <stop offset="48%" stopColor="rgba(96, 165, 250, 0.22)" />
                              <stop offset="78%" stopColor="rgba(59, 130, 246, 0.08)" />
                              <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
                            </linearGradient>
                            <radialGradient id={`cbtMeteorHead-${rid}`} cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor="#ffffff" />
                              <stop offset="45%" stopColor="rgba(254, 240, 138, 0.95)" />
                              <stop offset="100%" stopColor="rgba(252, 165, 165, 0)" />
                            </radialGradient>
                            <linearGradient id={`cbtEnemyNose-${rid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#f87171" />
                              <stop offset="55%" stopColor="#dc2626" />
                              <stop offset="100%" stopColor="#7f1d1d" />
                            </linearGradient>
                            <linearGradient id={`cbtEnemyBody-${rid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#57534e" />
                              <stop offset="100%" stopColor="#44403c" />
                            </linearGradient>
                            <linearGradient id={`cbtEnemyJet-${rid}`} x1="50%" y1="0%" x2="50%" y2="100%">
                              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                              <stop offset="18%" stopColor="rgba(186, 230, 253, 0.88)" />
                              <stop offset="40%" stopColor="rgba(125, 211, 252, 0.55)" />
                              <stop offset="70%" stopColor="rgba(248, 113, 113, 0.35)" />
                              <stop offset="100%" stopColor="rgba(127, 29, 29, 0)" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M 36 0 L 51 214 L 21 214 Z"
                            fill={`url(#cbtMeteorTail-${rid})`}
                            className="cbt-enemy-meteor-streak-svg"
                          />
                          <path d="M36 6 L52 38 L48 42 L24 42 L20 38 Z" fill={`url(#cbtEnemyNose-${rid})`} />
                          <circle cx="36" cy="16" r="5.5" fill={`url(#cbtMeteorHead-${rid})`} opacity="0.92" />
                          <rect x="22" y="40" width="28" height="72" rx="3" fill={`url(#cbtEnemyBody-${rid})`} />
                          <ellipse cx="36" cy="138" rx="16" ry="32" fill="rgba(254, 243, 199, 0.35)" />
                          <ellipse cx="36" cy="168" rx="11" ry="40" fill={`url(#cbtEnemyJet-${rid})`} />
                          </svg>
                        </div>
                      </div>
                      <div
                        className={`cbt-scene-aim-overlay ${combatFrozen ? '' : 'cbt-scene-aim-overlay--locked'}`}
                        role="presentation"
                        aria-label="כיוון משגר: גרירה אופקית על השמיים לסיבוב; עומק רק בחיצים למעלה או למטה"
                        onPointerDown={onAimPointerDown}
                        onPointerMove={onAimPointerMove}
                        onPointerUp={onAimPointerUp}
                        onPointerCancel={onAimPointerUp}
                      />
                    </div>
                    {CBT_SHOW_LAUNCHER_COMBAT_VIDEO ? (
                      <div className="cbt-real-launcher-bay" aria-hidden>
                        <video
                          className="cbt-real-launcher-video"
                          src={COMBAT_VIDEO_SRC}
                          autoPlay
                          muted
                          loop
                          playsInline
                          onError={() =>
                            setVideoLoadError('לא נמצא וידאו שיגור. שמרו את הקובץ בנתיב CBT/public/videos/rocket flight.mp4')
                          }
                        />
                      </div>
                    ) : null}
                    {interceptFlash ? (
                      <div
                        className="cbt-in-frame-hit"
                        key={`hit-${current.id}-${roundIndex}`}
                        aria-hidden
                      >
                        <div className="cbt-in-frame-hit-meet">
                          <div className="cbt-in-frame-hit-flash" />
                          <div className="cbt-in-frame-hit-core" />
                          <div className="cbt-in-frame-hit-shock" />
                          {Array.from({ length: 14 }, (_, i) => (
                            <span key={i} className="cbt-in-frame-hit-spark" style={{ '--cbt-if-spark': i }} />
                          ))}
                          <div className="cbt-in-frame-hit-smoke" />
                        </div>
                      </div>
                    ) : null}
                    <div
                      ref={launchDeckAimRef}
                      className={`cbt-launcher-deck-aim ${CBT_SHOW_LAUNCHER_COMBAT_VIDEO ? 'cbt-launcher-deck-aim--combat' : ''}`}
                    >
                    <div
                      className="cbt-launcher-turntable-pivot"
                      style={{
                        transform: CBT_SHOW_LAUNCHER_COMBAT_VIDEO
                          ? `rotate(${launcherAimDeg}deg)`
                          : `translateX(-50%) rotateZ(${launcherAimDeg}deg) scale(0.88)`
                      }}
                    >
                    <div
                      className="cbt-launcher-turntable-depth-tilt"
                      style={{ transform: `rotateX(${launcherPitchDeg}deg)` }}
                    >
                    <div className="cbt-launcher-turntable-base" aria-hidden />
                    <div className={`cbt-launcher-deck ${isLauncherSpinning ? 'is-spinning' : ''} ${isLauncherSettling ? 'is-settling' : ''}`}>
                      <div
                        className={`cbt-launcher-bay cbt-launcher-bay--cube ${isLauncherSpinning ? 'is-spinning' : ''} ${
                          isLauncherSettling ? 'is-settling' : ''
                        } ${launcherLaunchFx.active && !launcherLaunchFx.hostile ? 'cbt-launcher-bay--fired' : ''}`}
                      >
                        <div
                          className="cbt-launcher-crate-side-panel"
                          style={{ '--cbt-crate-zoom': crateThoughtZoomStep }}
                        >
                          <div className="cbt-launcher-crate-thought-row" dir="rtl">
                            <button
                              type="button"
                              className="cbt-launcher-crate-nav"
                              aria-label="מחשבה חלופית קודמת"
                              disabled={
                                choices.length < 2 ||
                                roundBlocking ||
                                isLauncherSpinning ||
                                isLauncherSettling ||
                                launcherLaunchFx.active
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                cycleLauncherThought(-1)
                              }}
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className="cbt-launcher-crate-thought"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCrateThoughtZoomStep((s) => (s >= CBT_CRATE_ZOOM_MAX ? 0 : s + 1))
                              }}
                            >
                              {activeLauncherThought}
                            </button>
                            <button
                              type="button"
                              className="cbt-launcher-crate-nav"
                              aria-label="מחשבה חלופית הבאה"
                              disabled={
                                choices.length < 2 ||
                                roundBlocking ||
                                isLauncherSpinning ||
                                isLauncherSettling ||
                                launcherLaunchFx.active
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                cycleLauncherThought(1)
                              }}
                            >
                              ›
                            </button>
                          </div>
                        </div>
                        <div className="cbt-missile-iron-bundle" aria-hidden>
                          {/* סרט עבה מאוד — כמעט דופן תיבה; קומות צמודות בלי חפיפה */}
                          <svg
                            className="cbt-missile-iron-bundle-hoop cbt-missile-iron-bundle-hoop--back cbt-missile-iron-bundle-hoop--unified"
                            viewBox="-104 -12 592 412"
                            preserveAspectRatio="xMidYMid meet"
                            aria-hidden
                          >
                            <defs>
                              {/* פלדה צבאית מאובקת — לא בהיר/פלורסנטי */}
                              <linearGradient id="cbt-hoop-grad-back" x1="12%" y1="8%" x2="88%" y2="92%">
                                <stop offset="0%" stopColor="#7a7f74" />
                                <stop offset="22%" stopColor="#5a5e54" />
                                <stop offset="45%" stopColor="#43463c" />
                                <stop offset="68%" stopColor="#2e2f29" />
                                <stop offset="100%" stopColor="#12110f" />
                              </linearGradient>
                            </defs>
                            <g
                              fill="none"
                              stroke="url(#cbt-hoop-grad-back)"
                              strokeWidth="80"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M -3 52 A 32 32 0 0 0 -35 84 L -35 116 A 32 32 0 0 0 -3 150 A 32 32 0 0 0 -35 182 L -35 214 A 32 32 0 0 0 -3 250 A 32 32 0 0 0 -35 282 L -35 314 A 32 32 0 0 0 -3 350" />
                              <path d="M 363 52 A 32 32 0 0 1 395 84 L 395 116 A 32 32 0 0 1 363 150 A 32 32 0 0 1 395 182 L 395 214 A 32 32 0 0 1 363 250 A 32 32 0 0 1 395 282 L 395 314 A 32 32 0 0 1 363 350" />
                              <path d="M -3 52 L 363 52 M -3 150 L 363 150 M -3 250 L 363 250 M -3 350 L 363 350" />
                            </g>
                          </svg>
                          <div className="cbt-single-missile-grid" aria-hidden>
                          <div className="cbt-single-missile-row cbt-single-missile-row--rear">
                            {[0, 1, 2].map((i) => (
                              <div key={`r-${i}`} className="cbt-single-missile-wrap">
                                <span className="cbt-single-missile-body" />
                                <span className="cbt-single-missile-nose" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--l" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--r" />
                              </div>
                            ))}
                          </div>
                          <div className="cbt-single-missile-row cbt-single-missile-row--back">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={`b-${i}`}
                                className={`cbt-single-missile-wrap${i === 1 ? ' cbt-single-missile-wrap--spindle-axis' : ''}`}
                              >
                                <span className="cbt-single-missile-body" />
                                <span className="cbt-single-missile-nose" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--l" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--r" />
                              </div>
                            ))}
                          </div>
                          <div className="cbt-single-missile-row cbt-single-missile-row--front">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={`f-${i}`}
                                ref={i === 1 ? crateMissileRef : null}
                                className="cbt-single-missile-wrap"
                              >
                                <span className="cbt-single-missile-body" />
                                <span className="cbt-single-missile-nose" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--l" />
                                <span className="cbt-single-missile-fin cbt-single-missile-fin--r" />
                              </div>
                            ))}
                          </div>
                          </div>
                          <svg
                            className="cbt-missile-iron-bundle-hoop cbt-missile-iron-bundle-hoop--front cbt-missile-iron-bundle-hoop--unified"
                            viewBox="-104 -12 592 412"
                            preserveAspectRatio="xMidYMid meet"
                            aria-hidden
                          >
                            <defs>
                              <linearGradient id="cbt-hoop-grad-front" x1="10%" y1="6%" x2="90%" y2="94%">
                                <stop offset="0%" stopColor="#868b80" />
                                <stop offset="24%" stopColor="#5f6358" />
                                <stop offset="48%" stopColor="#464a40" />
                                <stop offset="70%" stopColor="#30322c" />
                                <stop offset="100%" stopColor="#161514" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M 395 100 L 395 116 A 32 32 0 0 1 363 150 L -3 150 A 32 32 0 0 1 -35 116 L -35 100 M 395 200 L 395 216 A 32 32 0 0 1 363 250 L -3 250 A 32 32 0 0 1 -35 216 L -35 200 M 395 300 L 395 316 A 32 32 0 0 1 363 350 L -3 350 A 32 32 0 0 1 -35 316 L -35 300"
                              fill="none"
                              stroke="url(#cbt-hoop-grad-front)"
                              strokeWidth="80"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                    </div>
                    </div>
                    </div>
                    {CBT_SHOW_LAUNCHER_COMBAT_VIDEO ? (
                      <div
                        className="cbt-launch-flight-aim-wrap"
                        style={{ transform: `rotateX(${launcherPitchDeg}deg) rotate(${launcherAimDeg}deg)` }}
                        aria-hidden
                      >
                        <div
                          key={launcherLaunchFx.token || 0}
                          className={`cbt-launch-flight ${launcherLaunchFx.active ? 'is-active' : ''} ${launcherLaunchFx.hostile ? 'is-hostile' : 'is-intercept'}`}
                          aria-hidden
                        >
                          <div className="cbt-launch-muzzle-flash" />
                          <div className="cbt-launch-flame" />
                          <div className="cbt-launch-pressure-wave" />
                          <div className="cbt-launch-smoke">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                          </div>
                          <div className="cbt-launch-body" aria-hidden />
                        </div>
                      </div>
                    ) : launcherLaunchFx.active || launchFlightStyle != null ? (
                      <div
                        key={launcherLaunchFx.token || 0}
                        className={`cbt-launch-flight cbt-launch-flight--world ${launcherLaunchFx.active ? 'is-active' : ''} ${launcherLaunchFx.hostile ? 'is-hostile' : 'is-intercept'}`}
                        style={launchFlightStyle}
                        aria-hidden
                      >
                        <div className="cbt-launch-muzzle-flash" />
                        <div className="cbt-launch-flame" />
                        <div className="cbt-launch-booster-trail" aria-hidden />
                        <div className="cbt-launch-pressure-wave" />
                        <div className="cbt-launch-smoke">
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="cbt-launch-body" aria-hidden />
                      </div>
                    ) : null}
                  </div>
                  <div className="cbt-hostile-thought-strip cbt-hostile-thought-strip--minimal">
                    <p className="cbt-hostile-thought-text">{current.hostileThought}</p>
                  </div>
                  {videoLoadError ? <p className="error-msg">{videoLoadError}</p> : null}
                </div>
            <div className="cbt-launcher-actions">
              <button
                type="button"
                className="cbt-secondary cbt-spin-btn"
                disabled={roundBlocking || choices.length === 0 || isLauncherSpinning || isLauncherSettling || launcherLaunchFx.active}
                onClick={rotateLauncher}
              >
                {isLauncherSpinning ? 'עצור' : isLauncherSettling ? '…' : 'סובב'}
              </button>
              <button
                type="button"
                className="cbt-primary cbt-launch-now-btn"
                disabled={
                  roundBlocking ||
                  isLauncherSpinning ||
                  launcherLaunchFx.active ||
                  !combatFrozen ||
                  (!activeLauncherThought && normalizeThought(customInterceptorText).length === 0)
                }
                onClick={onLaunchPress}
              >
                שגר
              </button>
            </div>
          </div>
          </div>

          <div className="cbt-custom-launcher cbt-custom-launcher--minimal">
            <textarea
              className="cbt-custom-input"
              rows={2}
              value={customInterceptorText}
              onChange={(e) => setCustomInterceptorText(e.target.value)}
              disabled={roundBlocking}
              placeholder=""
            />
          </div>
        </section>
      )}

      {phase === 'done' && (
        <section className="cbt-panel cbt-done">
          <h2>סיימת את הסבב</h2>
          <p>
            ניקוד בסבב זה: <strong>{score}</strong>
          </p>
          <p>כל הכבוד – תרגלת זיהוי של מחשבה לא מועילה ובחירה במחשבה חלופית שמתאימה לסיטואציה שבחרת.</p>
          <button
            type="button"
            className="cbt-primary"
            onClick={() => {
              setPhase('welcome')
              setRoundIndex(0)
              setScore(0)
              setSelectedSituationId(null)
            }}
          >
            חזרה לפתיחה
          </button>
          <button type="button" className="cbt-secondary" onClick={goToSituationPicker}>
            סיטואציה אחרת
          </button>
        </section>
      )}
    </div>
  )
}
