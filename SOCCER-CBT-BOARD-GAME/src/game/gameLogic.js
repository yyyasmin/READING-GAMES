import { buildPlayDeck, buildSpecialDeck } from './cardsData.js'
import { GOAL_LINE, HAND_SIZE, SPECIAL_CELLS, SUITS } from './constants.js'
import { NUM_LANES, MID_LANE, DEFAULT_OPENING_PIECES } from './boardData.js'

export const OUT_KEYS = ['o0', 'o1', 'o2', 'o3']

function createTeamOpening(teamIdx) {
  const pos = DEFAULT_OPENING_PIECES[teamIdx]
  const gkStep = teamIdx === 0 ? GOAL_LINE : 0
  return {
    teamIdx,
    pieces: {
      gk: { lane: MID_LANE, step: gkStep, isGK: true, scored: false },
      o0: { lane: pos.o0.lane, step: pos.o0.step, isGK: false, scored: false },
      o1: { lane: pos.o1.lane, step: pos.o1.step, isGK: false, scored: false },
      o2: { lane: pos.o2.lane, step: pos.o2.step, isGK: false, scored: false },
      o3: { lane: pos.o3.lane, step: pos.o3.step, isGK: false, scored: false }
    }
  }
}

function bonusState() {
  return { 0: 0, 1: 0 }
}

function flagState() {
  return { 0: false, 1: false }
}

/** חיתוך קופה אקראי לפני חלוקה — נקודת התחלה שונה בכל משחק חדש */
function cutDeck(deck) {
  const d = [...deck]
  const n = d.length
  if (n <= 1) return d
  const cut = Math.floor(Math.random() * n)
  return [...d.slice(cut), ...d.slice(0, cut)]
}

export function createInitialMatch() {
  const deck = cutDeck(buildPlayDeck())
  const specialDeck = buildSpecialDeck()
  const hands = [[], []]
  for (let i = 0; i < HAND_SIZE; i++) {
    if (deck.length) hands[0].push(deck.shift())
    if (deck.length) hands[1].push(deck.shift())
  }
  return {
    phase: 'play',
    sub: 'pickPiece',
    deck,
    specialDeck,
    discard: [],
    hands,
    teams: [createTeamOpening(0), createTeamOpening(1)],
    currentPlayer: 0,
    attacker: null,
    attackCard: null,
    defenseCard: null,
    diceA: null,
    diceD: null,
    pendingSpecial: null,
    pendingJokerAttack: null,
    pendingJokerDefense: null,
    pendingLanding: null,
    pendingDiceBonus: bonusState(),
    anxietyNextAttack: flagState(),
    pendingForceZeroMove: flagState(),
    message:
      'תור 1 — סדר פעולות: (1) שחקן תוקף בוחר שחקן שדה בלחיצה (2) קלף התקפה (3) זריקת קוביית תוקף (4) שחקן מגן: קלף הגנה או דילוג (5) זריקת קוביית מגן (6) שחקן תוקף: לחיצה על עיגול יעד במגרש — מספר הצעדים לפי ההפרש בין הקוביות (מינוס = רק אחורה).',
    log: []
  }
}

export function rollD6() {
  return 1 + Math.floor(Math.random() * 6)
}

function pieceAtGoal(teamIdx, step) {
  if (teamIdx === 0) return step <= 0
  return step >= GOAL_LINE
}

function movablePieces(state, teamIdx) {
  const t = state.teams[teamIdx]
  return OUT_KEYS.filter((k) => {
    const p = t.pieces[k]
    if (p.scored) return false
    return !pieceAtGoal(teamIdx, p.step)
  })
}

export function selectPiece(state, pieceKey) {
  if (state.sub !== 'pickPiece') return null
  const teamIdx = state.currentPlayer
  if (!OUT_KEYS.includes(pieceKey)) return null
  if (!movablePieces(state, teamIdx).includes(pieceKey)) return null
  return {
    ...state,
    attacker: pieceKey,
    sub: 'pickAttack',
    message:
      'בחרי קלף התקפה מהיד — לחיצה ראשונה מדגישה, לחיצה שנייה על אותו קלף או «אשר» משמיעות אותו. ג\'וקר: לחיצה אחת פותחת טופס.'
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
  if (card.joker) {
    return {
      ...state,
      hands,
      pendingJokerAttack: { card },
      sub: 'jokerAttack',
      message:
        'ג\'וקר התקפה: כתבו את המחשבה התוקפת, בחרו צבע מסגרת (אדום / צהוב / כחול / ירוק), ואשרו — ואז זריקת קוביית תוקף.'
    }
  }
  return {
    ...state,
    hands,
    attackCard: card,
    discard: [...state.discard, card],
    sub: 'rollAttack',
    message:
      'שחקן תוקף: לחצו למטה על «זריקת קוביית התקף» — ואז תור המגן לקלף הגנה וקוביית מגן.'
  }
}

export function confirmJokerAttack(state, suit, thought) {
  if (state.sub !== 'jokerAttack' || !state.pendingJokerAttack?.card) return null
  if (!SUITS.includes(suit)) return null
  const text = typeof thought === 'string' ? thought.trim() : ''
  if (!text) {
    return { ...state, message: 'חובה לכתוב את המחשבה התוקפת לפני האישור.' }
  }
  const raw = state.pendingJokerAttack.card
  const card = { ...raw, effectiveSuit: suit, thoughtText: text, text }
  return {
    ...state,
    pendingJokerAttack: null,
    attackCard: card,
    discard: [...state.discard, card],
    sub: 'rollAttack',
    message:
      'שחקן תוקף: לחצו על «זריקת קוביית התקף» — ואז תור המגן לקלף הגנה וקוביית מגן.'
  }
}

export function cancelJokerAttack(state) {
  if (state.sub !== 'jokerAttack' || !state.pendingJokerAttack?.card) return null
  const card = state.pendingJokerAttack.card
  const p = state.currentPlayer
  const hands = [...state.hands]
  hands[p] = [...hands[p], card]
  return {
    ...state,
    hands,
    pendingJokerAttack: null,
    sub: 'pickAttack',
    message: 'חזרה לבחירת קלף התקפה.'
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
  if (card.joker) {
    return {
      ...state,
      hands,
      pendingJokerDefense: { card },
      sub: 'jokerDefense',
      message:
        'ג\'וקר הגנה: כתבו מחשבה חלופית מועילה ובחרו צבע מסגרת — זהה לצבע קלף ההתקפה כדי לקבל −2 לצעדים.'
    }
  }
  return {
    ...state,
    hands,
    defenseCard: card,
    discard: [...state.discard, card],
    sub: 'rollDefense',
    message:
      'שחקן מגן: לחצו על «זריקת קוביית המגן». ההפרש בין קוביית התוקף לקוביית המגן (ובונוס צבע −2) קובע כמה צעדי רשת ניתן לזוז — ואז התוקף בוחר עיגול יעד במגרש.'
  }
}

export function confirmJokerDefense(state, suit, thought) {
  if (state.sub !== 'jokerDefense' || !state.pendingJokerDefense?.card) return null
  if (!SUITS.includes(suit)) return null
  const text = typeof thought === 'string' ? thought.trim() : ''
  if (!text) {
    return { ...state, message: 'חובה לכתוב את המחשבה החלופית לפני האישור.' }
  }
  const raw = state.pendingJokerDefense.card
  const card = { ...raw, effectiveSuit: suit, thoughtText: text, text }
  return {
    ...state,
    pendingJokerDefense: null,
    defenseCard: card,
    discard: [...state.discard, card],
    sub: 'rollDefense',
    message:
      'שחקן מגן: לחצו על «זריקת קוביית המגן» — ואז התוקף יבחר יעד במגרש לפי ההפרש.'
  }
}

export function cancelJokerDefense(state) {
  if (state.sub !== 'jokerDefense' || !state.pendingJokerDefense?.card) return null
  const card = state.pendingJokerDefense.card
  const defIdx = 1 - state.currentPlayer
  const hands = state.hands.map((hand, i) => (i === defIdx ? [...hand, card] : [...hand]))
  return {
    ...state,
    hands,
    pendingJokerDefense: null,
    sub: 'defense',
    message: 'חזרה לבחירת קלף הגנה.'
  }
}

export function passDefense(state) {
  if (state.sub !== 'defense') return null
  return {
    ...state,
    defenseCard: null,
    sub: 'rollDefense',
    message:
      'המגן דילג על קלף הגנה. שחקן מגן: לחצו על «זריקת קוביית המגן».'
  }
}

function cardSuitForMatch(c) {
  if (!c) return null
  const s = c.effectiveSuit ?? c.suit
  return s || null
}

export function suitsMatchForBonus(attackCard, defenseCard) {
  const a = cardSuitForMatch(attackCard)
  const d = cardSuitForMatch(defenseCard)
  return !!(a && d && a === d)
}

function cellKey(lane, step) {
  return `${lane},${step}`
}

/** שכנים בגרף הרשת — צעד אחד לאורך קו (מסלול או צעד), בכיוון קדימה או אחורה לפי הקבוצה */
function gridMoveNeighbors(lane, step, teamIdx, towardGoal) {
  const out = []
  const add = (l, s) => {
    if (l >= 0 && l < NUM_LANES && s >= 0 && s <= GOAL_LINE) out.push({ lane: l, step: s })
  }
  if (towardGoal) {
    if (teamIdx === 0) {
      add(lane - 1, step)
      add(lane + 1, step)
      add(lane, step - 1)
    } else {
      add(lane - 1, step)
      add(lane + 1, step)
      add(lane, step + 1)
    }
  } else {
    if (teamIdx === 0) {
      add(lane - 1, step)
      add(lane + 1, step)
      add(lane, step + 1)
    } else {
      add(lane - 1, step)
      add(lane + 1, step)
      add(lane, step - 1)
    }
  }
  return out
}

/** כל הצמתים במרחק 1…absn (צעדי רשת) מהמיקום הנוכחי, בכיוון המבוקש */
function computeGridLandingCandidates(teamIdx, fromLane, fromStep, absn, towardGoal) {
  const start = { lane: fromLane, step: fromStep }
  const q = [start]
  const dist = new Map([[cellKey(fromLane, fromStep), 0]])
  for (let i = 0; i < q.length; i++) {
    const cur = q[i]
    const d = dist.get(cellKey(cur.lane, cur.step))
    if (d >= absn) continue
    for (const nb of gridMoveNeighbors(cur.lane, cur.step, teamIdx, towardGoal)) {
      const k = cellKey(nb.lane, nb.step)
      if (!dist.has(k)) {
        dist.set(k, d + 1)
        q.push(nb)
      }
    }
  }
  const out = []
  for (const [k, d] of dist) {
    if (d < 1 || d > absn) continue
    const [lane, step] = k.split(',').map(Number)
    out.push({ lane, step })
  }
  out.sort((a, b) => a.step - b.step || a.lane - b.lane)
  return out
}

function applyStepToPiece(
  state,
  teamIdx,
  key,
  targetLane,
  targetStep,
  att,
  def,
  matched,
  extraNote,
  absn,
  towardGoal
) {
  const teams = state.teams.map((t) => ({ ...t, pieces: { ...t.pieces } }))
  const p = { ...teams[teamIdx].pieces[key], lane: targetLane, step: targetStep }
  if (pieceAtGoal(teamIdx, p.step)) p.scored = true
  teams[teamIdx].pieces[key] = p

  let pendingSpecial = null
  let nextSub = 'endTurn'
  let specialTail = ''
  if (!p.scored && SPECIAL_CELLS.includes(targetStep)) {
    if ((state.specialDeck || []).length > 0) {
      pendingSpecial = { teamIdx, pieceKey: key, step: targetStep }
      nextSub = 'special'
      specialTail = ' לחצו על ערימת קלפי המיוחדים למטה כדי למשוך.'
    } else {
      specialTail = ' עיגול צהוב — אין קלפים בערימת המיוחדים.'
    }
  }

  const moveDesc = towardGoal
    ? `נחיתה במסלול ${targetLane}, צעד ${targetStep} (עד ${absn} צעדי רשת קדימה)`
    : `דחיפה למסלול ${targetLane}, צעד ${targetStep} (${absn} צעדי רשת אחורה)`

  const baseMsg = `קוביות (אמונה במחשבה): תוקף ${att} · מגן ${def}${matched ? ' · צבע תואם (−2 להפרש)' : ''}${extraNote || ''} → ${moveDesc}.${specialTail}`

  return {
    ...state,
    teams,
    diceA: att,
    diceD: def,
    pendingLanding: null,
    sub: nextSub,
    pendingSpecial,
    message: baseMsg,
    log: [...state.log, baseMsg]
  }
}

function processDiceOutcome(state, att, def, matched, extraNote) {
  let net = att - def
  if (matched) net -= 2
  const teamIdx = state.currentPlayer
  const key = state.attacker
  const fromPiece = state.teams[teamIdx].pieces[key]
  const fromLane = fromPiece.lane
  const fromStep = fromPiece.step

  if (extraNote === '__FORCE_ZERO__') {
    return {
      ...state,
      diceA: att,
      diceD: def,
      sub: 'endTurn',
      pendingLanding: null,
      pendingSpecial: null,
      message: 'קלף מיוחד (Overthinking / לופ): אין התקדמות בתור זה.',
      log: [...state.log, 'קלף מיוחד: אין תנועה']
    }
  }

  const intro = `קוביות: תוקף ${att} · מגן ${def}${matched ? ' · צבע תואם במסגרות (−2 להפרש)' : ''}${extraNote || ''}`

  if (net === 0) {
    const msg = `${intro} → שוויון בין הקוביות — אין תזוזה (0 צעדים).`
    return {
      ...state,
      diceA: att,
      diceD: def,
      sub: 'endTurn',
      pendingLanding: null,
      pendingSpecial: null,
      message: msg,
      log: [...state.log, msg]
    }
  }

  const towardGoal = net > 0
  const absn = Math.abs(net)
  const candidates = computeGridLandingCandidates(teamIdx, fromLane, fromStep, absn, towardGoal)
  if (candidates.length === 0) {
    const msg = `${intro} → אין צומת חוקי במרחק הזה — אין תזוזה.`
    return {
      ...state,
      diceA: att,
      diceD: def,
      sub: 'endTurn',
      pendingLanding: null,
      pendingSpecial: null,
      message: msg,
      log: [...state.log, msg]
    }
  }

  const dirPhrase = towardGoal ? `קדימה (לכיוון שער היריב)` : `אחורה`
  const msg = `${intro} → יש לבצע ${absn} צעדי רשת ${dirPhrase}. לחצו על עיגול היעד במגרש.`

  return {
    ...state,
    diceA: att,
    diceD: def,
    pendingLanding: {
      teamIdx,
      pieceKey: key,
      candidates,
      att,
      def,
      matched,
      extraNote,
      absn,
      towardGoal
    },
    sub: 'pickLanding',
    pendingSpecial: null,
    message: msg,
    log: [...state.log, msg]
  }
}

/** בחירת צומת יעד אחרי זריקה (תמיד בלחיצה על המגרש) */
export function selectLandingCell(state, targetLane, targetStep) {
  if (state.sub !== 'pickLanding' || !state.pendingLanding) return null
  if (!Number.isInteger(targetLane) || !Number.isInteger(targetStep)) return null
  const { teamIdx, pieceKey, candidates, att, def, matched, extraNote, absn, towardGoal } = state.pendingLanding
  const ok = candidates.some((c) => c.lane === targetLane && c.step === targetStep)
  if (!ok) return null
  return applyStepToPiece(
    state,
    teamIdx,
    pieceKey,
    targetLane,
    targetStep,
    att,
    def,
    matched,
    extraNote,
    absn,
    towardGoal
  )
}

/** זריקת קוביית התקף בלבד — אחריה תור המגן (קלף + קוביית מגן) */
export function commitRollAttack(state) {
  if (state.sub !== 'rollAttack') return null
  const teamIdx = state.currentPlayer
  if (state.pendingForceZeroMove[teamIdx]) {
    const pf = { ...state.pendingForceZeroMove, [teamIdx]: false }
    return {
      ...state,
      pendingForceZeroMove: pf,
      diceA: 0,
      diceD: null,
      sub: 'endTurn',
      pendingLanding: null,
      pendingSpecial: null,
      message: 'קלף מיוחד (Overthinking / לופ): אין התקדמות בתור זה.',
      log: [...state.log, 'קלף מיוחד: אין תנועה']
    }
  }
  const wasAnx = state.anxietyNextAttack[teamIdx]
  let rollAtt = rollD6()
  if (wasAnx) rollAtt = Math.min(rollAtt, rollD6())
  const bonus = state.pendingDiceBonus[teamIdx] || 0
  const att = rollAtt + bonus
  const pd = { ...state.pendingDiceBonus, [teamIdx]: 0 }
  const ax = { ...state.anxietyNextAttack, [teamIdx]: false }
  const extra =
    bonus !== 0 || wasAnx
      ? ` (גלגול בסיס ${rollAtt}${bonus ? ` + בונוס ${bonus}` : ''}${wasAnx ? ' · חרדה: נמוך משני גלגולים' : ''})`
      : ''
  const msg = `קוביית תוקף: ${att}${extra} — תור המגן: קלף הגנה (לחיצה ×2 או «אשר», או דילוג), ואז זריקת קוביית המגן.`
  return {
    ...state,
    diceA: att,
    diceD: null,
    pendingDiceBonus: pd,
    anxietyNextAttack: ax,
    sub: 'defense',
    message: msg,
    log: [...state.log, msg]
  }
}

/** זריקת קוביית המגן — חישוב הפרש ומעבר לבחירת יעד או סיום */
export function commitRollDefense(state) {
  if (state.sub !== 'rollDefense') return null
  if (state.diceA == null) return null
  const def = rollD6()
  const ac = state.attackCard
  const dc = state.defenseCard
  const matched = suitsMatchForBonus(ac, dc)
  return processDiceOutcome(state, state.diceA, def, matched, '')
}

export function drawSpecialFromDeck(state) {
  if (state.sub !== 'special' || !state.pendingSpecial) return null
  const specialDeck = [...(state.specialDeck || [])]
  if (specialDeck.length === 0) {
    return {
      ...state,
      sub: 'endTurn',
      pendingSpecial: null,
      message: 'אין קלפים בערימת המיוחדים — ממשיכים.'
    }
  }
  const c = specialDeck.shift()
  return {
    ...state,
    specialDeck,
    pendingSpecial: { ...state.pendingSpecial, card: c },
    message: `נמשך קלף מיוחד מהערימה: ${c.title}`
  }
}

export function acknowledgeSpecial(state) {
  if (state.sub !== 'special' || !state.pendingSpecial?.card) return null
  const c = state.pendingSpecial.card
  const tid = state.pendingSpecial.teamIdx
  const pendingDiceBonus = { ...state.pendingDiceBonus }
  const anxietyNextAttack = { ...state.anxietyNextAttack }
  const pendingForceZeroMove = { ...state.pendingForceZeroMove }
  if (typeof c.diceMod === 'number' && c.diceMod !== 0) {
    pendingDiceBonus[tid] = (pendingDiceBonus[tid] || 0) + c.diceMod
  }
  if (c.effect === 'anxiety') anxietyNextAttack[tid] = true
  if (c.effect === 'skip_move') pendingForceZeroMove[tid] = true
  const bonusHint =
    typeof c.diceMod === 'number' && c.diceMod !== 0
      ? ` בונוס לקוביית התקפה הבאה של הקבוצה: ${c.diceMod >= 0 ? '+' : ''}${c.diceMod}.`
      : ''
  return {
    ...state,
    discard: [...state.discard, c],
    pendingSpecial: null,
    sub: 'endTurn',
    pendingDiceBonus,
    anxietyNextAttack,
    pendingForceZeroMove,
    message: `בוצע: ${c.task}.${bonusHint}`
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
    pendingJokerAttack: null,
    pendingJokerDefense: null,
    pendingLanding: null,
    pendingDiceBonus: state.pendingDiceBonus,
    anxietyNextAttack: state.anxietyNextAttack,
    pendingForceZeroMove: state.pendingForceZeroMove,
    message: `תור שחקן ${next + 1}: לחצו על שחקן שדה במגרש, אחר כך קלף וקוביות.`
  }
  const w = checkWinner(newState.teams)
  if (w !== null) {
    return {
      ...newState,
      phase: 'over',
      winner: w,
      message: `הקבוצה של שחקן ${w + 1} הבקיעה את כל ארבעת השדה!`
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
