'use client';

import React from 'react';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userName: string;
  userRole: string;
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Virtual Assistants', href: '/dashboard/vas', icon: 'vas' },
  { label: 'Projects', href: '/dashboard/projects', icon: 'projects' },
  { label: 'Screenshots', href: '/dashboard/screenshots', icon: 'screenshots' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
];

export default function DashboardLayout({ children, userName, userRole }: DashboardLayoutProps) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar navItems={navItems} userName={userName} userRole={userRole} />
      <main style={styles.main}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    marginLeft: 240,
    flex: 1,
    background: '#F6F5F2',
    minHeight: '100vh',
    padding: '24px 28px',
  },
};
