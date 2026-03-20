import React, { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { buildPyramidDeckWithStory, shuffleDeck, READING_CATEGORY, getRandomPyramidStoryId } from './readingPairs'

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

function App() {
  const [screen, setScreen] = useState('login')
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

  const connectSocket = useCallback((loginEmail, loginNickname) => {
    const em = (loginEmail != null ? loginEmail : email).toString().trim()
    const nick = (loginNickname != null ? loginNickname : nickname).toString().trim()
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
        s.emit('register', { email: em, nickname: nick })
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
      s.on('registered', () => setScreen('lobby'))
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
        if (data.story && data.story.text) {
          currentGameStoryRef.current = data.story
          setCurrentGameStory(data.story)
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
        const text = isMe
          ? `מצאת זוג! המילה מתאימה לתמונה. קיבלת נקודה. סה״כ ${myNewScore} נקודות`
          : 'שחקן אחר מצא זוג וקיבל נקודה.'
        audioContextRefForCombo.current = audioContextRef.current
        if (successCombosRef.current.length > 0) {
          playSuccessVoice(isMe)
        } else {
          playSuccessSound(audioContextRef.current)
          playSuccessVoice(isMe)
        }
        setMatchModal({
          title: READING_CATEGORY.title,
          emoji: READING_CATEGORY.emoji,
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
  }, [email, nickname])

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

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    const em = email.trim()
    const nick = nickname.trim()
    if (!em || !nick) {
      setError('אימייל ושם חובה')
      return
    }
    setEmail(em)
    setNickname(nick)
    if (typeof window !== 'undefined' && SOCKET_URL.includes('onrender.com')) {
      setError('מעיר את השרת...')
      try {
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 60000)
        await fetch(`${RENDER_BACKEND}/api/health`, { signal: ctrl.signal })
        clearTimeout(t)
      } catch (_) {}
      setError('')
    }
    connectSocket(em, nick)
  }

  const handleCreateRoom = () => {
    setError('')
    if (!socket) return
    socket.emit('createRoom', {
      maxPlayers: maxPlayers,
      pairCount: PAIR_COUNT,
      email,
      nickname
    })
  }

  const handleJoinRoom = (code) => {
    setError('')
    if (!socket || !code) return
    socket.emit('joinRoom', { roomId: code.trim().toUpperCase(), email, nickname })
  }

  const handleStartGame = () => {
    if (!socket) return
    const pairCount = room?.pairCount ?? PAIR_COUNT
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
    if (flipped.length >= 2 || flipped.includes(cardIndex) || matched.includes(cardIndex)) return
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

  return (
    <div className="app">
      <h1>משחק זיכרון – התאמת תמונה למילה</h1>
      <p className="subtitle">ראשית לימוד קריאה · לשניים (או עד 3 שחקנים)</p>

      <div className="top-nav">
        <button type="button" className="top-nav-btn" onClick={goBack} disabled={screenHistory.length === 0}>
          חזרה אחורה
        </button>
        {room && socket && room.players?.[0]?.id === socket?.id && (
          <span className="top-nav-levels">
            <button type="button" className={`top-nav-small ${gameLevel === 1 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(1)}>שלב 1</button>
            <button type="button" className={`top-nav-small ${gameLevel === 2 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(2)}>שלב 2</button>
            <button type="button" className={`top-nav-small ${gameLevel === 3 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(3)}>שלב 3</button>
            <button type="button" className={`top-nav-small ${gameLevel === 4 ? 'active' : ''}`} onClick={() => handleSelectLevelFromTopNav(4)}>שלב 4</button>
            {(screen === 'game' || screen === 'story') && (
              <button type="button" className="top-nav-small" onClick={handleReplay}>משחק חדש</button>
            )}
          </span>
        )}
      </div>

      {screen === 'login' && (
        <>
          <form onSubmit={handleLogin}>
            <div className="form-row">
              <label>אימייל</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div className="form-row">
              <label>שם במשחק</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="השם שלי" />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit">התחבר והמשך</button>
          </form>
          <p className="voice-manage-link-wrap">
            <button type="button" className="link-btn" onClick={() => setScreen('voiceManage')}>
              ניהול קולות הצלחה (צליל + קול) / Manage success voice+sound
            </button>
          </p>
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
            <button type="button" className="link-btn" onClick={() => setScreen('login')}>חזרה להתחברות</button>
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
                <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => setGameLevel(1)}>שלב 1 (מילה אחת)</button>
                <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => setGameLevel(2)}>שלב 2 (שתי מילים)</button>
                <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => setGameLevel(3)}>שלב 3 (3 מילים)</button>
                <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => setGameLevel(4)}>שלב 4 (משפט שלם)</button>
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
          return pairIds.map((pairId) => deckList.find((c) => c.pairId === pairId && c.type === 'picture')).filter(Boolean)
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
          </div>
          <div className="game-over-bar game-actions-bar">
            <button type="button" onClick={handleShowStory}>סיפור מהמשחק</button>
            <button type="button" onClick={handleShowPyramidStory}>סיפור פירמידה מהמשחק</button>
            {room.players?.[0]?.id === socket?.id && (
              <span className="level-choose-wrap">
                <button type="button" onClick={handleReplay}>משחק חדש</button>
                <button type="button" className={gameLevel === 1 ? 'active' : ''} onClick={() => handleStartLevel(1)}>שלב 1 (מילה אחת)</button>
                <button type="button" className={gameLevel === 2 ? 'active' : ''} onClick={() => handleStartLevel(2)}>שלב 2 (שתי מילים)</button>
                <button type="button" className={gameLevel === 3 ? 'active' : ''} onClick={() => handleStartLevel(3)}>שלב 3 (3 מילים)</button>
                <button type="button" className={gameLevel === 4 ? 'active' : ''} onClick={() => handleStartLevel(4)}>שלב 4 (משפט שלם)</button>
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
                          <span className="score-mini-word">{card.text || ''}</span>
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
                          <span className="score-mini-word">{card.text || ''}</span>
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

      {screen === 'story' && deck.length > 0 && (() => {
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
