/** צבעי התאמה בין קלף «מחשבה לא מועילה» ל־«חלופית מועילה» */
export const SUITS = ['red', 'yellow', 'blue', 'green']

export const SUIT_LABELS = {
  red: 'אדום',
  yellow: 'צהוב',
  blue: 'כחול',
  green: 'ירוק'
}

/** מספר משבצות עד שער היריב (לא כולל שער) — שורות 0 … GOAL_LINE */
export const GOAL_LINE = 10

/** משבצות עם הטיית קלף מיוחד (אינדקסי צעד על המסלול) */
export const SPECIAL_CELLS = [3, 6, 8]

/** קלפים בפתיחת יד — שאר החפיסה בקופה (מומלץ: לא לחלק את כל החפיסה) */
export const HAND_SIZE = 8
