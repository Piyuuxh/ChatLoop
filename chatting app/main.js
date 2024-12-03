let socket = io();
let currentUser = null;
let currentRoom = null;

// Join Room
function joinRoom() {
    const username = document.getElementById('username').value;
    const roomId = document.getElementById('room-id').value;

    if (!username || !roomId) {
        alert('Please enter both username and room ID');
        return;
    }

    fetch('/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, room_id: roomId })
    })
    .then(response => response.json())
    .then(data => {
        currentUser = { id: data.user_id, username: username };
        currentRoom = roomId;

        // Emit join_room event to the server
        socket.emit('join_room', { username, room_id: roomId, user_id: data.user_id });

        // Fade out the login container
        const joinContainer = document.getElementById('join-container');
        joinContainer.classList.add('hidden');

        // Wait for fade-out to complete before switching views
        setTimeout(() => {
            joinContainer.parentNode.removeChild(joinContainer);
            document.getElementById('chat-container').style.display = 'flex';
            document.getElementById('room-title').textContent = `Chat Room: ${roomId}`;
        }, 500); // Match the CSS transition duration
    });
}

// Leave Room
function leaveRoom() {
    if (currentUser && currentRoom) {
        socket.emit('leave_room', {
            user_id: currentUser.id,
            username: currentUser.username,
            room_id: currentRoom
        });

        currentUser = null;
        currentRoom = null;

        // Reset the UI to the login view
        location.reload();
    }
}

// Send Message
function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value;

    if (message.trim() && currentUser && currentRoom) {
        socket.emit('message', {
            message: message,
            user_id: currentUser.id,
            username: currentUser.username,
            room_id: currentRoom
        });
        messageInput.value = '';
    }
}

// Update Active Users
socket.on('active_users', function(data) {
    const activeUsersList = document.getElementById('active-users');
    activeUsersList.innerHTML = '';
    data.users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.className = 'list-group-item';
        userItem.textContent = user;
        activeUsersList.appendChild(userItem);
    });
});

// Receive New Messages
socket.on('new_message', function(data) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = data.username === currentUser.username ? 'message sent' : 'message received';
    messageElement.innerHTML = `<strong>${data.username}</strong>: ${data.message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// System Messages for User Join/Leave
socket.on('user_joined', function(data) {
    const messagesDiv = document.getElementById('chat-messages');
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message system-message';
    systemMessage.textContent = `${data.username} has joined the room.`;
    messagesDiv.appendChild(systemMessage);

    // Update Active Users List
    socket.emit('get_active_users', { room_id: currentRoom });
});

socket.on('user_left', function(data) {
    const messagesDiv = document.getElementById('chat-messages');
    const systemMessage = document.createElement('div');
    systemMessage.className = 'message system-message';
    systemMessage.textContent = `${data.username} has left the room.`;
    messagesDiv.appendChild(systemMessage);

    // Update Active Users List
    socket.emit('get_active_users', { room_id: currentRoom });
});
