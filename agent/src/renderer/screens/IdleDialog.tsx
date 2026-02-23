import React from 'react';

interface Props {
  idleMinutes: number;
  onRespond: (choice: 'keep' | 'discard-resume' | 'discard-stop') => void;
}

export default function IdleDialog({ idleMinutes, onRespond }: Props) {
  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        <h3 style={styles.title}>
          You&apos;ve been idle for {idleMinutes} minutes
        </h3>
        <p style={styles.subtitle}>What would you like to do?</p>

        <div style={styles.buttons}>
          <button
            onClick={() => onRespond('keep')}
            style={{ ...styles.btn, ...styles.btnPrimary }}
          >
            Keep Time &amp; Resume
          </button>
          <button
            onClick={() => onRespond('discard-resume')}
            style={{ ...styles.btn, ...styles.btnSecondary }}
          >
            Discard Idle Time &amp; Resume
          </button>
          <button
            onClick={() => onRespond('discard-stop')}
            style={{ ...styles.btn, ...styles.btnDanger }}
          >
            Discard &amp; Stop Timer
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dialog: {
    background: '#FFFFFF',
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    padding: 28,
    width: 320,
    textAlign: 'center',
  },
  title: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#5C5C6F',
    marginBottom: 20,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  btn: {
    padding: '10px 16px',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    border: 'none',
  },
  btnPrimary: {
    background: '#1A1A2E',
    color: '#FFFFFF',
  },
  btnSecondary: {
    background: '#FFFFFF',
    color: '#1A1A2E',
    border: '1px solid #E2E1DC',
  },
  btnDanger: {
    background: '#FDF2F2',
    color: '#9B2C2C',
    border: '1px solid #F5C6C6',
  },
};
