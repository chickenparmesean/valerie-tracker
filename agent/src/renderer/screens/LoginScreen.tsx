import React, { useState } from 'react';

interface Props {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await window.electronAPI.auth.login(email, password);
    setLoading(false);

    if (result.success) {
      onLogin();
    } else {
      setError(result.error ?? 'Sign in failed');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>V</div>
          <span style={styles.logoText}>Valerie Agent</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: 24,
  },
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    padding: 28,
    width: '100%',
    maxWidth: 320,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    justifyContent: 'center',
  },
  logoMark: {
    width: 28,
    height: 28,
    background: 'rgba(184,152,42,0.18)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Georgia, serif',
    fontWeight: 400,
    fontSize: 16,
    color: '#B8982A',
  },
  logoText: {
    fontFamily: 'Georgia, serif',
    fontSize: 18,
    color: '#1A1A2E',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: '#5C5C6F',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  error: {
    color: '#9B2C2C',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    background: '#1A1A2E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
};
