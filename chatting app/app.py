from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import uuid

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
socketio = SocketIO(app)

users = {}  # {user_id: {'username': username, 'room_id': room_id}}
room_users = {}  # {room_id: set(user_ids)}
messages = []  # List to store messages

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/join', methods=['POST'])
def join():
    username = request.json.get('username')
    room_id = request.json.get('room_id')
    
    user_id = str(uuid.uuid4())
    users[user_id] = {
        'username': username,
        'room_id': room_id
    }
    
    if room_id not in room_users:
        room_users[room_id] = set()
    room_users[room_id].add(user_id)
    
    return jsonify({
        'status': 'success', 
        'user_id': user_id,
        'user_count': len(room_users[room_id])
    })

@socketio.on('get_active_users')
def get_active_users(data):
    room_id = data['room_id']
    active_users = [users[user_id]['username'] for user_id in room_users.get(room_id, [])]
    emit('active_users', {'users': active_users}, room=request.sid)


@socketio.on('join_room')
def handle_join_room(data):
    room = data['room_id']
    join_room(room)
    user_count = len(room_users[room])
    active_users = [users[user_id]['username'] for user_id in room_users[room]]
    emit('user_joined', {
        'username': data['username'],
        'user_count': user_count,
        'active_users': active_users
    }, room=room)

@socketio.on('message')
def handle_message(data):
    message = {
        'message': data['message'],
        'user_id': data['user_id'],
        'username': data['username'],
        'room_id': data['room_id'],
        'timestamp': datetime.utcnow().strftime('%H:%M')
    }
    messages.append(message)
    
    emit('new_message', {
        'message': message['message'],
        'username': message['username'],
        'timestamp': message['timestamp']
    }, room=data['room_id'])
    print(message.values())

@socketio.on('leave_room')
def handle_leave_room(data):
    room = data['room_id']
    user_id = data['user_id']    
    if user_id in users:
        del users[user_id]    
    if room in room_users and user_id in room_users[room]:
        room_users[room].remove(user_id)
        if not room_users[room]:
            del room_users[room]    
    leave_room(room)
    user_count = len(room_users.get(room, set()))
    emit('user_left', {
        'username': data['username'],
        'user_count': user_count
    }, room=room)
@socketio.on('disconnect')
def handle_disconnect():
    for user_id, user_data in list(users.items()):
        if request.sid in socketio.server.manager.rooms.get(user_data['room_id'], set()):
            room = user_data['room_id']
            if room in room_users and user_id in room_users[room]:
                room_users[room].remove(user_id)
                if not room_users[room]:
                    del room_users[room]
            
            user_count = len(room_users.get(room, set()))
            emit('user_left', {
                'username': user_data['username'],
                'user_count': user_count
            }, room=room)
            
            del users[user_id]
            break
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)