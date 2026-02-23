import React from 'react';

interface ProductivityBarProps {
  percent: number;
}

export default function ProductivityBar({ percent }: ProductivityBarProps) {
  const color = percent > 85 ? '#2D6A4F' : percent > 70 ? '#B8982A' : '#9B2C2C';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${Math.min(percent, 100)}%`, background: color }} />
      </div>
      <span style={styles.label}>{percent}%</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    flex: 1,
    height: 5,
    background: '#F0EFEB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s',
  },
  label: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#5C5C6F',
    minWidth: 32,
    textAlign: 'right' as const,
  },
};
