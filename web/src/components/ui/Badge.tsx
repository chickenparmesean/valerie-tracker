import React from 'react';

interface BadgeProps {
  status: string;
  children: React.ReactNode;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE: { bg: '#EBF5F0', text: '#2D6A4F', border: '#C6E0D4' },
  RUNNING: { bg: '#EBF5F0', text: '#2D6A4F', border: '#C6E0D4' },
  ONLINE: { bg: '#EBF5F0', text: '#2D6A4F', border: '#C6E0D4' },
  STOPPED: { bg: '#F0EFEB', text: '#8E8E9A', border: '#E2E1DC' },
  IDLE_PAUSED: { bg: '#FEF9EC', text: '#92710A', border: '#F0E2A8' },
  IDLE: { bg: '#FEF9EC', text: '#92710A', border: '#F0E2A8' },
  PENDING: { bg: '#FEF9EC', text: '#92710A', border: '#F0E2A8' },
  OPEN: { bg: '#EFF6FF', text: '#2563EB', border: 'rgba(37,99,235,0.25)' },
  IN_PROGRESS: { bg: '#EFF6FF', text: '#2563EB', border: 'rgba(37,99,235,0.25)' },
  COMPLETED: { bg: '#EBF5F0', text: '#2D6A4F', border: '#C6E0D4' },
  ARCHIVED: { bg: '#F0EFEB', text: '#8E8E9A', border: '#E2E1DC' },
  OFFLINE: { bg: '#FDF2F2', text: '#9B2C2C', border: '#F5C6C6' },
  DEACTIVATED: { bg: '#F0EFEB', text: '#8E8E9A', border: '#E2E1DC' },
};

export default function Badge({ status, children }: BadgeProps) {
  const colors = statusColors[status] ?? statusColors.STOPPED;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        fontSize: 10,
        fontWeight: 600,
        borderRadius: 3,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {children}
    </span>
  );
}
