'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface SidebarProps {
  navItems: NavItem[];
  userName: string;
  userRole: string;
}

const navIcons: Record<string, string> = {
  Dashboard: '\u25A0',
  'Virtual Assistants': '\u25CB',
  Projects: '\u25A1',
  Screenshots: '\u25A3',
  Settings: '\u2699',
};

export default function Sidebar({ navItems, userName, userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoSection}>
        <div style={styles.logoMark}>V</div>
        <div>
          <div style={styles.logoText}>Valerie Tracker</div>
          <div style={styles.roleLabel}>{userRole}</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
            >
              <span style={{
                ...styles.navIcon,
                color: isActive ? '#B8982A' : '#9998A8',
              }}>
                {navIcons[item.label] ?? '\u25CF'}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={styles.userBlock}>
        <div style={styles.avatar}>
          {userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={styles.userName}>{userName}</div>
          <div style={styles.userRole}>{userRole}</div>
        </div>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 240,
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    background: '#1A1A2E',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 18px',
  },
  logoMark: {
    width: 28,
    height: 28,
    background: 'rgba(184,152,42,0.18)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 16,
    color: '#B8982A',
  },
  logoText: {
    fontFamily: '"DM Serif Display", Georgia, serif',
    fontSize: 16,
    color: '#FFFFFF',
  },
  roleLabel: {
    fontSize: 10,
    color: '#9998A8',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  nav: {
    flex: 1,
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 4,
    fontSize: 14,
    color: '#9998A8',
    textDecoration: 'none',
    transition: 'all 0.12s',
  },
  navItemActive: {
    background: '#2E2E50',
    color: '#FFFFFF',
  },
  navIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center' as const,
  },
  userBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 5,
    background: '#F0EFEB',
    border: '1px solid #E2E1DC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: '#1A1A2E',
  },
  userName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#DDDCE4',
  },
  userRole: {
    fontSize: 11,
    color: '#9998A8',
  },
};
