from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Player(db.Model):
    __tablename__ = 'players'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    nickname = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {'id': self.id, 'email': self.email, 'nickname': self.nickname}


class ConnectionLog(db.Model):
    __tablename__ = 'connection_logs'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, index=True)
    nickname = db.Column(db.String(100), nullable=True)
    connected_at = db.Column(db.DateTime, default=datetime.utcnow)
    game_type = db.Column(db.String(50), nullable=True, index=True)
    subject = db.Column(db.String(50), nullable=True, index=True)
    age_group = db.Column(db.String(20), nullable=True, index=True)


class Room(db.Model):
    __tablename__ = 'rooms'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    max_players = db.Column(db.Integer, nullable=False, default=3)
    status = db.Column(db.String(20), default='waiting')
    host_socket_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    room_players = db.relationship(
        'RoomPlayer', backref='room', lazy='dynamic',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code, 'max_players': self.max_players,
            'status': self.status,
            'players': [rp.to_dict() for rp in self.room_players]
        }


class RoomPlayer(db.Model):
    __tablename__ = 'room_players'
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey('players.id'), nullable=False)
    socket_id = db.Column(db.String(100), nullable=True)
    score = db.Column(db.Integer, default=0)
    player = db.relationship(
        'Player', backref=db.backref('room_players', lazy=True)
    )

    def to_dict(self):
        return {
            'id': self.player_id, 'socket_id': self.socket_id,
            'nickname': self.player.nickname if self.player else None,
            'email': self.player.email if self.player else None,
            'score': self.score
        }


class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.Integer, primary_key=True)
    age_group = db.Column(db.String(20), nullable=False, index=True)
    subject = db.Column(db.String(50), nullable=False, index=True)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.String(255), nullable=False)
    options_json = db.Column(db.Text, nullable=True)
    alt_answers_json = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, default=0)


class PyramidStory(db.Model):
    __tablename__ = 'pyramid_stories'
    id = db.Column(db.Integer, primary_key=True)
    story_key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    subject = db.Column(db.String(50), nullable=False, default='reading', index=True)
    category = db.Column(db.String(100), nullable=False, default='pyramid_story', index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0, index=True)
    title = db.Column(db.Text, nullable=False)
    full_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    items = db.relationship(
        'PyramidStoryItem',
        backref='story',
        lazy=True,
        cascade='all, delete-orphan'
    )


class PyramidStoryItem(db.Model):
    __tablename__ = 'pyramid_story_items'
    id = db.Column(db.Integer, primary_key=True)
    story_id = db.Column(db.Integer, db.ForeignKey('pyramid_stories.id'), nullable=False, index=True)

    pair_index = db.Column(db.Integer, nullable=False, index=True)
    item_category = db.Column(db.String(100), nullable=False, default='default', index=True)

    level1 = db.Column(db.Text, nullable=True)
    level2 = db.Column(db.Text, nullable=True)
    level3 = db.Column(db.Text, nullable=True)
    level4 = db.Column(db.Text, nullable=True)
    level5 = db.Column(db.Text, nullable=True)
    lines_json = db.Column(db.Text, nullable=False)
    lines_count = db.Column(db.Integer, nullable=False, default=0)

    emoji = db.Column(db.Text, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('story_id', 'pair_index', name='uq_pyramid_story_item_pair_index'),
    )
