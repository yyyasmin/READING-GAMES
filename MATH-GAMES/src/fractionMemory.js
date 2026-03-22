/**
 * זיכרון שברים — כל כמות (quantityKey) מופיעה לכל היותר פעם אחת בחפיסה.
 * שלבים 1–3: זוג של 2 — או עשרוני↔שבר או שבר↔ציור (ציור בלי טקסט).
 * שלב 4: שלישייה — ציור + עשרוני + שבר לאותה כמות.
 */

export const MATH_FRACTION_CATEGORY = { title: 'זיכרון שברים', emoji: '🔢' }

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * ניתן להרחיב את המכנה במכפלה שלמה כך שהמכנה יתחלק ב־10 (כלומר רק גורמים 2 ו־5).
 */
function fractionHasDenominator2And5Only(fractionStr) {
  const m = String(fractionStr).trim().match(/^(\d+)\/(\d+)$/)
  if (!m) {
    throw new Error(`fractionMemory: פורמט שבר לא תקין: ${fractionStr}`)
  }
  let d = parseInt(m[2], 10)
  if (d <= 0) {
    throw new Error(`fractionMemory: מכנה לא חיובי ב־${fractionStr}`)
  }
  while (d % 2 === 0) d /= 2
  while (d % 5 === 0) d /= 5
  return d === 1
}

function pushFractionVisualPair(deck, pairIndex, q, exp) {
  deck.push({
    id: pairIndex * 2,
    pairId: pairIndex,
    category: 'math_fractions',
    type: 'word',
    cardRole: 'fraction',
    text: q.fraction,
    explanation: exp,
    mathTopic: 'part',
    pairVariant: 'fraction_visual',
    matchSize: 2,
    quantityKey: q.quantityKey
  })
  deck.push({
    id: pairIndex * 2 + 1,
    pairId: pairIndex,
    category: 'math_fractions',
    type: 'picture',
    cardRole: 'visual',
    text: '',
    visual: q.visual,
    visualOnly: true,
    explanation: exp,
    mathTopic: 'part',
    pairVariant: 'fraction_visual',
    matchSize: 2,
    quantityKey: q.quantityKey
  })
}

function pushDecimalFractionPair(deck, pairIndex, q, exp) {
  deck.push({
    id: pairIndex * 2,
    pairId: pairIndex,
    category: 'math_fractions',
    type: 'word',
    cardRole: 'decimal',
    text: q.decimal,
    explanation: exp,
    mathTopic: 'decimal_pair',
    pairVariant: 'decimal_fraction',
    matchSize: 2,
    quantityKey: q.quantityKey
  })
  deck.push({
    id: pairIndex * 2 + 1,
    pairId: pairIndex,
    category: 'math_fractions',
    type: 'picture',
    cardRole: 'fraction',
    text: q.fraction,
    explanation: exp,
    mathTopic: 'decimal_pair',
    pairVariant: 'decimal_fraction',
    matchSize: 2,
    quantityKey: q.quantityKey
  })
}

/**
 * כל שורה = כמות אחת בלבד (אין כפילות ערך בין שורות).
 * @property {string} quantityKey מזהה ייחודי
 * @property {string} fraction טקסט שבר למסך
 * @property {string|null} decimal טקסט עשרוני (null אם אין התאמה עשרונית פשוטה)
 * @property {object|null} visual ל-FractionQuestionArt (null אם אין ציור)
 * @property {boolean} supportsTriple שלב 4 — דורש שלושה קלפים
 */
const MATH_QUANTITIES = [
  {
    quantityKey: 'half',
    minLevel: 1,
    fraction: '1/2',
    decimal: '0.5',
    visual: { kind: 'pizza', total: 2, filled: 1 },
    supportsTriple: true,
    explanation: 'חלק אחד מתוך שני חלקים שווים = חצי. 1/2 = 0.5.'
  },
  {
    quantityKey: 'quarter',
    minLevel: 1,
    fraction: '1/4',
    decimal: '0.25',
    visual: { kind: 'brownieGrid', total: 4, filled: 1 },
    supportsTriple: true,
    explanation: 'רבע = חלק אחד מתוך ארבעה. 1/4 = 0.25.'
  },
  {
    quantityKey: 'three_quarters',
    minLevel: 1,
    fraction: '3/4',
    decimal: '0.75',
    visual: { kind: 'brownieGrid', total: 4, filled: 3 },
    supportsTriple: true,
    explanation: 'שלושה מתוך ארבעה = 3/4 = 0.75.'
  },
  {
    quantityKey: 'two_fifths',
    minLevel: 1,
    fraction: '2/5',
    decimal: '0.4',
    visual: { kind: 'popsicle', total: 5, filled: 2 },
    supportsTriple: true,
    explanation: 'שניים מתוך חמישה = 2/5 = 0.4.'
  },
  {
    quantityKey: 'one_fifth',
    minLevel: 1,
    fraction: '1/5',
    decimal: '0.2',
    visual: { kind: 'chocolateBar', total: 5, filled: 1 },
    supportsTriple: true,
    explanation: 'אחד מתוך חמישה = 1/5 = 0.2.'
  },
  {
    quantityKey: 'one_tenth',
    minLevel: 1,
    fraction: '1/10',
    decimal: '0.1',
    visual: { kind: 'watermelonBar', total: 10, filled: 1 },
    supportsTriple: true,
    explanation: 'עשירית אחת: 1/10 = 0.1.'
  },
  {
    quantityKey: 'three_tenths',
    minLevel: 1,
    fraction: '3/10',
    decimal: '0.3',
    visual: { kind: 'chocolateBar', total: 10, filled: 3 },
    supportsTriple: true,
    explanation: 'שלוש עשיריות: 3/10 = 0.3.'
  },
  {
    quantityKey: 'seven_tenths',
    minLevel: 1,
    fraction: '7/10',
    decimal: '0.7',
    visual: { kind: 'chocolateBar', total: 10, filled: 7 },
    supportsTriple: true,
    explanation: 'שבע עשיריות: 7/10 = 0.7.'
  },
  {
    quantityKey: 'nine_tenths',
    minLevel: 1,
    fraction: '9/10',
    decimal: '0.9',
    visual: { kind: 'rubyBar', total: 10, filled: 9 },
    supportsTriple: true,
    explanation: 'תשע עשיריות: 9/10 = 0.9.'
  },
  {
    quantityKey: 'one_third',
    minLevel: 2,
    fraction: '1/3',
    decimal: null,
    visual: { kind: 'orangePie', total: 3, filled: 1 },
    supportsTriple: false,
    explanation: 'שליש אחד: 1/3 (אין מספר עשרוני סופי פשוט באותה שלישייה).'
  },
  {
    quantityKey: 'five_eighths',
    minLevel: 2,
    fraction: '5/8',
    decimal: '0.625',
    visual: { kind: 'waffleGrid', total: 8, filled: 5 },
    supportsTriple: true,
    explanation: 'חמישה מתוך שמונה = 5/8 = 0.625.'
  },
  {
    quantityKey: 'five_sixths',
    minLevel: 3,
    fraction: '5/6',
    decimal: null,
    visual: { kind: 'donut', total: 6, filled: 5 },
    supportsTriple: false,
    explanation: 'חמישה מתוך שישה = 5/6.'
  },
  {
    quantityKey: 'five_twelfths',
    minLevel: 3,
    fraction: '5/12',
    decimal: null,
    visual: { kind: 'cookieGrid', total: 12, filled: 5 },
    supportsTriple: false,
    explanation: 'חמישה מתוך שנים־עשר = 5/12.'
  },
  {
    quantityKey: 'three_twenty_fifths',
    minLevel: 3,
    fraction: '3/25',
    decimal: '0.12',
    visual: null,
    supportsTriple: false,
    explanation: '3/25 = 12/100 = 0.12 (הרחבה במכנה 100).'
  },
  {
    quantityKey: 'four_twenty_fifths',
    minLevel: 4,
    fraction: '4/25',
    decimal: '0.16',
    visual: null,
    supportsTriple: false,
    explanation: '4/25 = 16/100 = 0.16 (הרחבה במכנה 100).'
  }
]

/**
 * @param {number} pairCount מספר «זוגות» (בשלב 4 = מספר שלישיות)
 * @param {number} level 1–4
 * @returns {{ deck: Array<object>, matchSize: number }}
 */
export function buildFractionMemoryDeck(pairCount = 8, level = 1) {
  const lv = Math.min(4, Math.max(1, level))
  const matchSize = lv === 4 ? 3 : 2

  const deck = []

  if (matchSize === 3) {
    let pool = MATH_QUANTITIES.filter((q) => q.minLevel <= lv && q.supportsTriple === true)
    if (pool.length < pairCount) {
      throw new Error(
        `fractionMemory: בבריכה רק ${pool.length} כמויות לשלב 4 (נדרשו ${pairCount})`
      )
    }
    const chosen = shuffle(pool).slice(0, pairCount)
    chosen.forEach((q, pairIndex) => {
      const exp = q.explanation
      if (!q.visual || !q.decimal || !q.fraction) {
        throw new Error(`fractionMemory: כמות ${q.quantityKey} לא מלאה לשלב 4`)
      }
      deck.push({
        id: pairIndex * 3,
        pairId: pairIndex,
        category: 'math_fractions',
        type: 'picture',
        cardRole: 'visual',
        text: '',
        visual: q.visual,
        visualOnly: true,
        explanation: exp,
        mathTopic: 'triple',
        matchSize: 3,
        quantityKey: q.quantityKey
      })
      deck.push({
        id: pairIndex * 3 + 1,
        pairId: pairIndex,
        category: 'math_fractions',
        type: 'word',
        cardRole: 'decimal',
        text: q.decimal,
        explanation: exp,
        mathTopic: 'triple',
        matchSize: 3,
        quantityKey: q.quantityKey
      })
      deck.push({
        id: pairIndex * 3 + 2,
        pairId: pairIndex,
        category: 'math_fractions',
        type: 'word',
        cardRole: 'fraction',
        text: q.fraction,
        explanation: exp,
        mathTopic: 'triple',
        matchSize: 3,
        quantityKey: q.quantityKey
      })
    })
    return { deck, matchSize }
  }

  /* שלב 1: רק שבר ↔ ציור (ציור בלי מלל). כל כמות מופיעה פעם אחת בלבד. */
  if (lv === 1) {
    const pool = MATH_QUANTITIES.filter(
      (q) => q.minLevel <= 1 && q.visual != null && q.fraction
    )
    if (pool.length < pairCount) {
      throw new Error(
        `fractionMemory: שלב 1 — רק ${pool.length} כמויות עם ציור (נדרשו ${pairCount})`
      )
    }
    const chosen = shuffle(pool).slice(0, pairCount)
    chosen.forEach((q, i) => pushFractionVisualPair(deck, i, q, q.explanation))
    return { deck, matchSize: 2 }
  }

  /* שלב 2: רק עשרוני ↔ שבר, כשהמכנה ניתן להרחבה ל־10/100… (רק גורמי 2 ו־5). */
  if (lv === 2) {
    const pool = MATH_QUANTITIES.filter(
      (q) =>
        q.minLevel <= 2 &&
        q.decimal != null &&
        q.fraction &&
        fractionHasDenominator2And5Only(q.fraction)
    )
    if (pool.length < pairCount) {
      throw new Error(
        `fractionMemory: שלב 2 — רק ${pool.length} כמויות מתאימות לעשרוני פשוט (נדרשו ${pairCount})`
      )
    }
    const chosen = shuffle(pool).slice(0, pairCount)
    chosen.forEach((q, i) => pushDecimalFractionPair(deck, i, q, q.explanation))
    return { deck, matchSize: 2 }
  }

  /* שלב 3: חלק זוגות שבר↔ציור וחלק עשרוני↔שבר; כל quantityKey פעם אחת; לפחות זוג מכל סוג אם אפשר. */
  const poolL3 = MATH_QUANTITIES.filter((q) => q.minLevel <= 3)
  if (poolL3.length < pairCount) {
    throw new Error(
      `fractionMemory: שלב 3 — רק ${poolL3.length} כמויות (נדרשו ${pairCount})`
    )
  }
  const chosen = shuffle(poolL3).slice(0, pairCount)

  const onlyFv = chosen.filter((q) => q.visual != null && q.decimal == null)
  const onlyDf = chosen.filter((q) => q.visual == null && q.decimal != null && q.fraction)
  const both = chosen.filter((q) => q.visual != null && q.decimal != null && q.fraction)

  const missing = chosen.filter(
    (q) =>
      !onlyFv.includes(q) &&
      !onlyDf.includes(q) &&
      !both.includes(q)
  )
  if (missing.length > 0) {
    throw new Error(
      `fractionMemory: שלב 3 — כמות ללא שילוב חוקי: ${missing.map((q) => q.quantityKey).join(', ')}`
    )
  }

  const fvList = [...onlyFv]
  const dfList = [...onlyDf]
  both.forEach((q, idx) => {
    if (idx % 2 === 0) fvList.push(q)
    else dfList.push(q)
  })

  /* לפחות זוג אחד מכל סוג אם יש כמות שמתאימה לשניהם */
  if (dfList.length === 0 && both.length > 0) {
    const i = fvList.findIndex((q) => both.includes(q))
    if (i >= 0) dfList.push(fvList.splice(i, 1)[0])
  }
  if (fvList.length === 0 && both.length > 0) {
    const i = dfList.findIndex((q) => both.includes(q))
    if (i >= 0) fvList.push(dfList.splice(i, 1)[0])
  }

  let pairIndex = 0
  fvList.forEach((q) => {
    pushFractionVisualPair(deck, pairIndex, q, q.explanation)
    pairIndex += 1
  })
  dfList.forEach((q) => {
    pushDecimalFractionPair(deck, pairIndex, q, q.explanation)
    pairIndex += 1
  })

  if (pairIndex !== pairCount) {
    throw new Error(`fractionMemory: שלב 3 — ספירת זוגות לא תואמת (${pairIndex} !== ${pairCount})`)
  }

  return { deck, matchSize: 2 }
}
