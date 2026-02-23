import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: '#1A1A2E', color: '#FFFFFF', border: 'none' },
    secondary: { background: 'transparent', color: '#1A1A2E', border: '1px solid #E2E1DC' },
    danger: { background: '#FDF2F2', color: '#9B2C2C', border: '1px solid #F5C6C6' },
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '10px 20px', fontSize: 14 },
    lg: { padding: '12px 24px', fontSize: 14 },
  };

  return (
    <button
      disabled={disabled || loading}
      style={{
        borderRadius: 4,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        transition: 'opacity 0.15s',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
