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
    --safe-bottom: env(safe-area-inset-bottom, 0px);
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

  #root { height: 100dvh; height: 100vh; }

  input, textarea, button { font-family: var(--font); }
  
  /* Prevent iOS zoom on input focus */
  input, textarea, select { font-size: 16px !important; }
  
  /* Touch improvements */
  button { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes ripple { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.4); opacity: 0; } }
  @keyframes recording { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 102, 0.4); } 50% { box-shadow: 0 0 0 12px rgba(255, 68, 102, 0); } }
  @keyframes circleRecord { 0% { border-color: var(--accent); } 50% { border-color: var(--danger); } 100% { border-color: var(--accent); } }
`;

// ─── Emoji Data ───────────────────────────────────────────────────
const EMOJI_CATEGORIES = {
  'Смайлики': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Жесты': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪'],
  'Сердечки': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  'Природа': ['🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','🌱','🌳','🌴','🍃','🍂','🍁','🌾','🌵','🌊','🌈','🌙','⭐','🌟','✨','☀️','🌤️','⛅','🌥️','🌦️','🌧️','🌨️','❄️','☃️','⛄','🔥','💧','🌬️'],
  'Еда': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥝','🍅','🥑','🍆','🌶️','🫑','🥒','🥦','🧄','🧅','🥕','🌽','🍕','🍔','🍟','🌭','🍿','🧂','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌮','🌯','🥗','🍱','🍣','🍜','🍝','🍲','🍛','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','🍮','☕','🍵','🥤','🍺','🍻','🥂','🍷','🍸','🍹'],
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
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse at 30% 20%, rgba(0,212,170,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(0,212,170,0.04) 0%, transparent 50%)'
    }}>
      <div style={{
        width: '100%', maxWidth: 420, padding: 32,
        animation: 'slideUp 0.5s ease'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            borderRadius: '50%', border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--accent-glow)',
            boxShadow: '0 0 40px rgba(0,212,170,0.2)'
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>Pulse</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>Приватный мессенджер</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, background: 'var(--bg-secondary)', borderRadius: 12, padding: 3 }}>
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

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder={isLogin ? 'Логин или email' : 'Имя пользователя'}
              value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
              style={inputStyle} required />
            
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
              style={inputStyle} required minLength={6} />
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 10,
              background: 'rgba(255,68,102,0.1)', color: 'var(--danger)', fontSize: 13
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', marginTop: 20, padding: '14px 0', border: 'none',
            borderRadius: 12, background: 'var(--accent)', color: 'var(--bg-primary)',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            opacity: loading ? 0.6 : 1
          }}>
            {loading ? '...' : isLogin ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
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
  const [category, setCategory] = useState('Смайлики');
  const ref = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', bottom: 60, left: 0, right: 0,
      maxWidth: 320, width: 'calc(100vw - 24px)',
      maxHeight: 360,
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 16, boxShadow: 'var(--shadow)', zIndex: 100,
      animation: 'slideUp 0.2s ease', overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', gap: 2, padding: '8px 8px 4px', overflowX: 'auto',
        borderBottom: '1px solid var(--border)'
      }}>
        {Object.keys(EMOJI_CATEGORIES).map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
              background: cat === category ? 'var(--accent-glow)' : 'transparent',
              color: cat === category ? 'var(--accent)' : 'var(--text-secondary)'
            }}>
            {cat}
          </button>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
        padding: 8, maxHeight: 280, overflowY: 'auto'
      }}>
        {EMOJI_CATEGORIES[category].map(emoji => (
          <button key={emoji} onClick={() => { onSelect(emoji); onClose(); }}
            style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 20,
              borderRadius: 8, transition: 'background 0.15s'
            }}
            onMouseOver={e => e.target.style.background = 'var(--bg-hover)'}
            onMouseOut={e => e.target.style.background = 'transparent'}>
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
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // Detect supported mime type
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        let mimeType = '';
        for (const mt of mimeTypes) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
        }

        const options = mimeType ? { mimeType } : {};
        const recorder = new MediaRecorder(stream, options);
        mediaRecorder.current = recorder;
        chunks.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.current.push(e.data);
        };
        
        recorder.start(200);
        timer.current = setInterval(() => {
          durationRef.current += 1;
          setDuration(d => d + 1);
        }, 1000);
      } catch (err) {
        console.error('Voice recorder error:', err);
        if (!cancelled) onCancelRef.current();
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timer.current);
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        try { mediaRecorder.current.stop(); } catch(e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []); // no deps — mount once

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

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flex: 1,
      animation: 'fadeIn 0.2s ease'
    }}>
      <button onClick={handleCancel} style={{
        width: 36, height: 36, borderRadius: '50%', border: 'none',
        background: 'rgba(255,68,102,0.15)', color: 'var(--danger)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0
      }}>✕</button>
      
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
        padding: '8px 12px', background: 'rgba(255,68,102,0.08)',
        borderRadius: 20
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)',
          animation: 'pulse 1.5s infinite', flexShrink: 0
        }} />
        <span style={{ color: 'var(--danger)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {formatDuration(duration)}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Запись...</span>
      </div>
      
      <button onClick={handleSend} style={{
        width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: 'var(--accent)', color: 'var(--bg-primary)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0
      }}>▶</button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── CIRCLE RECORDER (Video Circle) ─────────────────────────────
// ══════════════════════════════════════════════════════════════════
function CircleRecorder({ onSend, onCancel }) {
  const videoRef = useRef();
  const mediaRecorder = useRef(null);
  const chunks = useRef([]);
  const [duration, setDuration] = useState(0);
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
      try {
        // Detect supported mime type
        const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
        let mimeType = '';
        for (const mt of mimeTypes) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
        }

        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } }, 
          audio: true 
        });
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        
        const options = mimeType ? { mimeType } : {};
        const recorder = new MediaRecorder(s, options);
        mediaRecorder.current = recorder;
        chunks.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.current.push(e.data);
        };
        
        recorder.start(200);
        timer.current = setInterval(() => {
          durationRef.current += 1;
          setDuration(d => {
            if (d >= MAX_DURATION - 1) {
              doSend();
              return d;
            }
            return d + 1;
          });
        }, 1000);
      } catch (err) {
        console.error('Circle recorder error:', err);
        if (!cancelled) onCancelRef.current();
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(timer.current);
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        try { mediaRecorder.current.stop(); } catch(e) {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []); // no deps

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

  const progress = (duration / MAX_DURATION) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, animation: 'fadeIn 0.3s ease',
      padding: '20px'
    }}>
      <div style={{ position: 'relative', width: 'min(280px, 70vw)', height: 'min(280px, 70vw)' }}>
        {/* Progress ring */}
        <svg viewBox="0 0 280 280" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="140" cy="140" r="136" fill="none" stroke="var(--border)" strokeWidth="4" />
          <circle cx="140" cy="140" r="136" fill="none" stroke="var(--accent)" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 136}`}
            strokeDashoffset={`${2 * Math.PI * 136 * (1 - progress / 100)}`}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        
        <video ref={videoRef} autoPlay muted playsInline
          style={{
            position: 'absolute', top: '2.8%', left: '2.8%',
            width: '94.4%', height: '94.4%', borderRadius: '50%',
            objectFit: 'cover', background: '#000'
          }} />
      </div>

      <div style={{ marginTop: 20, fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
        {formatDuration(duration)}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
        <button onClick={handleCancel} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: 'rgba(255,68,102,0.2)', color: 'var(--danger)',
          cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>✕</button>
        <button onClick={doSend} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: 'var(--accent)', color: 'var(--bg-primary)',
          cursor: 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>▶</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── VIDEO CALL SCREEN ───────────────────────────────────────────
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
      localStream.current = await navigator.mediaDevices.getUserMedia(constraints);
      if (localRef.current) localRef.current.srcObject = localStream.current;

      const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      pc.current = new RTCPeerConnection(config);

      localStream.current.getTracks().forEach(t => pc.current.addTrack(t, localStream.current));

      pc.current.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        setConnected(true);
        timer.current = setInterval(() => setDuration(d => d + 1), 1000);
      };

      pc.current.onicecandidate = (e) => {
        if (e.candidate) {
          ws.current.send(JSON.stringify({
            type: 'call_ice_candidate', callId, candidate: e.candidate
          }));
        }
      };

      if (isIncoming && offer) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'call_answer', callId, answer }));
      } else {
        const off = await pc.current.createOffer();
        await pc.current.setLocalDescription(off);
        // offer already sent
      }
    })();

    const handleMsg = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'call_answered' && msg.callId === callId) {
        pc.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
      if (msg.type === 'call_ice_candidate' && msg.callId === callId) {
        pc.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
      if ((msg.type === 'call_ended' || msg.type === 'call_rejected') && msg.callId === callId) {
        cleanup();
        onEnd();
      }
    };
    ws.current.addEventListener('message', handleMsg);

    return () => {
      cleanup();
      ws.current.removeEventListener('message', handleMsg);
    };
  }, []);

  const cleanup = () => {
    clearInterval(timer.current);
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if (pc.current) pc.current.close();
  };

  const endCall = () => {
    ws.current.send(JSON.stringify({ type: 'call_end', callId }));
    cleanup();
    onEnd();
  };

  const toggleMute = () => {
    const audioTrack = localStream.current?.getAudioTracks()[0];
    if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setMuted(!muted); }
  };

  const toggleVideo = () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];
    if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setVideoOff(!videoOff); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0f', zIndex: 2000,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      {callType === 'video' ? (
        <>
          <video ref={remoteRef} autoPlay playsInline style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'
          }} />
          <video ref={localRef} autoPlay muted playsInline style={{
            position: 'absolute', top: 20, right: 20, width: 120, height: 160,
            borderRadius: 16, objectFit: 'cover', border: '2px solid var(--border)',
            zIndex: 10
          }} />
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%', background: 'var(--accent-glow)',
            border: '3px solid var(--accent)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', fontSize: 40
          }}>🎧</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{callerName || 'Звонок'}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {connected ? formatDuration(duration) : 'Соединение...'}
          </p>
          <audio ref={remoteRef} autoPlay />
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: 40, display: 'flex', gap: 20, zIndex: 20
      }}>
        <button onClick={toggleMute} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: muted ? 'var(--danger)' : 'rgba(255,255,255,0.15)',
          color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>{muted ? '🔇' : '🎤'}</button>

        {callType === 'video' && (
          <button onClick={toggleVideo} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: videoOff ? 'var(--danger)' : 'rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>{videoOff ? '📷' : '🎥'}</button>
        )}

        <button onClick={endCall} style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--danger)', color: '#fff', fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>📞</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── INCOMING CALL POPUP ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function IncomingCall({ callData, ws, onAccept, onReject }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{
        textAlign: 'center', padding: 40, background: 'var(--bg-secondary)',
        borderRadius: 24, boxShadow: 'var(--shadow)', minWidth: 280
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-glow)',
          border: '3px solid var(--accent)', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, animation: 'recording 2s infinite'
        }}>
          {callData.callType === 'video' ? '🎥' : '📞'}
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Входящий {callData.callType === 'video' ? 'видео' : 'аудио'}звонок</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          {callData.callerName || 'Неизвестный'}
        </p>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
          <button onClick={onReject} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: 'var(--danger)', color: '#fff', cursor: 'pointer',
            fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>✕</button>
          <button onClick={onAccept} style={{
            width: 56, height: 56, borderRadius: '50%', border: 'none',
            background: 'var(--accent)', color: 'var(--bg-primary)', cursor: 'pointer',
            fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                if (playing) { audioRef.current.pause(); }
                else { audioRef.current.play(); }
                setPlaying(!playing);
              }
            }} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: isOwn ? 'rgba(0,212,170,0.3)' : 'var(--bg-hover)',
              color: isOwn ? 'var(--accent)' : 'var(--text-primary)',
              cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>{playing ? '⏸' : '▶'}</button>
            <div style={{ flex: 1 }}>
              <div style={{
                height: 24, display: 'flex', alignItems: 'center', gap: 1
              }}>
                {Array.from({ length: 30 }, (_, i) => (
                  <div key={i} style={{
                    width: 3, borderRadius: 2,
                    height: Math.random() * 18 + 4,
                    background: isOwn ? 'var(--accent)' : 'var(--text-secondary)',
                    opacity: 0.6
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: isOwn ? 'rgba(0,212,170,0.6)' : 'var(--text-muted)' }}>
                {message.duration ? formatDuration(message.duration) : '0:00'}
              </span>
            </div>
            <audio ref={audioRef} src={`${serverUrl}${message.file_url}`}
              onEnded={() => setPlaying(false)} />
          </div>
        );

      case 'circle':
        return (
          <div style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <div style={{ position: 'relative', width: 'min(200px, 50vw)', height: 'min(200px, 50vw)' }}>
              <video
                src={`${serverUrl}${message.file_url}`}
                style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  objectFit: 'cover', border: '3px solid var(--accent)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  const v = e.target;
                  if (v.paused) v.play(); else v.pause();
                }}
                playsInline
              />
              <span style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,0.6)', borderRadius: 8,
                padding: '2px 6px', fontSize: 11, color: '#fff'
              }}>
                {message.duration ? formatDuration(message.duration) : ''}
              </span>
            </div>
          </div>
        );

      case 'image':
        return (
          <img src={`${serverUrl}${message.file_url}`} alt=""
            style={{ maxWidth: 'min(280px, 70vw)', maxHeight: 300, borderRadius: 12, display: 'block' }}
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
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--accent-glow)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18
            }}>📎</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{message.file_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {message.file_size ? `${(message.file_size / 1024).toFixed(1)} KB` : ''}
              </div>
            </div>
          </a>
        );

      case 'emoji':
        return <span style={{ fontSize: 48 }}>{message.content}</span>;

      default:
        return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</span>;
    }
  };

  if (message.type === 'circle') {
    return (
      <div style={{
        display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start',
        padding: '4px 16px', animation: 'fadeIn 0.2s ease'
      }}>
        <div>
          {renderContent()}
          <div style={{ textAlign: isOwn ? 'right' : 'left', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {formatMessageTime(message.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start',
      padding: '2px 16px', animation: 'fadeIn 0.15s ease'
    }}>
      <div style={{
        maxWidth: '75%', padding: message.type === 'emoji' ? '8px 12px' : '10px 14px',
        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: message.type === 'emoji' ? 'transparent' : (isOwn ? 'var(--msg-out)' : 'var(--msg-in)'),
        border: message.type === 'emoji' ? 'none' : `1px solid ${isOwn ? 'rgba(0,212,170,0.15)' : 'var(--border)'}`,
        fontSize: 14, lineHeight: 1.5
      }}>
        {!isOwn && message.sender_name && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 3 }}>
            {message.sender_name}
          </div>
        )}
        {renderContent()}
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ─── CHAT LIST SIDEBAR ───────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
function ChatList({ chats, activeChat, onSelectChat, onNewChat, user }) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length >= 2) {
      const users = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(users);
      setShowSearch(true);
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
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)'
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
          <span style={{ color: 'var(--accent)' }}>P</span>ulse
        </h2>
        <button onClick={onNewChat} style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'var(--accent-glow)', color: 'var(--accent)',
          cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>+</button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 12px' }}>
        <input
          placeholder="Поиск пользователей..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none'
          }}
        />
      </div>

      {/* Search Results */}
      {showSearch && searchResults.length > 0 && (
        <div style={{ padding: '0 12px 8px' }}>
          {searchResults.map(u => (
            <div key={u.id} onClick={() => startChat(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'var(--accent)',
                border: '2px solid var(--accent)'
              }}>
                {u.display_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{u.display_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>@{u.username}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chats.map(chat => {
          const name = chat.type === 'direct' ? chat.other_user?.display_name : chat.name;
          const avatar = chat.type === 'direct' ? chat.other_user?.display_name?.[0] : chat.name?.[0];
          const isOnline = chat.type === 'direct' && chat.other_user?.status === 'online';
          const isActive = activeChat?.id === chat.id;

          return (
            <div key={chat.id} onClick={() => onSelectChat(chat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                cursor: 'pointer', transition: 'background 0.15s',
                background: isActive ? 'var(--bg-active)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent'
              }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-glow), var(--bg-tertiary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: 'var(--accent)',
                  border: '2px solid var(--border)'
                }}>
                  {avatar?.toUpperCase() || '?'}
                </div>
                {isOnline && (
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 14, height: 14, borderRadius: '50%',
                    background: 'var(--accent)', border: '3px solid var(--bg-secondary)'
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || 'Чат'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                    {chat.last_message_at ? formatTime(chat.last_message_at) : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  <span style={{
                    fontSize: 13, color: 'var(--text-secondary)',
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
                      minWidth: 20, height: 20, borderRadius: 10,
                      background: 'var(--accent)', color: 'var(--bg-primary)',
                      fontSize: 11, fontWeight: 700, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', padding: '0 6px'
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

      {/* User Info */}
      <div style={{
        padding: '12px 16px', paddingBottom: 'max(12px, var(--safe-bottom))',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'var(--bg-primary)',
          flexShrink: 0
        }}>
          {user.display_name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.display_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>@{user.username}</div>
        </div>
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

  // Close attach menu on outside click
  useEffect(() => {
    const handleClick = (e) => { 
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttachMenu(false); 
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  // Load messages
  useEffect(() => {
    (async () => {
      const msgs = await api(`/api/chats/${chat.id}/messages`);
      setMessages(msgs);
      setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'auto' }), 100);
    })();
  }, [chat.id]);

  // Listen for new messages
  useEffect(() => {
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'new_message' && msg.chatId === chat.id) {
        setMessages(prev => [...prev, msg.message]);
        setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      if (msg.type === 'typing' && msg.chatId === chat.id) {
        setTyping(prev => ({ ...prev, [msg.userId]: msg.isTyping }));
        if (msg.isTyping) {
          setTimeout(() => setTyping(prev => ({ ...prev, [msg.userId]: false })), 3000);
        }
      }
    };
    ws.current.addEventListener('message', handler);
    return () => ws.current.removeEventListener('message', handler);
  }, [chat.id, ws]);

  const sendMessage = (content, messageType = 'text', extra = {}) => {
    ws.current.send(JSON.stringify({
      type: 'message',
      chatId: chat.id,
      content,
      messageType,
      ...extra
    }));
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
    ws.current.send(JSON.stringify({ type: 'typing', chatId: chat.id, isTyping: true }));
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      ws.current.send(JSON.stringify({ type: 'typing', chatId: chat.id, isTyping: false }));
    }, 2000);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const type = isImage ? 'images' : 'files';
    const data = await uploadFile(type, file);
    sendMessage(file.name, isImage ? 'image' : 'file', {
      fileUrl: data.url,
      fileName: data.filename,
      fileSize: data.size
    });
    setShowAttachMenu(false);
  };

  const handleVoiceSend = async (blob, dur) => {
    setRecording(false);
    const data = await uploadFile('voice', new File([blob], 'voice.webm'));
    sendMessage('Голосовое сообщение', 'voice', { fileUrl: data.url, duration: dur });
  };

  const handleCircleSend = async (blob, dur) => {
    setRecordingCircle(false);
    const data = await uploadFile('circles', new File([blob], 'circle.webm'));
    sendMessage('Кружочек', 'circle', { fileUrl: data.url, duration: dur });
  };

  const typingUsers = Object.entries(typing).filter(([id, t]) => t && id !== user.id);

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)',
      maxHeight: '100dvh', maxHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
        flexShrink: 0, minHeight: 56
      }}>
        <button onClick={onBack} style={{
          width: 32, height: 32, borderRadius: 8,
          border: 'none', background: 'transparent', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>←</button>

        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--accent-glow)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'var(--accent)',
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
        flex: 1, overflowY: 'auto', padding: '12px 0',
        backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(0,212,170,0.02) 0%, transparent 50%)',
        WebkitOverflowScrolling: 'touch'
      }}>
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === user.id} serverUrl={serverUrl} />
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Circle Recorder */}
      {recordingCircle && (
        <CircleRecorder onSend={handleCircleSend} onCancel={() => setRecordingCircle(false)} />
      )}

      {/* Input Area */}
      <div style={{
        padding: '8px 8px', paddingBottom: 'max(8px, var(--safe-bottom))',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)', flexShrink: 0, position: 'relative'
      }}>
        {showEmoji && <EmojiPicker onSelect={e => setText(t => t + e)} onClose={() => setShowEmoji(false)} />}

        {/* Attach menu popup */}
        {showAttachMenu && (
          <div ref={attachRef} style={{
            position: 'absolute', bottom: 56, left: 8,
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
            borderRadius: 12, boxShadow: 'var(--shadow)', zIndex: 50,
            padding: '4px 0', animation: 'slideUp 0.15s ease',
            minWidth: 180
          }}>
            <button onClick={() => { fileInput.current?.click(); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', border: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', textAlign: 'left'
            }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >📎 Файл / Фото</button>
            <button onClick={() => { setRecordingCircle(true); setShowAttachMenu(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 14px', border: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', textAlign: 'left'
            }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >⭕ Кружочек</button>
          </div>
        )}

        <input ref={fileInput} type="file" hidden onChange={handleFile} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {recording ? (
            <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setRecording(false)} />
          ) : (
            <>
              <button onClick={() => setShowEmoji(!showEmoji)} style={inputBtnStyle} title="Эмодзи">😊</button>
              <button onClick={() => setShowAttachMenu(!showAttachMenu)} style={inputBtnStyle} title="Прикрепить">+</button>

              <input
                placeholder="Сообщение..."
                value={text}
                onChange={e => { setText(e.target.value); handleTyping(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 20, minWidth: 0,
                  border: '1px solid var(--border)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none'
                }}
              />

              {text.trim() ? (
                <button onClick={handleSend} style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: 'var(--accent)', color: 'var(--bg-primary)',
                  cursor: 'pointer', fontSize: 16, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>▶</button>
              ) : (
                <button onClick={() => setRecording(true)} style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: 'var(--accent-glow)', color: 'var(--accent)',
                  cursor: 'pointer', fontSize: 18, display: 'flex',
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
  width: 34, height: 34, borderRadius: 10, border: 'none',
  background: 'var(--bg-tertiary)', cursor: 'pointer', fontSize: 15,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0
};

const inputBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', border: 'none',
  background: 'transparent', cursor: 'pointer', fontSize: 18,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0
};

// ══════════════════════════════════════════════════════════════════
// ─── MAIN APP ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [showMobile, setShowMobile] = useState('list'); // 'list' | 'chat'
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  // ─── Init auth ─────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('pulse_token');
    const savedUser = localStorage.getItem('pulse_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
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
        case 'new_message':
          setChats(prev => {
            const chatExists = prev.some(c => c.id === msg.chatId);
            if (!chatExists) {
              // Chat not in list — fetch it from server and add
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
            callId: msg.callId,
            callerId: msg.callerId,
            chatId: msg.chatId,
            callType: msg.callType,
            offer: msg.offer,
            callerName: 'Входящий звонок'
          });
          break;

        case 'call_created':
          // Call offer was sent, waiting for answer
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
    // Reset unread
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
  };

  const handleCall = (callType) => {
    if (!activeChat || activeChat.type !== 'direct') return;
    const targetUserId = activeChat.other_user?.id;
    if (!targetUserId) return;

    // Create offer and send
    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? { facingMode: 'user' } : false
      });
      stream.getTracks().forEach(t => t.stop()); // We'll re-acquire in VideoCall

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const offer = await pc.createOffer();
      pc.close();

      ws.current.send(JSON.stringify({
        type: 'call_offer',
        targetUserId,
        chatId: activeChat.id,
        callType,
        offer
      }));

      // Listen for callId
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'call_created') {
          setActiveCall({
            callId: msg.callId,
            callType,
            isIncoming: false,
            callerName: activeChat.other_user?.display_name
          });
          ws.current.removeEventListener('message', handler);
        }
      };
      ws.current.addEventListener('message', handler);
    })();
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    setActiveCall({
      callId: incomingCall.callId,
      callType: incomingCall.callType,
      isIncoming: true,
      offer: incomingCall.offer,
      callerName: incomingCall.callerName
    });
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    ws.current.send(JSON.stringify({ type: 'call_reject', callId: incomingCall.callId }));
    setIncomingCall(null);
  };

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
          callId={activeCall.callId}
          callType={activeCall.callType}
          isIncoming={activeCall.isIncoming}
          offer={activeCall.offer}
          callerName={activeCall.callerName}
          ws={ws}
          onEnd={() => setActiveCall(null)}
        />
      )}

      {incomingCall && (
        <IncomingCall
          callData={incomingCall}
          ws={ws}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      <div style={{
        height: '100dvh', height: '100vh', display: 'flex',
        maxWidth: 1200, margin: '0 auto', overflow: 'hidden'
      }}>
        {/* Sidebar */}
        <div style={{
          width: showMobile === 'chat' ? 0 : '100%',
          maxWidth: showMobile === 'chat' ? 0 : 360,
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'none'
        }}
          className="sidebar-container"
        >
          <div style={{ width: showMobile === 'chat' ? 360 : '100%', minWidth: 280, height: '100%' }}>
            <ChatList
              chats={chats}
              activeChat={activeChat}
              onSelectChat={handleSelectChat}
              onNewChat={() => {}}
              user={user}
            />
          </div>
        </div>

        {/* Chat */}
        <div style={{
          flex: 1,
          display: showMobile === 'list' && typeof window !== 'undefined' && window.innerWidth <= 768 ? 'none' : 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
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
              flexDirection: 'column', gap: 16
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                border: '2px solid var(--border)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent-glow2)'
              }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', opacity: 0.5 }} />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Выберите чат для начала общения</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
