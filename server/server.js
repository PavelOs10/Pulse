const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-in-production';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'pulse.db');

// Encryption key derived from JWT_SECRET
const ENCRYPTION_KEY = crypto.scryptSync(JWT_SECRET, 'pulse-salt-v1', 32);
const IV_LENGTH = 16;

// Ensure dirs
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
['avatars', 'voice', 'video', 'images', 'files', 'circles'].forEach(d => {
  const dir = path.join(UPLOAD_DIR, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Encryption ──────────────────────────────────────────────────
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch { return text; }
}

function decrypt(text) {
  if (!text) return text;
  try {
    if (!text.includes(':') || text.indexOf(':') !== 32) return text;
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts.slice(1).join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch { return text; }
}

// ─── Database ────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    status TEXT DEFAULT 'offline',
    bio TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'direct',
    name TEXT DEFAULT NULL,
    avatar TEXT DEFAULT NULL,
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES users(id),
    type TEXT DEFAULT 'text',
    content TEXT,
    file_url TEXT DEFAULT NULL,
    file_name TEXT DEFAULT NULL,
    file_size INTEGER DEFAULT NULL,
    duration INTEGER DEFAULT NULL,
    reply_to TEXT DEFAULT NULL REFERENCES messages(id),
    edited_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS message_reads (
    message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS contacts (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    contact_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
`);

// ─── Express ─────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'files';
    const dir = path.join(UPLOAD_DIR, type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ─── Auth Middleware ─────────────────────────────────────────────
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

// ─── Token Verify endpoint (fixes re-register on redeploy) ──────
app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ valid: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, display_name, email, avatar, bio, status FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ valid: false });
    res.json({ valid: true, user });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

// ─── Auth Routes ─────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;
    if (!username || !displayName || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Имя пользователя: 3-30 символов' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Пользователь или email уже существует' });

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare('INSERT INTO users (id, username, display_name, email, password_hash) VALUES (?, ?, ?, ?, ?)').run(id, username, displayName, email, passwordHash);
    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '90d' });
    const user = db.prepare('SELECT id, username, display_name, email, avatar, bio, status FROM users WHERE id = ?').get(id);
    res.json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user) return res.status(401).json({ error: 'Неверные данные' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });
    db.prepare('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run('online', user.id);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '90d' });
    res.json({
      token,
      user: { id: user.id, username: user.username, display_name: user.display_name, email: user.email, avatar: user.avatar, bio: user.bio, status: 'online' }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// ─── User Routes ─────────────────────────────────────────────────
app.get('/api/users/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, email, avatar, bio, status FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

app.patch('/api/users/me', authenticate, (req, res) => {
  const { displayName, bio, avatar } = req.body;
  if (displayName) db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, req.userId);
  if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.userId);
  if (avatar) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.userId);
  const user = db.prepare('SELECT id, username, display_name, email, avatar, bio, status FROM users WHERE id = ?').get(req.userId);
  res.json(user);
});

app.get('/api/users/search', authenticate, (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const users = db.prepare('SELECT id, username, display_name, avatar, status FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? LIMIT 20').all(`%${q}%`, `%${q}%`, req.userId);
  res.json(users);
});

// ─── Chat Routes ─────────────────────────────────────────────────
app.get('/api/chats', authenticate, (req, res) => {
  const chats = db.prepare(`
    SELECT c.*, 
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT type FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT sender_id FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
      (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender_id != ? 
        AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)) as unread_count
    FROM chats c JOIN chat_members cm ON cm.chat_id = c.id WHERE cm.user_id = ?
    ORDER BY last_message_at DESC NULLS LAST
  `).all(req.userId, req.userId, req.userId);

  const enriched = chats.map(chat => {
    if (chat.last_message && (chat.last_message_type === 'text' || chat.last_message_type === 'emoji')) {
      chat.last_message = decrypt(chat.last_message);
    }
    if (chat.type === 'direct') {
      const other = db.prepare('SELECT u.id, u.username, u.display_name, u.avatar, u.status FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = ? AND u.id != ?').get(chat.id, req.userId);
      return { ...chat, other_user: other };
    }
    const members = db.prepare('SELECT u.id, u.username, u.display_name, u.avatar, u.status FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = ?').all(chat.id);
    return { ...chat, members };
  });
  res.json(enriched);
});

app.post('/api/chats', authenticate, (req, res) => {
  const { type, userIds, name } = req.body;
  if (type === 'direct') {
    const targetId = userIds[0];
    const existing = db.prepare('SELECT c.id FROM chats c JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ? JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ? WHERE c.type = \'direct\'').get(req.userId, targetId);
    if (existing) {
      const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(existing.id);
      const other = db.prepare('SELECT id, username, display_name, avatar, status FROM users WHERE id = ?').get(targetId);
      return res.json({ ...chat, other_user: other });
    }
    const chatId = uuidv4();
    db.prepare('INSERT INTO chats (id, type, created_by) VALUES (?, ?, ?)').run(chatId, 'direct', req.userId);
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.userId, 'admin');
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, targetId, 'member');
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    const other = db.prepare('SELECT id, username, display_name, avatar, status FROM users WHERE id = ?').get(targetId);
    return res.json({ ...chat, other_user: other });
  }
  const chatId = uuidv4();
  db.prepare('INSERT INTO chats (id, type, name, created_by) VALUES (?, ?, ?, ?)').run(chatId, 'group', name || 'Группа', req.userId);
  db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.userId, 'admin');
  userIds.forEach(uid => {
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, uid, 'member');
  });
  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  const members = db.prepare('SELECT u.id, u.username, u.display_name, u.avatar, u.status FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = ?').all(chatId);
  res.json({ ...chat, members });
});

app.get('/api/chats/:chatId', authenticate, (req, res) => {
  const { chatId } = req.params;
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа' });
  const chat = db.prepare(`
    SELECT c.*, 
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT type FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.sender_id != ? 
        AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)) as unread_count
    FROM chats c WHERE c.id = ?
  `).get(req.userId, req.userId, chatId);
  if (!chat) return res.status(404).json({ error: 'Чат не найден' });
  if (chat.last_message && (chat.last_message_type === 'text' || chat.last_message_type === 'emoji')) {
    chat.last_message = decrypt(chat.last_message);
  }
  if (chat.type === 'direct') {
    const other = db.prepare('SELECT u.id, u.username, u.display_name, u.avatar, u.status FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = ? AND u.id != ?').get(chat.id, req.userId);
    return res.json({ ...chat, other_user: other });
  }
  const members = db.prepare('SELECT u.id, u.username, u.display_name, u.avatar, u.status FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = ?').all(chat.id);
  res.json({ ...chat, members });
});

// ─── Messages ────────────────────────────────────────────────────
app.get('/api/chats/:chatId/messages', authenticate, (req, res) => {
  const { chatId } = req.params;
  const { before, limit = 50 } = req.query;
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.userId);
  if (!member) return res.status(403).json({ error: 'Нет доступа' });

  let query = 'SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ?';
  const params = [chatId];
  if (before) { query += ' AND m.created_at < ?'; params.push(before); }
  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  const messages = db.prepare(query).all(...params).reverse();
  const decrypted = messages.map(m => ({
    ...m,
    content: (m.type === 'text' || m.type === 'emoji') ? decrypt(m.content) : m.content
  }));

  try {
    const unread = db.prepare('SELECT id FROM messages WHERE chat_id = ? AND sender_id != ? AND NOT EXISTS (SELECT 1 FROM message_reads WHERE message_id = messages.id AND user_id = ?)').all(chatId, req.userId, req.userId);
    const markRead = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)');
    db.transaction(() => { unread.forEach(m => markRead.run(m.id, req.userId)); })();
  } catch (e) { console.error('Mark read error:', e.message); }

  res.json(decrypted);
});

// ─── Uploads ─────────────────────────────────────────────────────
app.post('/api/upload/:type', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/${req.params.type}/${req.file.filename}`;
  res.json({ url, filename: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype });
});

app.post('/api/users/avatar', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.userId);
  res.json({ url });
});

// ─── SPA Fallback ────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

// ─── Server + WebSocket ──────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();
const activeCalls = new Map();

function broadcast(chatId, data, excludeUserId = null) {
  const members = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId);
  members.forEach(({ user_id }) => {
    if (user_id === excludeUserId) return;
    const sockets = clients.get(user_id);
    if (sockets) sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); });
  });
}

function sendTo(userId, data) {
  const sockets = clients.get(userId);
  if (sockets) sockets.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); });
}

// Ping/pong keepalive
const pingInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
wss.on('close', () => clearInterval(pingInterval));

wss.on('connection', (ws) => {
  let userId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'auth': {
          try {
            const payload = jwt.verify(msg.token, JWT_SECRET);
            const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.userId);
            if (!user) { ws.send(JSON.stringify({ type: 'auth_error', error: 'Пользователь не найден' })); return; }
            userId = payload.userId;
            if (!clients.has(userId)) clients.set(userId, new Set());
            clients.get(userId).add(ws);
            db.prepare('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run('online', userId);
            const chats = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(userId);
            chats.forEach(({ chat_id }) => { broadcast(chat_id, { type: 'user_status', userId, status: 'online' }, userId); });
            ws.send(JSON.stringify({ type: 'auth_ok' }));
          } catch { ws.send(JSON.stringify({ type: 'auth_error', error: 'Невалидный токен' })); }
          break;
        }
        case 'message': {
          if (!userId) return;
          const { chatId, content, messageType = 'text', fileUrl, fileName, fileSize, duration, replyTo } = msg;
          const encryptedContent = (messageType === 'text' || messageType === 'emoji') ? encrypt(content) : content;
          const id = uuidv4();
          db.prepare('INSERT INTO messages (id, chat_id, sender_id, type, content, file_url, file_name, file_size, duration, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, chatId, userId, messageType, encryptedContent, fileUrl || null, fileName || null, fileSize || null, duration || null, replyTo || null);
          const message = db.prepare('SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?').get(id);
          message.content = (messageType === 'text' || messageType === 'emoji') ? content : message.content;
          broadcast(chatId, { type: 'new_message', message, chatId });
          break;
        }
        case 'typing': {
          if (!userId) return;
          broadcast(msg.chatId, { type: 'typing', userId, chatId: msg.chatId, isTyping: msg.isTyping }, userId);
          break;
        }
        case 'read': {
          if (!userId) return;
          db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(msg.messageId, userId);
          broadcast(msg.chatId, { type: 'message_read', messageId: msg.messageId, userId, chatId: msg.chatId }, userId);
          break;
        }
        case 'call_offer': {
          if (!userId) return;
          const callId = uuidv4();
          activeCalls.set(callId, { callerId: userId, targetId: msg.targetUserId, chatId: msg.chatId, callType: msg.callType, startedAt: Date.now() });
          sendTo(msg.targetUserId, { type: 'call_incoming', callId, callerId: userId, chatId: msg.chatId, callType: msg.callType, offer: msg.offer });
          ws.send(JSON.stringify({ type: 'call_created', callId }));
          break;
        }
        case 'call_answer': {
          if (!userId) return;
          const call = activeCalls.get(msg.callId);
          if (call) sendTo(call.callerId, { type: 'call_answered', callId: msg.callId, answer: msg.answer });
          break;
        }
        case 'call_ice_candidate': {
          if (!userId) return;
          const c = activeCalls.get(msg.callId);
          if (c) { const tid = c.callerId === userId ? c.targetId : c.callerId; sendTo(tid, { type: 'call_ice_candidate', callId: msg.callId, candidate: msg.candidate }); }
          break;
        }
        case 'call_end': {
          if (!userId) return;
          const endCall = activeCalls.get(msg.callId);
          if (endCall) { const tid = endCall.callerId === userId ? endCall.targetId : endCall.callerId; sendTo(tid, { type: 'call_ended', callId: msg.callId }); activeCalls.delete(msg.callId); }
          break;
        }
        case 'call_reject': {
          if (!userId) return;
          const rejCall = activeCalls.get(msg.callId);
          if (rejCall) { sendTo(rejCall.callerId, { type: 'call_rejected', callId: msg.callId }); activeCalls.delete(msg.callId); }
          break;
        }
      }
    } catch (err) { console.error('WS error:', err); }
  });

  ws.on('close', () => {
    if (userId) {
      const sockets = clients.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          clients.delete(userId);
          db.prepare('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?').run('offline', userId);
          const chats = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(userId);
          chats.forEach(({ chat_id }) => { broadcast(chat_id, { type: 'user_status', userId, status: 'offline' }, userId); });
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 Pulse v2.0 | Port ${PORT} | DB: ${DB_PATH} | Encryption: AES-256-CBC\n`);
});
