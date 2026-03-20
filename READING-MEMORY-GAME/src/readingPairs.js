/**
 * זוגות מילה–תמונה לראשית לימוד קריאה.
 * כל זוג: מילה פשוטה + תמונה (אמוג'י). משחק זיכרון לשניים (או עד 3 עם אותו backend).
 */

export const READING_CATEGORY = { title: 'ראשית קריאה', emoji: '📖' }

/** Level 1: רשימת זוגות (מילה אחת + אמוג'י) – מגוון גדול, בכל משחק נבחרים אקראית 8 זוגות */
const READING_PAIRS = [
  ['אַבָּא', '👨'],
  ['אִמָּא', '👩'],
  ['בַּיִת', '🏠'],
  ['כֶּלֶב', '🐕'],
  ['חָתוּל', '🐈'],
  ['שֶׁמֶשׁ', '☀️'],
  ['יָרֵחַ', '🌙'],
  ['סֵפֶר', '📚'],
  ['עִפָּרוֹן', '✏️'],
  ['מַיִם', '💧'],
  ['לֶחֶם', '🍞'],
  ['יָד', '✋'],
  ['רֶגֶל', '🦶'],
  ['עַיִן', '👁️'],
  ['פֶּה', '👄'],
  ['אוֹזֶן', '👂'],
  ['פֶּרַח', '🌸'],
  ['עֵץ', '🌳'],
  ['דָּג', '🐟'],
  ['צִפּוֹר', '🐦'],
  ['חָלָב', '🥛'],
  ['תַּפּוּחַ', '🍎'],
  ['בָּנָנָה', '🍌'],
  ['כּוֹבַע', '🎩'],
  ['נַעַל', '👟'],
  ['מְכוֹנִית', '🚗'],
  ['אוֹפַנַּיִם', '🚲'],
  ['כַּדּוּר', '⚽'],
  ['בֻּבָּה', '🧸'],
  ['מִטָּה', '🛏️'],
  ['שֻׁלְחָן', '🪑'],
  ['דֶּלֶת', '🚪'],
  ['חַלּוֹן', '🪟'],
  ['כִּסֵּא', '🪑'],
  ['מַחְבֶּרֶת', '📓'],
  ['מַפָּה', '🗺️'],
  ['גְּלִידָה', '🍦'],
  ['עוּגָה', '🎂'],
  ['עגבניה', '🍅'],
  ['גֶּזֶר', '🥕'],
  ['חָמוּץ', '🍋'],
  ['עֲנָבִים', '🍇'],
  ['כּוֹס', '🥤'],
  ['מַקֵּל', '🦯'],
  ['סַפְסָל', '🪑'],
  ['שָׂדֶה', '🌾'],
  ['כֶּתֶר', '👑'],
  ['מַצֶּבֶת', '🏛️'],
  ['סוּס', '🐴'],
  ['פָּרָה', '🐄'],
  ['דְּבוֹרָה', '🐝'],
  ['נְמָלָה', '🐜']
]

/**
 * פירמידה: שלב 1 = מילה אחת, שלב 2 = שתי מילים, שלב 3 = שלוש, שלב 4 = משפט שלם.
 * בכל משחק נבחר סיפור אקראי, ובכל השלבים יוצגו זוגות רק מתוך אותו סיפור.
 */
const PYRAMID_STORIES = [
  {
    id: 'dana_pluto_ball',
    title: 'דָּנָה, פְּלוּטוֹ וְהַכַּדּוּר הַקּוֹפֵּץ',
    fullText: 'דָּנָה יָצְאָה לַגַּן.\nפְּלוּטוֹ הַכֶּלֶב רָץ אִתָּהּ.\nפְּלוּטוֹ רָץ.\nהוּא רָץ מַהֵר.\nהוּא רָץ מַהֵר מְאוֹד !\nלְדָּנָה הָיָה כַּדּוּר אָדוֹם.\nדָּנָה אָמְרָה: "מוּכָנִים?"\nהִיא זָרְקָה אֶת הַכַּדּוּר.\nאֲבָל…\nהַכַּדּוּר הִתְגַּלְגֵּל וְנֶעֱלַם!\nדָּנָה חִיפְּשָׂה לְיַד הָעֵץ — אֵין כַּדּוּר.\nדָּנָה חִיפְּשָׂה לְיַד הַמַּגְלֵשָׁה — אֵין כַּדּוּר.\nדָּנָה חִיפְּשָׂה מִתַּחַת לַסַּפְסָל — אֵין כַּדּוּר.\nדָּנָה שָׁאֲלָה:\n"פְּלוּטוֹ… אֵיפֹה הַכַּדּוּר?"\nפְּלוּטוֹ נָבַח — הַב־הַב — וְרָץ לְחַפֵּשׂ אֶת הַכַּדּוּר.\nפִּתְאוֹם — בּוּם!\nהַכַּדּוּר נָפַל מִלְמַעְלָה.\nהַכַּדּוּר קָפַץ עַל הַסַּפְסָל,\nהַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא,\nהַכַּדּוּר קָפַץ עַל פְּלוּטוֹ!\nפְּלוּטוֹ נִבְהַל.\nדָּנָה תָּפְסָה אֶת הַכַּדּוּר.\nפְּלוּטוֹ נָבַח הַב־הַב וְיָשַׁב.\nדָּנָה אָמְרָה: עוֹד פַּעַם! 🎈',
    items: [
      {
        level1: 'כַּדּוּר',
        level2: 'כַּדּוּר אָדוֹם',
        level3: 'לְדָּנָה יֵשׁ כַּדּוּר',
        level4: 'לְדָּנָה יֵשׁ כַּדּוּר אָדוֹם.',
        emoji: '⚽'
      },
      {
        level1: 'דָּנָה',
        level2: 'דָּנָה יָצְאָה',
        level3: 'דָּנָה יָצְאָה לַגַּן',
        level4: 'דָּנָה יָצְאָה לַגַּן.',
        emoji: '👧'
      },
      {
        level1: 'פְּלוּטוֹ',
        level2: 'פְּלוּטוֹ רָץ',
        level3: 'פְּלוּטוֹ רָץ עִם',
        level4: 'פְּלוּטוֹ רָץ עִם דָּנָה.',
        emoji: '🐕'
      },
      {
        level1: 'רָץ',
        level2: 'רָץ מַהֵר',
        level3: 'פְּלוּטוֹ רָץ מַהֵר',
        level4: 'פְּלוּטוֹ רָץ מַהֵר מְאוֹד!',
        emoji: '🏃'
      },
      {
        level1: 'נָפַל',
        level2: 'הַכַּדּוּר נָפַל',
        level3: 'הַכַּדּוּר נָפַל עַל',
        level4: 'הַכַּדּוּר נָפַל עַל פְּלוּטוֹ הַכֶּלֶב.',
        emoji: '⬇️'
      },
      {
        level1: 'קָפַץ',
        level2: 'הַכַּדּוּר קָפַץ',
        level3: 'הַכַּדּוּר קָפַץ גָּבוֹהַּ',
        level4: 'הַכַּדּוּר קָפַץ גָּבוֹהַּ מְאוֹד.',
        emoji: '🔼'
      },
      {
        level1: 'חִיפְּשָׂה',
        level2: 'דָּנָה חִיפְּשָׂה',
        level3: 'דָּנָה חִיפְּשָׂה אֶת הַכַּדּוּר',
        level4: 'דָּנָה חִיפְּשָׂה אֶת הַכַּדּוּר מִתַּחַת לַסַּפְסָל.',
        emoji: '🔎'
      },
      {
        level1: 'שָׁאֲלָה',
        level2: 'דָּנָה שָׁאֲלָה',
        level3: 'דָּנָה שָׁאֲלָה אֵיפֹה',
        level4: 'דָּנָה שָׁאֲלָה אֵיפֹה הַכַּדּוּר.',
        emoji: '❔'
      }
    ]
  },
  {
    id: 'noa_yoav_ball',
    title: 'מִי מְשַׂחֵק בַּכַּדּוּר',
    fullText: 'נוֹעָה בָּאָה לַגַּן.\nיוֹאָב כְּבָר הָיָה שָׁם.\nנוֹעָה אָמְרָה: "אֲנִי רוֹצָה לְשַׂחֵק."\nיוֹאָב אָמַר: "אֲנִי מְשַׂחֵק."\nלְיוֹאָב הָיָה כַּדּוּר.\nכַּדּוּר כָּחֹל.\nיוֹאָב הִקְפִּיץ אֶת הַכַּדּוּר.\nהַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא.\nיוֹאָב הִקְפִּיץ עוֹד פַּעַם.\nהַכַּדּוּר קָפַץ עַל הַסַּפְסָל.\nיוֹאָב הִקְפִּיץ עוֹד פַּעַם.\nהַכַּדּוּר קָפַץ לְיַד הָעֵץ.\nיוֹאָב רָץ אַחֲרֵי הַכַּדּוּר.\nהוּא חָזַר.\nיוֹאָב הִקְפִּיץ עוֹד פַּעַם.\nנוֹעָה עָמְדָה בְּשֶׁקֶט.\nהִיא חִכְּתָה.\nהִיא חִכְּתָה עוֹד.\nנוֹעָה אָמְרָה: "אֲנִי לֹא רוֹצָה לַחֲכוֹת!"\nיוֹאָב חָשַׁב, וְנוֹעָה חָשְׁבָה.\nנוֹעָה אָמְרָה: "הַכַּדּוּר… נְשַׂחֵק יַחַד?"\nיוֹאָב אָמַר: "בְּסֵדֶר."\nיוֹאָב זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\nהַכַּדּוּר עָף גָּבוֹהַּ מִדַּי וְנָפַל עַל הַכּוֹבַע שֶׁל סַבְתָּא שֶׁל יוֹאָב, שֶׁיָּשְׁבָה עַל הַסַּפְסָל בְּגַּן.\nנוֹעָה הָלְכָה לְהָבִיא אֶת הַכַּדּוּר.\nהִיא זָרְקָה לְיוֹאָב.\nהַכַּדּוּר הָיָה נָמוּךְ מִדַּי וְהִתְגַּלְגֵּל לְתוֹךְ עֲרוּגַּת פְּרָחִים.\nיוֹאָב הָלַךְ לְהָבִיא אֶת הַכַּדּוּר.\nיוֹאָב זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\nנוֹעָה זָרְקָה אֶת הַכַּדּוּר לְיוֹאָב.\nהַכַּדּוּר הָלַךְ יָמִינָה וּפָּגַע בַּכֶּלֶב שֶׁל דָּנִי, שֶׁבְּדִיּוּק הִגִּיעַ לַגַּן.\nהַכֶּלֶב תָּפַס אֶת הַכַּדּוּר וּבָרַח.\nדָּנִי רָץ אַחֲרֵי הַכֶּלֶב וְלָקַח אֶת הַכַּדּוּר.\nדָּנִי זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\nנוֹעָה תָּפְסָה.\nדָּנִי שָׁאַל: "אֶפְשָׁר לְשַׂחֵק אִתְּכֶם?"\n"כֵּן," אָמְרָה נוֹעָה.\nנוֹעָה זָרְקָה אֶת הַכַּדּוּר לְיוֹאָב.\nיוֹאָב תָּפַס אֶת הַכַּדּוּר.',
    items: [
      {
        level1: 'יַלְדָּה',
        level2: 'נוֹעָה הַיַּלְדָּה',
        level3: 'נוֹעָה הַיַּלְדָּה בָּאָה',
        level4: 'נוֹעָה הַיַּלְדָּה בָּאָה לַגַּן.',
        emoji: '👧'
      },
      {
        level1: 'יֶלֶד',
        level2: 'יוֹאָב הַיֶּלֶד',
        level3: 'יוֹאָב הַיֶּלֶד הָיָה',
        level4: 'יוֹאָב הַיֶּלֶד הָיָה שָׁם.',
        emoji: '👦'
      },
      {
        level1: 'כַּדּוּר',
        level2: 'הַכַּדּוּר קָפַץ',
        level3: 'הַכַּדּוּר קָפַץ עַל',
        level4: 'הַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא.',
        emoji: '⚽'
      },
      {
        level1: 'עֵץ',
        level2: 'לְיַד הָעֵץ',
        level3: 'קָפַץ לְיַד הָעֵץ',
        level4: 'הַכַּדּוּר קָפַץ לְיַד הָעֵץ.',
        emoji: '🌳'
      },
      {
        level1: 'כּוֹבַע',
        level2: 'עַל הַכּוֹבַע',
        level3: 'נָפַל עַל הַכּוֹבַע',
        level4: 'הַכַּדּוּר נָפַל עַל הַכּוֹבַע.',
        emoji: '🎩'
      },
      {
        level1: 'כֶּלֶב',
        level2: 'הַכֶּלֶב תָּפַס',
        level3: 'הַכֶּלֶב תָּפַס אֶת',
        level4: 'הַכֶּלֶב תָּפַס אֶת הַכַּדּוּר.',
        emoji: '🐕'
      },
      {
        level1: 'סַפְסָל',
        level2: 'עַל הַסַּפְסָל',
        level3: 'קָפַץ עַל הַסַּפְסָל',
        level4: 'הַכַּדּוּר קָפַץ עַל הַסַּפְסָל.',
        emoji: '🪑'
      }
    ]
  },
  {
    id: 'tower',
    title: 'מִגְדַּל קֻבִּיּוֹת',
    fullText: 'דני ואלה בנו מגדל בקוביות.\nהמגדל היה גבוה מאוד.\nדני שם קוביה אדומה.\nאלה שמה קוביה כחולה.\nדני אמר:\n"אני רוצה לשים כאן עוד קוביה!"\nאלה אמרה:\n"לא! אני שם כאן!"\nהמגדל רעד.\nקוביה נפלה על הרצפה.\nדני חיבק את הקוביה.\nאלה חיבקה את הקוביה שלה.\n\nדני הסתכל על המגדל.\nאלה הסתכלה גם.\nדני אמר:\n"אני בונה פה, את בונה שם."\nאלה חייכה.\nהם שמו קוביות בצד שלהם.\nהמגדל גדל קצת, לא גבוה כמו קודם,\nאבל עדיין יציב.\nקוביה של דני נפלה.\nקוביה של אלה נפלה.\nשניהם צחקו.\nדני שם קוביה חדשה.\nאלה הוסיפה קוביה חדשה.\nהמגדל לא היה גבוה כמו שהם רצו,\nאבל הם שמחו שעדיין עומד.',
    items: [
      {
        level1: 'דָּנִי',
        level2: 'דָּנִי ואלה',
        level3: 'דָּנִי ואלה בָּנוּ',
        level4: 'דני ואלה בנו מגדל.',
        emoji: '👦'
      },
      {
        level1: 'יַלְדָּה',
        level2: 'אָלָה הַיַּלְדָּה',
        level3: 'אָלָה הַיַּלְדָּה שָׂמָה',
        level4: 'אלה הילדה שמה קובייה.',
        emoji: '👧'
      },
      {
        level1: 'מִגְדָּל',
        level2: 'הַמִּגְדָּל הָיָה',
        level3: 'הַמִּגְדָּל הָיָה גָּבוֹהַּ',
        level4: 'הַמִּגְדָּל הָיָה גָּבוֹהַּ מְאֹד.',
        emoji: '🗼'
      },
      {
        level1: 'אֲדוּמָה',
        level2: 'קוּבִּיָּה אֲדוּמָה',
        level3: 'קוּבִּיָּה אֲדוּמָה בַּמִּגְדָּל',
        level4: 'דָּנִי שָׂם קוּבִּיָּה אֲדוּמָה בַּמִּגְדָּל.',
        emoji: '🟥'
      },
      {
        level1: 'כְּחוּלָה',
        level2: 'קוּבִּיָּה כְּחוּלָה',
        level3: 'קוּבִּיָּה כְּחוּלָה בַּמִּגְדָּל',
        level4: 'אָלָה שָׂמָה קוּבִּיָּה כְּחוּלָה בַּמִּגְדָּל.',
        emoji: '🟦'
      },
      {
        level1: 'רָעַד',
        level2: 'הַמִּגְדָּל רָעַד',
        level3: 'הַמִּגְדָּל רָעַד מְאוֹד',
        level4: 'הַמִּגְדָּל רָעַד מְאוֹד.',
        emoji: '🌪️'
      },
      {
        level1: 'עוֹמֵד',
        level2: 'הַמִּגְדָּל עוֹמֵד',
        level3: 'הַמִּגְדָּל עוֹמֵד עַל',
        level4: 'המגדל עומד על הריצפה.',
        emoji: '✅'
      }
    ]
  }
]

const PYRAMID_ITEMS = PYRAMID_STORIES[0]?.items || []

export function getRandomPyramidStoryId() {
  if (!PYRAMID_STORIES || PYRAMID_STORIES.length === 0) return null
  const ix = Math.floor(Math.random() * PYRAMID_STORIES.length)
  return PYRAMID_STORIES[ix]?.id ?? null
}

/** נגזר מהפירמידה: שלב 1 = מילה אחת */
const READING_PAIRS_FROM_PYRAMID = PYRAMID_ITEMS.map(({ level1, emoji }) => [level1, emoji])

/**
 * שלב 1 עם סיפור: בוחר אקראית פריטים מהפירמידה, בונה חפיסה (מילה אחת) ומשפטי level4 כסיפור קצר.
 * @returns {{ deck: Array, story: { title: string, text: string } }}
 */
export function buildLevel1DeckWithStory(pairCount) {
  return buildPyramidDeckWithStory(pairCount, 1)
}

/**
 * בונה חפיסה + סיפור לכל שלב (1–4): בוחר אקראית פריטים מהפירמידה, טקסט לפי level (מילה/שתיים/שלוש/משפט), סיפור ממשפטי level4.
 * בכל שלב אפשר להציג את אותו הסיפור.
 * @param {number} pairCount 4–12
 * @param {number} level 1, 2, 3 או 4
 * @returns {{ deck: Array, story: { title: string, text: string } }}
 */
export function buildPyramidDeckWithStory(pairCount, level = 1, storyId = null, pairIndices = null) {
  const story = (storyId && PYRAMID_STORIES.find((s) => s.id === storyId)) || PYRAMID_STORIES[0]
  const items = story?.items || PYRAMID_ITEMS
  const maxPairs = items.length
  pairCount = Math.max(4, Math.min(12, Math.min(pairCount, maxPairs)))
  const lev = Math.max(1, Math.min(4, Number(level) || 1))

  const indexed = items.map((p, idx) => ({ ...p, _i: idx }))

  let chosen = null
  let chosenPairIndices = null

  if (Array.isArray(pairIndices) && pairIndices.length > 0) {
    chosenPairIndices = [...pairIndices]
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b)

    if (chosenPairIndices.length !== pairCount) {
      throw new Error(`Invalid pairIndices length. Expected ${pairCount} but got ${chosenPairIndices.length}`)
    }
    chosen = chosenPairIndices.map((i) => {
      const p = indexed[i]
      if (!p) throw new Error(`Invalid pairIndices value: ${i}`)
      return p
    })
  } else {
    chosenPairIndices = (pairCount === maxPairs)
      ? indexed.map((p) => p._i)
      : shuffleArray(indexed).slice(0, pairCount).sort((a, b) => a._i - b._i).map((p) => p._i)

    chosen = chosenPairIndices.map((i) => indexed[i])
  }

  const deck = []
  chosen.forEach((p, i) => {
    const text = p[`level${lev}`] || p.level1
    deck.push({ id: i * 2, pairId: i, category: 'reading', type: 'word', text })
    deck.push({ id: i * 2 + 1, pairId: i, category: 'reading', type: 'picture', text, emoji: p.emoji })
  })

  const storyText = story?.fullText || chosen
    .map((p) => (p.level4 || '').replace(/([.!?])\s+/g, '$1\n'))
    .join('\n')
  return {
    deck,
    story: {
      title: story?.title || '',
      storyId: story?.id || null,
      text: storyText,
      items: chosen.map((p) => ({
        level1: p.level1,
        level2: p.level2,
        level3: p.level3,
        level4: p.level4,
        emoji: p.emoji
      })),
      pairIndices: chosenPairIndices
    }
  }
}

/** נגזר מהפירמידה: שלב 2 = שתי מילים */
const READING_PAIRS_LEVEL2 = PYRAMID_ITEMS.map(({ level2, emoji }) => [level2, emoji])

/** נגזר מהפירמידה: שלב 3 = שלוש מילים */
const READING_PAIRS_LEVEL3 = PYRAMID_ITEMS.map(({ level3, emoji }) => [level3, emoji])

/** נגזר מהפירמידה: שלב 4 = משפט שלם */
const READING_PAIRS_LEVEL4 = PYRAMID_ITEMS.map(({ level4, emoji }) => [level4, emoji])

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** מערבב את סדר הקלפים בחפיסה (כדי שהלקוח והשרת ישתמשו באותו סדר – השרת לא מערבב חפיסה מותאמת) */
export function shuffleDeck(deck) {
  if (!Array.isArray(deck) || deck.length === 0) return deck
  return shuffleArray(deck)
}

/**
 * בונה חפיסה: זוגות מילה–תמונה. level 1 = מילה אחת, 2 = שתי מילים, 3 = שלוש מילים, 4 = משפט.
 * @param {number} pairCount מספר הזוגות (4–12)
 * @param {number} level 1, 2, 3 או 4
 */
export function buildReadingDeck(pairCount, level = 1) {
  pairCount = Math.max(4, Math.min(12, pairCount))
  const source = level === 2 ? READING_PAIRS_LEVEL2 : level === 3 ? READING_PAIRS_LEVEL3 : level === 4 ? READING_PAIRS_LEVEL4 : READING_PAIRS_FROM_PYRAMID
  const allPairs = source.map(([word, emoji]) => ({
    category: 'reading',
    word,
    emoji
  }))
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

/** סיפורים קצרים עם משמעות – בכל משחק נבחר אקראית סיפור אחד ו־8 זוגות ממנו; אחרי המשחק מוצג הסיפור */
export const READER_STORIES = [
  {
    id: 'lost_ball',
    title: 'דָּנָה, פְּלוּטוֹ וְהַכַּדּוּר הַקּוֹפֵּץ',
    text: 'דָּנָה יָצְאָה לַגַּן.\nפְּלוּטוֹ הַכֶּלֶב רָץ אִתָּהּ.\nלְדָּנָה הָיָה כַּדּוּר. כַּדּוּר אָדוֹם. כַּדּוּר קוֹפֵּץ מְאוֹד!\nדָּנָה אָמְרָה: "מֻכָּנִים?" הִיא זָרְקָה אֶת הַכַּדּוּר. הַכַּדּוּר קָפַץ! קָפַץ גָּבוֹהַּ. קָפַץ רָחוֹק! פְּלוּטוֹ רָץ. רָץ מְהֵרָה. רָץ מְאוֹד מְהֵרָה!\nאֲבָל… הַכַּדּוּר קָפַץ עוֹד פַּעַם — וְנֶעֱלַם. פְּלוּטוֹ עָצַר. דָּנָה עָצְרָה.\nדָּנָה שָׁאֲלָה: "פְּלוּטוֹ… אֵיפֹה הַכַּדּוּר?" פְּלוּטוֹ הִבִּיט יָמִינָה, הִבִּיט שְׂמֹאלָה וְהִבִּיט לְמַעְלָה. אֵין כַּדּוּר.\nדָּנָה חִפְּשָׂה לְיַד הַסַּפְסָל. אֵין כַּדּוּר.\nדָּנָה חִפְּשָׂה לְיַד הָעֵץ. אֵין כַּדּוּר.\nדָּנָה חִפְּשָׂה לְיַד הַמַּגְלֵשָׁה. אֵין כַּדּוּר.\nפִּתְאוֹם—בּוּם! הַכַּדּוּר נָפַל מִלְמַעְלָה!\nפְּלוּטוֹ קָפַץ! דָּנָה קִפְּצָה. הַכַּדּוּר קָפַץ שׁוּב: קָפַץ עַל הַסַּפְסָל, קָפַץ עַל הַדֶּשֶׁא וְקָפַץ עַל פְּלוּטוֹ!\nפְּלוּטוֹ נִבְהָל. דָּנָה צָחֲקָה.\nדָּנָה תָּפְסָה אֶת הַכַּדּוּר. הַכַּדּוּר פָּסַק לִקְפּוֹץ.\nדָּנָה אָמְרָה: "עוֹד פַּעַם!" פְּלוּטוֹ רָץ — וְהַכַּדּוּר קָפַץ שׁוּב 😄.',
    pairs: [
      ['דָּנָה', '👧'],
      ['פְּלוּטוֹ', '🐕'],
      ['כַּדּוּר', '⚽'],
      ['מֻכָּנִים', '❓'],
      ['נֶעֱלַם', '👻'],
      ['מַגְלֵשָׁה', '🛝'],
      ['נִבְהָל', '😮'],
      ['תָּפְסָה', '🧤']
    ]
  }
]

/** בוחר סיפור אקראי, שולף ממנו pairCount זוגות באקראי, מחזיר את החפיסה והסיפור (להצגה אחרי המשחק) */
export function buildDeckFromRandomStory(pairCount) {
  pairCount = Math.max(4, Math.min(12, pairCount))
  if (READER_STORIES.length === 0) return { deck: null, story: null }
  const story = READER_STORIES[Math.floor(Math.random() * READER_STORIES.length)]
  const allPairs = story.pairs.map(([word, emoji]) => ({ category: 'reading', word, emoji }))
  const chosen = shuffleArray(allPairs).slice(0, Math.min(pairCount, allPairs.length))
  const deck = []
  chosen.forEach((p, i) => {
    deck.push({ id: i * 2, pairId: i, category: p.category, type: 'word', text: p.word })
    deck.push({ id: i * 2 + 1, pairId: i, category: p.category, type: 'picture', text: p.word, emoji: p.emoji })
  })
  return { deck, story }
}
