'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LiveDot from '@/components/ui/LiveDot';
import Link from 'next/link';

export default function VaDetailPage() {
  // In production: fetch VA data from API using params.id
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/dashboard/vas"
          style={{ fontSize: 12, color: '#B8982A', textDecoration: 'none' }}
        >
          Virtual Assistants
        </Link>
        <span style={{ fontSize: 12, color: '#8E8E9A', margin: '0 6px' }}>/</span>
        <span style={{ fontSize: 12, color: '#5C5C6F' }}>VA Detail</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 5,
            background: '#F0EFEB',
            border: '1px solid #E2E1DC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          VA
        </div>
        <div>
          <h1 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 22, margin: 0 }}>
            Virtual Assistant
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <LiveDot status="offline" />
            <Badge status="OFFLINE">Offline</Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Today's Hours" value="0h" />
        <StatCard label="Productivity" value="--" />
        <StatCard label="Active Time" value="--" />
        <StatCard label="Current App" value="--" />
        <StatCard label="This Month" value="0h" />
      </div>

      {/* Two-column: Activity + Screenshots */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: '#8E8E9A',
              marginBottom: 12,
            }}
          >
            Hourly Activity
          </div>
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#8E8E9A', fontSize: 13 }}>No activity data yet</p>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                color: '#8E8E9A',
              }}
            >
              Recent Screenshots
            </div>
            <Link
              href="#"
              style={{ fontSize: 11, color: '#B8982A', textDecoration: 'none', fontWeight: 500 }}
            >
              View Full Gallery
            </Link>
          </div>
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#8E8E9A', fontSize: 13 }}>No screenshots yet</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
