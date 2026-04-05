/** סבבים למשחק «מלחמה» – טילים = מחשבות לא מועילות במצב מתח; מיירטים = כיפת ברזל / חץ + מחשבה חלופית (CBT)
 * גיבוי JSON (לסנכרון עם הקוד): backend/data/cbt_war_rounds.json · CBT/public/data/cbt_war_rounds.json
 */

export const STORY_TITLE = 'מלחמה'
export const TAGLINE =
  'בחרו סיטואציה, הקפיאו, כוונו ושגרו — המטרה: לפגוע בטיל האויב עם המשפט הנכון.'

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
    situationText:
      'אני שוכבת במיטה אחרי עוד יום של התראות והורדות אפליקציה; הראש לא מפסיק לרוץ לתמונות הכי קשות — כאילו אני כבר יודעת בדיוק מה יקרה רע מחר.',
    missileColor: '#b91c1c',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'אחרי כל ההתראות והאפליקציות הראש כבר «יודע» בדיוק איך מחר יתהפך לכי גרוע — כאילו זו לא דמיון, זו חיזוי.',
    balancedThought:
      'זו נבואה עצמית. אני לא יודעת את העתיד – אפשר להתמקד במה שבשליטתי עכשיו: בטיחות, נשימה, מעקב אחרי הוראות רשמיות.'
  },
  {
    id: 'news_spiral',
    situationText:
      'אני מרעננת שוב ושוב את אותו עמוד חדשות בטלפון — כל דקה נדמה שאם אעצור לרגע אפספס משהו חשוב ואז אחרים יידעו לפניי.',
    missileColor: '#c2410c',
    interceptorSystem: 'arrow',
    hostileThought:
      'חייבים לקרוא כל עדכון כל שנייה – אם לא אני «מפספס» משהו קריטי ואז אני אחטוף.',
    balancedThought:
      'אפשר לקבוע זמן קצוב לחדשות; רפרוף אינסופי לא מגן עליי פיזית ומחמיר חרדה. מספיק מקורות אמינים בפרקי זמן קבועים.'
  },
  {
    id: 'fear_shame',
    situationText:
      'בבית הספר, אחרי תרגיל אזעקה או כשיש מתח בחוץ — הלב רץ לי ואני מתביישת: נדמה לי שכולם רגועים ורק אני «מוגזמת».',
    missileColor: '#1d4ed8',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'אחרי אזעקה או מתח בחוץ, אם הלב רץ לי ככה בזמן שבכיתה נראה «רגוע» — אני בטוחה שמשהו לא תקין אצלי לעומת כולם.',
    balancedThought:
      'פחד במצב מאיים הוא תגובה טבעית; זה לא מגדיר את ערכי ולא אומר שאני חלש יותר מאחרים.'
  },
  {
    id: 'mind_read_calm',
    situationText:
      'בקבוצת ווטסאפ של הכיתה כולם שולחים סטיקרים וצוחקים, ואני מרגישה שקפואה בפנים — כאילו רק אני לא בסדר.',
    missileColor: '#6b21a8',
    interceptorSystem: 'arrow',
    hostileThought:
      'בקבוצת הכיתה כולם שולחים סטיקרים וצוחקים, ואני קפואה — אז אני היחידה פה שלא בסדר וכולם שמים לב.',
    balancedThought:
      'אני לא קורא מחשבות. גם לאנשים אחרים יש קושי; לא תמיד רואים את זה בחוץ.'
  },
  {
    id: 'helpless',
    situationText:
      'אני גוללת בלילה סרטונים וכותרות על מה שקורה בעולם ומרגישה קטנה לגמרי — כאילו אין לי שום דרך להשפיע או להגן על עצמי.',
    missileColor: '#334155',
    interceptorSystem: 'iron_dome',
    hostileThought:
      'אין מה לעשות – המצב בשליטת כוחות ענק ואני אפס שלא משפיע על כלום.',
    balancedThought:
      'יש דברים שאינם בשליטתי, אבל אני יכולה לבחור שגרה, לדבר עם מבוגר אמין, לבקש תמיכה ולשמור על עצמי בדרכים קונקרטיות.'
  },
  {
    id: 'forever',
    situationText:
      'זו כבר הלילה השלישי שאני כמעט לא נרדמת בגלל המתח, ובבוקר נדמה לי שזה לעולם לא יחלוף ושלא אוכל לחזור לשגרה.',
    missileColor: '#0f766e',
    interceptorSystem: 'arrow',
    hostileThought:
      'שלושה לילות בלי שינה בגלל המתח — זה לא ייעצר, לא אחזור לשגרה ולא אזכור איך זה להרגיש נורמלי.',
    balancedThought:
      'מצבי לחץ חמורים הם לרוב זמניים בהיסטוריה האישית והציבורית. אם אי־שינה או מצוקה נמשכים – כדאי לפנות לעזרה מקצועית או למבוגר אמין.'
  }
]
