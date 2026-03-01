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
          <div style={styles.logoMark}>
            <svg viewBox="0 0 214 346" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="m33.29 62.18c3.73-28.09 25-52.9 65.43-52.9 39.09 0 68.97 32.38 68.97 79.43l-0.58-0.17c-12.36-11.18-28.95-17.06-44.93-17.06-21.26 0-35.07 6.46-52.1 19.83 14.24-9.08 27.3-13.2 47.14-13.2 19.5 0 35.72 8.01 52.52 21.55 17.25 2.85 30.25 16.55 31.92 33.74 1.03 10.94-3.94 21.88-12.97 28.62-0.92 3.84-1.85 7.33-2.48 8.89 3.01 0.7 6.74-0.23 8.7-1.79-2.56 4.59-5.8 6.49-9.88 7.14 0.81 5.5 5.89 12.47 13.79 20.36 3.35 3.35 2.02 7.19-2.57 9.53-5.33 2.73-6.79 5.58-3.64 10.4 2.41 3.29 1.32 5.69-2.7 8.36 3.04 2.78 2.55 6.23-1.51 8.02-3.25 1.32-3.89 3.22-3.19 8.04 1.08 6.16 1.43 11.98-7.04 15.17-7.26 2.91-20.85-1.4-25.88-1.4-7.38 0-10.39 2.52-15.1 15.47-7.5 21.78-6.28 35.53 12.77 66.51-15.57 0.53-27.84-6.33-43.01-18.09-14.12-11-32.34-18.52-50.74-13.7l-8.13 4.06c15.68-21.78 29.86-43.56 27.96-68.37-10.26 10.49-15.77 24.19-18.23 42.2-11.27-11.59-9.9-25.19 3.68-37.01l6.37-8.62-17.49 13.63c-10.09 6.87-16.29 8.14-19.54 1.4-5.92-12.16-7.11-20.17-0.91-23.52 7.79-3.35 19.23-1.61 34.29-1.61l0.4-0.58c-19.9-4.59-44.5-11.56-51.82-32.6-8.64-25.85 9.39-56.48 43.97-64.49l8.08-2.23-10.73-0.76c-13-0.4-26.92 4.19-35.95 13.21l-0.4 0.29c-5.14-6.68-7.87-15.14-7.87-27.19 0-23.92 20.54-52.73 65.06-52.03l0.41-0.23c-11.72-4.82-28.97-5.34-42.07 1.09v0.61z" fill="currentColor"/>
            </svg>
          </div>
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
