import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
}

export default function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
      {trend && <div style={styles.trend}>{trend}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#FFFFFF',
    border: '1px solid #E2E1DC',
    borderRadius: 5,
    padding: '20px 24px',
  },
  label: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    color: '#8E8E9A',
    marginBottom: 8,
  },
  value: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 24,
    color: '#1A1A2E',
  },
  trend: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    color: '#8E8E9A',
    marginTop: 4,
  },
};
