import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Input({ label, style, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label style={styles.label}>{label}</label>
      )}
      <input
        style={{ ...styles.input, ...style }}
        {...props}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#5C5C6F',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    fontSize: 14,
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    background: '#FFFFFF',
  },
};
