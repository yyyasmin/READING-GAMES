/** סבבים למשחק «מלחמה» – טילים = מחשבות לא מועילות במצב מתח; מיירטים = כיפת ברזל / חץ + מחשבה חלופית (CBT) */

export const STORY_TITLE = 'מלחמה'
export const TAGLINE =
  'סימולציית יירוט: על גוף הטיל מחשבה לא מועילה; על המשגר – מחשבה חלופית (כיפת ברזל או חץ). בחר התאמה כדי ליירט.'

/** @typedef {'iron_dome' | 'arrow'} InterceptorSystem */

export const INTERCEPTOR_LABEL = {
  iron_dome: 'כיפת ברזל',
  arrow: 'חץ'
}

/** זמן לסבב (מילישניות) – אם לא נבחרה תשובה בזמן: המיירט נכשל ומאבדים נקודה */
export const ROUND_TIME_MS = 30000

/** נרמול טקסט (רווחים, trim) */
export function normalizeThought(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * מיירט עצמי חייב להיות ניסוח משל השחקן – לא העתקה של הטיל ולא של אחד הניסוחים על המשגרים במסך.
 * @param {string} typedNormalized - אחרי normalizeThought
 * @param {string} hostileNormalized
 * @param {string[]} choiceThoughtsNormalized - כל אחד אחרי normalizeThought
 */
export function isOwnInterceptorWording(typedNormalized, hostileNormalized, choiceThoughtsNormalized) {
  if (!typedNormalized) return false
  if (typedNormalized === hostileNormalized) return false
  for (let i = 0; i < choiceThoughtsNormalized.length; i++) {
    if (typedNormalized === choiceThoughtsNormalized[i]) return false
  }
  return true
}

export const ROUNDS = [
  {
    id: 'catastrophize',
    missileColor: '#b91c1c',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'בכל רגע מתחילות הכל נורא – אני בטוח שיקרה בדיוק הכי גרוע שאפשר לדמיין.',
    balancedThought:
      'זו נבואה עצמית. אני לא יודע את העתיד – אפשר להתמקד במה שבשליטתי עכשיו: בטיחות, נשימה, מעקב אחרי הוראות רשמיות.'
  },
  {
    id: 'news_spiral',
    missileColor: '#c2410c',
    interceptorSystem: 'arrow',
    hostileThought:
      'חייבים לקרוא כל עדכון כל שנייה – אם לא אני «מפספס» משהו קריטי ואז אני אחטוף.',
    balancedThought:
      'אפשר לקבוע זמן קצוב לחדשות; רפרוף אינסופי לא מגן עליי פיזית ומחמיר חרדה. מספיק מקורות אמינים בפרקי זמן קבועים.'
  },
  {
    id: 'fear_shame',
    missileColor: '#1d4ed8',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'אם אני מפחד אז אני פחדן – משהו לא תקין אצלי לעומת כולם.',
    balancedThought:
      'פחד במצב מאיים הוא תגובה טבעית; זה לא מגדיר את ערכי ולא אומר שאני חלש יותר מאחרים.'
  },
  {
    id: 'mind_read_calm',
    missileColor: '#6b21a8',
    interceptorSystem: 'arrow',
    hostileThought:
      'כולם בטח רגועים חוץ ממני – אני היחיד שמשתגע כאן.',
    balancedThought:
      'אני לא קורא מחשבות. גם לאנשים אחרים יש קושי; לא תמיד רואים את זה בחוץ.'
  },
  {
    id: 'helpless',
    missileColor: '#334155',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'אין מה לעשות – המצב בשליטת כוחות ענק ואני אפס שלא משפיע על כלום.',
    balancedThought:
      'יש דברים שאינם בשליטתי, אבל אני יכול לבחור שגרה, לדבר עם מבוגר אמין, לבקש תמיכה ולשמור על עצמי בדרכים קונקרטיות.'
  },
  {
    id: 'forever',
    missileColor: '#0f766e',
    interceptorSystem: 'arrow',
    hostileThought:
      'זה לא ייגמר לעולם – אני לא אוכל לישון או לחיות נורמלי שבועות.',
    balancedThought:
      'מצבי לחץ חמורים הם לרוב זמניים בהיסטוריה האישית והציבורית. אם אי־שינה או מצוקה נמשכים – כדאי לפנות לעזרה מקצועית או למבוגר אמין.'
  }
]
