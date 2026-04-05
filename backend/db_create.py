# Create or recreate DB tables. Run from backend: python db_create.py
# Uses config.py DATABASE_URL. Use --init for create only, --seed-tasks to seed.

from pathlib import Path
from urllib.parse import urlparse
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import json

load_dotenv(Path(__file__).resolve().parent / ".env")

from config import DEFAULT_DATABASE_URI
from app import app, db
from models import (
    Player, Room, RoomPlayer, ConnectionLog, Task,
    PyramidStory, PyramidStoryItem,
    CbtScenario, CbtUserEntry
)

_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
print("[db_create] SQLALCHEMY_DATABASE_URI =", _uri)


def ensure_database_exists(uri):
    parsed = urlparse(uri)
    db_name = parsed.path.lstrip("/") or parsed.path
    if not db_name:
        return
    base = uri.rsplit("/", 1)[0]
    postgres_uri = base + "/postgres"
    try:
        conn = psycopg2.connect(postgres_uri)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{db_name}"')
            print(f"[db_create] Created database: {db_name}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[db_create] Could not ensure database exists: {e}")
        raise


def db_drop_everything(app, db):
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    ensure_database_exists(uri)
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("Tables dropped and recreated.")


def db_init_only(app, db):
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    ensure_database_exists(uri)
    with app.app_context():
        db.create_all()
        print("Tables ensured (create_all).")


def seed_tasks(app, db):
    with app.app_context():
        if Task.query.first():
            print("[db_create] Tasks already exist, skipping seed.")
            return
        math = [
            ("12 × 8 = ?", "96", None, None), ("144 ÷ 12 = ?", "12", None, None),
            ("0.5 + 0.25 = ?", "0.75", None, None), ("מהו 20% מ-80?", "16", None, None),
            ("7 × 6 + 3 = ?", "45", None, None),
            ("1/2 + 1/4 = ? (שבר)", "3/4", None, '["0.75"]'),
            ("15 × 4 = ?", "60", None, None), ("100 − 37 = ?", "63", None, None),
            ("מהו 10% מ-250?", "25", None, None), ("3 × 3 × 3 = ?", "27", None, None),
        ]
        for i, (q, a, opts, alt) in enumerate(math):
            db.session.add(Task(
                age_group="grade_5_6", subject="math", question=q, answer=a,
                options_json=opts, alt_answers_json=alt, sort_order=i
            ))
        eng = [
            ("Complete: I ___ to school every day.", "go", '["go","goes","going","went"]', None),
            ("Opposite of \"hot\":", "cold", '["warm","cold","cool","freeze"]', None),
            ("Past tense of \"run\":", "ran", '["runned","ran","running","runs"]', None),
            ("She ___ a book now. (read)", "is reading", '["read","reads","is reading","reading"]', None),
            ("There ___ many students in the class.", "are", '["is","are","be","am"]', None),
            ("Meaning of \"beautiful\":", "יפה", '["מכוער","יפה","גדול","קטן"]', None),
            ("Plural of \"child\":", "children", '["childs","children","childes","childrens"]', None),
            ("Yesterday I ___ pizza. (eat)", "ate", '["eat","eats","ate","eaten"]', None),
            ("He ___ football every Sunday.", "plays", '["play","plays","playing","is play"]', None),
            ("Opposite of \"begin\":", "end", '["start","end","finish","both B and C"]', None),
        ]
        for i, (q, a, opts, alt) in enumerate(eng):
            db.session.add(Task(
                age_group="grade_5_6", subject="english", question=q, answer=a,
                options_json=opts, alt_answers_json=alt, sort_order=i
            ))
        reading = [
            ("התאמת האות א", "א", None, None),
            ("התאמת האות ב", "ב", None, None),
        ]
        for i, (q, a, opts, alt) in enumerate(reading):
            db.session.add(Task(
                age_group="grade_1", subject="reading", question=q, answer=a,
                options_json=opts, alt_answers_json=alt, sort_order=i
            ))
        db.session.commit()
        print("[db_create] Seeded tasks for grade_1 (reading), grade_5_6 (math, english).")


def seed_pyramid_stories(app, db):
    stories = [
        {
            "story_key": "dana_pluto_ball",
            "subject": "reading",
            "category": "story",
            "sort_order": 1,
            "title": "דָּנָה, פְּלוּטוֹ וְהַכַּדּוּר הַקּוֹפֵּץ",
            "full_text": (
                "דָּנָה יָצְאָה לַגַּן.\n"
                "פְּלוּטוֹ הַכֶּלֶב רָץ אִתָּהּ.\n"
                "פְּלוּטוֹ רָץ.\n"
                "הוּא רָץ מַהֵר.\n"
                "הוּא רָץ מַהֵר מְאוֹד !\n"
                "לְדָּנָה הָיָה כַּדּוּר אָדוֹם.\n"
                "דָּנָה אָמְרָה: \"מוּכָנִים?\"\n"
                "הִיא זָרְקָה אֶת הַכַּדּוּר.\n"
                "אֲבָל…\n"
                "הַכַּדּוּר הִתְגַּלְגֵּל וְנֶעֱלַם!\n"
                "דָּנָה חִיפְּשָׂה לְיַד הָעֵץ — אֵין כַּדּוּר.\n"
                "דָּנָה חִיפְּשָׂה לְיַד הַמַּגְלֵשָׁה — אֵין כַּדּוּר.\n"
                "דָּנָה חִיפְּשָׂה מִתַּחַת לַסַּפְסָל — אֵין כַּדּוּר.\n"
                "דָּנָה שָׁאֲלָה:\n"
                "\"פְּלוּטוֹ… אֵיפֹה הַכַּדּוּר?\"\n"
                "פְּלוּטוֹ נָבַח — הַב־הַב — וְרָץ לְחַפֵּשׂ אֶת הַכַּדּוּר.\n"
                "פִּתְאוֹם — בּוּם!\n"
                "הַכַּדּוּר נָפַל מִלְמַעְלָה.\n"
                "הַכַּדּוּר קָפַץ עַל הַסַּפְסָל,\n"
                "הַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא,\n"
                "הַכַּדּוּר קָפַץ עַל פְּלוּטוֹ!\n"
                "פְּלוּטוֹ נִבְהַל.\n"
                "דָּנָה תָּפְסָה אֶת הַכַּדּוּר.\n"
                "פְּלוּטוֹ נָבַח הַב־הַב וְיָשַׁב.\n"
                "דָּנָה אָמְרָה: עוֹד פַּעַם! 🎈"
            ),
            "items": [
                {"item_category": "כַּדּוּר", "lines": ["כַּדּוּר", "כַּדּוּר אָדוֹם", "לְדָּנָה יֵשׁ כַּדּוּר", "לְדָּנָה יֵשׁ כַּדּוּר אָדוֹם."], "emoji": "⚽"},
                {"item_category": "דָּנָה", "lines": ["דָּנָה", "דָּנָה יָצְאָה", "דָּנָה יָצְאָה לַגַּן", "דָּנָה יָצְאָה לַגַּן."], "emoji": "👧"},
                {"item_category": "פְּלוּטוֹ", "lines": ["פְּלוּטוֹ", "פְּלוּטוֹ רָץ", "פְּלוּטוֹ רָץ עִם", "פְּלוּטוֹ רָץ עִם דָּנָה."], "emoji": "🐕"},
                {"item_category": "רָץ", "lines": ["רָץ", "רָץ מַהֵר", "פְּלוּטוֹ רָץ מַהֵר", "פְּלוּטוֹ רָץ מַהֵר מְאוֹד!"], "emoji": "🏃"},
                {"item_category": "נָפַל", "lines": ["נָפַל", "הַכַּדּוּר נָפַל", "הַכַּדּוּר נָפַל עַל", "הַכַּדּוּר נָפַל עַל פְּלוּטוֹ הַכֶּלֶב."], "emoji": "⬇️"},
                {"item_category": "קָפַץ", "lines": ["קָפַץ", "הַכַּדּוּר קָפַץ", "הַכַּדּוּר קָפַץ גָּבוֹהַּ", "הַכַּדּוּר קָפַץ גָּבוֹהַּ מְאוֹד."], "emoji": "🔼"},
                {"item_category": "חִיפְּשָׂה", "lines": ["חִיפְּשָׂה", "דָּנָה חִיפְּשָׂה", "דָּנָה חִיפְּשָׂה אֶת הַכַּדּוּר", "דָּנָה חִיפְּשָׂה אֶת הַכַּדּוּר מִתַּחַת לַסַּפְסָל."], "emoji": "🔎"},
                {"item_category": "שָׁאֲלָה", "lines": ["שָׁאֲלָה", "דָּנָה שָׁאֲלָה", "דָּנָה שָׁאֲלָה אֵיפֹה", "דָּנָה שָׁאֲלָה אֵיפֹה הַכַּדּוּר."], "emoji": "❔"}
            ]
        },
        {
            "story_key": "noa_yoav_ball",
            "subject": "reading",
            "category": "story",
            "sort_order": 2,
            "title": "מִי מְשַׂחֵק בַּכַּדּוּר",
            "full_text": (
                "נוֹעָה בָּאָה לַגַּן.\n"
                "יוֹאָב כְּבָר הָיָה שָׁם.\n"
                "נוֹעָה אָמְרָה: \"אֲנִי רוֹצָה לְשַׂחֵק.\"\n"
                "יוֹאָב אָמַר: \"אֲנִי מְשַׂחֵק.\"\n"
                "לְיוֹאָב הָיָה כַּדּוּר.\n"
                "כַּדּוּר כָּחֹל.\n"
                "יוֹאָב הִקְפִּיץ אֶת הַכַּדּוּר.\n"
                "הַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא.\n"
                "יוֹאָב הִקְפִּיץ עוֹד פַּעַם.\n"
                "הַכַּדּוּר קָפַץ עַל הַסַּפְסָל.\n"
                "יוֹאָב הִקְפִּיץ עוֹד פַּעַם.\n"
                "הַכַּדּוּר קָפַץ לְיַד הָעֵץ.\n"
                "יוֹאָב רָץ אַחֲרֵי הַכַּדּוּר.\n"
                "הוּא חָזַר.\n"
                "יוֹאָב הִקְפִּיץ עוֹד פַּעַם.\n"
                "נוֹעָה עָמְדָה בְּשֶׁקֶט.\n"
                "הִיא חִכְּתָה.\n"
                "הִיא חִכְּתָה עוֹד.\n"
                "נוֹעָה אָמְרָה: \"אֲנִי לֹא רוֹצָה לַחֲכוֹת!\"\n"
                "יוֹאָב חָשַׁב, וְנוֹעָה חָשְׁבָה.\n"
                "נוֹעָה אָמְרָה: \"הַכַּדּוּר… נְשַׂחֵק יַחַד?\"\n"
                "יוֹאָב אָמַר: \"בְּסֵדֶר.\"\n"
                "יוֹאָב זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\n"
                "הַכַּדּוּר עָף גָּבוֹהַּ מִדַּי וְנָפַל עַל הַכּוֹבַע שֶׁל סַבְתָּא שֶׁל יוֹאָב, שֶׁיָּשְׁבָה עַל הַסַּפְסָל בְּגַּן.\n"
                "נוֹעָה הָלְכָה לְהָבִיא אֶת הַכַּדּוּר.\n"
                "הִיא זָרְקָה לְיוֹאָב.\n"
                "הַכַּדּוּר הָיָה נָמוּךְ מִדַּי וְהִתְגַּלְגֵּל לְתוֹךְ עֲרוּגַּת פְּרָחִים.\n"
                "יוֹאָב הָלַךְ לְהָבִיא אֶת הַכַּדּוּר.\n"
                "יוֹאָב זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\n"
                "נוֹעָה זָרְקָה אֶת הַכַּדּוּר לְיוֹאָב.\n"
                "הַכַּדּוּר הָלַךְ יָמִינָה וּפָּגַע בַּכֶּלֶב שֶׁל דָּנִי, שֶׁבְּדִיּוּק הִגִּיעַ לַגַּן.\n"
                "הַכֶּלֶב תָּפַס אֶת הַכַּדּוּר וּבָרַח.\n"
                "דָּנִי רָץ אַחֲרֵי הַכֶּלֶב וְלָקַח אֶת הַכַּדּוּר.\n"
                "דָּנִי זָרַק אֶת הַכַּדּוּר לְנוֹעָה.\n"
                "נוֹעָה תָּפְסָה.\n"
                "דָּנִי שָׁאַל: \"אֶפְשָׁר לְשַׂחֵק אִתְּכֶם?\"\n"
                "\"כֵּן,\" אָמְרָה נוֹעָה.\n"
                "נוֹעָה זָרְקָה אֶת הַכַּדּוּר לְיוֹאָב.\n"
                "יוֹאָב תָּפַס אֶת הַכַּדּוּר."
            ),
            "items": [
                {"item_category": "יַלְדָּה", "lines": ["יַלְדָּה", "נוֹעָה הַיַּלְדָּה", "נוֹעָה הַיַּלְדָּה בָּאָה", "נוֹעָה הַיַּלְדָּה בָּאָה לַגַּן."], "emoji": "👧"},
                {"item_category": "יֶלֶד", "lines": ["יֶלֶד", "יוֹאָב הַיֶּלֶד", "יוֹאָב הַיֶּלֶד הָיָה", "יוֹאָב הַיֶּלֶד הָיָה שָׁם."], "emoji": "👦"},
                {"item_category": "כַּדּוּר", "lines": ["כַּדּוּר", "הַכַּדּוּר קָפַץ", "הַכַּדּוּר קָפַץ עַל", "הַכַּדּוּר קָפַץ עַל הַדֶּשֶׁא."], "emoji": "⚽"},
                {"item_category": "עֵץ", "lines": ["עֵץ", "לְיַד הָעֵץ", "קָפַץ לְיַד הָעֵץ", "הַכַּדּוּר קָפַץ לְיַד הָעֵץ."], "emoji": "🌳"},
                {"item_category": "כּוֹבַע", "lines": ["כּוֹבַע", "עַל הַכּוֹבַע", "נָפַל עַל הַכּוֹבַע", "הַכַּדּוּר נָפַל עַל הַכּוֹבַע."], "emoji": "🎩"},
                {"item_category": "כֶּלֶב", "lines": ["כֶּלֶב", "הַכֶּלֶב תָּפַס", "הַכֶּלֶב תָּפַס אֶת", "הַכֶּלֶב תָּפַס אֶת הַכַּדּוּר."], "emoji": "🐕"},
                {"item_category": "סַפְסָל", "lines": ["סַפְסָל", "עַל הַסַּפְסָל", "קָפַץ עַל הַסַּפְסָל", "הַכַּדּוּר קָפַץ עַל הַסַּפְסָל."], "emoji": "🪑"}
            ]
        },
        {
            "story_key": "tower",
            "subject": "reading",
            "category": "story",
            "sort_order": 3,
            "title": "מִגְדַּל קֻבִּיּוֹת",
            "full_text": (
                "דני ואלה בנו מגדל בקוביות.\n"
                "המגדל היה גבוה מאוד.\n"
                "דני שם קוביה אדומה.\n"
                "אלה שמה קוביה כחולה.\n"
                "דני אמר:\n"
                "\"אני רוצה לשים כאן עוד קוביה!\"\n"
                "אלה אמרה:\n"
                "\"לא! אני שם כאן!\"\n"
                "המגדל רעד.\n"
                "קוביה נפלה על הרצפה.\n"
                "דני חיבק את הקוביה.\n"
                "אלה חיבקה את הקוביה שלה.\n\n"
                "דני הסתכל על המגדל.\n"
                "אלה הסתכלה גם.\n"
                "דני אמר:\n"
                "\"אני בונה פה, את בונה שם.\"\n"
                "אלה חייכה.\n"
                "הם שמו קוביות בצד שלהם.\n"
                "המגדל גדל קצת, לא גבוה כמו קודם,\n"
                "אבל עדיין יציב.\n"
                "קוביה של דני נפלה.\n"
                "קוביה של אלה נפלה.\n"
                "שניהם צחקו.\n"
                "דני שם קוביה חדשה.\n"
                "אלה הוסיפה קוביה חדשה.\n"
                "המגדל לא היה גבוה כמו שהם רצו,\n"
                "אבל הם שמחו שעדיין עומד."
            ),
            "items": [
                {"item_category": "דָּנִי", "lines": ["דָּנִי", "דָּנִי ואלה", "דָּנִי ואלה  בָּנוּ", "דני ואלה בנו מגדל", "דני ואלה בנו מגדל בקוביות."], "emoji": "👦"},
                {"item_category": "יַלְדָּה", "lines": ["יַלְדָּה", "אָלָה הַיַּלְדָּה", "אָלָה הַיַּלְדָּה שָׂמָה", "אלה הילדה שמה קובייה", "אלה הילדה שמה קובייה אדומה."], "emoji": "👧"},
                {"item_category": "מִגְדָּל", "lines": ["מִגְדָּל", "הַמִּגְדָּל הָיָה", "הַמִּגְדָּל הָיָה גָּבוֹהַּ", "הַמִּגְדָּל הָיָה גָּבוֹהַּ מְאוֹד."], "emoji": "🗼"},
                {"item_category": "עוֹמֵד", "lines": ["עוֹמֵד", "הַמִּגְדָּל עוֹמֵד", "הַמִּגְדָּל עוֹמֵד על", "המגדל עומד על הריצפה"], "emoji": "✅"},
                {"item_category": "עוֹמֵד", "lines": ["עוֹמֵד", "הַמִּגְדָּל עוֹמֵד", "הַמִּגְדָּל עוֹמֵד יציב."], "emoji": "✅"}
            ]
        }
    ]

    with app.app_context():
        # Root-cause fix: create_all() doesn't alter existing tables.
        # Rebuild only pyramid tables so new schema is guaranteed.
        PyramidStoryItem.__table__.drop(db.engine, checkfirst=True)
        PyramidStory.__table__.drop(db.engine, checkfirst=True)
        PyramidStory.__table__.create(db.engine, checkfirst=True)
        PyramidStoryItem.__table__.create(db.engine, checkfirst=True)

        PyramidStoryItem.query.delete()
        PyramidStory.query.delete()

        for story in stories:
            story_row = PyramidStory(
                story_key=story["story_key"],
                subject=story["subject"],
                category=story["category"],
                sort_order=story["sort_order"],
                title=story["title"],
                full_text=story["full_text"]
            )
            db.session.add(story_row)
            db.session.flush()

            for idx, item in enumerate(story["items"]):
                lines = item["lines"]
                db.session.add(PyramidStoryItem(
                    story_id=story_row.id,
                    pair_index=idx,
                    item_category=item["item_category"],
                    level1=lines[0] if len(lines) > 0 else None,
                    level2=lines[1] if len(lines) > 1 else None,
                    level3=lines[2] if len(lines) > 2 else None,
                    level4=lines[3] if len(lines) > 3 else None,
                    level5=lines[4] if len(lines) > 4 else None,
                    lines_json=json.dumps(lines, ensure_ascii=False),
                    lines_count=len(lines),
                    emoji=item.get("emoji")
                ))

        db.session.commit()
        print("[db_create] Seeded pyramid stories and items.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--init":
        db_init_only(app, db)
    elif len(sys.argv) > 1 and sys.argv[1] == "--seed-tasks":
        ensure_database_exists(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
        db_init_only(app, db)
        seed_tasks(app, db)
    elif len(sys.argv) > 1 and sys.argv[1] == "--seed-pyramid":
        ensure_database_exists(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
        db_init_only(app, db)
        seed_pyramid_stories(app, db)
    elif len(sys.argv) > 1 and sys.argv[1] == "--seed-all":
        ensure_database_exists(app.config.get("SQLALCHEMY_DATABASE_URI", ""))
        db_init_only(app, db)
        seed_tasks(app, db)
        seed_pyramid_stories(app, db)
    else:
        db_drop_everything(app, db)
