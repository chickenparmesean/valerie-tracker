import React from 'react';

interface AvatarProps {
  name: string;
  size?: number;
}

export default function Avatar({ name, size = 34 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        background: '#F0EFEB',
        border: '1px solid #E2E1DC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 600,
        color: '#1A1A2E',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
