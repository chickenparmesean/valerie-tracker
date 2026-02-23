'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';

export default function ScreenshotGalleryPage() {
  const [view, setView] = useState<'grid' | 'timeline'>('grid');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // In production: fetch screenshots from API

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
        <span style={{ fontSize: 12, color: '#5C5C6F' }}>Screenshots</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: '#B8982A',
              marginBottom: 4,
            }}
          >
            Activity Screenshots
          </div>
          <h1 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 20, margin: 0 }}>
            Screenshot Gallery
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              padding: '7px 12px',
              borderRadius: 4,
              border: '1px solid #E2E1DC',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', border: '1px solid #E2E1DC', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => setView('grid')}
              style={{
                padding: '6px 14px',
                fontSize: 11,
                border: 'none',
                borderRight: '1px solid #E2E1DC',
                cursor: 'pointer',
                background: view === 'grid' ? '#F8F4E6' : '#FFFFFF',
                color: view === 'grid' ? '#B8982A' : '#8E8E9A',
                fontWeight: view === 'grid' ? 600 : 400,
              }}
            >
              Grid
            </button>
            <button
              onClick={() => setView('timeline')}
              style={{
                padding: '6px 14px',
                fontSize: 11,
                border: 'none',
                cursor: 'pointer',
                background: view === 'timeline' ? '#F8F4E6' : '#FFFFFF',
                color: view === 'timeline' ? '#B8982A' : '#8E8E9A',
                fontWeight: view === 'timeline' ? 600 : 400,
              }}
            >
              Timeline
            </button>
          </div>
        </div>
      </div>

      <Card>
        <EmptyState
          title="No screenshots for this date"
          description="Screenshots are captured automatically when the VA is tracking time."
        />
      </Card>
    </div>
  );
}
