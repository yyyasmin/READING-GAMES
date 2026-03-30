import { useMemo, useState } from 'react'

const AGE_OPTIONS = [
  { value: 'adult', label: 'מבוגרים' },
  { value: 'highschool', label: 'תיכון' },
  { value: 'middleschool', label: 'חטיבת ביניים' },
  { value: 'elementary', label: 'יסודי' },
  { value: 'kindergarten', label: 'גן' }
]

const GAMES = [
  { id: 'reading', title: 'זיכרון קריאה', subject: 'reading', urlEnvKey: 'VITE_READING_GAME_URL' },
  { id: 'math_english', title: 'מתמטיקה ואנגלית', subject: 'math_english', urlEnvKey: 'VITE_MATH_ENGLISH_GAME_URL' },
  { id: 'ndfa', title: 'זיכרון NDFA', subject: 'ndfa', urlEnvKey: 'VITE_NDFA_GAME_URL' },
  { id: 'ronit', title: 'רונית חכם - המכשפות', subject: 'ronit_reading', urlEnvKey: 'VITE_RONIT_GAME_URL' },
  { id: 'cbt', title: 'מלחמה', subject: 'cbt_youth', urlEnvKey: 'VITE_CBT_GAME_URL' }
]

function localDefaultPathForKey(envKey) {
  const byKey = {
    VITE_READING_GAME_URL: 'http://localhost:5175/',
    VITE_NDFA_GAME_URL: 'http://localhost:5173/',
    VITE_RONIT_GAME_URL: 'http://localhost:5174/',
    VITE_CBT_GAME_URL: '/cbt/',
    VITE_MATH_ENGLISH_GAME_URL: 'http://localhost:5178/'
  }
  return byKey[envKey] || ''
}

function publishedDefaultPathForKey(envKey) {
  const byKey = {
    VITE_READING_GAME_URL: '/',
    VITE_NDFA_GAME_URL: '/ndfa/',
    VITE_RONIT_GAME_URL: '/ronit/',
    VITE_CBT_GAME_URL: '/cbt/',
    VITE_MATH_ENGLISH_GAME_URL: '/math-english/'
  }
  return byKey[envKey] || ''
}

function gameBaseUrl(envKey) {
  const fromEnv = import.meta.env[envKey]
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h === 'localhost' || h === '127.0.0.1') return localDefaultPathForKey(envKey)
  }
  return publishedDefaultPathForKey(envKey)
}

function buildLaunchUrl(game, ageGroup, email, nickname) {
  const baseStr = gameBaseUrl(game.urlEnvKey)
  if (!baseStr) return null
  try {
    const parsed = baseStr.startsWith('/')
      ? new URL(baseStr, window.location.origin)
      : new URL(baseStr)
    parsed.searchParams.set('subject', game.subject)
    parsed.searchParams.set('age_group', ageGroup)
    parsed.searchParams.set('from', 'main_menu')
    parsed.searchParams.set('email', email.trim())
    parsed.searchParams.set('nickname', nickname.trim())
    return parsed.toString()
  } catch {
    return null
  }
}

export default function App() {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [error, setError] = useState('')

  const canLaunch = useMemo(() => {
    return Boolean(email.trim() && nickname.trim() && ageGroup)
  }, [email, nickname, ageGroup])

  function launchGame(game) {
    if (!email.trim() || !nickname.trim() || !ageGroup) {
      setError('יש למלא אימייל, שם וגיל לפני פתיחת משחק.')
      return
    }
    const launchUrl = buildLaunchUrl(game, ageGroup, email, nickname)
    if (!launchUrl) {
      setError(`לא ניתן לפתוח את המשחק «${game.title}» כי ההגדרה שלו לא תקינה.`)
      return
    }
    setError('')
    window.location.assign(launchUrl)
  }

  return (
    <main className="page">
      <section className="card">
        <h1>MAIN - דף התחברות ותפריט משחקים</h1>
        <p className="subtitle">ממלאים פרטים, בוחרים משחק וממשיכים.</p>

        <label className="field">
          <span>אימייל</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </label>

        <label className="field">
          <span>שם להצגה</span>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="הקלד/י שם"
          />
        </label>

        <label className="field">
          <span>גיל</span>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="">בחר/י קבוצת גיל</option>
            {AGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {error ? <div className="error">{error}</div> : null}

        <div className="games">
          {GAMES.map((g) => (
            <button key={g.id} type="button" onClick={() => launchGame(g)} disabled={!canLaunch}>
              {g.title}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
