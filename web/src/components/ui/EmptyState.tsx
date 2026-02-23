import React from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={styles.container}>
      {icon && <div style={styles.icon}>{icon}</div>}
      <h3 style={styles.title}>{title}</h3>
      <p style={styles.description}>{description}</p>
      {action && <div style={styles.action}>{action}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  icon: {
    fontSize: 48,
    opacity: 0.2,
    marginBottom: 16,
  },
  title: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 20,
    fontWeight: 400,
    color: '#1A1A2E',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#8E8E9A',
    maxWidth: 420,
    margin: '0 auto',
    lineHeight: 1.5,
  },
  action: {
    marginTop: 20,
  },
};
