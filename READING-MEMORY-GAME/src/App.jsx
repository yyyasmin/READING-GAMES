import React, { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { buildPyramidDeckWithStory, shuffleDeck, READING_CATEGORY, getRandomPyramidStoryId } from './readingPairs'
import { buildFractionMemoryDeck, MATH_FRACTION_CATEGORY } from '@math-games/fractionMemory.js'
import { FractionQuestionArt } from '@math-games/FractionQuestionArt.jsx'

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72'
function getTwemojiUrl(emoji) {
  if (!emoji) return ''
  const code = [...emoji].map((c) => c.codePointAt(0).toString(16)).join('-')
  return `${TWEMOJI_BASE}/${code}.png`
}

const SOUND_PRESETS = [
  { id: 'fanfare1', label: 'פנפרה 1', notes: [{ f: 523.25, s: 0, d: 0.18 }, { f: 659.25, s: 0.12, d: 0.18 }, { f: 783.99, s: 0.24, d: 0.2 }, { f: 1046.5, s: 0.36, d: 0.35 }] },
  { id: 'fanfare2', label: 'פנפרה 2', notes: [{ f: 392, s: 0, d: 0.15 }, { f: 523.25, s: 0.1, d: 0.15 }, { f: 659.25, s: 0.2, d: 0.2 }, { f: 783.99, s: 0.3, d: 0.3 }] },
  { id: 'fanfare3', label: 'פנפרה 3', notes: [{ f: 659.25, s: 0, d: 0.2 }, { f: 783.99, s: 0.15, d: 0.2 }, { f: 1046.5, s: 0.3, d: 0.4 }] }
]

function playSoundPreset(ctx, presetId) {
  try {
    const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
    if (!Ctx) return
    const audioCtx = (ctx && ctx.state !== 'closed') ? ctx : new Ctx()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => { try { playSoundPreset(audioCtx, presetId); } catch (_) {} }).catch(() => {})
      return
    }
    const preset = SOUND_PRESETS.find((p) => p.id === presetId) || SOUND_PRESETS[0]
    const t0 = audioCtx.currentTime
    const v = 0.28
    preset.notes.forEach((n, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(n.f, t0 + n.s)
      gain.gain.setValueAtTime(0, t0 + n.s)
      gain.gain.linearRampToValueAtTime(v, t0 + n.s + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.01, t0 + n.s + n.d)
      osc.start(t0 + n.s)
      osc.stop(t0 + n.s + n.d + 0.02)
    })
  } catch (_) {}
}

function playSuccessSound(ctx) {
  playSoundPreset(ctx, 'fanfare1')
}

const voiceGlob = import.meta.glob('./assets/sounds/v*.mp3', { eager: true, query: '?url', import: 'default' })
const VOICE_URLS = Object.values(voiceGlob).map((m) => (m && m.default) || m).filter(Boolean)
const VOICE_ENTRIES = Object.entries(voiceGlob).map(([path, m]) => {
  const url = (m && m.default) || m
  const name = path.replace(/^.*\/(v\d+)\.mp3.*$/, '$1')
  return { name, url }
}).filter((e) => e.url)

const VOICE_DB_NAME = 'ReadingMemoryGameDB'
const VOICE_STORE = 'successVoices'
const COMBOS_STORE = 'successCombos'
const successVoiceUrlsRef = { current: VOICE_URLS.slice() }
const successCombosRef = { current: [] }
const audioContextRefForCombo = { current: null }

function openVoiceDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(VOICE_DB_NAME, 2)
    r.onerror = () => reject(r.error)
    r.onsuccess = () => resolve(r.result)
    r.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(VOICE_STORE)) {
        db.createObjectStore(VOICE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(COMBOS_STORE)) {
        db.createObjectStore(COMBOS_STORE, { keyPath: 'id' })
      }
    }
  })
}

async function getAllRecordedVoices() {
  const db = await openVoiceDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(VOICE_STORE, 'readonly')
    const req = t.objectStore(VOICE_STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function addRecordedVoice(blob) {
  const db = await openVoiceDB()
  const id = 'rec_' + Date.now()
  return new Promise((resolve, reject) => {
    const t = db.transaction(VOICE_STORE, 'readwrite')
    t.objectStore(VOICE_STORE).put({ id, blob })
    t.oncomplete = () => resolve(id)
    t.onerror = () => reject(t.error)
  })
}

async function deleteRecordedVoice(id) {
  const db = await openVoiceDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(VOICE_STORE, 'readwrite')
    t.objectStore(VOICE_STORE).delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

async function getAllSuccessCombos() {
  const db = await openVoiceDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(COMBOS_STORE, 'readonly')
    const req = t.objectStore(COMBOS_STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

async function addSuccessCombo(soundId, voiceType, voiceId) {
  const db = await openVoiceDB()
  const id = 'combo_' + Date.now()
  return new Promise((resolve, reject) => {
    const t = db.transaction(COMBOS_STORE, 'readwrite')
    t.objectStore(COMBOS_STORE).put({ id, soundId, voiceType, voiceId })
    t.oncomplete = () => resolve(id)
    t.onerror = () => reject(t.error)
  })
}

async function deleteSuccessCombo(id) {
  const db = await openVoiceDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(COMBOS_STORE, 'readwrite')
    t.objectStore(COMBOS_STORE).delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

function playSuccessCombo(combo) {
  if (typeof window === 'undefined' || !combo) return
  playSoundPreset(audioContextRefForCombo.current, combo.soundId)
  const a = new Audio(combo.voiceUrl)
  a.volume = 1
  setTimeout(() => a.play().catch(() => {}), 400)
}

function playSuccessVoice(isMe) {
  if (typeof window === 'undefined') return
  if (!isMe) return
  const combos = successCombosRef.current
  if (combos && combos.length > 0) {
    const combo = combos[Math.floor(Math.random() * combos.length)]
    playSuccessCombo(combo)
    return
  }
  const urls = successVoiceUrlsRef.current
  if (!urls || urls.length === 0) return
  const url = urls[Math.floor(Math.random() * urls.length)]
  const a = new Audio(url)
  a.volume = 1
  setTimeout(() => a.play().catch(() => {}), 400)
}

const LOCAL_BACKEND = 'http://localhost:5000'
const RENDER_BACKEND = 'https://ndfa-memory-match-game.onrender.com'

function getBackendUrl() {
  const fromEnv = import.meta.env.VITE_BACKEND_URL
  if (fromEnv && typeof fromEnv === 'string' && (fromEnv.startsWith('http://') || fromEnv.startsWith('https://'))) return fromEnv.trim()
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return RENDER_BACKEND
  return LOCAL_BACKEND
}

const API_BASE = getBackendUrl()
const SOCKET_URL = API_BASE
const PAIR_COUNT = 8
const AGE_OPTIONS = [
  { value: 'adult', label: 'מבוגרים' },
  { value: 'highschool', label: 'תיכון' },
  { value: 'middleschool', label: 'חטיבת ביניים' },
  { value: 'elementary', label: 'יסודי' },
  { value: 'kindergarten', label: 'גן' }
]
const READING_HUB_SESSION_KEY = 'reading_hub_session_v1'

function loadHubSession() {
  try {
    const raw = localStorage.getItem(READING_HUB_SESSION_KEY)
    if (!raw) return null
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    return o
  } catch {
    return null
  }
}

/** נשמר רק מזהה משחק אחרון – לא אימייל/שם/גיל (השלמה: דפדפן / משתמש) */
function saveLastPlayedGameOnly(gameId) {
  try {
    if (!gameId || typeof gameId !== 'string') return
    localStorage.setItem(READING_HUB_SESSION_KEY, JSON.stringify({ lastPlayedGameId: gameId }))
  } catch {
    /* ignore */
  }
}

/** כתובת מלאה למשחק חיצוני (מוכן ל-<a href>) או null אם חסר env / לא נבחר גיל.
 *  גיל מהרשימה בכרטיס (ageGroups) משמש רק לאזהרת UI; הפרמטר age_group בכתובת הוא הגיל שנבחר בתפריט. */
function buildExternalGameLaunchUrl(game, selectedAgeGroup, emailVal, nicknameVal) {
  if (game.launchType !== 'external' || !game.urlEnvKey) return null
  if (!selectedAgeGroup) return null
  const base = import.meta.env[game.urlEnvKey]
  if (!base || typeof base !== 'string') return null
  const baseStr = base.trim()
  try {
    const parsed = baseStr.startsWith('/')
      ? new URL(baseStr, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5175')
      : new URL(baseStr)
    parsed.searchParams.set('subject', game.subject)
    parsed.searchParams.set('age_group', selectedAgeGroup)
    parsed.searchParams.set('from', 'reading_main_menu')
    const em = (emailVal || '').trim()
    const nick = (nicknameVal || '').trim()
    if (em) parsed.searchParams.set('email', em)
    if (nick) parsed.searchParams.set('nickname', nick)
    return parsed.toString()
  } catch {
    return null
  }
}

function clearHubSession() {
  try {
    localStorage.removeItem(READING_HUB_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

const GAME_CATALOG = [
  {
    id: 'reading',
    title: 'זיכרון קריאה',
    icon: '📖',
    subject: 'reading',
    ageGroups: ['adult', 'highschool', 'middleschool', 'elementary', 'kindergarten'],
    launchType: 'internal'
  },
  {
    id: 'math_fractions_memory',
    title: 'זיכרון שברים (יסודי)',
    icon: '🔢',
    subject: 'math_fractions_elementary',
    ageGroups: ['elementary'],
    launchType: 'internal'
  },
  {
    id: 'math_english',
    title: 'מתמטיקה ואנגלית',
    icon: '🧮',
    subject: 'math_english',
    ageGroups: ['highschool', 'middleschool', 'elementary'],
    launchType: 'external',
    urlEnvKey: 'VITE_MATH_ENGLISH_GAME_URL'
  },
  {
    id: 'ndfa',
    title: 'זיכרון NDFA',
    icon: '🧠',
    subject: 'ndfa',
    ageGroups: ['adult', 'highschool', 'middleschool', 'elementary', 'kindergarten'],
    launchType: 'external',
    urlEnvKey: 'VITE_NDFA_GAME_URL'
  },
  {
    id: 'ronit',
    title: 'רונית חכם - המכשפות',
    icon: '🎯',
    subject: 'ronit_reading',
    ageGroups: ['elementary', 'kindergarten'],
    launchType: 'external',
    urlEnvKey: 'VITE_RONIT_GAME_URL'
  },
  {
    id: 'cbt',
    title: 'מלחמה',
    icon: '🛡️',
    subject: 'cbt_youth',
    ageGroups: ['middleschool', 'highschool'],
    launchType: 'external',
    urlEnvKey: 'VITE_CBT_GAME_URL'
  }
]

function collectSolutionsFromDeck(deckList) {
  const byPair = {}
  if (!Array.isArray(deckList)) return []
  deckList.forEach((c) => {
    const pid = c.pairId
    if (pid === undefined) return
    if (!byPair[pid]) byPair[pid] = { pairId: pid }
    const row = byPair[pid]
    if (c.explanation) row.explanation = c.explanation
    if (c.mathTopic) row.mathTopic = c.mathTopic
    if (c.matchSize) row.matchSize = c.matchSize
    if (c.pairVariant) row.pairVariant = c.pairVariant
    if (c.cardRole === 'visual' && c.visual) row.visual = c.visual
    if (c.cardRole === 'decimal' && c.text) row.decimal = c.text
    if (c.cardRole === 'fraction' && c.text) row.fraction = c.text
    if (c.type === 'word' && !c.cardRole && c.text) row.question = c.text
    if (c.type === 'picture' && !c.cardRole && c.text) row.answer = c.text
  })
  return Object.keys(byPair)
    .map((k) => {
      const r = byPair[k]
      let question = r.question
      if (r.matchSize === 3) {
        question = 'שלב 4: הרם 3 קלפים — ציור, עשרוני ושבר לאותה כמות.'
      } else if (r.pairVariant === 'decimal_fraction' || (r.decimal && r.fraction && !r.visual)) {
        question = `התאימו עשרוני לשבר: ${r.decimal} ↔ ${r.fraction}`
      } else if (r.pairVariant === 'fraction_visual' || (r.fraction && r.visual && r.matchSize !== 3)) {
        question = `התאימו שבר לציור (הציור בלי מלל): ${r.fraction}`
      }
      const answer =
        r.fraction && r.decimal ? `${r.fraction} = ${r.decimal}` : (r.fraction || r.decimal || r.answer || '—')
      return {
        pairId: Number(k),
        question,
        answer,
        decimal: r.decimal,
        fraction: r.fraction,
        visual: r.visual,
        explanation: r.explanation,
        mathTopic: r.mathTopic,
        matchSize: r.matchSize
      }
    })
    .sort((a, b) => a.pairId - b.pairId)
}

function mathTopicLabel(topic) {
  if (topic === 'triple') return 'שלישייה (שלב 4)'
  if (topic === 'decimal_pair') return 'עשרוני ↔ שבר'
  if (topic === 'part') return 'שבר ↔ ציור'
  if (topic === 'decimal') return 'שבר עשרוני'
  return ''
}

function App() {
  const [screen, setScreen] = useState('menu')
  const [screenHistory, setScreenHistory] = useState([])
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [socket, setSocket] = useState(null)
  const [error, setError] = useState('')
  const [roomsList, setRoomsList] = useState([])
  const [roomId, setRoomId] = useState('')
  const [room, setRoom] = useState(null)
  const [deck, setDeck] = useState([])
  const [flipped, setFlipped] = useState([])
  const [matched, setMatched] = useState([])
  const [matchModal, setMatchModal] = useState(null)
  const [maxPlayers, setMaxPlayers] = useState(2)
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [gameScores, setGameScores] = useState({})
  const [playerMatchedIndices, setPlayerMatchedIndices] = useState({})
  const [scoreBump, setScoreBump] = useState(null)
  const [showVoiceTest, setShowVoiceTest] = useState(false)
  const [customRecordings, setCustomRecordings] = useState([])
  const [successCombos, setSuccessCombos] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [newComboSound, setNewComboSound] = useState(SOUND_PRESETS[0]?.id || 'fanfare1')
  const [newComboVoice, setNewComboVoice] = useState('')
  const [gameLevel, setGameLevel] = useState(1)
  const [currentGameStory, setCurrentGameStory] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState('reading')
  const [selectedAgeGroup, setSelectedAgeGroup] = useState('')
  const [lastPlayedGameId, setLastPlayedGameId] = useState('')
  const [menuRoomsBySubject, setMenuRoomsBySubject] = useState({})
  const gameDisplayRef = useRef({ scores: {}, matched: [] })
  const currentGameStoryRef = useRef(null)
  const [storyMode, setStoryMode] = useState('game') // 'game' | 'pyramid'
  const currentGameStoryIdRef = useRef(null)
  const currentGamePairIndicesRef = useRef(null)
  const audioContextRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const prevScreenRef = useRef(null)
  const isGoingBackRef = useRef(false)
  const lastRegisteredRef = useRef({ email: '', nickname: '' })
  const hubModeRef = useRef('reading')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const s = loadHubSession()
    const lp =
      (s && typeof s.lastPlayedGameId === 'string' && s.lastPlayedGameId) ||
      (s && typeof s.selectedGameId === 'string' && s.selectedGameId) ||
      ''
    if (lp) setLastPlayedGameId(lp)
    if (s && (s.email || s.nickname || s.selectedAgeGroup || s.selectedSubject)) {
      if (lp) saveLastPlayedGameOnly(lp)
      else localStorage.removeItem(READING_HUB_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    const prev = prevScreenRef.current
    prevScreenRef.current = screen
    if (!prev || prev === screen) return
    if (isGoingBackRef.current) {
      isGoingBackRef.current = false
      return
    }
    setScreenHistory((h) => [...h, prev])
  }, [screen])

  const goBack = () => {
    setScreenHistory((h) => {
      if (!h || h.length === 0) return h
      const next = h[h.length - 1]
      isGoingBackRef.current = true
      setScreen(next)
      return h.slice(0, -1)
    })
  }

  const handleSelectLevelFromTopNav = (level) => {
    if (!socket || !room) return
    if (screen === 'room' && room.status !== 'playing') {
      setGameLevel(level)
      return
    }
    handleStartLevel(level)
  }

  function resumeAudioContext() {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (!audioContextRef.current) audioContextRef.current = new Ctx()
    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  }

  const connectSocket = useCallback((loginEmail, loginNickname, registerOverrides = null) => {
    const em = (loginEmail != null ? loginEmail : email).toString().trim()
    const nick = (loginNickname != null ? loginNickname : nickname).toString().trim()
    const regSubject =
      registerOverrides && registerOverrides.subject != null && registerOverrides.subject !== ''
        ? registerOverrides.subject
        : selectedSubject
    const regAgeGroup =
      registerOverrides && registerOverrides.ageGroup != null && registerOverrides.ageGroup !== ''
        ? registerOverrides.ageGroup
        : selectedAgeGroup
    const regGameId =
      registerOverrides && registerOverrides.gameId != null && registerOverrides.gameId !== ''
        ? registerOverrides.gameId
        : undefined
    hubModeRef.current =
      registerOverrides && registerOverrides.hubMode === 'math_fractions' ? 'math_fractions' : 'reading'
    const regGameType =
      hubModeRef.current === 'math_fractions' ? 'math_fraction_memory' : 'reading_memory'
    const isRender = SOCKET_URL && SOCKET_URL.includes('onrender.com')
    let currentSocket = null
    let retryTimeoutId = null

    function tryConnect(retryCount) {
      if (currentSocket) {
        currentSocket.removeAllListeners()
        currentSocket.disconnect()
        currentSocket = null
      }
      const s = io(SOCKET_URL || window.location.origin, {
        path: '/socket.io',
        transports: isRender ? ['polling'] : ['polling', 'websocket']
      })
      currentSocket = s

      s.on('connect', () => {
        setError('')
        setSocket(s)
        s.emit('register', {
          email: em,
          nickname: nick,
          game_type: regGameType,
          subject: regSubject,
          age_group: regAgeGroup,
          game_id: regGameId
        })
      })
      s.on('connect_error', () => {
        s.disconnect()
        if (isRender && retryCount < 5) {
          setError(`מעיר את השרת... נסיון ${retryCount + 1}/5`)
          retryTimeoutId = setTimeout(() => tryConnect(retryCount + 1), 6000)
        } else {
          setError('לא ניתן להתחבר. וודא שהשרת רץ: ' + SOCKET_URL)
        }
      })
      s.on('disconnect', (reason) => {
        if (reason === 'io server disconnect' || reason === 'io client disconnect') return
        setError('התנתקת מהשרת. נסה להתחבר שוב.')
      })
      s.on('registered', () => {
        lastRegisteredRef.current = { email: em, nickname: nick }
        const lp = regGameId != null && regGameId !== '' ? String(regGameId) : ''
        if (lp) {
          setLastPlayedGameId(lp)
          saveLastPlayedGameOnly(lp)
        }
        setScreen('lobby')
      })
      s.on('error', (data) => setError(data?.message || 'שגיאה'))
      s.on('roomCreated', (data) => {
        setRoomId(data.roomId)
        setRoom(data.room)
        setScreen('room')
        setError('')
      })
      s.on('joinedRoom', (data) => {
        setRoomId(data.roomId)
        setRoom(data.room)
        setScreen('room')
        setError('')
      })
      s.on('roomUpdate', (data) => {
        const matchedArr = Array.isArray(data.matched) ? data.matched : []
        setRoom((prev) => {
          if (!prev || prev.status !== 'playing') return data
          const scores = data.scores != null ? data.scores : (prev.scores ?? {})
          return { ...data, scores, matched: matchedArr }
        })
        if (matchedArr.length >= 0) setMatched(matchedArr)
      })
      s.on('roomsList', (data) => setRoomsList(data || []))
      s.on('gameStarted', (data) => {
        gameDisplayRef.current = { scores: {}, matched: [] }
        setGameScores({})
        setPlayerMatchedIndices({})
        setRoom(data.room ? { ...data.room, matched: [], scores: {} } : data.room)
        setDeck(data.deck || [])
        setFlipped([])
        setMatched([])
        if (hubModeRef.current === 'math_fractions') {
          currentGameStoryRef.current = null
          setCurrentGameStory(null)
        } else if (data.story && data.story.text) {
          currentGameStoryRef.current = data.story
          setCurrentGameStory(data.story)
        } else {
          currentGameStoryRef.current = null
          setCurrentGameStory(null)
        }
        setScreen('game')
        setError('')
      })
      s.on('cardFlipped', (data) => setFlipped(data.flipped || []))
      s.on('match', (data) => {
        const scoredId = data.scoredPlayerId
        const roomPayload = data.room || {}
        const newMatched = Array.isArray(roomPayload.matched) ? roomPayload.matched : (Array.isArray(data.cardIndices) ? data.cardIndices : [])
        const newScores = roomPayload.scores != null ? roomPayload.scores : (data.scores || {})
        gameDisplayRef.current = { scores: newScores, matched: newMatched }
        setGameScores(typeof newScores === 'object' && newScores !== null ? newScores : {})
        setScoreBump(scoredId)
        setTimeout(() => setScoreBump(null), 800)
        setPlayerMatchedIndices((prev) => ({
          ...prev,
          [scoredId]: [...(prev[scoredId] || []), ...(Array.isArray(data.cardIndices) ? data.cardIndices : [])]
        }))
        setMatched(newMatched)
        setFlipped([])
        if (data.room) {
          setRoom({
            ...data.room,
            scores: newScores,
            matched: newMatched
          })
        }
        const myNewScore = newScores[s.id] ?? 0
        const isMe = scoredId === s.id
        const isMathHub = hubModeRef.current === 'math_fractions'
        const cat = isMathHub ? MATH_FRACTION_CATEGORY : READING_CATEGORY
        const triple =
          isMathHub && Array.isArray(data.cardIndices) && data.cardIndices.length >= 3
        const text = isMe
          ? isMathHub
            ? triple
              ? `מצאת שלישייה (ציור + עשרוני + שבר)! +1 נקודה. סה״כ ${myNewScore} נקודות`
              : `מצאת זוג מתאים! +1 נקודה. סה״כ ${myNewScore} נקודות`
            : `מצאת זוג! המילה מתאימה לתמונה. קיבלת נקודה. סה״כ ${myNewScore} נקודות`
          : isMathHub
            ? triple
              ? 'שחקן אחר מצא שלישייה מתאימה וקיבל נקודה.'
              : 'שחקן אחר מצא זוג מתאים וקיבל נקודה.'
            : 'שחקן אחר מצא זוג וקיבל נקודה.'
        audioContextRefForCombo.current = audioContextRef.current
        if (successCombosRef.current.length > 0) {
          playSuccessVoice(isMe)
        } else {
          playSuccessSound(audioContextRef.current)
          playSuccessVoice(isMe)
        }
        setMatchModal({
          title: cat.title,
          emoji: cat.emoji,
          text
        })
      })
      s.on('noMatch', (data) => {
        setFlipped([])
        if (data.room) setRoom(data.room)
      })
      s.on('activityClosed', () => setMatchModal(null))
    }

    tryConnect(0)
    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId)
      if (currentSocket) {
        currentSocket.removeAllListeners()
        currentSocket.disconnect()
      }
    }
  }, [email, nickname, selectedSubject, selectedAgeGroup])

  useEffect(() => {
    if (screen === 'lobby' && socket) socket.emit('listRooms')
    const id = setInterval(() => {
      if (screen === 'lobby' && socket) socket.emit('listRooms')
    }, 3000)
    return () => clearInterval(id)
  }, [screen, socket])

  useEffect(() => {
    let cancelled = false
    getAllRecordedVoices()
      .then((rows) => {
        if (cancelled) return
        setCustomRecordings((prev) => {
          prev.forEach((r) => URL.revokeObjectURL(r.url))
          return (rows || []).map((r) => ({ id: r.id, url: URL.createObjectURL(r.blob) }))
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const voiceUrlMap = {}
    customRecordings.forEach((r) => { voiceUrlMap[r.id] = r.url })
    getAllSuccessCombos()
      .then((rows) => {
        if (cancelled) return
        const list = (rows || []).map((c) => {
          const soundLabel = SOUND_PRESETS.find((p) => p.id === c.soundId)?.label || c.soundId
          let voiceUrl = voiceUrlMap[c.voiceId]
          let voiceLabel = c.voiceId
          if (c.voiceType === 'builtin') {
            const ent = VOICE_ENTRIES.find((e) => e.name === c.voiceId)
            voiceUrl = ent?.url
            voiceLabel = ent ? `מובנה ${ent.name}` : c.voiceId
          } else if (voiceUrl) {
            voiceLabel = `הקלטה ${c.voiceId}`
          }
          return { ...c, voiceUrl, soundLabel, voiceLabel }
        }).filter((c) => c.voiceUrl)
        setSuccessCombos(list)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [customRecordings])

  useEffect(() => {
    successCombosRef.current = successCombos
      .filter((c) => c.voiceUrl)
      .map((c) => ({ soundId: c.soundId, voiceUrl: c.voiceUrl }))
  }, [successCombos])

  useEffect(() => {
    successVoiceUrlsRef.current = customRecordings.length > 0
      ? customRecordings.map((r) => r.url)
      : VOICE_URLS.slice()
  }, [customRecordings])

  const handleStartRecord = async () => {
    setRecordError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const rec = new MediaRecorder(stream)
      mediaRecorderRef.current = rec
      const chunks = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      rec.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (chunks.length === 0) { setIsRecording(false); return }
        const blob = new Blob(chunks, { type: 'audio/webm' })
        try {
          await addRecordedVoice(blob)
          const rows = await getAllRecordedVoices()
          setCustomRecordings((prev) => {
            prev.forEach((r) => URL.revokeObjectURL(r.url))
            return rows.map((r) => ({ id: r.id, url: URL.createObjectURL(r.blob) }))
          })
        } catch (_) { setRecordError('שגיאה בשמירה') }
        setIsRecording(false)
      }
      rec.start()
      setIsRecording(true)
    } catch (_) {
      setRecordError('אין גישה למיקרופון')
      setIsRecording(false)
    }
  }

  const handleStopRecord = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop()
  }

  const handleDeleteRecording = async (id, url) => {
    URL.revokeObjectURL(url)
    await deleteRecordedVoice(id)
    setCustomRecordings((prev) => prev.filter((r) => r.id !== id))
  }

  const handleAddCombo = async () => {
    const voiceType = newComboVoice.startsWith('rec_') ? 'recorded' : 'builtin'
    const voiceId = newComboVoice
    if (!voiceId) return
    await addSuccessCombo(newComboSound, voiceType, voiceId)
    const rows = await getAllSuccessCombos()
    const voiceUrlMap = {}
    customRecordings.forEach((r) => { voiceUrlMap[r.id] = r.url })
    setSuccessCombos(rows.map((c) => {
      const soundLabel = SOUND_PRESETS.find((p) => p.id === c.soundId)?.label || c.soundId
      let voiceUrl = voiceUrlMap[c.voiceId]
      let voiceLabel = c.voiceId
      if (c.voiceType === 'builtin') {
        const ent = VOICE_ENTRIES.find((e) => e.name === c.voiceId)
        voiceUrl = ent?.url
        voiceLabel = ent ? `מובנה ${ent.name}` : c.voiceId
      } else if (voiceUrl) voiceLabel = `הקלטה ${c.voiceId}`
      return { ...c, voiceUrl, soundLabel, voiceLabel }
    }).filter((c) => c.voiceUrl))
    setNewComboVoice('')
  }

  const handleDeleteCombo = async (id) => {
    await deleteSuccessCombo(id)
    setSuccessCombos((prev) => prev.filter((c) => c.id !== id))
  }

  const handlePlayCombo = (combo) => {
    resumeAudioContext()
    audioContextRefForCombo.current = audioContextRef.current
    playSuccessCombo(combo)
  }

  const handlePreviewSound = () => {
    resumeAudioContext()
    audioContextRefForCombo.current = audioContextRef.current
    playSoundPreset(audioContextRef.current, newComboSound)
  }

  const handlePreviewVoice = () => {
    if (!newComboVoice) return
    const rec = customRecordings.find((r) => r.id === newComboVoice)
    const url = rec ? rec.url : (VOICE_ENTRIES.find((e) => e.name === newComboVoice)?.url)
    if (url) new Audio(url).play().catch(() => {})
  }

  const handleClearHubUser = () => {
    clearHubSession()
    lastRegisteredRef.current = { email: '', nickname: '' }
    setEmail('')
    setNickname('')
    setSelectedAgeGroup('')
    setLastPlayedGameId('')
    setError('')
    if (socket) {
      try {
        socket.removeAllListeners()
      } catch (_) {
        /* ignore */
      }
      socket.disconnect()
      setSocket(null)
    }
  }

  const handleStartFromMenu = (game) => {
    if (!selectedAgeGroup) {
      setError('נא לבחור קבוצת גיל')
      return
    }

    setSelectedSubject(game.subject)
    setError('')

    if (game.launchType === 'internal') {
      if (!game.ageGroups.includes(selectedAgeGroup)) {
        setError(`קבוצת הגיל שנבחרה אינה זמינה עבור ${game.title}`)
        return
      }
      const em = email.trim()
      const nick = nickname.trim()
      if (!em || !nick) {
        setError('נא למלא אימייל ושם במשחק בתפריט לפני כניסה למשחק')
        return
      }
      const previousInternalGameId = lastPlayedGameId
      hubModeRef.current = game.id === 'math_fractions_memory' ? 'math_fractions' : 'reading'
      setLastPlayedGameId(game.id)
      saveLastPlayedGameOnly(game.id)
      const apiGameType =
        game.id === 'math_fractions_memory' ? 'math_fraction_memory' : 'reading_memory'
      fetch(`${API_BASE}/api/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          nickname: nick,
          game_type: apiGameType,
          subject: game.subject,
          age_group: selectedAgeGroup,
          game_id: game.id
        })
      }).catch(() => {})

      const regOpts = {
        subject: game.subject,
        ageGroup: selectedAgeGroup,
        gameId: game.id,
        hubMode: hubModeRef.current
      }
      if (
        socket &&
        socket.connected &&
        lastRegisteredRef.current.email === em &&
        lastRegisteredRef.current.nickname === nick &&
        previousInternalGameId === game.id
      ) {
        setScreen('lobby')
        return
      }
      if (socket) {
        try {
          socket.removeAllListeners()
        } catch (_) {
          /* ignore */
        }
        socket.disconnect()
        setSocket(null)
      }
      connectSocket(em, nick, regOpts)
      return
    }

    const em = email.trim()
    const nick = nickname.trim()
    if (!em || !nick) {
      setError('נא למלא אימייל ושם במשחק בתפריט לפני כניסה למשחק')
      return
    }
    const launchUrl = buildExternalGameLaunchUrl(game, selectedAgeGroup, em, nick)
    if (!launchUrl) {
      const externalUrl = import.meta.env[game.urlEnvKey]
      if (!externalUrl || typeof externalUrl !== 'string') {
        setError(`חסר ${game.urlEnvKey}. יש להגדיר משתנה סביבה כדי לפתוח את ${game.title}.`)
        return
      }
      try {
        const u = externalUrl.trim()
        if (!u) throw new Error('empty')
        if (u.startsWith('/')) {
          if (typeof window === 'undefined') throw new Error('no window')
          void new URL(u, window.location.origin)
        } else {
          void new URL(u)
        }
      } catch {
        setError(`כתובת לא תקינה ב-${game.urlEnvKey}`)
        return
      }
      setError(`לא ניתן לבנות כתובת כניסה ל«${game.title}». נא לבחור קבוצת גיל.`)
      return
    }
    setLastPlayedGameId(game.id)
    saveLastPlayedGameOnly(game.id)
    /* ניווט באותו חלון; אם הכתובת באותו מקור כמו READING (למשל /cbt דרך proxy) – בלי top.assign שמפיל chrome-error ב-preview */
    if (typeof window !== 'undefined') window.location.assign(launchUrl)
  }

  useEffect(() => {
    if (screen !== 'menu') return
    let cancelled = false
    const loadRooms = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/rooms`)
        if (!res.ok) throw new Error('failed to load rooms')
        const rows = await res.json()
        if (!Array.isArray(rows)) throw new Error('invalid rooms payload')
        const grouped = {}
        for (const row of rows) {
          const key = row?.subject || 'unknown'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(row)
        }
        if (!cancelled) setMenuRoomsBySubject(grouped)
      } catch (_) {
        if (!cancelled) setMenuRoomsBySubject({})
      }
    }
    loadRooms()
    const id = setInterval(loadRooms, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [screen])

  const handleCreateRoom = () => {
    setError('')
    if (!socket) return
    socket.emit('createRoom', {
      maxPlayers: maxPlayers,
      pairCount: PAIR_COUNT,
      subject: selectedSubject,
      age_group: selectedAgeGroup,
      email,
      nickname
    })
  }

  const handleJoinRoom = (code) => {
    setError('')
    if (!socket || !code) return
    socket.emit('joinRoom', {
      roomId: code.trim().toUpperCase(),
      subject: selectedSubject,
      age_group: selectedAgeGroup,
      email,
      nickname
    })
  }

  const handleStartGame = () => {
    if (!socket) return
    const pairCount = room?.pairCount ?? PAIR_COUNT
    if (hubModeRef.current === 'math_fractions') {
      const { deck, matchSize } = buildFractionMemoryDeck(pairCount, gameLevel)
      const customDeck = shuffleDeck(deck)
      currentGameStoryRef.current = null
      setCurrentGameStory(null)
      socket.emit('startGame', { roomId, deck: customDeck, matchSize })
      return
    }
    const storyId = getRandomPyramidStoryId()
    currentGameStoryIdRef.current = storyId
    const { deck, story } = buildPyramidDeckWithStory(pairCount, gameLevel, storyId)
    currentGamePairIndicesRef.current = story?.pairIndices ?? null
    const customDeck = shuffleDeck(deck)
    currentGameStoryRef.current = story
    setCurrentGameStory(story)
    socket.emit('startGame', { roomId, deck: customDeck, story })
  }

  const handleReplay = () => {
    if (!socket || !room) return
    const pairCount = room.pairCount ?? PAIR_COUNT
    if (hubModeRef.current === 'math_fractions') {
      const { deck, matchSize } = buildFractionMemoryDeck(pairCount, gameLevel)
      const deckToUse = shuffleDeck(deck)
      currentGameStoryRef.current = null
      setCurrentGameStory(null)
      socket.emit('startGame', { roomId, deck: deckToUse, matchSize })
      return
    }
    const storyId = getRandomPyramidStoryId()
    currentGameStoryIdRef.current = storyId
    const { deck, story } = buildPyramidDeckWithStory(pairCount, gameLevel, storyId)
    currentGamePairIndicesRef.current = story?.pairIndices ?? null
    const deckToUse = shuffleDeck(deck)
    currentGameStoryRef.current = story
    setCurrentGameStory(story)
    socket.emit('startGame', { roomId, deck: deckToUse, story })
    /* מצב המשחק מתאפס רק ב-gameStarted – מונע race ו"כל הקלפים נפתחים" */
  }

  const handleStartLevel = (level) => {
    if (!socket || !room) return
    setGameLevel(level)
    const pairCount = room.pairCount ?? PAIR_COUNT
    if (hubModeRef.current === 'math_fractions') {
      const { deck, matchSize } = buildFractionMemoryDeck(pairCount, level)
      const deckToUse = shuffleDeck(deck)
      currentGameStoryRef.current = null
      setCurrentGameStory(null)
      socket.emit('startGame', { roomId, deck: deckToUse, matchSize })
      return
    }
    const storyId = currentGameStoryIdRef.current ?? getRandomPyramidStoryId()
    currentGameStoryIdRef.current = storyId
    const { deck, story } = buildPyramidDeckWithStory(pairCount, level, storyId, currentGamePairIndicesRef.current)
    currentGamePairIndicesRef.current = story?.pairIndices ?? null
    const deckToUse = shuffleDeck(deck)
    currentGameStoryRef.current = story
    setCurrentGameStory(story)
    socket.emit('startGame', { roomId, deck: deckToUse, story })
    /* מצב המשחק מתאפס רק ב-gameStarted – מונע race ו"כל הקלפים נפתחים" */
  }

  const handleShowSolutions = () => {
    if (!Array.isArray(deck) || deck.length === 0) {
      setError('אין קלפים במשחק הנוכחי – לא ניתן להציג פתרונות.')
      return
    }
    setError('')
    setScreen('solutions')
  }

  const handleShowStory = () => {
    setStoryMode('game')
    setScreen('story')
  }

  const handleShowPyramidStory = () => {
    setStoryMode('pyramid')
    setScreen('story')
  }

  const handleFlip = (cardIndex) => {
    if (!socket || !room || room.status !== 'playing') return
    const ms = room.matchSize != null ? Number(room.matchSize) : 2
    const need = ms === 3 ? 3 : 2
    if (flipped.length >= need || flipped.includes(cardIndex) || matched.includes(cardIndex)) return
    const currentId = room.players[room.currentTurnIndex]?.id
    if (socket.id !== currentId) return
    resumeAudioContext()
    socket.emit('flipCard', { roomId, cardIndex })
  }

  const closeMatchModal = () => {
    if (socket) socket.emit('activityDone', { roomId })
    setMatchModal(null)
  }

  const currentTurnPlayer = room?.players?.[room?.currentTurnIndex]
  const currentTurnId = currentTurnPlayer?.id
  const isMyTurn = socket && currentTurnId === socket.id
  const turnPlayerName = currentTurnPlayer?.nickname ?? 'שחקן'

  function onCardImageError(e) {
    const el = e.target
    if (el && el.nextElementSibling) {
      el.style.display = 'none'
      el.nextElementSibling.style.display = 'flex'
    }
  }

  function renderCardFront(card) {
    if (!card) return '?'
    if (card.category === 'math_fractions') {
      if (card.visualOnly === true && card.visual) {
        return (
          <span className="card-math-visual-only-wrap" aria-hidden>
            <span className="fraction-art-wrap fraction-art-wrap--solo">
              <FractionQuestionArt visual={card.visual} />
            </span>
          </span>
        )
      }
      if (card.type === 'picture' && card.cardRole === 'fraction' && card.text) {
        return <span className="card-word-text card-math-answer">{card.text}</span>
      }
      if (card.type === 'picture' && card.text) {
        return <span className="card-word-text card-math-answer">{card.text || '?'}</span>
      }
      if (card.type === 'word' && card.cardRole === 'decimal') {
        return (
          <span className="card-math-question-wrap">
            <span className="card-math-badge card-math-badge--decimal">עשרוני</span>
            <span className="card-word-text card-math-decimal">{card.text || '?'}</span>
          </span>
        )
      }
      if (card.type === 'word' && card.cardRole === 'fraction') {
        return (
          <span className="card-math-question-wrap">
            <span className="card-math-badge">שבר</span>
            <span className="card-word-text card-math-fraction-card">{card.text || '?'}</span>
          </span>
        )
      }
      return (
        <span className="card-math-question-wrap">
          <span className="card-math-badge">שאלה</span>
          <span className="card-word-text">{card.text || '?'}</span>
        </span>
      )
    }
    if (card.type === 'picture' && card.emoji) {
      const imgUrl = getTwemojiUrl(card.emoji)
      if (!imgUrl) return <span className="card-picture-fallback">{card.emoji}</span>
      return (
        <span className="card-picture-wrap">
          <img src={imgUrl} alt="" className="card-picture-img" draggable={false} onError={onCardImageError} />
          <span className="card-picture-fallback" style={{ display: 'none' }}>{card.emoji}</span>
        </span>
      )
    }
    return <span className="card-word-text">{card.text || card.category || '?'}</span>
  }

  const isMathFractionHub = selectedSubject === 'math_fractions_elementary'

  return (
    <div className="app">
      <h1>{isMathFractionHub ? 'משחק זיכרון – שברים (יסודי)' : 'משחק זיכרון – התאמת תמונה למילה'}</h1>
      <p className="subtitle">
        {isMathFractionHub
          ? 'זיהוי חלק משלם והמרה לשבר עשרוני · לשניים (או עד 3 שחקנים)'
          : 'ראשית לימוד קריאה · לשניים (או עד 3 שחקנים)'}
      </p>

      <div className="top-nav">
        <button type="button" className="top-nav-btn" onClick={goBack} disabled={screenHistory.length === 0}>
          חזרה אחורה
        </button>
        {room && socket && room.players?.[0]?.id === socket?.id && (
          <span className="top-nav-levels">
            <button type="button" className={`top-nav-small ${gameLevel === 1 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(1)}>שלב 1</button>
            <button type="button" className={`top-nav-small ${gameLevel === 2 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(2)}>שלב 2</button>
            <button type="button" className={`top-nav-small ${gameLevel === 3 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(3)}>שלב 3</button>
            <button type="button" className={`top-nav-small ${gameLevel === 4 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(4)}>{isMathFractionHub ? 'שלב 4 (הרם 3)' : 'שלב 4'}</button>
            {(screen === 'game' || screen === 'story' || screen === 'solutions') && (
              <button type="button" className="top-nav-small" onClick={handleReplay}>משחק חדש</button>
            )}
          </span>
        )}
      </div>

      {screen === 'menu' && (
        <>
          <div className="main-menu-box">
            <h2>תפריט ראשי</h2>
            <p>
              מלאו <strong>אימייל, שם וגיל</strong> בכל כניסה (הדפדפן יכול להשלים לבד כמו בטפסים רגילים). השרת שומר זהות
              בהתחברות למשחק הפנימי. <strong>לא</strong> נשמרים אצלנו בשמירה מקומית – רק סימון &quot;אחרון ששיחקת&quot; על משחק.
            </p>
            <div className="form-row">
              <label>קבוצת גיל</label>
              <select
                value={selectedAgeGroup}
                onChange={(e) => setSelectedAgeGroup(e.target.value)}
                autoComplete="off"
                name="age_group"
              >
                <option value="">בחר קבוצת גיל...</option>
                {AGE_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>אימייל (זהות גלובלית לכל המשחקים)</label>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="form-row">
              <label>שם במשחק</label>
              <input
                type="text"
                name="nickname"
                autoComplete="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="השם שלי"
              />
            </div>
            <p className="voice-manage-link-wrap">
              <button type="button" className="link-btn" onClick={() => setScreen('voiceManage')}>
                ניהול קולות הצלחה (צליל + קול)
              </button>
              <button type="button" className="link-btn" onClick={handleClearHubUser}>
                ניקוי שמירה מקומית (אחרון ששיחקת) וניתוק
              </button>
            </p>
            <div className="game-cards-grid">
              {GAME_CATALOG.map((game) => {
                const ageLabels = AGE_OPTIONS
                  .filter((a) => game.ageGroups.includes(a.value))
                  .map((a) => a.label)
                const ageMatches = !selectedAgeGroup || game.ageGroups.includes(selectedAgeGroup)
                const waitingRooms = menuRoomsBySubject[game.subject] || []
                const waitingCount = waitingRooms.length
                const waitingNames = waitingRooms
                  .flatMap((r) => (Array.isArray(r.players) ? r.players : []))
                  .map((p) => p?.nickname)
                  .filter(Boolean)
                  .slice(0, 5)
                return (
                  <div
                    key={game.id}
                    className={`game-card-btn ${selectedAgeGroup && !ageMatches ? 'game-card-age-warn' : ''}`}
                  >
                    <span className="game-card-icon">{game.icon}</span>
                    <span className="game-card-title">{game.title}</span>
                    {selectedAgeGroup && !ageMatches && (
                      <span className="game-card-age-hint">לא תואם לגיל שנבחר – אפשר לשנות גיל או לנסות (יוצגת שגיאה)</span>
                    )}
                    <span className="game-card-meta">נושא: {game.subject}</span>
                    <span className="game-card-meta">גילים: {ageLabels.join(', ')}</span>
                    <span className="game-card-meta">חדרים ממתינים: {waitingCount}</span>
                    <span className="game-card-meta">
                      מחוברים: {waitingNames.length > 0 ? waitingNames.join(', ') : 'אין'}
                    </span>
                    <button type="button" className="game-card-start-btn" onClick={() => handleStartFromMenu(game)}>
                      {game.launchType === 'internal'
                        ? 'פתיחה ויצירת/הצטרפות למשחק'
                        : 'כניסה למשחק'}
                    </button>
                    {game.id === lastPlayedGameId && (
                      <span className="game-card-last">אחרון ששיחקת (אפשר לבחור אחר)</span>
                    )}
                  </div>
                )
              })}
            </div>
            {error && <p className="error-msg">{error}</p>}
          </div>
        </>
      )}

      {screen === 'voiceManage' && (
        <div className="voice-manage-page">
          <h2>ניהול קולות הצלחה – צליל + קול</h2>
          <p className="voice-manage-desc">בכל הרמת זוג מוצלחת יושמע אקראית אחד מהשילובים שלך (צליל ואז קול).</p>

          <div className="voice-manage-section">
            <h3>שלב 1: הקלטות שלי</h3>
            <p className="voice-manage-hint">הקלט קול (למשל «אתה תותח!») – אחרי ההקלטה הוא יופיע כאפשרות בבחירת קול.</p>
            {recordError && <p className="error-msg">{recordError}</p>}
            <div className="voice-manage-record">
              {!isRecording ? (
                <button type="button" onClick={handleStartRecord}>הקליט קול חדש</button>
              ) : (
                <button type="button" className="recording-btn" onClick={handleStopRecord}>עצור הקלטה</button>
              )}
            </div>
            <ul className="voice-manage-list">
              {customRecordings.map((r) => (
                <li key={r.id}>
                  <button type="button" className="small-btn" onClick={() => new Audio(r.url).play().catch(() => {})}>השמע</button>
                  <span>{r.id}</span>
                  <button type="button" className="small-btn delete-btn" onClick={() => handleDeleteRecording(r.id, r.url)}>מחק</button>
                </li>
              ))}
              {customRecordings.length === 0 && VOICE_ENTRIES.length === 0 && (
                <li className="muted">אין עדיין קולות. לחץ «הקליט קול חדש» למעלה (תן הרשאת מיקרופון), אמר משהו כמו «אתה תותח!» ולחץ «עצור הקלטה».</li>
              )}
              {customRecordings.length === 0 && VOICE_ENTRIES.length > 0 && (
                <li className="muted">אין הקלטות שלך. אפשר להקליט כאן או לבחור קול מובנה ב«הוסף שילוב».</li>
              )}
            </ul>
          </div>

          <div className="voice-manage-section">
            <h3>שלב 2: הוסף שילוב (צליל + קול)</h3>
            <p className="voice-manage-hint">בחר פנפרה וקול, השמע ואז הוסף. הקול יכול להיות «הקלטה שלי» (משלב 1) או «מובנה» (אם יש קבצי v1–v6 בפרויקט).</p>
            <div className="voice-manage-form">
              <label>צליל (פנפרה):</label>
              <select value={newComboSound} onChange={(e) => setNewComboSound(e.target.value)}>
                {SOUND_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button type="button" className="small-btn" onClick={handlePreviewSound}>השמע צליל</button>
              <label>קול:</label>
              <select value={newComboVoice} onChange={(e) => setNewComboVoice(e.target.value)}>
                <option value="">בחר קול...</option>
                {customRecordings.map((r) => (
                  <option key={r.id} value={r.id}>הקלטה שלי ({r.id})</option>
                ))}
                {VOICE_ENTRIES.map((e) => (
                  <option key={e.name} value={e.name}>מובנה {e.name}</option>
                ))}
              </select>
              {customRecordings.length === 0 && VOICE_ENTRIES.length === 0 && (
                <span className="voice-no-options">אין קולות – הקלט קול ב«שלב 1» למעלה.</span>
              )}
              <button type="button" className="small-btn" onClick={handlePreviewVoice} disabled={!newComboVoice}>השמע קול</button>
              <button type="button" onClick={handleAddCombo} disabled={!newComboVoice}>הוסף שילוב</button>
            </div>
          </div>

          <div className="voice-manage-section">
            <h3>שילובים (צליל + קול) – אלה יושמעו במשחק</h3>
            <ul className="voice-manage-list">
              {successCombos.map((c) => (
                <li key={c.id}>
                  <button type="button" className="small-btn" onClick={() => handlePlayCombo(c)}>השמע</button>
                  <span>{c.soundLabel} + {c.voiceLabel}</span>
                  <button type="button" className="small-btn delete-btn" onClick={() => handleDeleteCombo(c.id)}>מחק</button>
                </li>
              ))}
              {successCombos.length === 0 && <li className="muted">אין שילובים. בצע שלב 1 (הקלטה) ושלב 2 (הוסף שילוב).</li>}
            </ul>
          </div>
          <p className="voice-manage-link-wrap">
            <button type="button" className="link-btn" onClick={() => setScreen('menu')}>חזרה לתפריט ראשי</button>
          </p>
        </div>
      )}

      {screen === 'lobby' && (
        <>
          <p>שלום, {nickname}. ברירת המחדל: שני שחקנים. צור חדר או הצטרף לחדר קיים.</p>
          <div className="lobby-actions">
            <label>מספר שחקנים: </label>
            <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <button onClick={handleCreateRoom}>צור חדר חדש</button>
          </div>
          <h3>חדרים פתוחים</h3>
          <ul className="room-list">
            {roomsList.length === 0 && <li>אין חדרים פתוחים. צור חדר חדש.</li>}
            {roomsList.map((r) => (
              <li key={r.roomId || r.code}>
                <span>חדר {r.roomId || r.code} – {r.players?.map((p) => p.nickname).join(', ')} ({r.players?.length}/{r.maxPlayers})</span>
                <button className="join-btn" onClick={() => handleJoinRoom(r.roomId || r.code)}>הצטרף</button>
              </li>
            ))}
          </ul>
          <div className="form-row">
            <label>הזן קוד חדר להצטרפות</label>
            <input value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value)} placeholder="קוד חדר" />
            <button onClick={() => handleJoinRoom(joinRoomCode)}>הצטרף לחדר</button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </>
      )}

      {screen === 'room' && room && (
        <>
          <p className="room-code">קוד החדר: <strong>{roomId}</strong></p>
          <p>שחקנים בחדר: {room.players?.map((p) => p.nickname).join(', ')} ({room.players?.length}/{room.maxPlayers})</p>
          {room.players?.[0]?.id === socket?.id && (
            <div className="level-select-wrap">
              <p>בחר שלב:</p>
              <span className="level-buttons">
                {isMathFractionHub ? (
                  <>
                    <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => setGameLevel(1)}>שלב 1</button>
                    <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => setGameLevel(2)}>שלב 2</button>
                    <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => setGameLevel(3)}>שלב 3</button>
                    <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => setGameLevel(4)}>שלב 4 (הרם 3)</button>
                  </>
                ) : (
                  <>
                    <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => setGameLevel(1)}>שלב 1 (מילה אחת)</button>
                    <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => setGameLevel(2)}>שלב 2 (שתי מילים)</button>
                    <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => setGameLevel(3)}>שלב 3 (3 מילים)</button>
                    <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => setGameLevel(4)}>שלב 4 (משפט שלם)</button>
                  </>
                )}
              </span>
            </div>
          )}
          {room.players?.[0]?.id === socket?.id && room.players?.length === room.maxPlayers && (
            <button onClick={handleStartGame}>התחל משחק</button>
          )}
          {room.players?.[0]?.id === socket?.id && room.players?.length < room.maxPlayers && (
            <p>מחכים לעוד {room.maxPlayers - room.players?.length} שחקן/ים.</p>
          )}
          {room.players?.[0]?.id !== socket?.id && <p>מחכים לבעל החדר שיתחיל...</p>}
          {error && <p className="error-msg">{error}</p>}
        </>
      )}

      {screen === 'game' && room && (() => {
        const rawMatched = matched.length > 0 ? matched : (Array.isArray(room.matched) ? room.matched : (gameDisplayRef.current.matched || []))
        const matchedList = Array.isArray(rawMatched) ? rawMatched.map((x) => Number(x)) : []
        const gameOver = deck.length > 0 && matchedList.length >= deck.length
        function getPairsForPlayer(deckList, indices) {
          if (!Array.isArray(indices) || !Array.isArray(deckList)) return []
          const pairIds = [...new Set(indices.map((idx) => deckList[idx]?.pairId).filter((x) => x !== undefined))]
          return pairIds.map((pairId) => {
            const group = deckList.filter((c) => c.pairId === pairId)
            if (group.some((c) => c.category === 'math_fractions')) {
              const fr = group.find((c) => c.cardRole === 'fraction' && c.text)
              const dec = group.find((c) => c.cardRole === 'decimal' && c.text)
              const pick = fr || dec || group.find((c) => c.type === 'picture' && c.text)
              return pick || group[0]
            }
            return deckList.find((c) => c.pairId === pairId && c.type === 'picture')
          }).filter(Boolean)
        }
        return (
        <>
          <p className="player-identity">אתה משחק כ: <strong>{nickname}</strong></p>
          <div className="players-turn-grid">
            <p className="players-turn-title">שחקנים</p>
            <div className="players-turn-cards">
              {(room.players || []).map((p) => (
                <div
                  key={p.id}
                  className={`player-turn-card ${p.id === currentTurnId ? 'player-turn-card-active' : ''} ${p.id === socket?.id ? 'player-turn-card-you' : ''}`}
                >
                  <span className="player-turn-card-name">{p.nickname}</span>
                </div>
              ))}
            </div>
            <p className="players-turn-line">
              {isMyTurn ? `תור: ${turnPlayerName} (תורך)` : `תור: ${turnPlayerName}`}
            </p>
            {isMathFractionHub && Number(room?.matchSize) === 3 && (
              <p className="math-match-hint">שלב 4: <strong>הרם 3 קלפים</strong> — ציור, עשרוני ושבר לאותה כמות.</p>
            )}
            {isMathFractionHub && Number(room?.matchSize) === 2 && gameLevel === 1 && (
              <p className="math-match-hint math-match-hint--subtle">שלב 1: התאימו <strong>שבר</strong> ל<strong>ציור</strong> (על קלף הציור אין טקסט).</p>
            )}
            {isMathFractionHub && Number(room?.matchSize) === 2 && gameLevel === 2 && (
              <p className="math-match-hint math-match-hint--subtle">שלב 2: התאימו <strong>מספר עשרוני</strong> ל<strong>שבר</strong> (מכנה שניתן להרחיב ל־10/100…).</p>
            )}
            {isMathFractionHub && Number(room?.matchSize) === 2 && gameLevel === 3 && (
              <p className="math-match-hint math-match-hint--subtle">שלב 3: בחפיסה יש גם זוגות שבר↔ציור וגם עשרוני↔שבר — כל כמות מופיעה פעם אחת.</p>
            )}
          </div>
          <div className="game-over-bar game-actions-bar">
            {isMathFractionHub ? (
              <button type="button" onClick={handleShowSolutions}>פתרונות מלאים (כל הזוגות)</button>
            ) : (
              <>
                <button type="button" onClick={handleShowStory}>סיפור מהמשחק</button>
                <button type="button" onClick={handleShowPyramidStory}>סיפור פירמידה מהמשחק</button>
              </>
            )}
            {room.players?.[0]?.id === socket?.id && (
              <span className="level-choose-wrap">
                <button type="button" onClick={handleReplay}>משחק חדש</button>
                {isMathFractionHub ? (
                  <>
                    <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1</button>
                    <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2</button>
                    <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3</button>
                    <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (הרם 3)</button>
                  </>
                ) : (
                  <>
                    <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1 (מילה אחת)</button>
                    <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2 (שתי מילים)</button>
                    <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3 (3 מילים)</button>
                    <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (משפט שלם)</button>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="game-layout">
            <div className="score-sidebar score-sidebar-left">
              {room.players?.[0] && (() => {
                const p = room.players[0]
                const score = gameScores[p.id] ?? room.scores?.[p.id] ?? p.score ?? 0
                const justScored = scoreBump === p.id
                const pairCards = getPairsForPlayer(deck, playerMatchedIndices[p.id] || [])
                return (
                  <div key={p.id} className={`score-card ${p.id === socket?.id ? 'score-you' : ''} ${p.id === currentTurnId ? 'score-turn' : ''}`}>
                    <div className="score-card-name">{p.nickname}{p.id === currentTurnId ? ' ← תור' : ''}</div>
                    <div className={`score-card-number ${justScored ? 'score-bump' : ''}`}>{score}</div>
                    <div className="score-card-pairs">
                      {pairCards.map((card, idx) => (
                        <div key={idx} className="score-mini-pair">
                          <span className={`score-mini-word${card.category === 'math_fractions' ? ' score-mini-math-fraction' : ''}`}>{card.text || ''}</span>
                          {card.emoji && (
                            <img src={getTwemojiUrl(card.emoji)} alt="" className="score-mini-img" draggable={false} onError={(e) => { e.target.style.display = 'none'; const n = e.target.nextElementSibling; if (n) n.style.display = 'flex'; }} />
                          )}
                          <span className="score-mini-emoji" style={{ display: card.emoji ? 'none' : 'flex' }}>{card.emoji || '✓'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="game-board-wrap">
              <div className="game-board">
                {deck.map((card, i) => {
                  const isMatched = matchedList.includes(i)
                  const isFlipped = flipped.includes(i)
                  const showFront = isFlipped || isMatched
                  return (
                    <div
                      key={i}
                      className={`card ${card.type} ${showFront ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
                      onClick={() => handleFlip(i)}
                    >
                      <div className="card-inner">
                        <div className="card-face card-back">?</div>
                        <div className={`card-face card-front card-front-${card.type}`}>{renderCardFront(card)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="score-sidebar score-sidebar-right">
              {(room.players || []).slice(1).map((p) => {
                const score = gameScores[p.id] ?? room.scores?.[p.id] ?? p.score ?? 0
                const justScored = scoreBump === p.id
                const pairCards = getPairsForPlayer(deck, playerMatchedIndices[p.id] || [])
                return (
                  <div key={p.id} className={`score-card ${p.id === socket?.id ? 'score-you' : ''} ${p.id === currentTurnId ? 'score-turn' : ''}`}>
                    <div className="score-card-name">{p.nickname}{p.id === currentTurnId ? ' ← תור' : ''}</div>
                    <div className={`score-card-number ${justScored ? 'score-bump' : ''}`}>{score}</div>
                    <div className="score-card-pairs">
                      {pairCards.map((card, idx) => (
                        <div key={idx} className="score-mini-pair">
                          <span className={`score-mini-word${card.category === 'math_fractions' ? ' score-mini-math-fraction' : ''}`}>{card.text || ''}</span>
                          {card.emoji && (
                            <img src={getTwemojiUrl(card.emoji)} alt="" className="score-mini-img" draggable={false} onError={(e) => { e.target.style.display = 'none'; const n = e.target.nextElementSibling; if (n) n.style.display = 'flex'; }} />
                          )}
                          <span className="score-mini-emoji" style={{ display: card.emoji ? 'none' : 'flex' }}>{card.emoji || '✓'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
        )
      })()}

      {matchModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{matchModal.emoji} {matchModal.title}</h2>
            <p className="activity-text">{matchModal.text}</p>
            <button className="done-btn" onClick={closeMatchModal}>המשך</button>
          </div>
        </div>
      )}

      {screen === 'solutions' && Array.isArray(deck) && deck.length > 0 && (
        <div className="story-screen solutions-screen">
          <h2>פתרונות מלאים – כל זוגות השאלה והתשובה</h2>
          <p className="story-desc">לכל זוג: נושא, שאלה, תשובה והסבר (הדרך).</p>
          <div className="solutions-list">
            {collectSolutionsFromDeck(deck).map((row) => (
              <div key={row.pairId} className="solution-block">
                {row.mathTopic && (
                  <div className="solution-topic">{mathTopicLabel(row.mathTopic)}</div>
                )}
                {row.visual && (
                  <div className="solution-art-wrap" aria-hidden>
                    <FractionQuestionArt visual={row.visual} />
                  </div>
                )}
                <p className="solution-q"><strong>שאלה:</strong> {row.question ?? '—'}</p>
                <p className="solution-a"><strong>תשובה:</strong> {row.answer ?? '—'}</p>
                <p className="solution-exp"><strong>הדרך:</strong> {row.explanation ?? '—'}</p>
              </div>
            ))}
          </div>
          <div className="story-actions">
            <button type="button" onClick={() => setScreen('game')}>חזרה למשחק</button>
            {room?.players?.[0]?.id === socket?.id && (
              <>
                <button type="button" onClick={handleReplay}>משחק חדש</button>
                <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>
                  {isMathFractionHub ? 'שלב 1' : 'שלב 1 (מילה אחת)'}
                </button>
                <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>
                  {isMathFractionHub ? 'שלב 2' : 'שלב 2 (שתי מילים)'}
                </button>
                <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>
                  {isMathFractionHub ? 'שלב 3' : 'שלב 3 (3 מילים)'}
                </button>
                <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>
                  {isMathFractionHub ? 'שלב 4 (הרם 3)' : 'שלב 4 (משפט שלם)'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {screen === 'story' && deck.length > 0 && isMathFractionHub && (
        <div className="story-screen">
          <h2>סיפור</h2>
          <p className="story-desc">במשחק שברים אין מסך סיפור. השתמשו ב«פתרונות מלאים» מהמשחק.</p>
          <div className="story-actions">
            <button type="button" onClick={() => setScreen('game')}>חזרה למשחק</button>
          </div>
        </div>
      )}

      {screen === 'story' && deck.length > 0 && !isMathFractionHub && (() => {
        const story = currentGameStory ?? currentGameStoryRef.current
        if (storyMode === 'pyramid' && story && Array.isArray(story.items) && story.items.length > 0) {
          return (
            <div className="story-screen">
              <h2>סיפור פירמידה מהמשחק 🧩</h2>
              <p className="story-desc">{story.title}</p>
              <div className="story-content">
                {story.items.map((it, idx) => (
                  <div key={idx} className="pyramid-item-block" style={{ marginBottom: '3rem' }}>
                    {/* ילדים קוראים רק את הטקסטים עצמם בלי כותרות */}
                    {it.emoji ? (
                      <p style={{ margin: '0.15rem 0', fontSize: '1.05rem' }}>{it.level1} {it.emoji}</p>
                    ) : (
                      <p style={{ margin: '0.15rem 0' }}>{it.level1}</p>
                    )}
                    <p style={{ margin: '0.15rem 0' }}>{it.level2}</p>
                    <p style={{ margin: '0.15rem 0' }}>{it.level3}</p>
                    {(it.level4 || '')
                      .split('\n')
                      .filter((line) => line.trim())
                      .map((line, i2) => (
                        <p key={i2} style={{ margin: '0.15rem 0' }}>{line}</p>
                      ))}
                  </div>
                ))}
              </div>
              <div className="story-actions">
                <button type="button" onClick={() => setScreen('game')}>חזרה למשחק</button>
                <button type="button" onClick={handleReplay}>משחק חדש</button>
                <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1 (מילה אחת)</button>
                <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2 (שתי מילים)</button>
                <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3 (3 מילים)</button>
                <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (משפט שלם)</button>
              </div>
            </div>
          )
        }

        if (story && story.text) {
          const normalizedStoryText = (story.text || '').replace(/([.!?]["'״׳]?)(\s+)/g, '$1\n')
          const paragraphs = normalizedStoryText.split('\n').filter((p) => p.trim())
          return (
            <div className="story-screen">
              <h2>סיפור מהמשחק 📖</h2>
              <p className="story-desc">{story.title}</p>
              <div className="story-content story-text">
                {paragraphs.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
              <div className="story-actions">
                <button type="button" onClick={() => setScreen('game')}>חזרה למשחק</button>
                <button type="button" onClick={handleReplay}>משחק חדש</button>
                <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1 (מילה אחת)</button>
                <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2 (שתי מילים)</button>
                <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3 (3 מילים)</button>
                <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (משפט שלם)</button>
              </div>
            </div>
          )
        }

        const wordCards = deck.filter((c) => c.type === 'word').sort((a, b) => a.pairId - b.pairId)
        const pictureByPairId = {}
        deck.filter((c) => c.type === 'picture').forEach((c) => { pictureByPairId[c.pairId] = c })
        return (
          <div className="story-screen">
            <h2>סיפור מהמשחק 📖</h2>
            <p className="story-desc">קרא את המילים מהמשחק שהסתיים:</p>
            <div className="story-content">
              {wordCards.map((c, idx) => (
                <span key={c.pairId} className="story-word-block">
                  {c.text}
                  {pictureByPairId[c.pairId]?.emoji && (
                    <span className="story-word-emoji" aria-hidden="true">{pictureByPairId[c.pairId].emoji}</span>
                  )}
                  {idx < wordCards.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
            <div className="story-actions">
              <button type="button" onClick={() => setScreen('game')}>חזרה למשחק</button>
              <button type="button" onClick={handleReplay}>משחק חדש</button>
              <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1 (מילה אחת)</button>
              <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2 (שתי מילים)</button>
              <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3 (3 מילים)</button>
              <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (משפט שלם)</button>
            </div>
          </div>
        )
      })()}

      <div className="voice-test-wrap">
        <button type="button" className="voice-test-toggle" onClick={() => setShowVoiceTest((v) => !v)}>
          {showVoiceTest ? '▼ ' : '▶ '}בדיקת קולות הצלחה / Test voice files
        </button>
        {showVoiceTest && (
          <div className="voice-test-panel">
            {VOICE_ENTRIES.length > 0 && (
              <>
                <p className="voice-test-info">קולות מובנים – לחץ להאזנה:</p>
                <div className="voice-test-buttons">
                  {VOICE_ENTRIES.map(({ name, url }) => (
                    <button
                      type="button"
                      key={name}
                      className="voice-test-btn"
                      onClick={() => new Audio(url).play().catch(() => {})}
                    >
                      Play {name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="voice-test-btn voice-test-random"
                    onClick={() => {
                      if (VOICE_URLS.length) new Audio(VOICE_URLS[Math.floor(Math.random() * VOICE_URLS.length)]).play().catch(() => {})
                    }}
                  >
                    Play random
                  </button>
                </div>
              </>
            )}
            {(customRecordings.length > 0 || successCombos.length > 0) && (
              <>
                <p className="voice-test-info">ההקלטות והשילובים שלך (נשמעים במשחק):</p>
                <div className="voice-test-buttons">
                  {customRecordings.map((r) => (
                    <button type="button" key={r.id} className="voice-test-btn" onClick={() => new Audio(r.url).play().catch(() => {})}>
                      השמע הקלטה
                    </button>
                  ))}
                  {successCombos.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="voice-test-btn"
                      onClick={() => { audioContextRefForCombo.current = audioContextRef.current; resumeAudioContext(); audioContextRefForCombo.current = audioContextRef.current; playSuccessCombo(c); }}
                    >
                      השמע {c.soundLabel} + קול
                    </button>
                  ))}
                </div>
              </>
            )}
            {VOICE_ENTRIES.length === 0 && customRecordings.length === 0 && successCombos.length === 0 && (
              <>
                <p className="voice-test-empty">No voice files in <code>src/assets/sounds/</code>. Add v1.mp3 … v6.mp3 there, or use the app to record and combine sound+voice:</p>
                <button type="button" className="voice-test-btn voice-test-manage" onClick={() => setScreen('voiceManage')}>
                  ניהול קולות הצלחה – הוסף הקלטות ושילובים / Manage success voice+sound
                </button>
              </>
            )}
            {(VOICE_ENTRIES.length > 0 || customRecordings.length > 0 || successCombos.length > 0) && (
              <p className="voice-test-manage-link">
                <button type="button" className="link-btn" onClick={() => setScreen('voiceManage')}>
                  ניהול (הוסף/מחק הקלטות ושילובים)
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      <p className="backend-indicator">Backend: {SOCKET_URL}</p>
    </div>
  )
}

export default App
