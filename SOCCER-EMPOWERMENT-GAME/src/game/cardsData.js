import { SUITS } from './constants.js'

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
  { id: 's1', cbt: 'רגש', title: 'כעס', diceMod: -2, task: 'קומי וספרי עד 5 בקול רם כמו שופטת כועסת.' },
  { id: 's2', cbt: 'רגש', title: 'שמחה', diceMod: 2, task: 'רקדו במקום 10 שניות כמו אחרי גול.' },
  { id: 's3', cbt: 'רגש', title: 'חרדה', diceMod: 0, task: 'זורקים פעמיים קוביה — לוקחים את הנמוך לתור הבא (בדמיון).' },
  { id: 's4', cbt: 'גוף', title: 'דופק מהיר', diceMod: -1, task: 'יד על הלב ואומרים «אני מרגישה את הדופק וזה בסדר».' },
  { id: 's5', cbt: 'גוף', title: 'נשימה עמוקה', diceMod: 1, task: 'נשימה עמוקה אחת עם שקיעת בטן.' },
  { id: 's6', cbt: 'התנהגות', title: 'הימנעות', diceMod: -1, task: 'אומרים משפט אחד על משהו שכדאי לעשות ולא להימנע.' },
  { id: 's7', cbt: 'התנהגות', title: 'ניסוי התנהגותי', diceMod: 3, task: 'מציגים מחווה קטנה שלא הרגלתם — גם אם מצחיק.' },
  { id: 's8', cbt: 'משאב', title: 'ביטחון עצמי', diceMod: 2, task: 'משפט אחד: «יש לי משהו לתת כאן».' },
  { id: 's9', cbt: 'משאב', title: 'ויסות', diceMod: 0, task: 'מבטלים קלף שלילי בדמיון — מנופפים ביד.' },
  { id: 's10', cbt: 'רגש', title: 'מבוכה', diceMod: -1, task: 'מחייכים בכוונה למשך 5 שניות.' },
  { id: 's11', cbt: 'עיוות', title: 'הכללה', diceMod: -2, task: 'אומרים: «זה לא תמיד או לעולם לא».' },
  { id: 's12', cbt: 'עיוות', title: 'קריאת מחשבות', diceMod: 0, task: 'היריב אומר בקול מחשבה «מנחשת» — אחת לצחוק.' },
  { id: 's13', cbt: 'שובב', title: 'Overthinking Loop', diceMod: -2, task: 'אותה מחשבה פעמיים בקול — ואז «נועלים» עם אצבע.' },
  { id: 's14', cbt: 'שובב', title: 'Fake Confidence', diceMod: 3, task: '+3 לדמיון; אם התור נכשל — חוזרים צעד אחורה בדמיון.' },
  { id: 's15', cbt: 'שובב', title: 'Inner Critic', diceMod: -1, task: 'חייבים לקרוא בקול מחשבה שלילית ואז לחייך אחריה.' },
  { id: 's16', cbt: 'משאב', title: 'עייפות', diceMod: -2, task: 'עיניים עצומות 5 שניות — «טעינה».' },
  { id: 's17', cbt: 'גוף', title: 'מתח בכתפיים', diceMod: -1, task: 'הרימו כתפיים 3 פעמים ואמרו «משחררים».' },
  { id: 's18', cbt: 'רגש', title: 'גאווה', diceMod: 1, task: 'מצדיעים לעצמכם בצורה דרמטית.' }
]

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

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
  return shuffle(cards)
}

export function buildSpecialDeck() {
  const cards = SPECIAL_TEMPLATES.map((t) => ({
    id: uid('sp'),
    kind: 'special',
    suit: null,
    ...t,
    text: `${t.title} (${t.cbt}) — משימה שובבה`,
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

export function buildFullDeck() {
  return shuffle([...buildMainDeck(), ...buildSpecialDeck()])
}
