// ATTI — Real-Time Communication App (CodeAlpha Task 4)
// Signaling server: auth, room management, WebRTC signaling relay, whiteboard relay.
// Actual video/screen/file data flows peer-to-peer over WebRTC — this server never touches media.

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// ---- In-memory auth store (swap for a real DB later; fine for internship scope) ----
const users = new Map(); // username -> { hash, salt }
const sessions = new Map(); // token -> username

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}


app.use(express.json());

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username needs 3+ chars, password 4+ chars.' });
  }
  if (users.has(username)) {
    return res.status(409).json({ error: 'That username is taken.' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  users.set(username, { hash: hashPassword(password, salt), salt });
  const token = makeToken();
  sessions.set(token, username);
  res.json({ token, username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const record = users.get(username);
  if (!record || hashPassword(password, record.salt) !== record.hash) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  const token = makeToken();
  sessions.set(token, username);
  res.json({ token, username });
});

function usernameFromToken(token) {
  return sessions.get(token);
}

// ---- Room state ----
// rooms: roomId -> Set of socket ids
const rooms = new Map();

function socketsInRoom(roomId) {
  return [...(rooms.get(roomId) || [])];
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

  socket.on('join-room', ({ roomId, token }) => {
    username = usernameFromToken(token);
    if (!username) {
      socket.emit('auth-error', { error: 'Session expired, please log in again.' });
      return;
    }
    currentRoom = roomId;
    socket.data.username = username;

    const existingPeers = socketsInRoom(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);
    socket.join(roomId);

    // Tell the new peer who is already in the room (it will initiate offers to them)
    socket.emit('existing-peers', existingPeers.map((id) => ({
      socketId: id,
      username: io.sockets.sockets.get(id)?.data?.username || 'guest',
    })));

    // Tell existing peers a new one joined
    socket.to(roomId).emit('peer-joined', { socketId: socket.id, username });
  });

  // Relay WebRTC signaling (offer/answer/ICE) directly to the target peer
  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data, username });
  });

  // Whiteboard: broadcast draw events / clears to everyone else in the room
  socket.on('whiteboard-draw', (payload) => {
    if (currentRoom) socket.to(currentRoom).emit('whiteboard-draw', payload);
  });
  socket.on('whiteboard-clear', () => {
    if (currentRoom) socket.to(currentRoom).emit('whiteboard-clear');
  });

  // Simple text chat alongside the call (handy for file-share links / notices)
  socket.on('chat-message', (msg) => {
    if (currentRoom) {
      io.to(currentRoom).emit('chat-message', { from: username, msg, at: Date.now() });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      if (rooms.get(currentRoom).size === 0) rooms.delete(currentRoom);
      socket.to(currentRoom).emit('peer-left', { socketId: socket.id, username });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ATTI signaling server running on port ${PORT}`));
