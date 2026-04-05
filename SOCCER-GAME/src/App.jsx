import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { SoccerFieldBoard } from './SoccerFieldBoard.jsx'

const RENDER_BACKEND = 'https://ndfa-memory-match-game.onrender.com'

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

function buildOptionsForScenario(s) {
  const correct = (s.balancedThought || '').trim()
  const decoys = Array.isArray(s.balancedDecoys) ? s.balancedDecoys.map((t) => String(t).trim()).filter(Boolean) : []
  const all = [correct, ...decoys].filter(Boolean)
  if (all.length < 2) return { options: all, correct: correct }
  return { options: shuffle(all), correct }
}

export default function App() {
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { email: '', subject: '', age_group: '', nickname: '' }
    }
    const p = new URLSearchParams(window.location.search)
    return {
      email: (p.get('email') || '').trim(),
      subject: (p.get('subject') || '').trim(),
      age_group: (p.get('age_group') || '').trim(),
      nickname: (p.get('nickname') || '').trim()
    }
  }, [])

  const [loadError, setLoadError] = useState(null)
  const [allScenarios, setAllScenarios] = useState([])
  const [phase, setPhase] = useState('menu')
  const [gameMode, setGameMode] = useState(null)
  const [queue, setQueue] = useState([])
  const [qIndex, setQIndex] = useState(0)
  const [options, setOptions] = useState([])
  const [correctText, setCorrectText] = useState('')
  const [feedback, setFeedback] = useState('')
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)

  const logGameLoginEmail = useCallback(() => {
    const em = urlParams.email
    if (!em || typeof window === 'undefined') return
    const key = 'soccer_game_login_email_logged'
    if (sessionStorage.getItem(key) === em) return
    fetch(apiUrl('/api/game-login-email'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: em,
        game_type: 'cbt_soccer',
        subject: urlParams.subject || undefined,
        age_group: urlParams.age_group || undefined
      })
    })
      .then((res) => {
        if (res.ok) sessionStorage.setItem(key, em)
      })
      .catch(() => {})
  }, [urlParams])

  useEffect(() => {
    let cancelled = false
    const qs = new URLSearchParams()
    if (urlParams.subject) qs.set('subject', urlParams.subject)
    const path = `/api/cbt-soccer-scenarios${qs.toString() ? `?${qs.toString()}` : ''}`
    fetch(apiUrl(path))
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const err = data && data.error ? String(data.error) : `HTTP ${res.status}`
          throw new Error(err)
        }
        return data
      })
      .then((data) => {
        if (cancelled) return
        const list = data.scenarios
        if (!Array.isArray(list) || list.length === 0) {
          setLoadError('לא התקבלו סיטואציות מהשרת. ודאו שה־backend רץ ושקובץ הנתונים קיים.')
          return
        }
        setAllScenarios(list)
        setLoadError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e.message || 'טעינת סיטואציות נכשלה.')
      })
    return () => {
      cancelled = true
    }
  }, [urlParams.subject])

  const startMode = useCallback(
    (mode) => {
      logGameLoginEmail()
      const filtered = allScenarios.filter((s) => s && s.mode === mode)
      if (filtered.length === 0) {
        setLoadError(`אין סיטואציות למצב זה (${mode}).`)
        return
      }
      const shuffled = shuffle(filtered)
      setGameMode(mode)
      setQueue(shuffled)
      setQIndex(0)
      setScore(0)
      setFeedback('')
      setPicked(null)
      const first = shuffled[0]
      const built = buildOptionsForScenario(first)
      setOptions(built.options)
      setCorrectText(built.correct)
      setPhase('play')
    },
    [allScenarios, logGameLoginEmail]
  )

  const current = queue[qIndex] || null

  const onPick = useCallback(
    (text) => {
      if (picked !== null || !current) return
      setPicked(text)
      const ok = text === correctText
      if (ok) setScore((s) => s + 1)
      setFeedback(ok ? 'נכון — מחשבה מאוזנת.' : 'לא בדיוק — נסי שוב בסיבוב הבא.')
    },
    [picked, current, correctText]
  )

  const nextRound = useCallback(() => {
    const next = qIndex + 1
    if (next >= queue.length) {
      setPhase('done')
      setFeedback('')
      setPicked(null)
      return
    }
    setQIndex(next)
    setFeedback('')
    setPicked(null)
    const s = queue[next]
    const built = buildOptionsForScenario(s)
    setOptions(built.options)
    setCorrectText(built.correct)
  }, [qIndex, queue])

  const backToMenu = useCallback(() => {
    setPhase('menu')
    setGameMode(null)
    setQueue([])
    setQIndex(0)
    setFeedback('')
    setPicked(null)
    setOptions([])
    setCorrectText('')
  }, [])

  if (loadError) {
    return (
      <div className="soccer-shell">
        <header className="soccer-header">
          <h1>כדורגל — מחשבות במגרש</h1>
        </header>
        <main className="soccer-card soccer-error">
          <p>{loadError}</p>
          <p className="soccer-hint">בפיתוח מקומי: הריצו את ה־API ב־<code>backend</code> (למשל פורט 5000) ואז רעננו.</p>
        </main>
      </div>
    )
  }

  if (allScenarios.length === 0 && !loadError) {
    return (
      <div className="soccer-shell soccer-loading">
        <p>טוען סיטואציות…</p>
      </div>
    )
  }

  return (
    <div className="soccer-shell">
      <header className="soccer-header">
        <h1>כדורגל — מחשבות במגרש</h1>
        {urlParams.nickname ? <p className="soccer-sub">שלום, {urlParams.nickname}</p> : null}
      </header>

      {phase === 'menu' && (
        <main className="soccer-card">
          <p className="soccer-intro">
            בחרי מצב: משחק מלא (כולל 5v5 ו-11v11) או פנדלים. בכל סיטואציה תופיע מחשבה מקשה לצד תשובות — בחרי את
            המחשבה המאוזנת.
          </p>
          <div className="soccer-mode-grid">
            <button type="button" className="soccer-btn soccer-btn-primary" onClick={() => startMode('match')}>
              משחק מלא
            </button>
            <button type="button" className="soccer-btn soccer-btn-primary" onClick={() => startMode('penalties')}>
              פנדלים
            </button>
          </div>
        </main>
      )}

      {phase === 'play' && current && (
        <main className="soccer-card">
          <SoccerFieldBoard totalSteps={queue.length} currentStep={qIndex} phase="play" />
          <div className="soccer-meta">
            <span className="soccer-badge">{current.pitch || '—'}</span>
            <span className="soccer-badge">{current.roleLabel || 'תפקיד'}</span>
            <span className="soccer-progress">
              {qIndex + 1} / {queue.length}
            </span>
          </div>
          <p className="soccer-situation">{current.situationText}</p>
          <div className="soccer-hostile">
            <span className="soccer-label">מחשבה מקשה</span>
            <p>{current.hostileThought}</p>
          </div>
          <div className="soccer-pick">
            <span className="soccer-label">מחשבה מאוזנת — בחרי</span>
            <div className="soccer-options">
              {options.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={
                    'soccer-opt' +
                    (picked !== null ? (t === correctText ? ' is-correct' : t === picked ? ' is-wrong' : '') : '')
                  }
                  disabled={picked !== null}
                  onClick={() => onPick(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {feedback ? <p className={'soccer-feedback ' + (picked === correctText ? ' ok' : ' no')}>{feedback}</p> : null}
          {picked !== null && (
            <div className="soccer-actions">
              <button type="button" className="soccer-btn" onClick={nextRound}>
                {qIndex + 1 >= queue.length ? 'סיום' : 'המשך'}
              </button>
            </div>
          )}
          <p className="soccer-score">ניקוד: {score}</p>
        </main>
      )}

      {phase === 'done' && (
        <main className="soccer-card">
          <SoccerFieldBoard totalSteps={queue.length} currentStep={queue.length - 1} phase="done" />
          <h2>סיום מצב</h2>
          <p>{gameMode === 'match' ? 'משחק מלא' : 'פנדלים'}</p>
          <p className="soccer-score-final">ניקוד: {score} מתוך {queue.length}</p>
          <button type="button" className="soccer-btn soccer-btn-primary" onClick={backToMenu}>
            חזרה לתפריט
          </button>
        </main>
      )}
    </div>
  )
}
