export const SUITS = ['red', 'yellow', 'blue', 'green']

export const SUIT_LABELS = {
  red: 'אדום',
  yellow: 'צהוב',
  blue: 'כחול',
  green: 'ירוק'
}

export const GOAL_LINE = 7
export const HAND_SIZE = 8

/** משבצות עם קלף מיוחד CBT */
export const SPECIAL_CELLS = [2, 4, 5]

/** סוג מסלול התקדמות לכל שחקן שדה (חיילים) — 4 אפשרויות */
export const PATH_STYLES = ['fast', 'safe', 'balanced', 'bold']

export const PATH_LABELS = {
  fast: { title: 'מהיר', hint: '+1 צעד קדימה כשנטו חיובי' },
  safe: { title: 'בטוח', hint: 'פחות דחיפה אחורה באחד כשהמגן דוחף' },
  balanced: { title: 'מאוזן', hint: 'ללא שינוי' },
  bold: { title: 'נועז', hint: '+2 קדימה; אם נדחפים אחורה — עוד צעד' }
}
