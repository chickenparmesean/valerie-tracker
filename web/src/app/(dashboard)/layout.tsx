'use client';

import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In production, fetch user from session/cookies
  // For now, use placeholder
  return (
    <DashboardLayout userName="Admin User" userRole="Client">
      {children}
    </DashboardLayout>
  );
}
