import React from 'react';

interface LiveDotProps {
  status: 'active' | 'idle' | 'offline';
}

const dotColors: Record<string, { bg: string; shadow: string }> = {
  active: { bg: '#2D6A4F', shadow: '0 0 6px #2D6A4F' },
  idle: { bg: '#D4870E', shadow: 'none' },
  offline: { bg: '#8E8E9A', shadow: 'none' },
};

export default function LiveDot({ status }: LiveDotProps) {
  const colors = dotColors[status];
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors.bg,
        boxShadow: colors.shadow,
      }}
    />
  );
}
