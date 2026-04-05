import React, { useState, useCallback } from 'react'
import { SUIT_LABELS, PATH_STYLES, PATH_LABELS } from './game/constants.js'
import {
  createInitialMatch,
  setPathDraft,
  beginPlay,
  selectPiece,
  selectAttackCard,
  selectDefenseCard,
  passDefense,
  commitRoll,
  drawSpecialFromDeck,
  acknowledgeSpecial,
  endTurnAndDraw,
  getMovableKeys,
  drawOneFromDeck
} from './game/gameLogic.js'

const ROLE_LABELS = { o0: 'חלוץ', o1: 'קשר', o2: 'בלם', o3: 'קשר נוסף' }
const ROLE_ICONS = { o0: '⚽', o1: '⚙', o2: '🛡', o3: '🔄' }
const OUT_KEYS = ['o0', 'o1', 'o2', 'o3']

const ROW_SPECIAL = {
  2: 'קלף CBT',
  4: 'לחץ / העצמה',
  5: 'משימה שובבה'
}

function CardFace({ card, onPick, compact }) {
  if (!card) return null
  const border =
    card.suit === 'red'
      ? '#c2410c'
      : card.suit === 'yellow'
        ? '#ca8a04'
        : card.suit === 'blue'
          ? '#2563eb'
          : card.suit === 'green'
            ? '#059669'
            : '#64748b'
  return (
    <button
      type="button"
      className={`card-face ${compact ? 'compact' : ''}`}
      style={{ borderColor: border }}
      onClick={() => onPick && onPick(card.id)}
      disabled={!onPick}
    >
      {card.suit && <span className="card-suit">{SUIT_LABELS[card.suit]}</span>}
      <span className="card-sub">{card.sub}</span>
      <span className="card-title">{card.title}</span>
      <p className="card-text">{card.text}</p>
      {card.kind === 'special' && (
        <span className="card-mod">קוביה: {card.diceMod >= 0 ? '+' : ''}{card.diceMod}</span>
      )}
    </button>
  )
}

function Board({ state }) {
  const rows = 8
  const lanes = 4
  const cellPiece = (row, lane) => {
    const out = []
    for (let t = 0; t < 2; t++) {
      const team = state.teams[t]
      for (const [k, p] of Object.entries(team.pieces)) {
        if (p.lane === lane && p.row === row) {
          if (p.isGK) out.push({ t, k, gk: true })
          else out.push({ t, k, gk: false })
        }
      }
    }
    return out
  }

  return (
    <div className="board-wrap">
      <div className="board-labels">
        <span>שער שחקן 2</span>
        <span>שחקן 1 — כיוון התקפה ↑</span>
      </div>
      <div className="board-grid">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="board-row">
            {Array.from({ length: lanes }, (_, lane) => {
              const pcs = cellPiece(row, lane)
              const special = [2, 4, 5].includes(row)
              return (
                <div key={lane} className={'board-cell' + (special ? ' special-cell' : '')}>
                  <span className="cell-coord">
                    {lane},{row}
                  </span>
                  {special && <span className="cell-tag">{ROW_SPECIAL[row]}</span>}
                  {pcs.map((p) => (
                    <span
                      key={p.t + p.k}
                      className={'piece p' + p.t + (p.gk ? ' gk' : '')}
                      title={p.gk ? 'שוער (לא זז)' : ROLE_LABELS[p.k]}
                    >
                      {p.gk ? '🧤' : ROLE_ICONS[p.k] || '?'}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="board-legend">משבצות מסומנות: משיכת קלף מיוחד (רגש / גוף / התנהגות / משאב / שובב)</p>
    </div>
  )
}

function SetupPaths({ state, onChange, onStart }) {
  return (
    <div className="setup-box">
      <h2>פריסת «חיילים» — בחרו מסלול התקדמות לכל שחקן שדה</h2>
      <p className="msg">
        מומלץ: <strong>8 קלפים</strong> לכל שחקן בתחילה, שאר החפיסה בקופה; אחרי שימוש בקלף — משלימים מהקופה עד 8.
      </p>
      {[0, 1].map((ti) => (
        <div key={ti} className="setup-team">
          <h3>קבוצה {ti + 1}</h3>
          <div className="setup-grid">
            {OUT_KEYS.map((k) => (
              <div key={k} className="setup-row">
                <label>
                  {ROLE_ICONS[k]} {ROLE_LABELS[k]}:
                </label>
                <select
                  value={state.pathDraft[ti][k]}
                  onChange={(e) => onChange(ti, k, e.target.value)}
                >
                  {PATH_STYLES.map((ps) => (
                    <option key={ps} value={ps}>
                      {PATH_LABELS[ps].title} — {PATH_LABELS[ps].hint}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn primary" onClick={onStart}>
        התחל משחק
      </button>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(() => createInitialMatch())

  const apply = useCallback((fn) => {
    setState((s) => {
      const n = fn(s)
      return n || s
    })
  }, [])

  const cur = state.currentPlayer
  const def = 1 - cur
  const movable = state.phase === 'play' ? getMovableKeys(state) || [] : []

  const attackCards = state.hands[cur]?.filter((c) => c.kind === 'attack') || []
  const defenseCards = state.hands[def]?.filter((c) => c.kind === 'defense') || []

  return (
    <div className="app">
      <header className="hdr">
        <h1>כדורגל העצמה ⚽⭐</h1>
        <p className="hdr-sub">
          מטרה: להביא את <strong>ארבעת שחקני השדה</strong> (חלוץ, קשר, בלם, קשר נוסף) לשער היריב —{' '}
          <strong>השוער נשאר</strong>. בכל תור: בוחרים שחקן, קלף התקפה (מחשבה לא מועילה), המגן משיב ב־
          <strong>אותו צבע</strong> (הגנה מועילה). שני הצדדים זורקים קוביה — הקוביה מייצגת כמה אתם{' '}
          <strong>מאמינים</strong> למחשבה על הקלף. הפרש = תנועה; התאמת צבע מחזקת מגן; שוויון = עמידה; יתרון למגן =
          דחיפה אחורה.
        </p>
      </header>

      {state.phase === 'setup' && (
        <SetupPaths
          state={state}
          onChange={(ti, k, v) => apply((s) => setPathDraft(s, ti, k, v))}
          onStart={() => apply(beginPlay)}
        />
      )}

      {state.phase === 'over' && (
        <div className="banner-win">
          {state.message}
          <button type="button" className="btn primary" onClick={() => setState(createInitialMatch())}>
            משחק חדש
          </button>
        </div>
      )}

      {state.phase === 'play' && (
        <div className="layout">
          <section className="panel">
            <h2>לוח</h2>
            <Board state={state} />
          </section>

          <section className="panel">
            <h2>תור: שחקן {cur + 1} (תוקף)</h2>
            <p className="msg">{state.message}</p>

            {state.sub === 'pickPiece' && (
              <div className="actions">
                <p>בחרי שחקן שדה:</p>
                <div className="piece-btns">
                  {movable.map((k) => (
                    <button key={k} type="button" className="btn" onClick={() => apply((s) => selectPiece(s, k))}>
                      {ROLE_ICONS[k]} {ROLE_LABELS[k]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {state.sub === 'pickAttack' && (
              <div className="hand-block">
                <p>קלף התקפה — אמרי את המחשבה בקול:</p>
                {attackCards.length === 0 && (
                  <button type="button" className="btn" onClick={() => apply(drawOneFromDeck)}>
                    משיכה מהקופה
                  </button>
                )}
                <div className="hand">
                  {attackCards.map((c) => (
                    <CardFace key={c.id} card={c} onPick={(id) => apply((s) => selectAttackCard(s, id))} compact />
                  ))}
                </div>
              </div>
            )}

            {state.sub === 'defense' && (
              <div className="hand-block">
                <p>שחקן {def + 1} — קלף הגנה באותו צבע או דילוג:</p>
                <div className="hand">
                  {defenseCards.map((c) => (
                    <CardFace key={c.id} card={c} onPick={(id) => apply((s) => selectDefenseCard(s, id))} compact />
                  ))}
                </div>
                <button type="button" className="btn" onClick={() => apply(passDefense)}>
                  בלי קלף הגנה
                </button>
              </div>
            )}

            {state.sub === 'roll' && (
              <div className="actions">
                {(state.nextDiceMod?.[cur] || 0) !== 0 && (
                  <p className="msg">
                    תיקון מקלף מיוחד לזריקת התוקף הבאה:{' '}
                    <strong>
                      {(state.nextDiceMod[cur] >= 0 ? '+' : '') + state.nextDiceMod[cur]}
                    </strong>{' '}
                    (מוחל על גלילת הקוביה ומוגבל ל־1–6)
                  </p>
                )}
                <button type="button" className="btn primary" onClick={() => apply(commitRoll)}>
                  זריקת קוביות (אמונה במחשבה)
                </button>
              </div>
            )}

            {state.sub === 'special' && !state.pendingSpecial?.card && (
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => apply(drawSpecialFromDeck)}>
                  משיכת קלף מיוחד
                </button>
              </div>
            )}

            {state.sub === 'special' && state.pendingSpecial?.card && (
              <div className="special-reveal">
                <CardFace card={state.pendingSpecial.card} />
                <button type="button" className="btn primary" onClick={() => apply(acknowledgeSpecial)}>
                  בוצע
                </button>
              </div>
            )}

            {state.sub === 'endTurn' && state.phase !== 'over' && (
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => apply(endTurnAndDraw)}>
                  סיום תור וחלוקת קלפים
                </button>
              </div>
            )}

            <h3>יד שחקן 1 ({state.hands[0].length})</h3>
            <div className="hand readonly">
              {state.hands[0].map((c) => (
                <CardFace key={c.id} card={c} compact />
              ))}
            </div>
            <h3>יד שחקן 2 ({state.hands[1].length})</h3>
            <div className="hand readonly">
              {state.hands[1].map((c) => (
                <CardFace key={c.id} card={c} compact />
              ))}
            </div>
            <p className="deck-info">קופה: {state.deck.length}</p>
          </section>
        </div>
      )}
    </div>
  )
}
