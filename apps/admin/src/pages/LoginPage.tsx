import { useState, FormEvent, useMemo } from 'react';

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good morning', sub: 'Hope your day is going well.' };
  if (h >= 12 && h < 17) return { text: 'Good afternoon', sub: 'Stay focused, you got this.' };
  if (h >= 17 && h < 21) return { text: 'Good evening', sub: 'Wrapping up for the day?' };
  return { text: 'Up late?', sub: 'Take it easy, you deserve rest.' };
}
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const inp: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e8e8e8',
  borderRadius: 4,
  fontSize: 13,
  color: '#111',
  outline: 'none',
  background: '#fff',
};

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { text, sub } = useMemo(() => getGreeting(), []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, rememberMe);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ width: 320 }}>
        {/* Brand */}
        <div style={{ marginBottom: 32 }}>
          <img src="/logo.png" alt="Trackvee" style={{ height: 48, width: 'auto', display: 'block', marginBottom: 20 }} />
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111', lineHeight: 1 }}>{text}</div>
          <div style={{ fontSize: 13, color: '#bbb', marginTop: 5 }}>{sub}</div>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, fontSize: 12, color: '#dc2626' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</div>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inp, paddingRight: 38 }}
                onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
                onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 0, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#888')}
                onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#666', cursor: 'pointer', marginBottom: 20, userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{ accentColor: '#dc2626', cursor: 'pointer', width: 14, height: 14 }}
            />
            Remember me
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: loading ? '#fca5a5' : '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', letterSpacing: 0.2 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
