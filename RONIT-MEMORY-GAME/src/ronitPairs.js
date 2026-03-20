/**
 * זוגות מילה–תמונה לפי סדרת הכרטיסיות של רונית חכם:
 * זזה, סיסי, רולה-רול, זזה לא זזה, סיסע וזזה רבות.
 * כל זוג: מילה + תמונה (כאן מיוצגת באמוג'י כ-placeholder).
 */

export const RONIT_CATEGORIES = {
  zeze: { title: 'זזה', emoji: '🏃' },
  sisi: { title: 'סיסי', emoji: '🪑' },
  rolaRoll: { title: 'רולה-רול', emoji: '🔄' },
  zezeLoZeze: { title: 'זזה לא זזה', emoji: '⏸️' },
  sisaVeZeze: { title: 'סיסע וזזה רבות', emoji: '🎯' }
}

/** רשימת זוגות (מילה, אמוג'י/תמונה) לפי קטגוריה – התאמת מילה לתמונה */
const PAIRS_BY_CATEGORY = {
  zeze: [
    ['ריצה', '🏃'],
    ['קפיצה', '🦘'],
    ['הליכה', '🚶'],
    ['זחילה', '🐌'],
    ['גלגול', '🔄'],
    ['ריקוד', '💃'],
    ['נדנדה', '🪀'],
    ['טיפוס', '🧗'],
    ['ריצה במקום', '🦵'],
    ['קפיצות', '⬆️'],
    ['הליכת 4', '🐻'],
    ['דילוג', '🦘']
  ],
  sisi: [
    ['כיסא', '🪑'],
    ['ישיבה', '🧘'],
    ['שולחן', '🪵'],
    ['רגליים על הרצפה', '🦶'],
    ['גב ישר', '📐'],
    ['ידיים על השולחן', '✋'],
    ['הקשבה', '👂'],
    ['המתנה', '⏳'],
    ['נשימה', '💨'],
    ['ריכוז', '🎯'],
    ['שקט', '🤫'],
    ['הכנה', '📋']
  ],
  rolaRoll: [
    ['גלגול צד', '🔄'],
    ['גלגול קדימה', '⏩'],
    ['גלגול אחורה', '⏪'],
    ['סיבוב', '🔄'],
    ['גל', '🌊'],
    ['גלגל', '⭕'],
    ['מגלגל', '🎲'],
    ['מגולגל', '📜'],
    ['גלילה', '📜'],
    ['גלגלת', '⚙️'],
    ['רולר', '🛼'],
    ['רולדה', '🥐']
  ],
  zezeLoZeze: [
    ['עצור', '🛑'],
    ['הקפא', '❄️'],
    ['עמדה', '🧍'],
    ['אל תזוז', '⏸️'],
    ['שמור מקום', '📍'],
    ['המתן', '⏳'],
    ['קיפאון', '🪨'],
    ['שקט תנועה', '🤐'],
    ['חכה', '✋'],
    ['תפסיק', '🛑'],
    ['מקום', '📍'],
    ['עמידה', '🧍']
  ],
  sisaVeZeze: [
    ['סיסמה', '🔑'],
    ['סימן', '✋'],
    ['זז עכשיו', '🏃'],
    ['עצור עכשיו', '🛑'],
    ['התחל', '▶️'],
    ['סיים', '🏁'],
    ['קדימה', '👉'],
    ['אחורה', '👈'],
    ['מהר', '⚡'],
    ['לאט', '🐢'],
    ['קפוץ', '⬆️'],
    ['שב', '🪑']
  ]
}

const CATEGORY_IDS = Object.keys(PAIRS_BY_CATEGORY)

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * בונה חפיסה: זוגות מילה–תמונה. כל זוג = שני קלפים (מילה + תמונה).
 * @param {number} pairCount מספר הזוגות (4–12)
 * @returns {Array<{id: number, pairId: number, category: string, type: 'word'|'picture', text: string, emoji?: string}>}
 */
export function buildRonitDeck(pairCount) {
  pairCount = Math.max(4, Math.min(12, pairCount))
  const allPairs = []
  CATEGORY_IDS.forEach((catId) => {
    PAIRS_BY_CATEGORY[catId].forEach(([word, emoji]) => {
      allPairs.push({ category: catId, word, emoji })
    })
  })
  const chosen = shuffleArray(allPairs).slice(0, pairCount)
  const deck = []
  chosen.forEach((p, i) => {
    deck.push({
      id: i * 2,
      pairId: i,
      category: p.category,
      type: 'word',
      text: p.word
    })
    deck.push({
      id: i * 2 + 1,
      pairId: i,
      category: p.category,
      type: 'picture',
      text: p.word,
      emoji: p.emoji
    })
  })
  return deck
}
