/**
 * צלילי קרב – Web Audio API (ללא קבצי שמע חיצוניים).
 * דורש מחוות משתמש קודמת (למשל «התחלת משחק») כדי ש־AudioContext יופעל.
 */

let ctxRef = null

/** חייב להתאים ל־--cbt-enemy-flight-duration ב־index.css (מחזור אנימציית טיל האויב). */
export const ENEMY_APPROACH_CYCLE_SEC = 28

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

/** מנוע / להב בשיגור (מיד בלחיצת «שגר») */
export function playLaunchIgnition() {
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime
  const crackle = ctx.createBufferSource()
  crackle.buffer = noiseBuffer(ctx, 0.12)
  const bp = ctx.createBiquadFilter()
  bp.type = 'highpass'
  bp.frequency.setValueAtTime(400, t0)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(0.32, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14)
  crackle.connect(bp)
  bp.connect(g)
  g.connect(ctx.destination)
  crackle.start(t0)
  crackle.stop(t0 + 0.16)

  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(95, t0)
  osc.frequency.exponentialRampToValueAtTime(220, t0 + 0.08)
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.12, t0)
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12)
  osc.connect(og)
  og.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + 0.14)
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

/**
 * רשרש טיל מתקרב – נשמע מוקדם (מרחוק) לפני שהטיל בולט על המסך; חוזר כל מחזור אנימציה.
 * מחזיר { stop } לכיבוי ודעיכה קצרה.
 */
export function startEnemyMissileApproachAmbient() {
  const ctx = getCtx()
  if (!ctx) {
    return { stop: () => {} }
  }

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.35)
  master.connect(ctx.destination)

  let stopped = false
  let nextTimerId = null

  const scheduleNext = () => {
    if (stopped) return
    nextTimerId = window.setTimeout(runCycle, ENEMY_APPROACH_CYCLE_SEC * 1000)
  }

  function runCycle() {
    if (stopped) return
    nextTimerId = null

    const t0 = ctx.currentTime
    const D = ENEMY_APPROACH_CYCLE_SEC
    const tEnd = t0 + D

    const hiss = ctx.createBufferSource()
    hiss.buffer = noiseBuffer(ctx, 1.8)
    hiss.loop = true
    const hissBp = ctx.createBiquadFilter()
    hissBp.type = 'bandpass'
    hissBp.Q.value = 0.85
    hissBp.frequency.setValueAtTime(220, t0)
    hissBp.frequency.exponentialRampToValueAtTime(480, t0 + D * 0.35)
    hissBp.frequency.exponentialRampToValueAtTime(1400, t0 + D * 0.72)
    hissBp.frequency.exponentialRampToValueAtTime(2400, t0 + D * 0.92)
    const hissG = ctx.createGain()
    hissG.gain.setValueAtTime(0, t0)
    hissG.gain.linearRampToValueAtTime(0.09, t0 + 1.2)
    hissG.gain.linearRampToValueAtTime(0.14, t0 + 6)
    hissG.gain.linearRampToValueAtTime(0.22, t0 + 14)
    hissG.gain.linearRampToValueAtTime(0.28, t0 + 22)
    hissG.gain.linearRampToValueAtTime(0.26, t0 + D * 0.93)
    hissG.gain.exponentialRampToValueAtTime(0.001, tEnd - 0.05)
    hiss.connect(hissBp)
    hissBp.connect(hissG)
    hissG.connect(master)
    hiss.start(t0)
    hiss.stop(tEnd)

    const rumble = ctx.createOscillator()
    rumble.type = 'sawtooth'
    rumble.frequency.setValueAtTime(38, t0)
    rumble.frequency.exponentialRampToValueAtTime(72, t0 + D * 0.4)
    rumble.frequency.exponentialRampToValueAtTime(118, t0 + D * 0.78)
    const rumbleLp = ctx.createBiquadFilter()
    rumbleLp.type = 'lowpass'
    rumbleLp.frequency.setValueAtTime(160, t0)
    rumbleLp.frequency.exponentialRampToValueAtTime(420, t0 + D * 0.65)
    const rumbleG = ctx.createGain()
    rumbleG.gain.setValueAtTime(0, t0)
    rumbleG.gain.linearRampToValueAtTime(0.05, t0 + 0.9)
    rumbleG.gain.linearRampToValueAtTime(0.09, t0 + 8)
    rumbleG.gain.linearRampToValueAtTime(0.14, t0 + 20)
    rumbleG.gain.exponentialRampToValueAtTime(0.001, tEnd - 0.08)
    rumble.connect(rumbleLp)
    rumbleLp.connect(rumbleG)
    rumbleG.connect(master)
    rumble.start(t0)
    rumble.stop(tEnd)

    const wind = ctx.createBufferSource()
    wind.buffer = noiseBuffer(ctx, 2.2)
    wind.loop = true
    const windLp = ctx.createBiquadFilter()
    windLp.type = 'lowpass'
    windLp.frequency.setValueAtTime(320, t0)
    windLp.frequency.exponentialRampToValueAtTime(2200, t0 + D * 0.88)
    const windG = ctx.createGain()
    windG.gain.setValueAtTime(0, t0)
    windG.gain.linearRampToValueAtTime(0.035, t0 + 2)
    windG.gain.linearRampToValueAtTime(0.07, t0 + 12)
    windG.gain.exponentialRampToValueAtTime(0.001, tEnd - 0.06)
    wind.connect(windLp)
    windLp.connect(windG)
    windG.connect(master)
    wind.start(t0)
    wind.stop(tEnd)

    scheduleNext()
  }

  runCycle()

  return {
    stop: () => {
      stopped = true
      if (nextTimerId != null) {
        window.clearTimeout(nextTimerId)
        nextTimerId = null
      }
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    }
  }
}
