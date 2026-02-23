'use client';

import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function VaListPage() {
  return (
    <div>
      <PageHeader
        title="Virtual Assistants"
        subtitle="Manage and monitor your team"
      />
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E1DC',
          borderRadius: 5,
        }}
      >
        <EmptyState
          title="No virtual assistants yet"
          description="Register virtual assistants via the API to start tracking."
        />
      </div>
    </div>
  );
}
