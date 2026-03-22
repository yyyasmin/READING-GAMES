/**
 * צלילי קרב – Web Audio API (ללא קבצי שמע חיצוניים).
 * דורש מחוות משתמש קודמת (למשל «התחלת משחק») כדי ש־AudioContext יופעל.
 */

let ctxRef = null

/** קריאה מ-startGame כדי לאפשר השמעה אחרי לחיצת משתמש */
export function resumeBattleAudio() {
  getCtx()
}

function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctxRef || ctxRef.state === 'closed') ctxRef = new AC()
  if (ctxRef.state === 'suspended') {
    ctxRef.resume().catch(() => {})
  }
  return ctxRef
}

function noiseBuffer(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    d[i] = Math.random() * 2 - 1
  }
  return buf
}

/** מיירט עולה – לפני פגיעה */
export function playInterceptorWhoosh() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 0.35)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(400, t0)
  filter.frequency.exponentialRampToValueAtTime(2800, t0 + 0.22)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.22, t0 + 0.04)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28)
  noise.connect(filter)
  filter.connect(g)
  g.connect(ctx.destination)
  noise.start(t0)
  noise.stop(t0 + 0.3)
}

/** יירוט מוצלח – פיצוץ «נקי» + דינג */
export function playExplosionSuccess() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime

  const nSrc = ctx.createBufferSource()
  nSrc.buffer = noiseBuffer(ctx, 0.45)
  const bp = ctx.createBiquadFilter()
  bp.type = 'lowpass'
  bp.frequency.setValueAtTime(3200, t0)
  bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.25)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.45, t0)
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32)
  nSrc.connect(bp)
  bp.connect(ng)
  ng.connect(ctx.destination)
  nSrc.start(t0)
  nSrc.stop(t0 + 0.35)

  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, t0)
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.14)
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.35, t0)
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
  osc.connect(og)
  og.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.22)

  const hi = ctx.createOscillator()
  hi.type = 'sine'
  hi.frequency.setValueAtTime(1320, t0 + 0.02)
  const hg = ctx.createGain()
  hg.gain.setValueAtTime(0, t0 + 0.02)
  hg.gain.linearRampToValueAtTime(0.12, t0 + 0.05)
  hg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12)
  hi.connect(hg)
  hg.connect(ctx.destination)
  hi.start(t0 + 0.02)
  hi.stop(t0 + 0.14)
}

/** כישלון / טיימאאוט – פיצוץ כבד יותר */
export function playExplosionFail() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime

  const nSrc = ctx.createBufferSource()
  nSrc.buffer = noiseBuffer(ctx, 0.7)
  const bp = ctx.createBiquadFilter()
  bp.type = 'lowpass'
  bp.frequency.setValueAtTime(1800, t0)
  bp.frequency.exponentialRampToValueAtTime(120, t0 + 0.55)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.65, t0)
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.58)
  nSrc.connect(bp)
  bp.connect(ng)
  ng.connect(ctx.destination)
  nSrc.start(t0)
  nSrc.stop(t0 + 0.62)

  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(95, t0)
  osc.frequency.exponentialRampToValueAtTime(28, t0 + 0.45)
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.28, t0)
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5)
  osc.connect(og)
  og.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.52)
}

/** סיבוב נפילה קצר לפני הפיצוץ */
export function playFallTension() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(380, t0)
  osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.08, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.4)
}
