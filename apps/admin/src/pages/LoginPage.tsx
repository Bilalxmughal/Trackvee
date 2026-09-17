import { useState, FormEvent } from 'react';
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

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fff',
    }}>
      <div style={{ width: 320 }}>
        {/* Brand */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', letterSpacing: -1 }}>YoTrack</div>
          <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>Admin Portal</div>
        </div>

        {error && (
          <div style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 4,
            fontSize: 12,
            color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
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

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</div>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inp}
              onFocus={e => (e.currentTarget.style.borderColor = '#dc2626')}
              onBlur={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: loading ? '#fca5a5' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: 0.2,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
