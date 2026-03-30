import os
import random
import string
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import time
from config import Config
from models import (
    db, Player, Room, RoomPlayer, ConnectionLog, Task,
    PyramidStory, PyramidStoryItem
)

app = Flask(__name__)
app.config.from_object(Config)

_player_last_columns_checked = False


def ensure_player_last_choice_columns():
    """מוסיף עמודות last_* לטבלת players אם חסרות (מסד קיים לפני השינוי)."""
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        if not inspector.has_table('players'):
            return
        cols = {c['name'] for c in inspector.get_columns('players')}
        stmts = []
        if 'last_subject' not in cols:
            stmts.append('ALTER TABLE players ADD COLUMN last_subject VARCHAR(80)')
        if 'last_age_group' not in cols:
            stmts.append('ALTER TABLE players ADD COLUMN last_age_group VARCHAR(40)')
        if 'last_game_id' not in cols:
            stmts.append('ALTER TABLE players ADD COLUMN last_game_id VARCHAR(80)')
        if not stmts:
            return
        with db.engine.begin() as conn:
            for stmt in stmts:
                conn.execute(text(stmt))
    except Exception as exc:
        print(f'WARNING: ensure_player_last_choice_columns: {exc}', flush=True)


@app.before_request
def _ensure_player_last_columns_once():
    global _player_last_columns_checked
    if _player_last_columns_checked:
        return
    _player_last_columns_checked = True
    ensure_player_last_choice_columns()
_cors_origins = os.environ.get('CORS_ORIGINS', '').strip() or '*'
_origins_list = (
    [o.strip() for o in _cors_origins.split(',') if o.strip()]
    if _cors_origins != '*' else ['*']
)
if '*' not in _origins_list:
    _origins_list.append('https://ndfa-memory-match-game.netlify.app')
CORS(app, origins=_origins_list)
db.init_app(app)
_socket_cors = _origins_list if _origins_list != ['*'] else '*'
socketio = SocketIO(app, cors_allowed_origins=_socket_cors)

ROOMS_IN_MEMORY = {}
SOCKET_PLAYER = {}


def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


def get_categories():
    return [
        'vestibular', 'tactile', 'proprioceptive', 'differentiation',
        'midline', 'eyeMuscles', 'tone', 'crossing', 'hearing', 'eyeHand'
    ]


def create_shuffled_deck(pair_count):
    categories = get_categories()
    deck = []
    for i in range(pair_count):
        cat = categories[i % len(categories)]
        deck.append({'id': i * 2, 'pairId': i, 'category': cat})
        deck.append({'id': i * 2 + 1, 'pairId': i, 'category': cat})
    random.shuffle(deck)
    return deck


@app.route('/')
def index():
    return jsonify({'service': 'NDFA Games API', 'health': '/api/health'})


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok'})


_admin_static = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')

@app.route('/admin')
def admin_page():
    return send_from_directory(_admin_static, 'admin.html')


_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
_TASKS_JSON = os.path.join(_DATA_DIR, 'tasks.json')
_CBT_CUSTOM_JSONL = os.path.join(_DATA_DIR, 'cbt_custom_interceptors.jsonl')
_GAME_LOGIN_EMAILS_JSONL = os.path.join(_DATA_DIR, 'game_login_emails.jsonl')
_CBT_WAR_ROUNDS_JSON = os.path.join(_DATA_DIR, 'cbt_war_rounds.json')


def _load_cbt_war_rounds_from_json_file():
    """גיבוי סבבי משחק מלחמה (CBT) כשמסד הנתונים לא זמין — קובץ JSON ב־backend/data/."""
    try:
        with open(_CBT_WAR_ROUNDS_JSON, 'r', encoding='utf-8') as f:
            payload = json.load(f)
        if not isinstance(payload, dict):
            return None
        rounds = payload.get('rounds')
        if isinstance(rounds, list) and len(rounds) > 0:
            return rounds
    except OSError as e:
        print(f'WARNING: cbt_war_rounds.json unreadable: {e}', flush=True)
    except (json.JSONDecodeError, TypeError, ValueError) as e:
        print(f'WARNING: cbt_war_rounds.json invalid: {e}', flush=True)
    return None


def _append_game_login_email_to_data(
    email,
    nickname,
    game_type=None,
    subject=None,
    age_group=None,
    source='unknown',
):
    """שומר התחברות משתמש (אימייל) לקובץ DATA – שורת JSON לכל אירוע."""
    em = (email or '').strip()
    nick = (nickname or '').strip()
    if not em or '@' not in em or len(em) > 320:
        return
    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
        record = {
            'email': em,
            'nickname': nick or None,
            'game_type': (game_type or '').strip() or None,
            'subject': (subject or '').strip() or None,
            'age_group': (age_group or '').strip() or None,
            'source': source,
            'ts': time.time(),
        }
        with open(_GAME_LOGIN_EMAILS_JSONL, 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    except OSError as exc:
        print(f'ERROR: game_login_emails.jsonl append failed: {exc}', flush=True)


def _load_tasks_from_json(age_group, subject):
    if not age_group or not subject:
        return []
    if not os.path.isfile(_TASKS_JSON):
        return []
    try:
        with open(_TASKS_JSON, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return []
    age_data = data.get(age_group) if isinstance(data, dict) else None
    if not isinstance(age_data, dict):
        return []
    items = age_data.get(subject)
    if not isinstance(items, list):
        return []
    out = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        q = item.get('question') or item.get('q')
        a = item.get('answer') or item.get('a')
        if q is None or a is None:
            continue
        opts = item.get('options') or item.get('options_json')
        alt = item.get('alt') or item.get('alt_answers_json')
        if isinstance(alt, str):
            try:
                alt = json.loads(alt)
            except Exception:
                pass
        out.append({
            'id': f'json-{i}', 'question': str(q), 'answer': str(a),
            'options': opts, 'alt': alt
        })
    return out


@app.route('/api/tasks')
def get_tasks():
    age_group = (request.args.get('age_group') or '').strip() or None
    subject = (request.args.get('subject') or '').strip() or None
    if not age_group or not subject:
        return jsonify({'error': 'נדרשים age_group ו-subject', 'tasks': []}), 400
    tasks = []
    rows = Task.query.filter_by(
        age_group=age_group, subject=subject
    ).order_by(Task.sort_order, Task.id).all()
    for t in rows:
        opts = None
        if t.options_json:
            try:
                opts = json.loads(t.options_json)
            except Exception:
                pass
        alt = None
        if t.alt_answers_json:
            try:
                alt = json.loads(t.alt_answers_json)
            except Exception:
                pass
        tasks.append({
            'id': t.id,
            'question': t.question,
            'answer': t.answer,
            'options': opts,
            'alt': alt
        })
    tasks.extend(_load_tasks_from_json(age_group, subject))
    return jsonify({'age_group': age_group, 'subject': subject, 'tasks': tasks})


@app.route('/api/cbt-custom-interceptor', methods=['POST'])
def cbt_custom_interceptor():
    """שומר לקובץ DATA שורת JSON: אימייל + טקסט מיירט עצמי (משחק מלחמה / CBT)."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'גוף הבקשה חייב להיות JSON'}), 400
    email = (data.get('email') or '').strip()
    custom_text = (data.get('custom_text') or '').strip()
    if not email:
        return jsonify({'error': 'נדרש אימייל'}), 400
    if '@' not in email or len(email) > 320:
        return jsonify({'error': 'אימייל לא תקין'}), 400
    if not custom_text:
        return jsonify({'error': 'נדרש טקסט מיירט'}), 400
    if len(custom_text) > 8000:
        return jsonify({'error': 'הטקסט ארוך מדי'}), 400
    round_id = (data.get('round_id') or '').strip() or None
    subject = (data.get('subject') or '').strip() or None
    age_group = (data.get('age_group') or '').strip() or None
    try:
        os.makedirs(_DATA_DIR, exist_ok=True)
        record = {
            'email': email,
            'custom_text': custom_text,
            'round_id': round_id,
            'subject': subject,
            'age_group': age_group,
            'ts': time.time(),
        }
        with open(_CBT_CUSTOM_JSONL, 'a', encoding='utf-8') as f:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')
    except OSError as e:
        return jsonify({'error': f'כתיבה לקובץ נכשלה: {e}'}), 500
    return jsonify({'ok': True})


@app.route('/api/cbt-war-rounds', methods=['GET'])
def get_cbt_war_rounds():
    """סבבי משחק מלחמה — נטען מקובץ גיבוי JSON; בעתיד ניתן להעדיף DB וליפול לכאן."""
    rounds = _load_cbt_war_rounds_from_json_file()
    if rounds is None:
        return jsonify({
            'error': 'נתוני סבבים לא זמינים (חסר או פגום קובץ data/cbt_war_rounds.json).',
            'rounds': []
        }), 503
    subject = (request.args.get('subject') or '').strip() or None
    if subject:
        has_subject = any(
            isinstance(r, dict) and (str(r.get('subject') or '').strip())
            for r in rounds
        )
        if has_subject:
            rounds = [
                r for r in rounds
                if isinstance(r, dict) and (str(r.get('subject') or '').strip() == subject)
            ]
    return jsonify({'rounds': rounds})

@app.route('/api/game-login-email', methods=['POST'])
def game_login_email():
    """שמירת אימייל התחברות ל־DATA (משחקים ללא Socket.io, למשל CBT פתוח מכתובת עם email)."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'גוף הבקשה חייב להיות JSON'}), 400
    email = (data.get('email') or '').strip()
    nickname = (data.get('nickname') or '').strip()
    if not email or '@' not in email or len(email) > 320:
        return jsonify({'error': 'אימייל לא תקין'}), 400
    game_type = (data.get('game_type') or '').strip() or None
    subject = (data.get('subject') or '').strip() or None
    age_group = (data.get('age_group') or '').strip() or None
    _append_game_login_email_to_data(
        email,
        nickname,
        game_type=game_type,
        subject=subject,
        age_group=age_group,
        source='http_game_login',
    )
    return jsonify({'ok': True})


@app.route('/api/pyramid-stories', methods=['GET'])
def get_pyramid_stories():
    subject = (request.args.get('subject') or '').strip() or None
    category = (request.args.get('category') or '').strip() or None

    q = PyramidStory.query
    if subject:
        q = q.filter(PyramidStory.subject == subject)
    if category:
        q = q.filter(PyramidStory.category == category)

    rows = q.order_by(PyramidStory.subject, PyramidStory.category, PyramidStory.sort_order, PyramidStory.id).all()
    return jsonify({
        'stories': [{
            'id': s.id,
            'story_key': s.story_key,
            'subject': s.subject,
            'category': s.category,
            'sort_order': s.sort_order,
            'title': s.title,
            'full_text': s.full_text
        } for s in rows]
    })


@app.route('/api/pyramid-stories/<story_key>', methods=['GET'])
def get_pyramid_story(story_key):
    if not story_key:
        return jsonify({'error': 'story_key is required'}), 400

    story = PyramidStory.query.filter(PyramidStory.story_key == story_key).first()
    if not story:
        return jsonify({'error': f'story_key not found: {story_key}'}), 404

    items = PyramidStoryItem.query.filter(
        PyramidStoryItem.story_id == story.id
    ).order_by(PyramidStoryItem.pair_index, PyramidStoryItem.id).all()

    out_items = []
    for item in items:
        lines = []
        if item.lines_json:
            try:
                parsed = json.loads(item.lines_json)
                if isinstance(parsed, list):
                    lines = parsed
            except Exception:
                return jsonify({'error': f'invalid lines_json for item id {item.id}'}), 500

        out_items.append({
            'id': item.id,
            'pair_index': item.pair_index,
            'item_category': item.item_category,
            'lines': lines,
            'lines_count': item.lines_count,
            'level1': item.level1,
            'level2': item.level2,
            'level3': item.level3,
            'level4': item.level4,
            'level5': item.level5,
            'emoji': item.emoji
        })

    return jsonify({
        'story': {
            'id': story.id,
            'story_key': story.story_key,
            'subject': story.subject,
            'category': story.category,
            'sort_order': story.sort_order,
            'title': story.title,
            'full_text': story.full_text,
            'items': out_items
        }
    })


def _admin_key_ok():
    key = request.headers.get('X-Admin-Key') or request.args.get('key') or ''
    secret = os.environ.get('ADMIN_SECRET', '').strip()
    return secret and key == secret


@app.route('/api/admin/connections', methods=['GET'])
def admin_list_connections():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    q = ConnectionLog.query
    age_group = (request.args.get('age_group') or '').strip() or None
    subject = (request.args.get('subject') or '').strip() or None
    game_type = (request.args.get('game_type') or '').strip() or None
    if age_group:
        q = q.filter(ConnectionLog.age_group == age_group)
    if subject:
        q = q.filter(ConnectionLog.subject == subject)
    if game_type:
        q = q.filter(ConnectionLog.game_type == game_type)
    rows = q.order_by(ConnectionLog.connected_at.desc()).limit(500).all()
    return jsonify({
        'connections': [{
            'id': r.id, 'email': r.email, 'nickname': r.nickname,
            'connected_at': r.connected_at.isoformat() if r.connected_at else None,
            'game_type': r.game_type, 'subject': r.subject,
            'age_group': r.age_group
        } for r in rows]
    })


@app.route('/api/admin/users', methods=['GET'])
def admin_list_users():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    q = ConnectionLog.query

    # ניקח את ההיסטוריה האחרונה בלבד כדי לא להעמיס על השרת.
    # המטרה כאן: להציג Admin "מי נכנס", ולא לנהל דוח אנליטי מלא.
    rows = q.order_by(ConnectionLog.connected_at.desc()).limit(5000).all()
    by_email = {}
    for r in rows:
        email = r.email
        if not email:
            continue
        if email not in by_email:
            by_email[email] = {
                'email': email,
                'nickname': r.nickname,
                'first_connected_at': r.connected_at.isoformat() if r.connected_at else None,
                'last_connected_at': r.connected_at.isoformat() if r.connected_at else None,
                'connections_count': 1,
            }
        else:
            by_email[email]['connections_count'] += 1
            # מאחר שה-rows בסדר יורד לפי connected_at, first_connected_at הוא זה של הרשומה הראשונה שנתקלנו בה.
            # last_connected_at ישתנה רק אם ניתקל בתאריך יותר חדש (לא צפוי כאן, אבל נשמור בכל מקרה).
            if r.connected_at and by_email[email]['last_connected_at']:
                by_email[email]['last_connected_at'] = max(
                    by_email[email]['last_connected_at'],
                    r.connected_at.isoformat()
                )

    users = list(by_email.values())
    users.sort(key=lambda u: u.get('last_connected_at') or '', reverse=True)
    return jsonify({'users': users})


@app.route('/api/admin/tasks', methods=['GET'])
def admin_list_tasks():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    q = Task.query
    age_group = (request.args.get('age_group') or '').strip() or None
    subject = (request.args.get('subject') or '').strip() or None
    if age_group:
        q = q.filter(Task.age_group == age_group)
    if subject:
        q = q.filter(Task.subject == subject)
    rows = q.order_by(Task.age_group, Task.subject, Task.sort_order, Task.id).all()
    return jsonify({
        'tasks': [{
            'id': t.id, 'age_group': t.age_group, 'subject': t.subject,
            'question': t.question, 'answer': t.answer,
            'options_json': t.options_json, 'alt_answers_json': t.alt_answers_json,
            'sort_order': t.sort_order
        } for t in rows]
    })


@app.route('/api/admin/connections', methods=['DELETE'])
def admin_delete_connections():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    body = request.get_json(silent=True) or {}
    age_group = (request.args.get('age_group') or body.get('age_group') or '').strip() or None
    subject = (request.args.get('subject') or body.get('subject') or '').strip() or None
    q = ConnectionLog.query
    if age_group:
        q = q.filter(ConnectionLog.age_group == age_group)
    if subject:
        q = q.filter(ConnectionLog.subject == subject)
    deleted = q.delete()
    db.session.commit()
    return jsonify({'deleted': deleted, 'message': f'Deleted {deleted} connection log(s).'})


@app.route('/api/admin/tasks', methods=['DELETE'])
def admin_delete_tasks():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    age_group = (request.args.get('age_group') or '').strip() or None
    subject = (request.args.get('subject') or '').strip() or None
    q = Task.query
    if age_group:
        q = q.filter(Task.age_group == age_group)
    if subject:
        q = q.filter(Task.subject == subject)
    deleted = q.delete()
    db.session.commit()
    return jsonify({'deleted': deleted, 'message': f'Deleted {deleted} task(s).'})


@app.route('/api/admin/clean-all', methods=['DELETE'])
def admin_clean_all():
    if not _admin_key_ok():
        return jsonify({'error': 'Admin key required'}), 403
    try:
        RoomPlayer.query.delete()
        Room.query.delete()
        ConnectionLog.query.delete()
        Task.query.delete()
        if request.args.get('players') == '1':
            Player.query.delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    msg = 'Clean all done (connection_logs, tasks, rooms, room_players'
    if request.args.get('players') == '1':
        msg += ', players'
    msg += ').'
    return jsonify({'message': msg})


@app.route('/api/players', methods=['POST'])
def register_player():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip()
    nickname = (data.get('nickname') or '').strip()
    if not email or not nickname:
        return jsonify({'error': 'אימייל ושם חובה'}), 400
    subject = (data.get('subject') or '').strip()
    age_group = (data.get('age_group') or '').strip()
    game_id = (data.get('game_id') or data.get('last_game_id') or '').strip()
    player = Player.query.filter_by(email=email).first()
    if player:
        player.nickname = nickname
    else:
        player = Player(email=email, nickname=nickname)
        db.session.add(player)
    if subject:
        player.last_subject = subject
    if age_group:
        player.last_age_group = age_group
    if game_id:
        player.last_game_id = game_id
    db.session.commit()
    _append_game_login_email_to_data(
        email,
        nickname,
        game_type=(data.get('game_type') or '').strip() or None,
        subject=subject or None,
        age_group=age_group or None,
        source='http_register',
    )
    return jsonify(player.to_dict())


def _build_waiting_rooms_list(subject=None, age_group=None, game_type=None):
    # Source of truth is the live in-memory state; fallback to DB when needed.
    out = []
    waiting_states = [r for r in ROOMS_IN_MEMORY.values() if r.get('status') == 'waiting']
    if waiting_states:
        for r in waiting_states:
            if subject and r.get('subject') != subject:
                continue
            if age_group and r.get('age_group') != age_group:
                continue
            if game_type and r.get('game_type') != game_type:
                continue
            out.append({
                'roomId': r.get('id'),
                'code': r.get('id'),
                'maxPlayers': r.get('maxPlayers'),
                'players': [{'nickname': p.get('nickname')} for p in (r.get('players') or [])],
                'subject': r.get('subject'),
                'age_group': r.get('age_group'),
                'game_type': r.get('game_type')
            })
        return out

    rooms = Room.query.filter_by(status='waiting').all()
    for r in rooms:
        out.append({
            'roomId': r.code,
            'code': r.code,
            'maxPlayers': r.max_players,
            'players': [{'nickname': rp.player.nickname} for rp in r.room_players],
            'subject': None,
            'age_group': None,
            'game_type': None
        })
    return out


@app.route('/api/rooms', methods=['GET'])
def list_rooms():
    subject = (request.args.get('subject') or '').strip() or None
    age_group = (request.args.get('age_group') or '').strip() or None
    game_type = (request.args.get('game_type') or '').strip() or None
    return jsonify(_build_waiting_rooms_list(subject=subject, age_group=age_group, game_type=game_type))


@app.cli.command()
def init_db():
    db.create_all()


@socketio.on('connect')
def on_connect():
    pass


@socketio.on('register')
def on_register(data):
    sid = request.sid
    payload = data if isinstance(data, dict) else {}
    email = (payload.get('email') or '').strip()
    nickname = (payload.get('nickname') or '').strip()
    if not email or not nickname:
        emit('error', {'message': 'אימייל ושם חובה'})
        return
    player = Player.query.filter_by(email=email).first()
    if not player:
        player = Player(email=email, nickname=nickname)
        db.session.add(player)
    else:
        player.nickname = nickname
    subj_for_last = (payload.get('subject') or '').strip()
    ag_for_last = (payload.get('age_group') or '').strip()
    gid_for_last = (payload.get('game_id') or '').strip()
    if subj_for_last:
        player.last_subject = subj_for_last
    if ag_for_last:
        player.last_age_group = ag_for_last
    if gid_for_last:
        player.last_game_id = gid_for_last
    db.session.commit()
    game_type = (payload.get('game_type') or '').strip() or 'legacy_socket'
    subject = subj_for_last or 'memory'
    age_group = ag_for_last or 'all'
    log = ConnectionLog(
        email=email, nickname=nickname, game_type=game_type,
        subject=subject, age_group=age_group
    )
    db.session.add(log)
    db.session.commit()
    _append_game_login_email_to_data(
        email, nickname,
        game_type=game_type, subject=subject, age_group=age_group,
        source='socket_register',
    )
    SOCKET_PLAYER[sid] = {'email': email, 'nickname': nickname, 'player_id': player.id}
    emit('registered', {'player': player.to_dict()})


@socketio.on('createRoom')
def on_create_room(data):
    sid = request.sid
    stored = SOCKET_PLAYER.get(sid, {})
    email = (data.get('email') or stored.get('email') or '').strip()
    nickname = (data.get('nickname') or stored.get('nickname') or '').strip()
    if not email or not nickname:
        emit('error', {'message': 'נא להזין אימייל ושם קודם'})
        return
    player = Player.query.filter_by(email=email).first()
    if not player:
        player = Player(email=email, nickname=nickname)
        db.session.add(player)
        db.session.commit()
    else:
        player.nickname = nickname
        db.session.commit()
    max_players = min(3, max(1, int(data.get('maxPlayers', 1) or 1)))
    pair_count = max(4, min(12, int(data.get('pairCount', 8) or 8)))
    subject = (data.get('subject') or 'memory').strip()
    age_group = (data.get('age_group') or 'all').strip()
    game_type = (data.get('game_type') or subject or 'memory').strip()
    code = generate_room_code()
    room_db = Room(code=code, max_players=max_players, host_socket_id=sid)
    db.session.add(room_db)
    db.session.commit()
    SOCKET_PLAYER[sid] = {'email': email, 'nickname': nickname, 'player_id': player.id}
    rp = RoomPlayer(room_id=room_db.id, player_id=player.id, socket_id=sid, score=0)
    db.session.add(rp)
    db.session.commit()
    room_state = {
        'id': code,
        'maxPlayers': max_players,
        'players': [{'id': sid, 'nickname': nickname, 'email': email, 'score': 0}],
        'status': 'waiting',
        'deck': None,
        'flipped': [],
        'scores': {sid: 0},
        'currentTurnIndex': 0,
        'pairCount': pair_count,
        'subject': subject,
        'age_group': age_group,
        'game_type': game_type,
        'matchSize': 2,
    }
    ROOMS_IN_MEMORY[code] = room_state
    join_room(code)
    emit('roomCreated', {'roomId': code, 'room': room_state})
    emit('roomUpdate', room_state, room=code)


@socketio.on('listRooms')
def on_list_rooms(data=None):
    payload = data if isinstance(data, dict) else {}
    # Socket payload is delivered in data; default no filters for backwards compatibility.
    # We keep permissive behavior for older clients that do not pass metadata.
    subject = None
    age_group = None
    game_type = None
    subject = (payload.get('subject') or '').strip() or None
    age_group = (payload.get('age_group') or '').strip() or None
    game_type = (payload.get('game_type') or '').strip() or None
    list_ = _build_waiting_rooms_list(subject=subject, age_group=age_group, game_type=game_type)
    emit('roomsList', list_)


@socketio.on('joinRoom')
def on_join_room(data):
    sid = request.sid
    room_id = (data.get('roomId') or data.get('code') or '').strip().upper()
    room_db = Room.query.filter_by(code=room_id, status='waiting').first()
    if not room_db:
        emit('error', {'message': 'חדר לא נמצא'})
        return
    if room_db.room_players.count() >= room_db.max_players:
        emit('error', {'message': 'החדר מלא'})
        return
    stored = SOCKET_PLAYER.get(sid, {})
    email = (data.get('email') or stored.get('email') or '').strip()
    nickname = (data.get('nickname') or stored.get('nickname') or '').strip()
    if not email or not nickname:
        emit('error', {'message': 'נא להזין אימייל ושם קודם'})
        return
    player = Player.query.filter_by(email=email).first()
    if not player:
        player = Player(email=email, nickname=nickname)
        db.session.add(player)
        db.session.commit()
    else:
        player.nickname = nickname
        db.session.commit()
    SOCKET_PLAYER[sid] = {'email': email, 'nickname': nickname, 'player_id': player.id}
    rp = RoomPlayer(room_id=room_db.id, player_id=player.id, socket_id=sid, score=0)
    db.session.add(rp)
    db.session.commit()
    room_state = ROOMS_IN_MEMORY.get(room_id)
    if not room_state:
        room_state = {
            'id': room_id,
            'maxPlayers': room_db.max_players,
            'players': [],
            'status': 'waiting',
            'deck': None,
            'flipped': [],
            'scores': {},
            'currentTurnIndex': 0,
            'pairCount': 8,
            'subject': (data.get('subject') or 'memory').strip(),
            'age_group': (data.get('age_group') or 'all').strip(),
            'game_type': (data.get('game_type') or (data.get('subject') or 'memory')).strip(),
            'matchSize': 2,
        }
        ROOMS_IN_MEMORY[room_id] = room_state
    else:
        room_state.setdefault('pairCount', 8)
        room_state.setdefault('subject', (data.get('subject') or 'memory').strip())
        room_state.setdefault('age_group', (data.get('age_group') or 'all').strip())
        room_state.setdefault('game_type', (data.get('game_type') or (data.get('subject') or 'memory')).strip())
        room_state.setdefault('matchSize', 2)
    room_state['players'].append({'id': sid, 'nickname': nickname, 'email': email, 'score': 0})
    room_state['scores'][sid] = 0
    join_room(room_id)
    emit('joinedRoom', {'roomId': room_id, 'room': room_state})
    emit('roomUpdate', room_state, room=room_id)


@socketio.on('startGame')
def on_start_game(data):
    sid = request.sid
    room_id = (data.get('roomId') or '').strip().upper()
    room_state = ROOMS_IN_MEMORY.get(room_id)
    if not room_state:
        emit('error', {'message': 'לא ניתן להתחיל משחק'})
        return
    status = room_state.get('status')
    # waiting — התחלה ראשונה; playing — משחק חדש / החלפת שלב אחרי סיום סיבוב
    if status not in ('waiting', 'playing'):
        emit('error', {'message': 'לא ניתן להתחיל משחק'})
        return
    if room_state['players'][0]['id'] != sid:
        emit('error', {'message': 'רק יוצר החדר יכול להתחיל'})
        return
    if status == 'waiting' and len(room_state['players']) < room_state['maxPlayers']:
        emit('error', {'message': 'מחכים לעוד שחקן/ים. לא ניתן להתחיל.'})
        return
    try:
        ms = int(data.get('matchSize', 2) or 2)
    except (TypeError, ValueError):
        ms = 2
    if ms not in (2, 3):
        emit('error', {'message': 'הגדרת משחק לא תקינה (מספר קלפים להפיכה).'})
        return
    room_state['status'] = 'playing'
    custom_deck = data.get('deck') if isinstance(data.get('deck'), list) else None
    if custom_deck:
        # וידוא שכל קלף יש לו pairId מספרי (לזיהוי זוגות) – נגזר מ־id אם חסר
        for card in custom_deck:
            if isinstance(card, dict):
                pid = card.get('pairId', card.get('pair_id'))
                if pid is None and card.get('id') is not None:
                    try:
                        card['pairId'] = int(card['id']) // 2
                    except (TypeError, ValueError):
                        pass
                elif pid is not None and isinstance(pid, str):
                    try:
                        card['pairId'] = int(pid)
                    except (TypeError, ValueError):
                        pass
        room_state['deck'] = custom_deck
    else:
        room_state['deck'] = create_shuffled_deck(
            room_state.get('pairCount', 8)
        )
    room_state['flipped'] = []
    room_state['matched'] = []
    room_state['currentTurnIndex'] = 0
    room_state['matchSize'] = ms
    story = data.get('story') if isinstance(data.get('story'), dict) else None
    if story:
        room_state['story'] = story
    else:
        room_state.pop('story', None)
    room_db = Room.query.filter_by(code=room_id).first()
    if room_db:
        room_db.status = 'playing'
        db.session.commit()
    payload = {'room': room_state, 'deck': room_state['deck']}
    if room_state.get('story'):
        payload['story'] = room_state['story']
    emit('gameStarted', payload, room=room_id)


def _delayed_no_match(room_id, card_indices, next_idx, next_sid):
    time.sleep(2)
    room_state = ROOMS_IN_MEMORY.get(room_id)
    if room_state and room_state['status'] == 'playing':
        room_state['flipped'] = []
        room_state['currentTurnIndex'] = next_idx
        socketio.emit('noMatch', {
            'cardIndices': list(card_indices),
            'nextTurn': next_sid,
            'room': room_state
        }, room=room_id)


@socketio.on('flipCard')
def on_flip_card(data):
    sid = request.sid
    room_id = (data.get('roomId') or '').strip().upper()
    room_state = ROOMS_IN_MEMORY.get(room_id)
    if not room_state or room_state['status'] != 'playing' or not room_state.get('deck'):
        return
    current_sid = room_state['players'][room_state['currentTurnIndex']]['id']
    if sid != current_sid:
        emit('error', {'message': 'לא תורך'})
        return
    try:
        card_index = int(data.get('cardIndex', -1))
    except (TypeError, ValueError):
        emit('error', {'message': 'בחירת קלף לא תקינה'})
        return
    if card_index < 0 or card_index >= len(room_state['deck']):
        emit('error', {'message': 'בחירת קלף לא תקינה'})
        return
    match_size = int(room_state.get('matchSize') or 2)
    if match_size not in (2, 3):
        match_size = 2
    if card_index in room_state['flipped'] or len(room_state['flipped']) >= match_size:
        return
    room_state['flipped'].append(card_index)
    card = room_state['deck'][card_index]
    emit('cardFlipped', {
        'cardIndex': card_index, 'card': card, 'flipped': room_state['flipped']
    }, room=room_id)
    if len(room_state['flipped']) == match_size:
        indices = list(room_state['flipped'])
        cards = [room_state['deck'][i] for i in indices]

        def _pair_id(card):
            pid = card.get('pairId', card.get('pair_id'))
            if pid is not None:
                try:
                    return int(pid)
                except (TypeError, ValueError):
                    pass
            cid = card.get('id')
            if cid is not None:
                try:
                    return int(cid) // 2
                except (TypeError, ValueError):
                    pass
            return None

        pair_ids = [_pair_id(c) for c in cards]
        is_match = (
            all(p is not None for p in pair_ids)
            and len(set(pair_ids)) == 1
        )
        if is_match:
            room_state['scores'][sid] = room_state['scores'].get(sid, 0) + 1
            for p in room_state['players']:
                if p['id'] == sid:
                    p['score'] = room_state['scores'][sid]
                    break
            room_state['flipped'] = []
            room_state.setdefault('matched', []).extend(indices)
            # Same player gets another turn after a match (classic memory rule)
            room_payload = {
                'id': room_state.get('id'),
                'maxPlayers': room_state.get('maxPlayers'),
                'players': list(room_state.get('players', [])),
                'status': room_state.get('status'),
                'deck': room_state.get('deck'),
                'flipped': list(room_state.get('flipped', [])),
                'matched': list(room_state.get('matched', [])),
                'scores': dict(room_state.get('scores', {})),
                'currentTurnIndex': room_state.get('currentTurnIndex', 0),
                'pairCount': room_state.get('pairCount', 8),
                'matchSize': room_state.get('matchSize', 2),
            }
            emit('match', {
                'cardIndices': indices,
                'category': cards[0].get('category', 'memory'),
                'scores': room_payload['scores'],
                'scoredPlayerId': sid,
                'nextTurn': sid,
                'room': room_payload
            }, room=room_id)
        else:
            next_idx = (room_state['currentTurnIndex'] + 1) % len(room_state['players'])
            next_sid = room_state['players'][next_idx]['id']
            socketio.start_background_task(
                _delayed_no_match, room_id, indices, next_idx, next_sid
            )


@socketio.on('activityDone')
def on_activity_done(data):
    room_id = (data.get('roomId') or '').strip().upper()
    emit('activityClosed', room=room_id)


@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    SOCKET_PLAYER.pop(sid, None)
    for code, room_state in list(ROOMS_IN_MEMORY.items()):
        if any(p['id'] == sid for p in room_state['players']):
            room_state['players'] = [p for p in room_state['players'] if p['id'] != sid]
            room_state['scores'].pop(sid, None)
            if len(room_state['players']) == 0:
                del ROOMS_IN_MEMORY[code]
                room_db = Room.query.filter_by(code=code).first()
                if room_db:
                    db.session.delete(room_db)
                    db.session.commit()
            else:
                room_state['currentTurnIndex'] = (
                    room_state['currentTurnIndex'] % len(room_state['players'])
                )
                emit('roomUpdate', room_state, room=code)
            leave_room(code)
            break


if __name__ == '__main__':
    uri = app.config.get('SQLALCHEMY_DATABASE_URI') or ''
    if not uri or '@' not in uri:
        print('ERROR: Set DATABASE_URL in backend/.env')
        print('Example: DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/ndfa_games')
        exit(1)
    with app.app_context():
        db.create_all()
    socketio.run(
        app, host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)), debug=True
    )
