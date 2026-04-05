import { GOAL_LINE, SPECIAL_CELLS } from './constants.js'

/** מזהה צעד לאורך המגרש (0 … GOAL_LINE) */
export const STEPS = GOAL_LINE + 1

/** מספר מסלולים (עמודות) — קווים וצמתים */
export const NUM_LANES = 6

/** אינדקס צעד אמצעי (לוגי) */
export const MID_STEP = Math.floor(GOAL_LINE / 2)

/** מסלול אנכי אמצעי — שוערים באמצע הגובה אחרי סיבוב המגרש */
export const MID_LANE = Math.max(0, Math.floor((NUM_LANES - 1) / 2))

/**
 * מגרש מסובב 90°: ציר הצעדים (הארוך) אופקי, מימין לשמאל (צעד 0 בצד ימין).
 * ציר המסלולים אנכי (מעט יותר קצר).
 */
const PAD_ALONG_STEPS = 11
const PAD_ALONG_LANES = 14

export const LANE_NODE_POS = (() => {
  const out = []
  const n = NUM_LANES
  for (let lane = 0; lane < n; lane++) {
    const row = []
    const y = n <= 1 ? 50 : PAD_ALONG_LANES + (lane / (n - 1)) * (100 - 2 * PAD_ALONG_LANES)
    for (let step = 0; step < STEPS; step++) {
      const xAlong =
        STEPS <= 1 ? 50 : PAD_ALONG_STEPS + (step / (STEPS - 1)) * (100 - 2 * PAD_ALONG_STEPS)
      const x = 100 - xAlong
      const special = SPECIAL_CELLS.includes(step)
      row.push({ x, y, step, lane, special })
    }
    out.push(row)
  }
  return out
})()

/**
 * עמדות פתיחה — פיזור רחב על שני הצירים (פינות חצי מגרש), בלי צפיפות באותו טור.
 * פנימי בלבד: מסלולים 1…NUM_LANES-2, צעדים 1…GOAL_LINE-1.
 */
export const DEFAULT_OPENING_PIECES = {
  0: {
    o0: { lane: 1, step: 9 },
    o1: { lane: 4, step: 9 },
    o2: { lane: 1, step: 6 },
    o3: { lane: 4, step: 5 }
  },
  1: {
    o0: { lane: 4, step: 1 },
    o1: { lane: 1, step: 1 },
    o2: { lane: 4, step: 4 },
    o3: { lane: 1, step: 3 }
  }
}

/**
 * העלה מספר בכל שינוי עמדות פתיחה — הדפדפן יטען משחק חדש אוטומטית (sessionStorage).
 */
export const OPENING_LAYOUT_VERSION = 9

/** תוויות למשבצות מיוחדות (לפי אינדקס צעד) */
export const SPECIAL_STEP_LABELS = {
  3: '😡 לחץ / כעס',
  6: '😄 שמחה / חיזוק',
  8: '😨 חרדה — בקלף: נמוך משני גלגולים (תוקף הבא)'
}

/** טקסט עזר: התקדמות על המגרש המשובץ */
export const ROLE_PATH_HINTS = {
  o0: ['לאורך הקווים — עד מספר הצעדים מהקוביה', 'קדימה לשער: צעד + מסלול או רק צעד', 'אחורה: דחיפה לאורך הקווים'],
  o1: ['בחירת צומת יעד מבין המותרים על הרשת', 'אפשר לשנות מסלול בזמן תנועה (קווים מחברים)'],
  o2: ['לא חייבים להישאר באותו «שורת מסלול» — רק על עיגולים מחוברים'],
  o3: ['אחרי זריקה: לוחצים על עיגול חוקי על המגרש או על הכפתור המתאים']
}

export function getNodeLayout(lane, step) {
  return LANE_NODE_POS[lane]?.[step] || { x: 50, y: 50, step, lane, special: false }
}
