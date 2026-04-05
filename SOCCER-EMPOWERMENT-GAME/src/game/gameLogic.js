import { buildFullDeck } from './cardsData.js'
import { GOAL_LINE, HAND_SIZE, SPECIAL_CELLS } from './constants.js'

const OUT_KEYS = ['o0', 'o1', 'o2', 'o3']

function createTeam(teamIdx) {
  const homeRow = teamIdx === 0 ? GOAL_LINE : 0
  const mk = (lane) => ({
    lane,
    row: homeRow,
    isGK: false,
    scored: false,
    pathStyle: 'balanced'
  })
  const pieces = {
    gk: { lane: 2, row: homeRow, isGK: true, scored: false },
    o0: mk(0),
    o1: mk(1),
    o2: mk(2),
    o3: mk(3)
  }
  return { teamIdx, pieces }
}

function shuffle(a) {
  const arr = [...a]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function createInitialMatch() {
  const deck = shuffle(buildFullDeck())
  const hands = [[], []]
  for (let i = 0; i < HAND_SIZE; i++) {
    if (deck.length) hands[0].push(deck.shift())
    if (deck.length) hands[1].push(deck.shift())
  }
  return {
    phase: 'setup',
    sub: 'paths',
    pathDraft: [
      { o0: 'balanced', o1: 'balanced', o2: 'balanced', o3: 'balanced' },
      { o0: 'balanced', o1: 'balanced', o2: 'balanced', o3: 'balanced' }
    ],
    deck,
    discard: [],
    hands,
    teams: [createTeam(0), createTeam(1)],
    currentPlayer: 0,
    attacker: null,
    attackCard: null,
    defenseCard: null,
    diceA: null,
    diceD: null,
    pendingSpecial: null,
    /** תיקון לקוביית התוקף בזריקה הבאה של אותה קבוצה (מקלפים מיוחדים) */
    nextDiceMod: [0, 0],
    message:
      'לפני תחילת המשחק: בחרו לכל «חייל» מסלול התקדמות (מהיר / בטוח / מאוזן / נועז). אחר כך — התחל משחק.',
    log: []
  }
}

export function setPathDraft(state, teamIdx, pieceKey, pathStyle) {
  if (state.phase !== 'setup' || !OUT_KEYS.includes(pieceKey)) return null
  const pathDraft = state.pathDraft.map((row, i) =>
    i === teamIdx ? { ...row, [pieceKey]: pathStyle } : row
  )
  return { ...state, pathDraft }
}

export function beginPlay(state) {
  if (state.phase !== 'setup') return null
  const teams = state.teams.map((t, ti) => {
    const draft = state.pathDraft[ti]
    const pieces = { ...t.pieces }
    for (const k of OUT_KEYS) {
      pieces[k] = { ...pieces[k], pathStyle: draft[k] || 'balanced' }
    }
    return { ...t, pieces }
  })
  return {
    ...state,
    phase: 'play',
    teams,
    sub: 'pickPiece',
    message: 'המשחק התחיל! תור שחקן 1 — בחרי שחקן שדה והתקיפו לשער היריב.'
  }
}

export function rollD6() {
  return 1 + Math.floor(Math.random() * 6)
}

function pieceAtGoal(teamIdx, row) {
  if (teamIdx === 0) return row <= 0
  return row >= GOAL_LINE
}

function movablePieces(state, teamIdx) {
  const t = state.teams[teamIdx]
  return OUT_KEYS.filter((k) => {
    const p = t.pieces[k]
    if (p.scored) return false
    return !pieceAtGoal(teamIdx, p.row)
  })
}

/** התאמת מסלול: מהיר +1 קדימה; בטוח מרכך דחיפה אחורה; נועז +2 קדימה / עוד דחיפה אחורה */
function pathAdjustNet(net, pathStyle) {
  const ps = pathStyle || 'balanced'
  if (ps === 'fast' && net > 0) return net + 1
  if (ps === 'safe' && net < 0) return Math.min(0, net + 1)
  if (ps === 'bold') {
    if (net > 0) return net + 2
    if (net < 0) return net - 1
  }
  return net
}

export function selectPiece(state, pieceKey) {
  if (state.phase !== 'play' || state.sub !== 'pickPiece') return null
  const teamIdx = state.currentPlayer
  if (!OUT_KEYS.includes(pieceKey)) return null
  if (!movablePieces(state, teamIdx).includes(pieceKey)) return null
  return {
    ...state,
    attacker: pieceKey,
    sub: 'pickAttack',
    message: 'בחרי קלף התקפה (מחשבה לא מועילה) ואמרי את המחשבה בקול.'
  }
}

export function selectAttackCard(state, cardId) {
  if (state.sub !== 'pickAttack') return null
  const h = state.hands[state.currentPlayer]
  const idx = h.findIndex((c) => c.id === cardId)
  if (idx < 0) return null
  const card = h[idx]
  if (card.kind !== 'attack') return null
  const newHand = [...h]
  newHand.splice(idx, 1)
  const hands = [...state.hands]
  hands[state.currentPlayer] = newHand
  return {
    ...state,
    hands,
    attackCard: card,
    discard: [...state.discard, card],
    sub: 'defense',
    message: 'שחקן מגן: קלף הגנה באותו צבע כמו ההתקפה (−2 להפרש), או דילוג.'
  }
}

export function selectDefenseCard(state, cardId) {
  if (state.sub !== 'defense') return null
  const defIdx = 1 - state.currentPlayer
  const h = state.hands[defIdx]
  const idx = h.findIndex((c) => c.id === cardId)
  if (idx < 0) return null
  const card = h[idx]
  if (card.kind !== 'defense') return null
  const newHand = [...h]
  newHand.splice(idx, 1)
  const hands = [...state.hands]
  hands[defIdx] = newHand
  return {
    ...state,
    hands,
    defenseCard: card,
    discard: [...state.discard, card],
    sub: 'roll',
    message: 'זורקים קוביה — הקוביה מייצגת כמה אתם מאמינים למחשבה על הקלף.'
  }
}

export function passDefense(state) {
  if (state.sub !== 'defense') return null
  return {
    ...state,
    defenseCard: null,
    sub: 'roll',
    message: 'המגן דילג. זורקים קוביות.'
  }
}

function resolveMove(state, att, def, matched) {
  let net = att - def
  if (matched) net -= 2

  const teamIdx = state.currentPlayer
  const key = state.attacker
  const pathStyle = state.teams[teamIdx].pieces[key].pathStyle
  net = pathAdjustNet(net, pathStyle)

  const teams = state.teams.map((t) => ({ ...t, pieces: { ...t.pieces } }))
  const p = { ...teams[teamIdx].pieces[key] }

  if (net > 0) {
    if (teamIdx === 0) p.row = Math.max(0, p.row - net)
    else p.row = Math.min(GOAL_LINE, p.row + net)
  } else if (net < 0) {
    const back = Math.abs(net)
    if (teamIdx === 0) p.row = Math.min(GOAL_LINE, p.row + back)
    else p.row = Math.max(0, p.row - back)
  }

  if (pieceAtGoal(teamIdx, p.row)) p.scored = true
  teams[teamIdx].pieces[key] = p

  let pendingSpecial = null
  if (!p.scored && SPECIAL_CELLS.includes(p.row)) {
    pendingSpecial = { teamIdx, pieceKey: key, row: p.row }
  }

  const moveDesc =
    net > 0
      ? `התקדמות ${net} משבצות`
      : net < 0
        ? `דחיפה אחורה ${Math.abs(net)}`
        : 'שוויון — אין תנועה'

  const msg = `קוביות (אמונה במחשבה): תוקף ${att} · מגן ${def}${matched ? ' · צבע תואם' : ''} · מסלול: ${pathStyle || 'balanced'} → ${moveDesc}.`

  return {
    ...state,
    teams,
    diceA: att,
    diceD: def,
    sub: pendingSpecial ? 'special' : 'endTurn',
    pendingSpecial,
    message: msg,
    log: [...state.log, msg]
  }
}

export function commitRoll(state) {
  if (state.sub !== 'roll') return null
  const ti = state.currentPlayer
  const mod = (state.nextDiceMod && state.nextDiceMod[ti]) || 0
  const rawAtt = rollD6()
  const att = Math.max(1, Math.min(6, rawAtt + mod))
  const def = rollD6()
  const ac = state.attackCard
  const dc = state.defenseCard
  const matched = !!(ac && dc && dc.suit === ac.suit)
  const nextDiceMod = (state.nextDiceMod || [0, 0]).map((v, i) => (i === ti ? 0 : v))
  const base = resolveMove({ ...state, nextDiceMod }, att, def, matched)
  if (!base) return null
  if (mod !== 0) {
    const extra = ` גלילה גולמית ${rawAtt}, תיקון קלף מיוחד ${mod >= 0 ? '+' : ''}${mod} → תוקף ${att}.`
    return { ...base, message: base.message + extra }
  }
  return base
}

export function drawSpecialFromDeck(state) {
  if (state.sub !== 'special' || !state.pendingSpecial) return null
  const deck = [...state.deck]
  const idx = deck.findIndex((c) => c.kind === 'special')
  if (idx < 0) {
    return {
      ...state,
      sub: 'endTurn',
      pendingSpecial: null,
      message: 'אין קלף מיוחד בקופה.'
    }
  }
  const c = deck[idx]
  deck.splice(idx, 1)
  return {
    ...state,
    deck,
    pendingSpecial: { ...state.pendingSpecial, card: c },
    message: `משבצת מיוחדת — נמשך קלף: ${c.title}`
  }
}

export function acknowledgeSpecial(state) {
  if (state.sub !== 'special' || !state.pendingSpecial?.card) return null
  const c = state.pendingSpecial.card
  const teamIdx = state.pendingSpecial.teamIdx
  const prev = state.nextDiceMod || [0, 0]
  const nextDiceMod = prev.map((v, i) => (i === teamIdx ? v + c.diceMod : v))
  return {
    ...state,
    discard: [...state.discard, c],
    pendingSpecial: null,
    nextDiceMod,
    sub: 'endTurn',
    message: `בוצע: ${c.task} | לזריקת הקוביה הבאה של קבוצה ${teamIdx + 1}: ${c.diceMod >= 0 ? '+' : ''}${c.diceMod} (מצטבר על התיקון הקודם).`
  }
}

export function endTurnAndDraw(state) {
  if (state.sub !== 'endTurn') return null
  let deck = [...state.deck]
  const hands = state.hands.map((h) => [...h])
  for (let p = 0; p < 2; p++) {
    while (hands[p].length < HAND_SIZE && deck.length > 0) {
      hands[p].push(deck.shift())
    }
  }
  const next = 1 - state.currentPlayer
  const newState = {
    ...state,
    deck,
    hands,
    currentPlayer: next,
    sub: 'pickPiece',
    attacker: null,
    attackCard: null,
    defenseCard: null,
    diceA: null,
    diceD: null,
    message: `תור שחקן ${next + 1}`
  }
  const w = checkWinner(newState.teams)
  if (w !== null) {
    return {
      ...newState,
      phase: 'over',
      winner: w,
      message: `כדורגל העצמה — ניצחון לשחקן ${w + 1}! כל ארבעת השדה בישור.`
    }
  }
  return newState
}

function checkWinner(teams) {
  for (let t = 0; t < 2; t++) {
    if (OUT_KEYS.every((k) => teams[t].pieces[k].scored)) return t
  }
  return null
}

export function getMovableKeys(state) {
  return movablePieces(state, state.currentPlayer)
}

export function drawOneFromDeck(state) {
  if (state.sub !== 'pickAttack') return null
  let deck = [...state.deck]
  if (deck.length === 0) return { ...state, message: 'הקופה ריקה.' }
  const hands = [...state.hands]
  const h = [...hands[state.currentPlayer]]
  h.push(deck.shift())
  hands[state.currentPlayer] = h
  return { ...state, deck, hands, message: 'נמשך קלף מהקופה.' }
}
