import { SUITS } from './constants.js'

/** סיטואציות בסיס (תוכן CBT) — כל אחת נפרסת ל־4 קלפי התקפה (לפי צבע) + 4 הגנה */
const SCENARIOS = [
  {
    id: 'corner',
    situation: 'בעיטת קרן — כולן מסתכלות עליך בשער.',
    hostile: 'אם אפספס את הכדור כולם יזכרו רק את זה.',
    balanced: 'טעות אפשרית; אפשר ללמוד מהמצב ולהמשיך.'
  },
  {
    id: 'mid',
    situation: 'במרכז המגרש, פתוחה למסירה; יריבה סוגרת עליך.',
    hostile: 'אם אפספס את המסירה כולם יחשבו שאני לא ברמה.',
    balanced: 'טעות היא חלק מהמשחק; מה שחשוב זה הניסיון הבא.'
  },
  {
    id: 'def',
    situation: 'מגן מול התקפה מהירה אחד־על־אחד.',
    hostile: 'אם היא עוברת אותי כולם יראו שאני הכי חלשה בקו.',
    balanced: 'אני מתמקדת במה שבשליטתי עכשיו — רגליים, מרחק, עזרה.'
  },
  {
    id: 'pen',
    situation: 'פנדלים — כל העיניים עליך בבעיטה.',
    hostile: 'אם אפספס, אני מאכזבת את כולן.',
    balanced: 'זו בעיטה אחת מתוך משחק שלם; אפשר לבצע כמו בתרגול.'
  },
  {
    id: 'gk',
    situation: 'פנדל נגדך; את השוערת.',
    hostile: 'אם לא אעצור, כולם יאמרו שהפסד זה בגללי.',
    balanced: 'גם שוערות מצילות וגם מפספסות — זה חלק מהתפקיד.'
  },
  {
    id: 'fwd',
    situation: 'חלוצה לפני השער — מקום לבעיטה.',
    hostile: 'אם לא אכבוש עכשיו, הוכחתי שאני לא יכולה כשזה חשוב.',
    balanced: 'הזדמנות אחת; בלי לשפוט את כל הערך שלי כשחקנית.'
  }
]

const SPECIAL_TEMPLATES = [
  { id: 's1', cbt: 'רגש', title: 'כעס', diceMod: -2, task: 'קומי וספרי עד 5 בקול רם כמו שופטת כועסת.', effect: null },
  { id: 's2', cbt: 'רגש', title: 'שמחה', diceMod: 2, task: 'רקדו כולם במקום 10 שניות כמו אחרי גול.', effect: null },
  { id: 's3', cbt: 'רגש', title: 'חרדה', diceMod: 0, task: 'בתור ההתקפה הבא שלך: שתי זריקות קוביה לתוקף — לוקחים את הנמוך (אמונה מתנדנדת).', effect: 'anxiety' },
  { id: 's4', cbt: 'גוף', title: 'דופק מהיר', diceMod: -1, task: 'יד על הלב 5 שניות ואומרים «אני כאן».', effect: null },
  { id: 's5', cbt: 'גוף', title: 'נשימה עמוקה', diceMod: 1, task: 'נשימה 4–7: שאיפה 4, עצירה 7, שחרור איטי.', effect: null },
  { id: 's6', cbt: 'משאב', title: 'ביטחון עצמי', diceMod: 2, task: 'משפט «אני יכול/ה את זה» בקול רם.', effect: null },
  { id: 's7', cbt: 'התנהגות', title: 'הימנעות', diceMod: -1, task: 'אומרים משהו קטן שתכננת לעשות היום — ועושים תנועה קטנה.', effect: null },
  { id: 's8', cbt: 'התנהגות', title: 'ניסוי התנהגותי', diceMod: 3, task: 'מנסים פעולה קטנה שלא הרגלת — ומחייכים.', effect: null },
  { id: 's9', cbt: 'רגש', title: 'בושה', diceMod: -1, task: 'מחווה מצחיקה של «זה בסדר» עם שתי ידיים.', effect: null },
  { id: 's10', cbt: 'עיוות', title: 'Overthinking', diceMod: 0, task: 'אומרים בקול «סטופ» פעמיים — מסיימים תור בלי תזוזה אם בוחרים.', effect: 'skip_move' },
  { id: 's11', cbt: 'גוף', title: 'רעד', diceMod: -2, task: 'רועדים 3 שניות ואז «נועלים» רגליים לרצפה.', effect: null },
  { id: 's12', cbt: 'משאב', title: 'ויסות', diceMod: 0, task: 'מבטלים קלף שלילי מהיד הבאה (הסרו קלף התקפה אחד לערימה אם יש).', effect: 'cancel_negative' },
  { id: 's13', cbt: 'שובב', title: 'Inner critic', diceMod: -1, task: 'היריב אומר בקול מחשבה «שלילית» מומצאת בשבילך — צוחקים יחד.', effect: null },
  { id: 's14', cbt: 'שובב', title: 'Fake confidence', diceMod: 3, task: 'התהדרות מוגזמת 10 שניות; אם נכשלת בקלף הבא — -3 לקוביה (בית).', effect: 'fake_conf' }
]

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/** כל קלפי התקפה/הגנה לפי סדר קבוע — הערבוב נעשה פעם אחת ב־buildPlayDeck יחד עם הג'וקרים */
export function buildMainDeck() {
  const cards = []
  for (const sc of SCENARIOS) {
    for (const suit of SUITS) {
      cards.push({
        id: uid('atk'),
        kind: 'attack',
        suit,
        scenarioId: sc.id,
        title: sc.situation,
        text: sc.hostile,
        sub: 'התקפה — מחשבה לא מועילה'
      })
      cards.push({
        id: uid('def'),
        kind: 'defense',
        suit,
        scenarioId: sc.id,
        title: sc.situation,
        text: sc.balanced,
        sub: 'הגנה — מחשבה חלופית מועילה'
      })
    }
  }
  return cards
}

export function buildSpecialDeck() {
  const cards = SPECIAL_TEMPLATES.map((t) => ({
    id: uid('sp'),
    kind: 'special',
    suit: null,
    ...t,
    text: `${t.title} (${t.cbt}) — ${t.task}`,
    sub: 'קלף מיוחד CBT'
  }))
  return shuffle(cards)
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** ג'וקרים — השחקן ממלא מחשבה בעצמו ובוחר צבע מסגרת (חייב להתאים להגנה לבונוס −2) */
export function buildJokerCards() {
  const jokers = []
  for (let i = 0; i < 2; i++) {
    jokers.push({
      id: uid('jk-atk'),
      kind: 'attack',
      joker: true,
      suit: null,
      effectiveSuit: null,
      title: 'ג\'וקר — מחשבה תוקפת שלי',
      text: '',
      sub: 'התקפה — כתבו מחשבה בקול ובשדה; אחר כך בחרו צבע מסגרת.'
    })
  }
  for (let i = 0; i < 2; i++) {
    jokers.push({
      id: uid('jk-def'),
      kind: 'defense',
      joker: true,
      suit: null,
      effectiveSuit: null,
      title: 'ג\'וקר — מחשבה חלופית שלי',
      text: '',
      sub: 'הגנה — מחשבה מועילה משלכם; צבע המסגרת חייב להתאים לקלף ההתקפה לבונוס.'
    })
  }
  return jokers
}

/**
 * קופת משחק: התקפה/הגנה + ג'וקרים בלבד (נחלקים לידיים ונמשכים מהקופה הזו).
 * קלפים מיוחדים — רק ב־buildSpecialDeck(), ערימה נפרדת, לא בידיים.
 */
export function buildPlayDeck() {
  const main = buildMainDeck()
  const jokers = buildJokerCards()
  return shuffle([...main, ...jokers])
}
