import React, { useState } from 'react';

interface Props {
  error: 'not-configured' | 'key-invalid';
  onRetry: () => void;
}

const ERROR_MESSAGES = {
  'not-configured': {
    title: 'Tracker not configured',
    body: 'No configuration file was found. Contact your administrator to set up this workstation.',
  },
  'key-invalid': {
    title: 'API key is invalid or revoked',
    body: 'The API key for this tracker has been rejected by the server. Contact your administrator.',
  },
};

export default function ErrorScreen({ error, onRetry }: Props) {
  const [retrying, setRetrying] = useState(false);
  const msg = ERROR_MESSAGES[error];

  const handleRetry = async () => {
    setRetrying(true);
    onRetry();
    // The parent App will re-check state after retry
    setTimeout(() => setRetrying(false), 3000);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>V</div>
          <span style={styles.logoText}>Valerie Agent</span>
        </div>

        <div style={styles.iconRow}>
          <div style={styles.errorIcon}>!</div>
        </div>

        <h2 style={styles.title}>{msg.title}</h2>
        <p style={styles.body}>{msg.body}</p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            ...styles.retryBtn,
            opacity: retrying ? 0.6 : 1,
            cursor: retrying ? 'default' : 'pointer',
          }}
        >
          {retrying ? 'Checking...' : 'Retry'}
        </button>
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
    textAlign: 'center',
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
  iconRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIcon: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(155,44,44,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 20,
    color: '#9B2C2C',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1A1A2E',
    margin: '0 0 8px 0',
  },
  body: {
    fontSize: 13,
    color: '#5C5C6F',
    lineHeight: 1.5,
    margin: '0 0 20px 0',
  },
  retryBtn: {
    width: '100%',
    padding: '12px 24px',
    background: '#1A1A2E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
};
