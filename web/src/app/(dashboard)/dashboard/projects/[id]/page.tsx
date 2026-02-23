'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';

export default function ProjectDetailPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/dashboard/projects"
          style={{ fontSize: 12, color: '#B8982A', textDecoration: 'none' }}
        >
          Projects
        </Link>
        <span style={{ fontSize: 12, color: '#8E8E9A', margin: '0 6px' }}>/</span>
        <span style={{ fontSize: 12, color: '#5C5C6F' }}>Project Detail</span>
      </div>

      <PageHeader title="Project Detail" subtitle="Manage tasks and view time entries" />

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
            Tasks
          </div>
          <p style={{ color: '#8E8E9A', fontSize: 13 }}>No tasks yet. Add tasks above.</p>
        </Card>

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
            Time Entries
          </div>
          <p style={{ color: '#8E8E9A', fontSize: 13 }}>No time entries for this project yet.</p>
        </Card>
      </div>
    </div>
  );
}
