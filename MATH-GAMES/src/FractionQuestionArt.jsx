import React from 'react'

const W = 108
const H = 88

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function pieSlicePath(cx, cy, r, startDeg, endDeg) {
  const p0 = polar(cx, cy, r, startDeg)
  const p1 = polar(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`
}

function donutSlicePath(cx, cy, rOut, rIn, startDeg, endDeg) {
  const p0o = polar(cx, cy, rOut, startDeg)
  const p1o = polar(cx, cy, rOut, endDeg)
  const p1i = polar(cx, cy, rIn, endDeg)
  const p0i = polar(cx, cy, rIn, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return (
    `M ${p0o.x} ${p0o.y} A ${rOut} ${rOut} 0 ${large} 1 ${p1o.x} ${p1o.y}` +
    ` L ${p1i.x} ${p1i.y} A ${rIn} ${rIn} 0 ${large} 0 ${p0i.x} ${p0i.y} Z`
  )
}

/** עוגה / פיצה / הדר — פרוסות מעגליות */
function ArtPie({ total, filled, cheese, crust, accent }) {
  const cx = W / 2
  const cy = H / 2 + 2
  const r = 34
  const step = 360 / total
  const slices = []
  for (let i = 0; i < total; i++) {
    const start = i * step
    const end = (i + 1) * step
    const isOn = i < filled
    slices.push(
      <path
        key={i}
        d={pieSlicePath(cx, cy, r, start, end)}
        fill={isOn ? cheese : '#fde68a'}
        stroke={crust}
        strokeWidth={2.2}
      />
    )
  }
  return (
    <svg className="fraction-art-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      {slices}
      {accent}
    </svg>
  )
}

/** סרגל חטיפ / שוקולד */
function ArtBar({ total, filled, base, on, stroke, rind }) {
  const pad = 8
  const bw = W - pad * 2
  const bh = 40
  const gap = 2
  const segW = (bw - gap * (total - 1)) / total
  const y = (H - bh) / 2
  const rects = []
  for (let i = 0; i < total; i++) {
    const x = pad + i * (segW + gap)
    const isOn = i < filled
    rects.push(
      <rect
        key={i}
        x={x}
        y={y}
        width={segW}
        height={bh}
        rx={4}
        fill={isOn ? on : base}
        stroke={stroke}
        strokeWidth={1.8}
      />
    )
  }
  return (
    <svg className="fraction-art-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      {rind && (
        <rect x={pad - 2} y={y - 5} width={bw + 4} height={bh + 10} rx={6} fill="none" stroke="#15803d" strokeWidth={3} />
      )}
      {rects}
    </svg>
  )
}

/** רשת (וופל / בראוניז / עוגיות) */
function ArtGrid({ rows, cols, filled, on, off, stroke }) {
  const pad = 7
  const gw = W - pad * 2
  const gh = H - pad * 2 - 6
  const gap = 3
  const cellW = (gw - gap * (cols - 1)) / cols
  const cellH = (gh - gap * (rows - 1)) / rows
  const cells = []
  let idx = 0
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = pad + col * (cellW + gap)
      const y = pad + 6 + row * (cellH + gap)
      const isOn = idx < filled
      cells.push(
        <rect
          key={idx}
          x={x}
          y={y}
          width={cellW}
          height={cellH}
          rx={5}
          fill={isOn ? on : off}
          stroke={stroke}
          strokeWidth={1.6}
        />
      )
      idx++
    }
  }
  return (
    <svg className="fraction-art-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      {cells}
    </svg>
  )
}

/** סוכרייה על מקל — פסים בתוך ראש עגול */
function ArtPopsicle({ clipId, total, filled }) {
  const cx = W / 2
  const stickTop = 54
  const stickW = 11
  const stickH = 26
  const rx = 32
  const ry = 24
  const topY = 10
  const step = (2 * rx) / total
  const bars = []
  for (let i = 0; i < total; i++) {
    const x = cx - rx + i * step
    const isOn = i < filled
    bars.push(
      <rect
        key={i}
        x={x}
        y={topY}
        width={Math.max(step - 0.5, 1.5)}
        height={ry * 2}
        fill={isOn ? '#ec4899' : '#fbcfe8'}
        stroke="none"
      />
    )
  }
  return (
    <svg className="fraction-art-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx={cx} cy={topY + ry} rx={rx} ry={ry} />
        </clipPath>
      </defs>
      <ellipse cx={cx} cy={topY + ry} rx={rx + 1} ry={ry + 1} fill="#fce7f3" stroke="#be185d" strokeWidth={2.2} />
      <g clipPath={`url(#${clipId})`}>{bars}</g>
      <rect x={cx - stickW / 2} y={stickTop} width={stickW} height={stickH} rx={3} fill="#d4a574" stroke="#92400e" strokeWidth={1.5} />
    </svg>
  )
}

/** דונאט צבעוני */
function ArtDonut({ total, filled }) {
  const cx = W / 2
  const cy = H / 2
  const rOut = 36
  const rIn = 18
  const step = 360 / total
  const colorsOn = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#4ade80']
  const colorsOff = ['#fce7f3', '#ede9fe', '#dbeafe', '#d1fae5', '#fef3c7', '#ffedd5', '#fee2e2', '#dcfce7']
  const slices = []
  for (let i = 0; i < total; i++) {
    const start = i * step
    const end = (i + 1) * step
    const isOn = i < filled
    slices.push(
      <path
        key={i}
        d={donutSlicePath(cx, cy, rOut, rIn, start, end)}
        fill={isOn ? colorsOn[i % colorsOn.length] : colorsOff[i % colorsOff.length]}
        stroke="#78350f"
        strokeWidth={1.5}
      />
    )
  }
  return (
    <svg className="fraction-art-svg" viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-hidden>
      {slices}
      <circle cx={cx} cy={cy} r={rIn - 2} fill="#fef3c7" stroke="#92400e" strokeWidth={1.2} />
    </svg>
  )
}

const VALID_KINDS = new Set([
  'pizza',
  'chocolateBar',
  'orangePie',
  'waffleGrid',
  'watermelonBar',
  'popsicle',
  'donut',
  'brownieGrid',
  'cookieGrid',
  'rubyBar'
])

/**
 * ציור לשאלת שבר — ילדים (לא תיאור מילולי של ריבועים).
 * @param {{ kind: string, total: number, filled: number }} visual
 */
export function FractionQuestionArt({ visual }) {
  const clipId = React.useId().replace(/:/g, '_')
  if (!visual || typeof visual !== 'object') {
    throw new Error('FractionQuestionArt: חסר אובייקט visual')
  }
  const { kind, total, filled } = visual
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`FractionQuestionArt: kind לא ידוע: ${kind}`)
  }
  if (typeof total !== 'number' || typeof filled !== 'number' || total < 1 || filled < 0 || filled > total) {
    throw new Error(`FractionQuestionArt: total/filled לא תקינים: ${total} / ${filled}`)
  }

  switch (kind) {
    case 'pizza':
      return (
        <ArtPie
          total={total}
          filled={filled}
          cheese="#fbbf24"
          crust="#b45309"
          accent={<circle cx={W / 2} cy={H / 2 - 6} r={3} fill="#dc2626" opacity={0.85} />}
        />
      )
    case 'orangePie':
      return <ArtPie total={total} filled={filled} cheese="#fb923c" crust="#c2410c" accent={null} />
    case 'chocolateBar':
      return <ArtBar total={total} filled={filled} base="#d6c4a8" on="#5c3d2e" stroke="#3f2e1a" rind={false} />
    case 'watermelonBar':
      return <ArtBar total={total} filled={filled} base="#fecaca" on="#f43f5e" stroke="#9f1239" rind />
    case 'rubyBar':
      return <ArtBar total={total} filled={filled} base="#fecdd3" on="#e11d48" stroke="#881337" rind={false} />
    case 'waffleGrid': {
      let rows = 2
      let cols = 4
      if (total === 4) {
        rows = 2
        cols = 2
      } else if (total === 6) {
        rows = 2
        cols = 3
      } else if (total === 8) {
        rows = 2
        cols = 4
      } else if (total === 12) {
        rows = 3
        cols = 4
      } else {
        throw new Error(`FractionQuestionArt: waffleGrid לא תומך ב-total=${total}`)
      }
      if (rows * cols !== total) {
        throw new Error(`FractionQuestionArt: waffleGrid total ${total} לא מתאים לרשת`)
      }
      return <ArtGrid rows={rows} cols={cols} filled={filled} on="#fcd34d" off="#fffbeb" stroke="#d97706" />
    }
    case 'brownieGrid': {
      const rows = 2
      const cols = 2
      if (total !== 4) throw new Error('FractionQuestionArt: brownieGrid רק ל-total=4')
      return <ArtGrid rows={rows} cols={cols} filled={filled} on="#6b4423" off="#a78b6f" stroke="#3f2e1a" />
    }
    case 'cookieGrid': {
      let rows = 3
      let cols = 4
      if (total === 6) {
        rows = 2
        cols = 3
      } else if (total === 12) {
        rows = 3
        cols = 4
      } else {
        throw new Error(`FractionQuestionArt: cookieGrid לא תומך ב-total=${total}`)
      }
      if (rows * cols !== total) {
        throw new Error(`FractionQuestionArt: cookieGrid total ${total}`)
      }
      return <ArtGrid rows={rows} cols={cols} filled={filled} on="#d97706" off="#fde68a" stroke="#b45309" />
    }
    case 'popsicle':
      return <ArtPopsicle clipId={clipId} total={total} filled={filled} />
    case 'donut':
      return <ArtDonut total={total} filled={filled} />
    default:
      throw new Error(`FractionQuestionArt: kind לא מטופל: ${kind}`)
  }
}
