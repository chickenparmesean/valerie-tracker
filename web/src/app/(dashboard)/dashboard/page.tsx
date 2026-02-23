'use client';

import React, { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import LiveDot from '@/components/ui/LiveDot';
import ProductivityBar from '@/components/ui/ProductivityBar';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';

interface VaEntry {
  userId: string;
  userName: string;
  isTracking: boolean;
  currentProject?: string;
  currentTask?: string;
  elapsedSec?: number;
  activityPct?: number;
  currentApp?: string;
}

export default function DashboardPage() {
  const [vas, setVas] = useState<VaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch from /api/dashboard/live with auth
    // For now, show empty state
    setLoading(false);
  }, []);

  const activeVas = vas.filter((v) => v.isTracking);
  const avgProductivity =
    vas.length > 0
      ? Math.round(vas.reduce((sum, v) => sum + (v.activityPct ?? 0), 0) / vas.length)
      : 0;
  const totalHours =
    vas.reduce((sum, v) => sum + (v.elapsedSec ?? 0), 0) / 3600;

  const formatHours = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your virtual assistants"
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Active VAs" value={activeVas.length} />
        <StatCard label="Avg Productivity" value={`${avgProductivity}%`} />
        <StatCard label="Hours Today" value={totalHours.toFixed(1)} />
        <StatCard label="This Month" value="--" />
      </div>

      {/* VA Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E1DC',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #EDECE8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              fontFamily: '"DM Serif Display", Georgia, serif',
              fontSize: 16,
              margin: 0,
            }}
          >
            Virtual Assistants
          </h3>
        </div>

        {vas.length === 0 ? (
          <EmptyState
            title="No virtual assistants yet"
            description="Register virtual assistants via the API to start tracking their activity."
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F0EFEB' }}>
                <th style={thStyle}>VA</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Hours Today</th>
                <th style={thStyle}>Productivity</th>
                <th style={thStyle}>Current App</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vas.map((va) => (
                <tr key={va.userId} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={va.userName} size={30} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{va.userName}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <LiveDot status={va.isTracking ? 'active' : 'offline'} />
                      <Badge status={va.isTracking ? 'RUNNING' : 'OFFLINE'}>
                        {va.isTracking ? 'Active' : 'Offline'}
                      </Badge>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                    {formatHours(va.elapsedSec ?? 0)}
                  </td>
                  <td style={{ ...tdStyle, width: 140 }}>
                    <ProductivityBar percent={va.activityPct ?? 0} />
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#5C5C6F' }}>
                    {va.currentApp ?? '--'}
                  </td>
                  <td style={tdStyle}>
                    <Link
                      href={`/dashboard/vas/${va.userId}`}
                      style={{
                        fontSize: 12,
                        color: '#B8982A',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 18px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: '#8E8E9A',
  textAlign: 'left',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #EDECE8',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 18px',
  fontSize: 13,
};
