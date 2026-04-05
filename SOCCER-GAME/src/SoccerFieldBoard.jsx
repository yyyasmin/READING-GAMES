import React, { useState } from 'react'

/** תמונת הלוח — שמים את הקובץ ב־public/assets/ (בבילד: dist/assets/). */
const DEFAULT_FIELD_SRC = `${import.meta.env.BASE_URL}assets/soccer-field-2.png`

/** מיקומי שחקנים (אחוזים מתוך המיכל) — צד «ההתקפה» למעלה */
const PLAYER_MARKERS = [
  { key: 'gk', short: 'ש', title: 'שוער', left: '24%', top: '88%' },
  { key: 'd', short: '2', title: 'מגן', left: '18%', top: '72%' },
  { key: 'm', short: '8', title: 'קשר', left: '50%', top: '68%' },
  { key: 'a', short: '9', title: 'חלוץ', left: '82%', top: '72%' },
  { key: 'w', short: '7', title: 'כנף', left: '76%', top: '88%' }
]

function slotPosition(stepIndex, totalSteps) {
  if (totalSteps < 1) return { left: '50%', top: '50%' }
  const n = totalSteps
  const frac = n <= 1 ? 0.5 : stepIndex / (n - 1)
  const top = 80 - frac * 58
  const left = 50 + Math.sin(frac * Math.PI) * 6
  return { left: `${left}%`, top: `${top}%` }
}

function ballPosition(stepIndex, totalSteps) {
  const p = slotPosition(stepIndex, totalSteps)
  return {
    ...p,
    transform: 'translate(-50%, calc(-50% - 1.25rem))'
  }
}

/**
 * @param {object} props
 * @param {string} [props.imageSrc]
 * @param {number} props.totalSteps
 * @param {number} props.currentStep אינדקס 0..totalSteps-1
 * @param {'play'|'done'} props.phase
 */
export function SoccerFieldBoard({ imageSrc = DEFAULT_FIELD_SRC, totalSteps, currentStep, phase }) {
  const [imgBroken, setImgBroken] = useState(false)
  const steps = Math.max(1, totalSteps)
  const safeStep = Math.min(Math.max(0, currentStep), steps - 1)
  const ballStep = phase === 'done' ? steps - 1 : safeStep

  return (
    <div className="soccer-field-board">
      <div className="soccer-field-board-inner">
        {!imgBroken ? (
          <img
            className="soccer-field-board-img"
            src={imageSrc}
            alt=""
            onError={() => setImgBroken(true)}
          />
        ) : (
          <div className="soccer-field-board-fallback" role="img" aria-label="לוח כדורגל">
            <span>הוסיפו את תמונת הלוח ל־public/assets/soccer-field-2.png</span>
          </div>
        )}

        <svg className="soccer-field-track-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path
            d="M 50 80 Q 52 50 50 22"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.35"
            strokeDasharray="1.2 1.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="soccer-field-markers-layer" aria-hidden>
          {PLAYER_MARKERS.map((p) => (
            <div
              key={p.key}
              className="soccer-player-pin"
              style={{ left: p.left, top: p.top }}
              title={p.title}
            >
              <span className="soccer-player-pin-face">{p.short}</span>
            </div>
          ))}

          {Array.from({ length: steps }, (_, i) => {
            const pos = slotPosition(i, steps)
            const isPast = phase === 'done' ? i < steps - 1 : i < safeStep
            const isCurrent = phase === 'play' && i === safeStep
            const isGoal = phase === 'done' && i === steps - 1
            return (
              <div
                key={`slot-${i}`}
                className={
                  'soccer-progress-slot' +
                  (isPast ? ' is-past' : '') +
                  (isCurrent ? ' is-current' : '') +
                  (isGoal ? ' is-goal' : '')
                }
                style={pos}
              >
                <span className="soccer-progress-slot-num">{i + 1}</span>
              </div>
            )
          })}

          <div
            className="soccer-ball-pin"
            style={ballPosition(ballStep, steps)}
            title="כדור"
          >
            <span className="soccer-ball-emoji" aria-hidden>
              ⚽
            </span>
          </div>
        </div>
      </div>
      <p className="soccer-field-legend">
        משבצות מסודרות לפי סיבובי המשחק · השחקנים לסימון בלבד · הכדור על משבצת ההתקדמות הנוכחית
      </p>
    </div>
  )
}
