import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ─── Config ───────────────────────────────────────────────────────
const API_BASE = window.location.origin;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

// ─── Styles ───────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@300;400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg-primary: #0a0a0f;
    --bg-secondary: #12121a;
    --bg-tertiary: #1a1a25;
    --bg-hover: #22222f;
    --bg-active: #2a2a3a;
    --accent: #00d4aa;
    --accent-dim: #00a888;
    --accent-glow: rgba(0, 212, 170, 0.15);
    --accent-glow2: rgba(0, 212, 170, 0.08);
    --text-primary: #e8e8ef;
    --text-secondary: #8888a0;
    --text-muted: #555570;
    --danger: #ff4466;
    --warning: #ffaa33;
    --msg-out: #0d2d25;
    --msg-in: #1a1a25;
    --border: #2a2a38;
    --radius: 14px;
    --radius-sm: 8px;
    --radius-msg: 18px;
    --shadow: 0 4px 24px rgba(0,0,0,0.4);
    --font: 'Manrope', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
  }

  html { height: 100%; overflow: hidden; }

  body {
    font-family: var(--font);
    background: var(--bg-primary);
    color: var(--text-primary);
    height: 100dvh;
    height: 100vh;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
    position: fixed;
    width: 100%;
    top: 0;
    left: 0;
  }

  #root { height: 100dvh; height: 100vh; display: flex; flex-direction: column; }

  input, textarea, button { font-family: var(--font); }
  input, textarea, select { font-size: 16px !important; }
  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  a { -webkit-tap-highlight-color: transparent; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes recording { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 102, 0.4); } 50% { box-shadow: 0 0 0 12px rgba(255, 68, 102, 0); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Mobile-specific overrides */
  @media (max-width: 768px) {
    .sidebar-mobile-hidden { display: none !important; }
    .chat-mobile-hidden { display: none !important; }
  }
  @media (min-width: 769px) {
    .desktop-back-btn { display: none !important; }
  }
`;

// ─── Emoji Data ───────────────────────────────────────────────────
const EMOJI_CATEGORIES = {
  'Смайлы': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
  'Жесты': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪'],
  'Сердца': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❣️','💕','💞','💓','💗','💖','💘','💝'],
  'Природа': ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','🌱','🌳','🌴','🍃','🍂','🍁','🌊','🌈','🌙','⭐','✨','☀️','🔥','💧'],
  'Еда': ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🍒','🍑','🍍','🥝','🍕','🍔','🍟','🌭','🍿','🍳','🍩','🍪','🎂','🍰','🧁','🍫','🍬','☕','🍵','🥤','🍺','🍷'],
};

// ─── API Helpers ──────────────────────────────────────────────────
async function api(path, options = {}) {
  const token = localStorage.getItem('pulse_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || 'Ошибка');
  }
  return res.json();
}

async function uploadFile(type, file) {
  const token = localStorage.getItem('pulse_token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/upload/${type}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  return res.json();
}

// ─── Media Permission Helper ─────────────────────────────────────
async function requestMediaPermission(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { stream, error: null };
  } catch (err) {
    let errorMsg = 'Не удалось получить доступ к медиа.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = 'Доступ к микрофону/камере запрещён. Разрешите доступ в настройках браузера.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = 'Микрофон или камера не найдены на этом устройстве.';
    } else if (err.name === 'NotReadableError') {
      errorMsg = 'Устройство уже используется другим приложением.';
    } else if (err.name === 'OverconstrainedError') {
      errorMsg = 'Запрошенные параметры не поддерживаются устройством.';
    }
    return { stream: null, error: errorMsg };
  }
}

// ─── Time Formatting ──────────────────────────────────────────────
function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'сейчас';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'вчера';
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' });
}

function formatMessageTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════
// ─── AUTH SCREEN ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ login: form.username, password: form.password })
        });
      } else {
        data = await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(form)
        });
      }
      localStorage.setItem('pulse_token', data.token);
      localStorage.setItem('pulse_user', JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 16,
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(0,212,170,0.06) 0%, transparent 50%)'
    }}>
      <div style={{
        width: '100%', maxWidth: 400, padding: '24px 20px',
        animation: 'slideUp 0.5s ease'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 12px',
            borderRadius: '50%', border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-glow)',
            boxShadow: '0 0 40px rgba(0,212,170,0.2)'
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Pulse</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Приватный мессенджер</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 12, padding: 3 }}>
          {['Вход', 'Регистрация'].map((label, i) => (
            <button key={label} onClick={() => { setIsLogin(i === 0); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
                background: (i === 0 ? isLogin : !isLogin) ? 'var(--accent)' : 'transparent',
                color: (i === 0 ? isLogin : !isLogin) ? 'var(--bg-primary)' : 'var(--text-secondary)'
              }}>
              {label}
            </button>
          ))}
        </div>

        <div onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder={isLogin ? 'Логин или email' : 'Имя пользователя'}
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              style={inputStyle} required
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); }}
            />
            
            {!isLogin && (
              <>
                <input placeholder="Отображаемое имя" value={form.displayName}
                  onChange={e => setForm({ ...form, displayName: e.target.value })}
                  style={inputStyle} required />
                <input placeholder="Email" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={inputStyle} required />
              </>
            )}
            
            <input placeholder="Пароль" type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              style={inputStyle} required minLength={6}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); }}
            />
          </div>

          {error && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,68,102,0.1)', color: 'var(--danger)', fontSize: 13
            }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: '100%', marginTop: 16, padding: '14px 0', border: 'none',
            borderRadius: 12, background: 'var(--accent)', color: 'var(--bg-primary)',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1
          }}>
            {loading ? '...' : isLogin ? 'Войти' : 'Создать аккаунт'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  transition: 'border-color 0.2s'
};

// ══════════════════════════════════════════════════════════════════
// ─── EMOJI PICKER ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function EmojiPicker({ onSelect, onClose }) {
  const [category, setCategory] = useState('Смайлы');
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('touchstart', handleClick); };
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 56, left: 4, right: 4,
      maxWidth: 340, width: '100%',
      maxHeight: 320,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: 'var(--shadow)', zIndex: 100,
      animation: 'slideUp 0.2s ease', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', gap: 2, padding: '6px 6px 4px', overflowX: 'auto',
        borderBottom: '1px solid var(--border)', WebkitOverflowScrolling: 'touch'
      }}>
        {Object.keys(EMOJI_CATEGORIES).map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{
              padding: '5px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: cat === category ? 'var(--accent-glow)' : 'transparent',
              color: cat === category ? 'var(--accent)' : 'var(--text-secondary)'
            }}>
            {cat}
          </button>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 1,
        padding: 6, maxHeight: 240, overflowY: 'auto', WebkitOverflowScrolling: 'touch'
      }}>
        {EMOJI_CATEGORIES[category].map(emoji => (
          <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
            style={{
              width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20,
              borderRadius: 8, padding: 0
            }}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── VOICE RECORDER ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function VoiceRecorder({ onSend, onCancel }) {
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const durationRef = useRef(0);
  const streamRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  const onSendRef = useRef(onSend);
  onCancelRef.current = onCancel;
  onSendRef.current = onSend;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { stream, error: permError } = await requestMediaPermission({ audio: true });
      if (cancelled) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }
      
      if (permError) {
        setError(permError);
        setTimeout(() => onCancelRef.current(), 3000);
        return;
      }

      streamRef.current = stream;
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorder.current = recorder;
      chunks.current = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.start(200);
      timer.current = setInterval(() => { durationRef.current += 1; setDuration(d => d + 1); }, 1000);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer.current);
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        try { mediaRecorder.current.stop(); } catch(e) {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleSend = () => {
    clearInterval(timer.current);
    if (!mediaRecorder.current || mediaRecorder.current.state !== 'recording') return;
    mediaRecorder.current.onstop = () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const mimeType = mediaRecorder.current.mimeType || 'audio/webm';
      const blob = new Blob(chunks.current, { type: mimeType });
      onSendRef.current(blob, durationRef.current);
    };
    mediaRecorder.current.stop();
  };

  const handleCancel = () => {
    clearInterval(timer.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      try { mediaRecorder.current.stop(); } catch(e) {}
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onCancelRef.current();
  };

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flex: 1,
        padding: '8px 12px', background: 'rgba(255,68,102,0.08)', borderRadius: 20
      }}>
        <span style={{ color: 'var(--danger)', fontSize: 13, flex: 1 }}>{error}</span>
        <button onClick={handleCancel} style={{
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: 'var(--bg-hover)', color: 'var(--text-primary)',
          cursor: 'pointer', fontSize: 13
        }}>OK</button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flex: 1,
      animation: 'fadeIn 0.2s ease'
    }}>
      <button onClick={handleCancel} style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none',
        background: 'rgba(255,68,102,0.15)', color: 'var(--danger)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0
      }}>✕</button>
      
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
        padding: '8px 12px', background: 'rgba(255,68,102,0.08)', borderRadius: 20
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)',
          animation: 'pulse 1.5s infinite', flexShrink: 0
        }} />
        <span style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {formatDuration(duration)}
        </span>
      </div>
      
      <button onClick={handleSend} style={{
        width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: 'var(--accent)', color: 'var(--bg-primary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0
      }}>▶</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── CIRCLE RECORDER ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function CircleRecorder({ onSend, onCancel }) {
  const videoRef = useRef();
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const timer = useRef(null);
  const durationRef = useRef(0);
  const sentRef = useRef(false);
  const streamRef = useRef(null);
  const onSendRef = useRef(onSend);
  const onCancelRef = useRef(onCancel);
  onSendRef.current = onSend;
  onCancelRef.current = onCancel;
  const MAX_DURATION = 60;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { stream, error: permError } = await requestMediaPermission({ 
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } }, 
        audio: true 
      });
      
      if (cancelled) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }
      
      if (permError) {
        setError(permError);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      let mimeType = '';
      for (const mt of mimeTypes) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
      }
        
      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorder.current = recorder;
      chunks.current = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.start(200);
      timer.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(d => {
          if (d >= MAX_DURATION - 1) { doSend(); return d; }
          return d + 1;
        });
      }, 1000);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer.current);
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        try { mediaRecorder.current.stop(); } catch(e) {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const doSend = () => {
    if (sentRef.current) return;
    sentRef.current = true;
    clearInterval(timer.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.onstop = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        const mimeType = mediaRecorder.current.mimeType || 'video/webm';
        const blob = new Blob(chunks.current, { type: mimeType });
        onSendRef.current(blob, durationRef.current);
      };
      mediaRecorder.current.stop();
    }
  };

  const handleCancel = () => {
    clearInterval(timer.current);
    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      try { mediaRecorder.current.stop(); } catch(e) {}
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onCancelRef.current();
  };

  if (error) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20
      }}>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 20, padding: '32px 24px',
          maxWidth: 320, textAlign: 'center'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, marginBottom: 8 }}>Нет доступа к камере</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
          <button onClick={handleCancel} style={{
            padding: '12px 32px', borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: 'var(--bg-primary)',
            cursor: 'pointer', fontSize: 14, fontWeight: 600
          }}>Закрыть</button>
        </div>
      </div>
    );
  }

  const progress = (duration / MAX_DURATION) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, animation: 'fadeIn 0.3s ease', padding: 20
    }}>
      <div style={{ position: 'relative', width: 'min(260px, 65vw)', height: 'min(260px, 65vw)' }}>
        <svg viewBox="0 0 280 280" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="140" cy="140" r="136" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx="140" cy="140" r="136" fill="none" stroke="var(--accent)" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 136}`}
            strokeDashoffset={`${2 * Math.PI * 136 * (1 - progress / 100)}`}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <video ref={videoRef} autoPlay muted playsInline
          style={{
            position: 'absolute', top: '3%', left: '3%',
            width: '94%', height: '94%', borderRadius: '50%',
            objectFit: 'cover', background: '#000'
          }} />
      </div>

      <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
        {formatDuration(duration)}
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
        <button onClick={handleCancel} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'rgba(255,68,102,0.2)', color: 'var(--danger)',
          cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>✕</button>
        <button onClick={doSend} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'var(--accent)', color: 'var(--bg-primary)',
          cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>▶</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── VIDEO CALL ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function VideoCall({ callId, callType, isIncoming, offer, callerName, ws, onEnd }) {
  const localRef = useRef();
  const remoteRef = useRef();
  const pc = useRef(null);
  const [connected, setConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(callType === 'audio');
  const localStream = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const constraints = { audio: true, video: callType === 'video' ? { facingMode: 'user' } : false };
      const { stream, error } = await requestMediaPermission(constraints);
      if (error) { alert(error); onEnd(); return; }
      localStream.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;

      pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      stream.getTracks().forEach(t => pc.current.addTrack(t, stream));

      pc.current.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        setConnected(true);
        timer.current = setInterval(() => setDuration(d => d + 1), 1000);
      };

      pc.current.onicecandidate = (e) => {
        if (e.candidate) ws.current.send(JSON.stringify({ type: 'call_ice_candidate', callId, candidate: e.candidate }));
      };

      if (isIncoming && offer) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'call_answer', callId, answer }));
      } else {
        const off = await pc.current.createOffer();
        await pc.current.setLocalDescription(off);
      }
    })();

    const handleMsg = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'call_answered' && msg.callId === callId) pc.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
      if (msg.type === 'call_ice_candidate' && msg.callId === callId) pc.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
      if ((msg.type === 'call_ended' || msg.type === 'call_rejected') && msg.callId === callId) { cleanup(); onEnd(); }
    };
    ws.current.addEventListener('message', handleMsg);
    return () => { cleanup(); ws.current.removeEventListener('message', handleMsg); };
  }, []);

  const cleanup = () => {
    clearInterval(timer.current);
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if (pc.current) pc.current.close();
  };

  const endCall = () => {
    ws.current.send(JSON.stringify({ type: 'call_end', callId }));
    cleanup(); onEnd();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0f', zIndex: 2000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      {callType === 'video' ? (
        <>
          <video ref={remoteRef} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <video ref={localRef} autoPlay muted playsInline style={{
            position: 'absolute', top: 'max(20px, var(--safe-top))', right: 16, width: 100, height: 140,
            borderRadius: 16, objectFit: 'cover', border: '2px solid var(--border)', zIndex: 10
          }} />
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-glow)',
            border: '3px solid var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', fontSize: 36
          }}>🎧</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{callerName || 'Звонок'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{connected ? formatDuration(duration) : 'Соединение...'}</p>
          <audio ref={remoteRef} autoPlay />
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 'max(40px, calc(var(--safe-bottom) + 20px))', display: 'flex', gap: 16, zIndex: 20 }}>
        <button onClick={() => {
          const t = localStream.current?.getAudioTracks()[0];
          if (t) { t.enabled = !t.enabled; setMuted(!muted); }
        }} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: muted ? 'var(--danger)' : 'rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{muted ? '🔇' : '🎤'}</button>
        {callType === 'video' && (
          <button onClick={() => {
            const t = localStream.current?.getVideoTracks()[0];
            if (t) { t.enabled = !t.enabled; setVideoOff(!videoOff); }
          }} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: videoOff ? 'var(--danger)' : 'rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{videoOff ? '📷' : '🎥'}</button>
        )}
        <button onClick={endCall} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--danger)', color: '#fff', fontSize: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>📞</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── INCOMING CALL ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function IncomingCall({ callData, onAccept, onReject }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, animation: 'fadeIn 0.3s ease', padding: 20
    }}>
      <div style={{
        textAlign: 'center', padding: '32px 24px', background: 'var(--bg-secondary)',
        borderRadius: 24, boxShadow: 'var(--shadow)', width: '100%', maxWidth: 280
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: 'var(--accent-glow)',
          border: '3px solid var(--accent)', margin: '0 auto 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, animation: 'recording 2s infinite'
        }}>
          {callData.callType === 'video' ? '🎥' : '📞'}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Входящий {callData.callType === 'video' ? 'видео' : 'аудио'}звонок</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>{callData.callerName || 'Неизвестный'}</p>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <button onClick={onReject} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'var(--danger)', color: '#fff', cursor: 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
          <button onClick={onAccept} style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'var(--accent)', color: 'var(--bg-primary)', cursor: 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✓</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── MESSAGE BUBBLE ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function MessageBubble({ message, isOwn, serverUrl }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef();

  const renderContent = () => {
    switch (message.type) {
      case 'voice':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => {
              if (audioRef.current) {
                if (playing) audioRef.current.pause();
                else audioRef.current.play().catch(() => {});
                setPlaying(!playing);
              }
            }} style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: isOwn ? 'rgba(0,212,170,0.3)' : 'var(--bg-hover)',
              color: isOwn ? 'var(--accent)' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>{playing ? '⏸' : '▶'}</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 22, display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                {Array.from({ length: 25 }, (_, i) => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2, flexShrink: 0,
                    height: Math.random() * 16 + 4,
                    background: isOwn ? 'var(--accent)' : 'var(--text-secondary)', opacity: 0.6
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: isOwn ? 'rgba(0,212,170,0.6)' : 'var(--text-muted)' }}>
                {message.duration ? formatDuration(message.duration) : '0:00'}
              </span>
            </div>
            <audio ref={audioRef} src={`${serverUrl}${message.file_url}`} onEnded={() => setPlaying(false)} preload="none" />
          </div>
        );

      case 'circle':
        return (
          <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <div style={{ position: 'relative', width: 'min(180px, 45vw)', height: 'min(180px, 45vw)' }}>
              <video
                src={`${serverUrl}${message.file_url}`}
                style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  objectFit: 'cover', border: '3px solid var(--accent)', cursor: 'pointer'
                }}
                onClick={(e) => { const v = e.target; if (v.paused) v.play().catch(() => {}); else v.pause(); }}
                playsInline preload="none"
              />
              <span style={{
                position: 'absolute', bottom: 6, right: 6,
                background: 'rgba(0,0,0,0.6)', borderRadius: 6,
                padding: '2px 5px', fontSize: 10, color: '#fff'
              }}>
                {message.duration ? formatDuration(message.duration) : ''}
              </span>
            </div>
          </div>
        );

      case 'image':
        return (
          <img src={`${serverUrl}${message.file_url}`} alt=""
            style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 12, display: 'block' }}
            loading="lazy" />
        );

      case 'file':
        return (
          <a href={`${serverUrl}${message.file_url}`} download={message.file_name}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--accent)', textDecoration: 'none'
            }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'var(--accent-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
            }}>📎</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.file_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {message.file_size ? `${(message.file_size / 1024).toFixed(1)} KB` : ''}
              </div>
            </div>
          </a>
        );

      case 'emoji':
        return <span style={{ fontSize: 44 }}>{message.content}</span>;

      default:
        return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.5 }}>{message.content}</span>;
    }
  };

  if (message.type === 'circle') {
    return (
      <div style={{
        display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start',
        padding: '4px 12px', animation: 'fadeIn 0.2s ease'
      }}>
        <div>
          {renderContent()}
          <div style={{ textAlign: isOwn ? 'right' : 'left', marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatMessageTime(message.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start',
      padding: '2px 12px', animation: 'fadeIn 0.15s ease'
    }}>
      <div style={{
        maxWidth: 'min(75%, 320px)', padding: message.type === 'emoji' ? '6px 10px' : '9px 12px',
        borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: message.type === 'emoji' ? 'transparent' : (isOwn ? 'var(--msg-out)' : 'var(--msg-in)'),
        border: message.type === 'emoji' ? 'none' : `1px solid ${isOwn ? 'rgba(0,212,170,0.15)' : 'var(--border)'}`,
      }}>
        {!isOwn && message.sender_name && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>
            {message.sender_name}
          </div>
        )}
        {renderContent()}
        <div style={{ textAlign: 'right', marginTop: 3 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatMessageTime(message.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── SETTINGS / PROFILE PANEL ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function SettingsPanel({ user, onClose, onLogout }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 500, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease'
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg-secondary)',
        borderRadius: '20px 20px 0 0', padding: '20px 20px max(20px, var(--safe-bottom))',
        animation: 'slideUp 0.3s ease'
      }} onClick={e => e.stopPropagation()}>
        {/* Profile info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'var(--bg-primary)', flexShrink: 0
          }}>
            {user.display_name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{user.display_name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>@{user.username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
          </div>
        </div>

        {/* Encryption badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'var(--accent-glow2)', borderRadius: 12, marginBottom: 12
        }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Шифрование AES-256</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Сообщения шифруются на сервере</div>
          </div>
        </div>

        {/* Logout */}
        <button onClick={onLogout} style={{
          width: '100%', padding: '14px 0', border: 'none',
          borderRadius: 12, background: 'rgba(255,68,102,0.1)', color: 'var(--danger)',
          fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── CHAT LIST SIDEBAR ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function ChatList({ chats, activeChat, onSelectChat, user, onLogout }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length >= 2) {
      try {
        const users = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
        setSearchResults(users);
        setShowSearch(true);
      } catch { setSearchResults([]); }
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  };

  const startChat = async (targetUser) => {
    const chat = await api('/api/chats', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', userIds: [targetUser.id] })
    });
    onSelectChat(chat);
    setSearch('');
    setShowSearch(false);
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)'
    }}>
      {showSettings && (
        <SettingsPanel user={user} onClose={() => setShowSettings(false)} onLogout={onLogout} />
      )}

      {/* Header */}
      <div style={{
        padding: 'max(12px, var(--safe-top)) 14px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', flexShrink: 0
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>P</span>ulse
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSettings(true)} style={{
            width: 34, height: 34, borderRadius: 10, border: 'none',
            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>⚙</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <input
          placeholder="Поиск пользователей..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none'
          }}
        />
      </div>

      {/* Search Results */}
      {showSearch && searchResults.length > 0 && (
        <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
          {searchResults.map(u => (
            <div key={u.id} onClick={() => startChat(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                borderRadius: 10, cursor: 'pointer'
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: 'var(--accent)',
                border: '2px solid var(--accent)', flexShrink: 0
              }}>
                {u.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{u.display_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {chats.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Найдите пользователя, чтобы начать общение
          </div>
        )}
        {chats.map(chat => {
          const name = chat.type === 'direct' ? chat.other_user?.display_name : chat.name;
          const avatar = chat.type === 'direct' ? chat.other_user?.display_name?.[0] : chat.name?.[0];
          const isOnline = chat.type === 'direct' && chat.other_user?.status === 'online';
          const isActive = activeChat?.id === chat.id;

          return (
            <div key={chat.id} onClick={() => onSelectChat(chat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                cursor: 'pointer', transition: 'background 0.15s',
                background: isActive ? 'var(--bg-active)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent'
              }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-glow), var(--bg-tertiary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: 'var(--accent)',
                  border: '2px solid var(--border)'
                }}>
                  {avatar?.toUpperCase() || '?'}
                </div>
                {isOnline && (
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 12, height: 12, borderRadius: '50%',
                    background: 'var(--accent)', border: '2px solid var(--bg-secondary)'
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || 'Чат'}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 6 }}>
                    {chat.last_message_at ? formatTime(chat.last_message_at) : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{
                    fontSize: 12, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {chat.last_message_type === 'voice' ? '🎤 Голосовое' :
                     chat.last_message_type === 'circle' ? '⭕ Кружочек' :
                     chat.last_message_type === 'image' ? '📷 Фото' :
                     chat.last_message_type === 'file' ? '📎 Файл' :
                     chat.last_message || ''}
                  </span>
                  {chat.unread_count > 0 && (
                    <div style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      background: 'var(--accent)', color: 'var(--bg-primary)',
                      fontSize: 10, fontWeight: 700, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                      flexShrink: 0, marginLeft: 6
                    }}>
                      {chat.unread_count}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div style={{
        padding: '10px 14px', paddingBottom: 'max(10px, var(--safe-bottom))',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--bg-primary)', flexShrink: 0
        }}>
          {user.display_name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.display_name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>@{user.username}</div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── CHAT VIEW ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function ChatView({ chat, user, ws, onBack, onCall }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingCircle, setRecordingCircle] = useState(false);
  const [typing, setTyping] = useState({});
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEnd = useRef();
  const fileInput = useRef();
  const typingTimeout = useRef();
  const attachRef = useRef();

  const chatName = chat.type === 'direct' ? chat.other_user?.display_name : chat.name;
  const chatStatus = chat.type === 'direct' ? chat.other_user?.status : null;
  const serverUrl = API_BASE;

  useEffect(() => {
    const handleClick = (e) => { 
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttachMenu(false); 
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const msgs = await api(`/api/chats/${chat.id}/messages`);
        setMessages(msgs);
        setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'auto' }), 100);
      } catch (e) { console.error('Load messages error:', e); }
    })();
  }, [chat.id]);

  useEffect(() => {
    if (!ws.current) return;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'new_message' && msg.chatId === chat.id) {
        setMessages(prev => [...prev, msg.message]);
        setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      if (msg.type === 'typing' && msg.chatId === chat.id) {
        setTyping(prev => ({ ...prev, [msg.userId]: msg.isTyping }));
        if (msg.isTyping) setTimeout(() => setTyping(prev => ({ ...prev, [msg.userId]: false })), 3000);
      }
    };
    ws.current.addEventListener('message', handler);
    return () => ws.current?.removeEventListener('message', handler);
  }, [chat.id, ws]);

  const sendMessage = (content, messageType = 'text', extra = {}) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'message', chatId: chat.id, content, messageType, ...extra }));
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    const emojiRegex = /^[\p{Emoji}\u200d\ufe0f]{1,8}$/u;
    const msgType = emojiRegex.test(text.trim()) ? 'emoji' : 'text';
    sendMessage(text.trim(), msgType);
    setText('');
    setShowEmoji(false);
  };

  const handleTyping = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'typing', chatId: chat.id, isTyping: true }));
    }
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'typing', chatId: chat.id, isTyping: false }));
      }
    }, 2000);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const isImage = file.type.startsWith('image/');
      const type = isImage ? 'images' : 'files';
      const data = await uploadFile(type, file);
      sendMessage(file.name, isImage ? 'image' : 'file', { fileUrl: data.url, fileName: data.filename, fileSize: data.size });
    } catch (err) { console.error('Upload error:', err); }
    setShowAttachMenu(false);
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleVoiceSend = async (blob, dur) => {
    setRecording(false);
    try {
      const data = await uploadFile('voice', new File([blob], 'voice.webm'));
      sendMessage('Голосовое сообщение', 'voice', { fileUrl: data.url, duration: dur });
    } catch (err) { console.error('Voice upload error:', err); }
  };

  const handleCircleSend = async (blob, dur) => {
    setRecordingCircle(false);
    try {
      const data = await uploadFile('circles', new File([blob], 'circle.webm'));
      sendMessage('Кружочек', 'circle', { fileUrl: data.url, duration: dur });
    } catch (err) { console.error('Circle upload error:', err); }
  };

  const typingUsers = Object.entries(typing).filter(([id, t]) => t && id !== user.id);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)',
      maxHeight: '100dvh'
    }}>
      {/* Header */}
      <div style={{
        padding: 'max(8px, var(--safe-top)) 10px 8px',
        display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
        flexShrink: 0, minHeight: 52
      }}>
        <button onClick={onBack} className="desktop-back-btn" style={{
          width: 32, height: 32, borderRadius: 8,
          border: 'none', background: 'transparent', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>←</button>

        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--accent-glow)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: 'var(--accent)',
          border: '2px solid var(--border)', flexShrink: 0
        }}>
          {chatName?.[0]?.toUpperCase() || '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatName || 'Чат'}</div>
          <div style={{ fontSize: 11, color: chatStatus === 'online' ? 'var(--accent)' : 'var(--text-muted)' }}>
            {typingUsers.length > 0 ? 'печатает...' : chatStatus === 'online' ? 'в сети' : 'не в сети'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onCall('audio')} style={headerBtnStyle} title="Аудиозвонок">📞</button>
          <button onClick={() => onCall('video')} style={headerBtnStyle} title="Видеозвонок">🎥</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 0',
        WebkitOverflowScrolling: 'touch',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0,212,170,0.02) 0%, transparent 50%)'
      }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user.id} serverUrl={serverUrl} />
        ))}
        {typingUsers.length > 0 && (
          <div style={{ padding: '4px 12px', animation: 'fadeIn 0.2s' }}>
            <div style={{
              display: 'inline-block', padding: '8px 14px', borderRadius: '16px 16px 16px 4px',
              background: 'var(--msg-in)', border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                    animation: `pulse 1.4s infinite ${i * 0.2}s`
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Circle Recorder */}
      {recordingCircle && (
        <CircleRecorder onSend={handleCircleSend} onCancel={() => setRecordingCircle(false)} />
      )}

      {/* Input Area */}
      <div style={{
        padding: '6px 6px', paddingBottom: 'max(6px, var(--safe-bottom))',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexShrink: 0, position: 'relative'
      }}>
        {showEmoji && <EmojiPicker onSelect={e => setText(t => t + e)} onClose={() => setShowEmoji(false)} />}

        {showAttachMenu && (
          <div ref={attachRef} style={{
            position: 'absolute', bottom: 52, left: 6,
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 50,
            padding: '4px 0', animation: 'slideUp 0.15s ease', minWidth: 160
          }}>
            <button onClick={() => { fileInput.current?.click(); }} style={attachMenuBtnStyle}>
              📎 Файл / Фото
            </button>
            <button onClick={() => { setRecordingCircle(true); setShowAttachMenu(false); }} style={attachMenuBtnStyle}>
              ⭕ Кружочек
            </button>
          </div>
        )}

        <input ref={fileInput} type="file" hidden onChange={handleFile} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.rar,.txt" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {recording ? (
            <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setRecording(false)} />
          ) : (
            <>
              <button onClick={() => setShowEmoji(!showEmoji)} style={inputBtnStyle}>😊</button>
              <button onClick={() => setShowAttachMenu(!showAttachMenu)} style={inputBtnStyle}>+</button>

              <input
                placeholder="Сообщение..."
                value={text}
                onChange={e => { setText(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 20, minWidth: 0,
                  border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none'
                }}
              />

              {text.trim() ? (
                <button onClick={handleSend} style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: 'var(--accent)', color: 'var(--bg-primary)',
                  cursor: 'pointer', fontSize: 15, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>▶</button>
              ) : (
                <button onClick={() => setRecording(true)} style={{
                  width: 38, height: 38, borderRadius: '50%', border: 'none',
                  background: 'var(--accent-glow)', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 17, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>🎤</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const headerBtnStyle = {
  width: 32, height: 32, borderRadius: 8, border: 'none',
  background: 'var(--bg-tertiary)', cursor: 'pointer', fontSize: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
};

const inputBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', border: 'none',
  background: 'transparent', cursor: 'pointer', fontSize: 17,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
};

const attachMenuBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '10px 14px', border: 'none', background: 'transparent',
  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left'
};

// ══════════════════════════════════════════════════════════════════
// ─── MAIN APP ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [showMobile, setShowMobile] = useState('list');
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  // ─── Init: verify saved token against server ───
  useEffect(() => {
    (async () => {
      const savedToken = localStorage.getItem('pulse_token');
      if (!savedToken) {
        setInitializing(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        const data = await res.json();
        if (data.valid && data.user) {
          setToken(savedToken);
          setUser(data.user);
          localStorage.setItem('pulse_user', JSON.stringify(data.user));
        } else {
          // Token invalid — clear and show login
          localStorage.removeItem('pulse_token');
          localStorage.removeItem('pulse_user');
        }
      } catch {
        // Server unreachable — try using cached user data
        const savedUser = localStorage.getItem('pulse_user');
        if (savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      }
      setInitializing(false);
    })();
  }, []);

  // ─── WebSocket ─────────────────────────────
  const connectWs = useCallback(() => {
    if (!token) return;
    if (ws.current && ws.current.readyState <= 1) return;

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', token }));
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'auth_error':
          // Token rejected by WS — force re-login
          localStorage.removeItem('pulse_token');
          localStorage.removeItem('pulse_user');
          setUser(null);
          setToken(null);
          break;

        case 'new_message':
          setChats(prev => {
            const chatExists = prev.some(c => c.id === msg.chatId);
            if (!chatExists) {
              api(`/api/chats/${msg.chatId}`).then(newChat => {
                setChats(p => {
                  if (p.some(c => c.id === newChat.id)) return p;
                  return [{ ...newChat, unread_count: 1 }, ...p];
                });
              }).catch(console.error);
              return prev;
            }
            const updated = prev.map(c => {
              if (c.id === msg.chatId) {
                return {
                  ...c,
                  last_message: msg.message.content,
                  last_message_type: msg.message.type,
                  last_message_at: msg.message.created_at,
                  unread_count: (c.unread_count || 0) + (msg.message.sender_id !== user?.id ? 1 : 0)
                };
              }
              return c;
            });
            return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
          });
          break;

        case 'user_status':
          setChats(prev => prev.map(c => {
            if (c.type === 'direct' && c.other_user?.id === msg.userId) {
              return { ...c, other_user: { ...c.other_user, status: msg.status } };
            }
            return c;
          }));
          setActiveChat(prev => {
            if (prev && prev.type === 'direct' && prev.other_user?.id === msg.userId) {
              return { ...prev, other_user: { ...prev.other_user, status: msg.status } };
            }
            return prev;
          });
          break;

        case 'call_incoming':
          setIncomingCall({
            callId: msg.callId, callerId: msg.callerId, chatId: msg.chatId,
            callType: msg.callType, offer: msg.offer, callerName: 'Входящий звонок'
          });
          break;

        case 'call_created':
          break;
      }
    };

    socket.onclose = () => {
      reconnectTimer.current = setTimeout(connectWs, 3000);
    };

    return () => {
      clearTimeout(reconnectTimer.current);
      socket.close();
    };
  }, [token, user]);

  useEffect(() => {
    connectWs();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connectWs]);

  // ─── Load Chats ────────────────────────────
  useEffect(() => {
    if (!token) return;
    api('/api/chats').then(setChats).catch(console.error);
  }, [token]);

  const handleAuth = (u, t) => { setUser(u); setToken(t); };

  const handleLogout = () => {
    localStorage.removeItem('pulse_token');
    localStorage.removeItem('pulse_user');
    setUser(null);
    setToken(null);
    setChats([]);
    setActiveChat(null);
    if (ws.current) ws.current.close();
  };

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    setShowMobile('chat');
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
  };

  const handleCall = (callType) => {
    if (!activeChat || activeChat.type !== 'direct') return;
    const targetUserId = activeChat.other_user?.id;
    if (!targetUserId) return;

    (async () => {
      const { stream, error } = await requestMediaPermission({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false
      });
      if (error) { alert(error); return; }
      stream.getTracks().forEach(t => t.stop());

      const tempPc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const offer = await tempPc.createOffer();
      tempPc.close();

      ws.current.send(JSON.stringify({
        type: 'call_offer', targetUserId, chatId: activeChat.id, callType, offer
      }));

      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'call_created') {
          setActiveCall({ callId: msg.callId, callType, isIncoming: false, callerName: activeChat.other_user?.display_name });
          ws.current.removeEventListener('message', handler);
        }
      };
      ws.current.addEventListener('message', handler);
    })();
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveCall({
      callId: incomingCall.callId, callType: incomingCall.callType,
      isIncoming: true, offer: incomingCall.offer, callerName: incomingCall.callerName
    });
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    ws.current.send(JSON.stringify({ type: 'call_reject', callId: incomingCall.callId }));
    setIncomingCall(null);
  };

  // Loading state
  if (initializing) {
    return (
      <>
        <style>{globalStyles}</style>
        <div style={{
          height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-primary)', flexDirection: 'column', gap: 16
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Загрузка...</span>
        </div>
      </>
    );
  }

  if (!user) return (
    <>
      <style>{globalStyles}</style>
      <AuthScreen onAuth={handleAuth} />
    </>
  );

  return (
    <>
      <style>{globalStyles}</style>

      {activeCall && (
        <VideoCall
          callId={activeCall.callId} callType={activeCall.callType}
          isIncoming={activeCall.isIncoming} offer={activeCall.offer}
          callerName={activeCall.callerName} ws={ws} onEnd={() => setActiveCall(null)}
        />
      )}

      {incomingCall && (
        <IncomingCall callData={incomingCall} onAccept={handleAcceptCall} onReject={handleRejectCall} />
      )}

      <div style={{
        height: '100dvh', display: 'flex',
        maxWidth: 1200, margin: '0 auto', overflow: 'hidden', width: '100%'
      }}>
        {/* Sidebar — hidden on mobile when chat is open */}
        <div
          className={showMobile === 'chat' ? 'sidebar-mobile-hidden' : ''}
          style={{
            width: '100%',
            maxWidth: 360,
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <ChatList
            chats={chats}
            activeChat={activeChat}
            onSelectChat={handleSelectChat}
            user={user}
            onLogout={handleLogout}
          />
        </div>

        {/* Chat — hidden on mobile when list is shown */}
        <div
          className={showMobile === 'list' ? 'chat-mobile-hidden' : ''}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: '100%'
          }}
        >
          {activeChat ? (
            <ChatView
              chat={activeChat}
              user={user}
              ws={ws}
              onBack={() => setShowMobile('list')}
              onCall={handleCall}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                border: '2px solid var(--border)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-glow2)'
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5 }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Выберите чат</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
