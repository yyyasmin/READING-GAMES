import React, { useState, useCallback, useEffect, useId } from 'react'
import { SUIT_LABELS, SUITS, SPECIAL_CELLS } from './game/constants.js'
import {
  createInitialMatch,
  selectPiece,
  selectAttackCard,
  selectDefenseCard,
  passDefense,
  commitRollAttack,
  commitRollDefense,
  drawSpecialFromDeck,
  acknowledgeSpecial,
  endTurnAndDraw,
  getMovableKeys,
  drawOneFromDeck,
  selectLandingCell,
  confirmJokerAttack,
  cancelJokerAttack,
  confirmJokerDefense,
  cancelJokerDefense,
  suitsMatchForBonus,
  OUT_KEYS
} from './game/gameLogic.js'
import { LANE_NODE_POS, getNodeLayout, STEPS, OPENING_LAYOUT_VERSION } from './game/boardData.js'

const OPENING_LAYOUT_STORAGE_KEY = 'soccer-cbt-opening-layout-v'

const ROLE_LABELS = { gk: 'שוער', o0: 'חלוץ', o1: 'קשר', o2: 'בלם', o3: 'קשר נוסף' }
const ROLE_ICONS = { gk: '🧤', o0: '⚽', o1: '⚙', o2: '🛡', o3: '🔄' }
const RENDER_PIECE_KEYS = ['gk', ...OUT_KEYS]
const SHOW_DEBUG =
  import.meta.env.DEV || String(import.meta.env.VITE_DEBUG_BOARD || '').trim() === '1'

function suitBorderColor(suit) {
  if (suit === 'red') return '#c2410c'
  if (suit === 'yellow') return '#ca8a04'
  if (suit === 'blue') return '#2563eb'
  if (suit === 'green') return '#059669'
  return '#64748b'
}

function cardFaceBorder(card) {
  if (card.kind === 'special') return '#eab308'
  return suitBorderColor(card.effectiveSuit ?? card.suit)
}

function anyPieceOnSpecialStep(state) {
  if (!state?.teams) return false
  for (let t = 0; t < 2; t++) {
    for (const k of RENDER_PIECE_KEYS) {
      const p = state.teams[t]?.pieces?.[k]
      if (p && SPECIAL_CELLS.includes(p.step)) return true
    }
  }
  return false
}

/** קלף הגנה שמאפשר בונוס −2 להפרש: ג'וקר או אותו צבע מסגרת כמו קלף ההתקפה */
function defenseGivesColorBonus(attackCard, defenseCard) {
  if (!attackCard || !defenseCard || defenseCard.kind !== 'defense') return false
  if (defenseCard.joker) return true
  const a = attackCard.effectiveSuit ?? attackCard.suit
  const d = defenseCard.suit
  return !!(a && d && a === d)
}

function defenseBonusHintKind(attackCard, defenseCard) {
  if (!defenseGivesColorBonus(attackCard, defenseCard)) return null
  return defenseCard.joker ? 'joker' : 'suit'
}

function CardFace({ card, onPick, compact, asDisplay, isPrimed, defenseBonusHint }) {
  if (!card) return null
  const border = cardFaceBorder(card)
  const body = card.thoughtText || card.text
  const cls =
    `card-face ${compact ? 'compact' : ''} ${card.joker ? 'card-face--joker' : ''} ${card.kind === 'special' ? 'card-face--special' : ''} ${asDisplay ? 'card-face--display' : ''}${onPick ? ' card-face--pickable' : ''}${isPrimed ? ' card-face--primed' : ''}${defenseBonusHint ? ' card-face--defense-bonus' : ''}`
  const inner = (
    <>
      {defenseBonusHint === 'suit' && (
        <span className="card-defense-bonus-badge">אותו צבע מסגרת כמו ההתקפה — בונוס −2 להפרש</span>
      )}
      {defenseBonusHint === 'joker' && (
        <span className="card-defense-bonus-badge card-defense-bonus-badge--joker">
          ג&apos;וקר: בחרו בטופס צבע מסגרת זהה לקלף ההתקפה — בונוס −2
        </span>
      )}
      {card.joker && <span className="card-joker-badge">ג&apos;וקר</span>}
      <span className="card-title">{card.title}</span>
      {body ? <p className="card-text">{body}</p> : null}
      {card.kind === 'special' && (
        <span className="card-mod">קוביה: {card.diceMod >= 0 ? '+' : ''}{card.diceMod}</span>
      )}
    </>
  )
  if (asDisplay) {
    return (
      <div className={cls} style={{ borderColor: border }}>
        {inner}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={cls}
      style={{ borderColor: border }}
      onClick={() => onPick && onPick(card.id)}
      disabled={!onPick}
    >
      {inner}
    </button>
  )
}

function CardBack({ count, variant }) {
  const special = variant === 'special'
  return (
    <div className={'card-back' + (special ? ' card-back--special' : '')} aria-hidden>
      {special ? (
        <>
          <span className="card-back-special-emoji" aria-hidden>
            🤪
          </span>
          <span className="card-back-special-label">קלף מיוחד</span>
        </>
      ) : (
        <div className="card-back-pattern">⚽</div>
      )}
      <span className="card-back-count">{count}</span>
    </div>
  )
}

function DeckStacks({ deck, specialDeck = [], specialRaised, onClickMain, onClickSpecial }) {
  const mainCount = deck.length
  const specialCount = specialDeck.length
  if (mainCount === 0 && specialCount === 0) return null
  const mainInner = <CardBack count={mainCount} />
  const specialInner = <CardBack count={specialCount} variant="special" />
  return (
    <div className="deck-stacks">
      {mainCount > 0 && (
        <div className="deck-stack deck-stack--main">
          {onClickMain ? (
            <button
              type="button"
              className="deck-stack-hit deck-stack-hit--main"
              onClick={onClickMain}
              aria-label="משיכת קלף מהקופה"
            >
              {mainInner}
            </button>
          ) : (
            mainInner
          )}
        </div>
      )}
      {specialCount > 0 && (
        <div className={'deck-stack deck-stack--special' + (specialRaised ? ' deck-stack--raised' : '')}>
          {onClickSpecial ? (
            <button
              type="button"
              className="deck-stack-hit deck-stack-hit--special"
              onClick={onClickSpecial}
              aria-label="משיכת קלף מיוחד מהערימה"
            >
              {specialInner}
            </button>
          ) : (
            specialInner
          )}
        </div>
      )}
      {onClickMain && mainCount === 0 && deck.length > 0 && (
        <button type="button" className="deck-draw-fallback" onClick={onClickMain} aria-label="משיכת קלף מהקופה">
          לחצו למשיכת קלף מהקופה
        </button>
      )}
    </div>
  )
}

function DiceRollTap({ onRoll, variant = 'both' }) {
  const isAttack = variant === 'attack'
  const isDefense = variant === 'defense'
  const aria = isAttack
    ? 'זריקת קוביית התקף'
    : isDefense
      ? 'זריקת קוביית המגן'
      : 'זריקת שתי הקוביות — תוקף ומגן'
  const label = isAttack
    ? 'לחצו לזריקת קוביית התקף'
    : isDefense
      ? 'לחצו לזריקת קוביית המגן'
      : 'לחצו לזריקת הקוביות (תוקף + מגן)'
  return (
    <button
      type="button"
      className={'dice-roll-tap' + (isAttack ? ' dice-roll-tap--attack' : '') + (isDefense ? ' dice-roll-tap--defense' : '')}
      onClick={onRoll}
      aria-label={aria}
    >
      <span className="dice-roll-tap-dice" aria-hidden>
        🎲
      </span>
      {!isAttack && !isDefense ? (
        <span className="dice-roll-tap-dice" aria-hidden>
          🎲
        </span>
      ) : null}
      <span className="dice-roll-tap-label">{label}</span>
    </button>
  )
}

const TURN_PHASE_STEPS = [
  { role: 'תוקף', text: 'בחירת שחקן שדה במגרש' },
  { role: 'תוקף', text: 'קלף התקפה (לחיצה ×2 או אשר)' },
  { role: 'תוקף', text: 'זריקת קוביית התקף' },
  { role: 'מגן', text: 'קלף הגנה או דילוג' },
  { role: 'מגן', text: 'זריקת קוביית המגן' },
  { role: 'תוקף', text: 'לחיצה על עיגול יעד (לפי הפרש הקוביות)' }
]

function turnPhaseActiveStep(sub) {
  if (sub === 'pickPiece') return 0
  if (sub === 'pickAttack' || sub === 'jokerAttack') return 1
  if (sub === 'rollAttack') return 2
  if (sub === 'defense' || sub === 'jokerDefense') return 3
  if (sub === 'rollDefense') return 4
  if (sub === 'pickLanding') return 5
  return -1
}

function TurnPhaseRail({ sub, attackerPlayerIndex }) {
  const active = turnPhaseActiveStep(sub)
  if (active < 0) return null
  const atkNum = attackerPlayerIndex + 1
  const defNum = (1 - attackerPlayerIndex) + 1
  return (
    <ol className="turn-phase-rail" aria-label="סדר פעולות בתור התקפה">
      {TURN_PHASE_STEPS.map((step, i) => {
        const done = i < active
        const on = i === active
        const who =
          step.role === 'תוקף' ? `שחקן ${atkNum} (תוקף)` : `שחקן ${defNum} (מגן)`
        return (
          <li
            key={step.text}
            className={
              'turn-phase-rail__item' +
              (done ? ' turn-phase-rail__item--done' : '') +
              (on ? ' turn-phase-rail__item--active' : '')
            }
          >
            <span className="turn-phase-rail__who">{who}</span>
            <span className="turn-phase-rail__txt">{step.text}</span>
            {done ? <span className="turn-phase-rail__mark">✓</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

function JokerAttackForm({ onConfirm, onCancel }) {
  const [thought, setThought] = useState('')
  const [suit, setSuit] = useState('red')
  return (
    <div className="joker-form">
      <label className="joker-form-label" htmlFor="joker-atk-th">
        המחשבה התוקפת (בקול ובכתב)
      </label>
      <textarea
        id="joker-atk-th"
        className="joker-form-text"
        dir="rtl"
        rows={3}
        value={thought}
        onChange={(e) => setThought(e.target.value)}
        placeholder="למשל: «כולם יחשבו שאני לא מספיק טובה»"
      />
      <p className="joker-form-hint">בחרו צבע מסגרת — אותו צבע צריך להופיע בקלף ההגנה לבונוס −2.</p>
      <div className="suit-pick-row">
        {SUITS.map((s) => (
          <button
            key={s}
            type="button"
            className={'suit-pick-btn suit-pick-btn--swatch' + (suit === s ? ' suit-pick-btn--on' : '')}
            style={{ borderColor: suitBorderColor(s), background: suit === s ? `${suitBorderColor(s)}44` : 'transparent' }}
            onClick={() => setSuit(s)}
            aria-label={SUIT_LABELS[s]}
            title={SUIT_LABELS[s]}
          />
        ))}
      </div>
      <div className="joker-form-actions">
        <button type="button" className="btn primary" onClick={() => onConfirm(suit, thought)}>
          אישור קלף התקפה
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          ביטול — החזרת הג&apos;וקר ליד
        </button>
      </div>
    </div>
  )
}

function JokerDefenseForm({ onConfirm, onCancel }) {
  const [thought, setThought] = useState('')
  const [suit, setSuit] = useState('red')
  return (
    <div className="joker-form">
      <label className="joker-form-label" htmlFor="joker-def-th">
        מחשבה חלופית מועילה
      </label>
      <textarea
        id="joker-def-th"
        className="joker-form-text"
        dir="rtl"
        rows={3}
        value={thought}
        onChange={(e) => setThought(e.target.value)}
        placeholder="למשל: «טעות היא חלק מהמשחק; אפשר לנסות שוב»"
      />
      <p className="joker-form-hint">צבע המסגרת חייב להתאים לקלף ההתקפה (אותו צבע) לבונוס −2.</p>
      <div className="suit-pick-row">
        {SUITS.map((s) => (
          <button
            key={s}
            type="button"
            className={'suit-pick-btn suit-pick-btn--swatch' + (suit === s ? ' suit-pick-btn--on' : '')}
            style={{ borderColor: suitBorderColor(s), background: suit === s ? `${suitBorderColor(s)}44` : 'transparent' }}
            onClick={() => setSuit(s)}
            aria-label={SUIT_LABELS[s]}
            title={SUIT_LABELS[s]}
          />
        ))}
      </div>
      <div className="joker-form-actions">
        <button type="button" className="btn primary" onClick={() => onConfirm(suit, thought)}>
          אישור קלף הגנה
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          ביטול — החזרת הג&apos;וקר ליד
        </button>
      </div>
    </div>
  )
}

function PlayedCardsStrip({ attackCard, defenseCard, diceA, diceD }) {
  if (!attackCard && !defenseCard) return null
  const matched = suitsMatchForBonus(attackCard, defenseCard)
  return (
    <div className="played-strip">
      {attackCard && (
        <div
          className={'played-slot played-slot--attack' + (matched && defenseCard ? ' played-slot--match' : '')}
          style={{ borderColor: cardFaceBorder(attackCard) }}
        >
          <CardFace card={attackCard} compact asDisplay />
        </div>
      )}
      {defenseCard && (
        <div
          className={'played-slot played-slot--defense' + (matched ? ' played-slot--match' : '')}
          style={{ borderColor: cardFaceBorder(defenseCard) }}
        >
          <CardFace card={defenseCard} compact asDisplay />
        </div>
      )}
      {(diceA != null || diceD != null) && (
        <div className="played-dice played-dice--split">
          <div className="played-dice-line">
            <span className="played-dice-role">קוביית תוקף</span>
            <span className="played-dice-num">{diceA ?? '—'}</span>
          </div>
          <div className="played-dice-line">
            <span className="played-dice-role">קוביית מגן</span>
            <span className="played-dice-num">{diceD ?? '—'}</span>
          </div>
          {diceA != null && diceD != null && (
            <div className="played-dice-net">
              הפרש (לפני בונוס צבע): {diceA - diceD}
              {matched && defenseCard ? ' · בונוס צבע תואם: −2 נוספים להפרש' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DiceReadout({ diceA, diceD, attackCard, defenseCard }) {
  if (diceA == null && diceD == null) return null
  const matched = suitsMatchForBonus(attackCard, defenseCard)
  let net = null
  if (diceA != null && diceD != null) {
    net = diceA - diceD
    if (matched) net -= 2
  }
  return (
    <div className="dice-readout" dir="rtl">
      <div className="dice-readout__title">תוצאות קוביות</div>
      <div className="dice-readout__grid">
        <div className="dice-readout__cell dice-readout__cell--atk">
          <span className="dice-readout__label">תוקף</span>
          <span className="dice-readout__face">{diceA ?? '—'}</span>
        </div>
        <div className="dice-readout__cell dice-readout__cell--def">
          <span className="dice-readout__label">מגן</span>
          <span className="dice-readout__face">{diceD ?? '—'}</span>
        </div>
      </div>
      {net != null && (
        <p className="dice-readout__net">
          <strong>הפרש לצעדי רשת:</strong> {net}
          {matched && defenseCard ? ' (כולל −2 כי צבע המסגרות תואם)' : ''}
          {net === 0 ? ' — אין תזוזה' : net > 0 ? ' — תזוזה קדימה' : ' — תזוזה אחורה בלבד'}
        </p>
      )}
      {diceA != null && diceD == null ? (
        <p className="dice-readout__wait">ממתינים לזריקת קוביית המגן…</p>
      ) : null}
    </div>
  )
}

/** קווי רשת — אחרי סיבוב 90°: קווים «אופקיים» לפי מסלול, «אנכיים» לפי צעד */
function BoardGridLines({ lanes, steps }) {
  const lines = []
  for (let l = 0; l < lanes; l++) {
    const a = getNodeLayout(l, 0)
    const b = getNodeLayout(l, steps - 1)
    lines.push(
      <line
        key={`gl-${l}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        vectorEffect="nonScalingStroke"
        className="pitch-grid-line"
      />
    )
  }
  for (let s = 0; s < steps; s++) {
    const a = getNodeLayout(0, s)
    const b = getNodeLayout(lanes - 1, s)
    lines.push(
      <line
        key={`gs-${s}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        vectorEffect="nonScalingStroke"
        className="pitch-grid-line"
      />
    )
  }
  return <g className="pitch-grid-layer">{lines}</g>
}

/**
 * bare: בלי כיתוב על הלוח
 * uniformJunctions: כל העיגולים אותו סגנון (מסך פתיחה)
 * activeAttacker: הדגשת השחקן שנבחר לתור התקפה (עד הנחיתה / סיום שלב הקוביות)
 */
function Board({
  state,
  pickLanding,
  onPickLanding,
  pickPiece = null,
  activeAttacker = null,
  bare = true,
  uniformJunctions = false
}) {
  const pitchClipId = useId().replace(/:/g, '')
  const lanes = LANE_NODE_POS.length
  const steps = STEPS

  const reachKeySet = new Set()
  if (pickLanding?.candidates?.length) {
    for (const c of pickLanding.candidates) {
      reachKeySet.add(`${c.lane},${c.step}`)
    }
  }

  const junctionEls = []
  LANE_NODE_POS.forEach((laneNodes, lane) => {
    laneNodes.forEach((node) => {
      const specialClass =
        !uniformJunctions && node.special ? ' pitch-junction-node--special' : ''
      const reachableClass =
        reachKeySet.size > 0 && reachKeySet.has(`${lane},${node.step}`)
          ? ' pitch-junction-node--reachable'
          : ''
      junctionEls.push(
        <circle
          key={`j-${lane}-${node.step}`}
          cx={node.x}
          cy={node.y}
          r={2.35}
          className={'pitch-junction-node' + specialClass + reachableClass}
        />
      )
    })
  })

  const stacks = {}
  for (let t = 0; t < 2; t++) {
    const team = state.teams[t]
    for (const k of RENDER_PIECE_KEYS) {
      const p = team.pieces[k]
      if (!p) continue
      const key = `${p.lane}-${p.step}`
      if (!stacks[key]) stacks[key] = []
      stacks[key].push({ t, k, p })
    }
  }

  const pickSet =
    pickPiece?.movableKeys?.length && typeof pickPiece.onPickPiece === 'function'
      ? new Set(pickPiece.movableKeys)
      : null
  const pickPlayer = pickPiece?.currentPlayer

  const pieceEls = Object.entries(stacks).flatMap(([sk, list]) => {
    const [laneStr, stepStr] = sk.split('-')
    const lane = Number(laneStr)
    const step = Number(stepStr)
    const node = getNodeLayout(lane, step)
    const n = list.length
    return list.map((item, idx) => {
      const spread = n <= 1 ? 0 : (idx - (n - 1) / 2) * 2.85
      const lift = n <= 1 ? 0 : -1.05
      const canPick =
        pickSet &&
        item.t === pickPlayer &&
        !item.p.isGK &&
        pickSet.has(item.k)
      const isActiveAttacker =
        activeAttacker &&
        item.t === activeAttacker.teamIdx &&
        item.k === activeAttacker.pieceKey
      const discR = item.p.isGK ? 3.05 : isActiveAttacker ? 3.28 : 2.9
      return (
        <g
          key={`${item.t}-${item.k}`}
          transform={`translate(${node.x + spread}, ${node.y + lift})`}
          className={
            'pitch-piece-group s' +
            item.t +
            (item.p.isGK ? ' pitch-piece-group--gk' : '') +
            (canPick ? ' pitch-piece-group--pickable' : '') +
            (isActiveAttacker ? ' pitch-piece-group--selected' : '')
          }
          role={canPick ? 'button' : undefined}
          tabIndex={canPick ? 0 : undefined}
          aria-label={canPick ? `בחירת ${ROLE_LABELS[item.k] || item.k}` : undefined}
          onClick={canPick ? () => pickPiece.onPickPiece(item.k) : undefined}
          onKeyDown={
            canPick
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    pickPiece.onPickPiece(item.k)
                  }
                }
              : undefined
          }
        >
          <circle
            r={discR}
            className="pitch-piece-disc"
            vectorEffect="nonScalingStroke"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            y="0.45"
            className="pitch-piece-icon"
            fontSize="2.75"
          >
            {ROLE_ICONS[item.k] || '?'}
          </text>
        </g>
      )
    })
  })

  const landingEls =
    pickLanding && onPickLanding && pickLanding.candidates?.length
      ? pickLanding.candidates.map((c) => {
          const { x, y } = getNodeLayout(c.lane, c.step)
          const dir =
            pickLanding.towardGoal === true
              ? 'קדימה לשער'
              : pickLanding.towardGoal === false
                ? 'אחורה'
                : ''
          const ariaLand = dir
            ? `בחירת יעד — ${dir}, צעד ${pickLanding.absn} ברשת`
            : 'בחירת צומת יעד לנחיתה'
          return (
            <g
              key={`land-${c.lane}-${c.step}`}
              className="pitch-landing-group"
              role="button"
              tabIndex={0}
              transform={`translate(${x},${y})`}
              aria-label={ariaLand}
              onClick={() => onPickLanding(c.lane, c.step)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPickLanding(c.lane, c.step)
                }
              }}
            >
              <circle r={4.6} className="pitch-landing-hit" vectorEffect="nonScalingStroke" />
            </g>
          )
        })
      : []

  const svgNeedsPointerA11y = Boolean(pickSet) || landingEls.length > 0

  return (
    <div className={'pitch-wrap' + (bare ? ' pitch-wrap--bare' : '')}>
      <div className="pitch-board-row pitch-board-row--full">
        <div className="pitch-field" dir="ltr">
          <svg
            className="pitch-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden={svgNeedsPointerA11y ? false : true}
          >
            <defs>
              <clipPath id={pitchClipId}>
                <rect x="0.85" y="0.85" width="98.3" height="98.3" rx="1.05" />
              </clipPath>
            </defs>
            <rect
              className="pitch-grass"
              x="0"
              y="0"
              width="100"
              height="100"
              rx="1.2"
              fill="rgba(21, 94, 50, 0.38)"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="0.3"
            />
            <g clipPath={`url(#${pitchClipId})`}>
              <BoardGridLines lanes={lanes} steps={steps} />
              <g className="pitch-junction-layer">{junctionEls}</g>
              <g className="pitch-piece-layer">{pieceEls}</g>
              {landingEls.length > 0 ? <g className="pitch-landing-layer">{landingEls}</g> : null}
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(() => createInitialMatch())
  const [pitchIntro, setPitchIntro] = useState(true)
  const [handViewer, setHandViewer] = useState(0)
  const [primedAttackId, setPrimedAttackId] = useState(null)
  const [primedDefenseId, setPrimedDefenseId] = useState(null)

  useEffect(() => {
    try {
      const cur = String(OPENING_LAYOUT_VERSION)
      const prev = sessionStorage.getItem(OPENING_LAYOUT_STORAGE_KEY)
      if (prev != null && prev !== cur) {
        setPitchIntro(true)
        setState(createInitialMatch())
      }
      sessionStorage.setItem(OPENING_LAYOUT_STORAGE_KEY, cur)
    } catch {
      /* מצב פרטי / חסימת אחסון */
    }
  }, [OPENING_LAYOUT_VERSION])

  useEffect(() => {
    if (state.sub !== 'pickAttack' || handViewer !== state.currentPlayer) {
      setPrimedAttackId(null)
    }
  }, [state.sub, state.currentPlayer, handViewer])

  useEffect(() => {
    const def = 1 - state.currentPlayer
    if (state.sub !== 'defense' || handViewer !== def) {
      setPrimedDefenseId(null)
    }
  }, [state.sub, state.currentPlayer, handViewer])

  useEffect(() => {
    if (state.phase !== 'play') return
    if (
      state.sub === 'defense' ||
      state.sub === 'jokerDefense' ||
      state.sub === 'rollDefense'
    ) {
      setHandViewer(1 - state.currentPlayer)
    } else if (
      state.sub === 'pickAttack' ||
      state.sub === 'jokerAttack' ||
      state.sub === 'pickPiece' ||
      state.sub === 'rollAttack' ||
      state.sub === 'pickLanding' ||
      state.sub === 'special' ||
      state.sub === 'endTurn'
    ) {
      setHandViewer(state.currentPlayer)
    }
  }, [state.phase, state.sub, state.currentPlayer])

  const apply = useCallback((fn) => {
    setState((s) => {
      const n = fn(s)
      return n || s
    })
  }, [])

  const cur = state.currentPlayer
  const def = 1 - cur
  const movable = getMovableKeys(state) || []

  const specialDeckRaised = state.phase === 'play' && anyPieceOnSpecialStep(state)
  const pView = handViewer
  const handView = state.hands[pView] || []
  const canAtk = state.phase === 'play' && state.sub === 'pickAttack' && pView === cur
  const canDef = state.phase === 'play' && state.sub === 'defense' && pView === def
  const atkInHand = handView.filter((c) => c.kind === 'attack')

  const attackerHighlight =
    state.phase === 'play' &&
    state.attacker &&
    [
      'pickAttack',
      'jokerAttack',
      'rollAttack',
      'defense',
      'jokerDefense',
      'rollDefense',
      'pickLanding'
    ].includes(state.sub)
      ? { teamIdx: state.currentPlayer, pieceKey: state.attacker }
      : null

  const onAttackCardPick = (id) => {
    const c = (state.hands[state.currentPlayer] || []).find((x) => x.id === id)
    if (!c || c.kind !== 'attack') return
    if (c.joker) {
      setPrimedAttackId(null)
      apply((s) => selectAttackCard(s, id))
      return
    }
    if (primedAttackId === id) {
      setPrimedAttackId(null)
      apply((s) => selectAttackCard(s, id))
    } else {
      setPrimedAttackId(id)
    }
  }

  const onDefenseCardPick = (id) => {
    const defIdx = 1 - state.currentPlayer
    const c = (state.hands[defIdx] || []).find((x) => x.id === id)
    if (!c || c.kind !== 'defense') return
    if (c.joker) {
      setPrimedDefenseId(null)
      apply((s) => selectDefenseCard(s, id))
      return
    }
    if (primedDefenseId === id) {
      setPrimedDefenseId(null)
      apply((s) => selectDefenseCard(s, id))
    } else {
      setPrimedDefenseId(id)
    }
  }

  return (
    <div className="app app--full-pitch">
      {SHOW_DEBUG && (
        <aside className="debug-panel" dir="ltr">
          <strong>DEBUG</strong>
          <pre>{JSON.stringify(
            {
              phase: state.phase,
              sub: state.sub,
              currentPlayer: state.currentPlayer,
              attacker: state.attacker,
              diceA: state.diceA,
              diceD: state.diceD,
              deck: state.deck?.length,
              specialDeck: state.specialDeck?.length,
              pieces0: state.teams?.[0]?.pieces,
              pieces1: state.teams?.[1]?.pieces
            },
            null,
            2
          )}</pre>
        </aside>
      )}

      {state.phase === 'over' && (
        <div className="banner-win">
          {state.message}
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setPitchIntro(true)
              setState(createInitialMatch())
            }}
          >
            משחק חדש
          </button>
        </div>
      )}

      {pitchIntro && state.phase === 'play' ? (
        <div className="pitch-intro-bare">
          <Board
            state={state}
            pickLanding={null}
            onPickLanding={undefined}
            pickPiece={null}
            activeAttacker={null}
            uniformJunctions
          />
          <button
            type="button"
            className="pitch-bare-continue"
            onClick={() => setPitchIntro(false)}
            aria-label="המשך למשחק"
          />
        </div>
      ) : (
      <div className="layout layout-with-pitch layout-with-pitch--stacked">
        <section className="panel panel-pitch">
          <Board
            state={state}
            pickLanding={state.phase === 'play' && state.sub === 'pickLanding' ? state.pendingLanding : null}
            onPickLanding={(lane, step) => apply((s) => selectLandingCell(s, lane, step))}
            pickPiece={
              state.phase === 'play' && state.sub === 'pickPiece' && movable.length > 0
                ? {
                    currentPlayer: cur,
                    movableKeys: movable,
                    onPickPiece: (key) => apply((s) => selectPiece(s, key))
                  }
                : null
            }
            activeAttacker={attackerHighlight}
          />
          {state.phase === 'play' && turnPhaseActiveStep(state.sub) >= 0 && (
            <TurnPhaseRail sub={state.sub} attackerPlayerIndex={state.currentPlayer} />
          )}
          {state.phase === 'play' &&
            state.diceA != null &&
            ['defense', 'jokerDefense', 'rollDefense', 'pickLanding', 'special', 'endTurn'].includes(
              state.sub
            ) && (
              <DiceReadout
                diceA={state.diceA}
                diceD={state.diceD}
                attackCard={state.attackCard}
                defenseCard={state.defenseCard}
              />
            )}
          {state.phase === 'play' && (state.sub === 'rollAttack' || state.sub === 'rollDefense') && (
            <div className="pitch-phase-strip">
              <DiceRollTap
                variant={state.sub === 'rollAttack' ? 'attack' : 'defense'}
                onRoll={() =>
                  apply(state.sub === 'rollAttack' ? commitRollAttack : commitRollDefense)
                }
              />
            </div>
          )}
        </section>

        <section className="panel panel-cards-below">
          <>
              {state.phase === 'play' && (
                <DeckStacks
                  deck={state.deck}
                  specialDeck={state.specialDeck ?? []}
                  specialRaised={specialDeckRaised}
                  onClickMain={
                    canAtk && atkInHand.length === 0 ? () => apply(drawOneFromDeck) : undefined
                  }
                  onClickSpecial={
                    state.sub === 'special' && !state.pendingSpecial?.card
                      ? () => apply(drawSpecialFromDeck)
                      : undefined
                  }
                />
              )}

              {state.phase !== 'over' && (
                <p className="msg msg--compact">
                  {state.message}
                  {state.phase === 'play' ? ` · תור ${cur + 1}` : ''}
                </p>
              )}

              <PlayedCardsStrip
                attackCard={state.attackCard}
                defenseCard={state.defenseCard}
                diceA={state.diceA}
                diceD={state.diceD}
              />

              {state.phase === 'play' && (
                <div className="hands-panel hands-panel--single">
                  <div className="hand-viewer-min">
                    <span className="hand-viewer-min-label">יד</span>
                    <button
                      type="button"
                      className={'hand-pill' + (handViewer === 0 ? ' hand-pill--on' : '')}
                      onClick={() => setHandViewer(0)}
                      aria-label="שחקן 1"
                    >
                      1
                    </button>
                    <button
                      type="button"
                      className={'hand-pill' + (handViewer === 1 ? ' hand-pill--on' : '')}
                      onClick={() => setHandViewer(1)}
                      aria-label="שחקן 2"
                    >
                      2
                    </button>
                  </div>
                  {canDef && state.attackCard && (
                    <p className="defense-hand-hint" dir="rtl">
                      <strong>מגן:</strong> לבונוס <strong>−2</strong> להפרש בין הקוביות — השתמשו בקלף הגנה עם{' '}
                      <strong>אותו צבע מסגרת</strong> כמו קלף ההתקפה (
                      {SUIT_LABELS[state.attackCard.effectiveSuit ?? state.attackCard.suit] || 'כמו המסגרת על השולחן'}
                      ), או ב־<strong>ג&apos;וקר הגנה</strong> ובטופס בוחרים אותו צבע.
                    </p>
                  )}
                  <div className="hand">
                    {handView.map((c) => (
                      <CardFace
                        key={c.id}
                        card={c}
                        compact
                        defenseBonusHint={
                          canDef && c.kind === 'defense'
                            ? defenseBonusHintKind(state.attackCard, c)
                            : null
                        }
                        isPrimed={
                          (canAtk && c.kind === 'attack' && primedAttackId === c.id) ||
                          (canDef && c.kind === 'defense' && primedDefenseId === c.id)
                        }
                        onPick={
                          canAtk && c.kind === 'attack'
                            ? onAttackCardPick
                            : canDef && c.kind === 'defense'
                              ? onDefenseCardPick
                              : undefined
                        }
                      />
                    ))}
                  </div>
                  {canAtk && primedAttackId && (
                    <div className="hand-primed-row">
                      <button type="button" className="btn primary" onClick={() => onAttackCardPick(primedAttackId)}>
                        אשר והשמע קלף התקפה
                      </button>
                      <button type="button" className="btn" onClick={() => setPrimedAttackId(null)}>
                        בטל בחירה
                      </button>
                    </div>
                  )}
                  {canDef && primedDefenseId && (
                    <div className="hand-primed-row">
                      <button type="button" className="btn primary" onClick={() => onDefenseCardPick(primedDefenseId)}>
                        אשר והשמע קלף הגנה
                      </button>
                      <button type="button" className="btn" onClick={() => setPrimedDefenseId(null)}>
                        בטל בחירה
                      </button>
                    </div>
                  )}
                </div>
              )}

              {state.phase === 'play' && state.sub === 'jokerAttack' && (
                <div className="hand-block">
                  <JokerAttackForm
                    onConfirm={(suit, thought) => apply((s) => confirmJokerAttack(s, suit, thought))}
                    onCancel={() => apply(cancelJokerAttack)}
                  />
                </div>
              )}

              {state.phase === 'play' && state.sub === 'defense' && (
                <div className="hand-block hand-block--defense-hint">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setPrimedDefenseId(null)
                      apply(passDefense)
                    }}
                  >
                    בלי קלף הגנה
                  </button>
                </div>
              )}

              {state.phase === 'play' && state.sub === 'jokerDefense' && (
                <div className="hand-block">
                  {state.attackCard && (
                    <p className="defense-hand-hint defense-hand-hint--tight" dir="rtl">
                      לבונוס −2: צבע המסגרת שתבחרו חייב להיות{' '}
                      <strong>{SUIT_LABELS[state.attackCard.effectiveSuit ?? state.attackCard.suit]}</strong> — כמו
                      קלף ההתקפה על השולחן.
                    </p>
                  )}
                  <JokerDefenseForm
                    onConfirm={(suit, thought) => apply((s) => confirmJokerDefense(s, suit, thought))}
                    onCancel={() => apply(cancelJokerDefense)}
                  />
                </div>
              )}

              {state.phase === 'play' && state.sub === 'special' && state.pendingSpecial?.card && (
                <div className="special-reveal">
                  <CardFace card={state.pendingSpecial.card} />
                  <button type="button" className="btn primary" onClick={() => apply(acknowledgeSpecial)}>
                    בוצע — המשך
                  </button>
                </div>
              )}

              {state.phase === 'play' && state.sub === 'endTurn' && (
                <div className="actions">
                  <button type="button" className="btn primary" onClick={() => apply(endTurnAndDraw)}>
                    סיום תור וחלוקת קלפים
                  </button>
                </div>
              )}

          </>
        </section>
      </div>
      )}
    </div>
  )
}
