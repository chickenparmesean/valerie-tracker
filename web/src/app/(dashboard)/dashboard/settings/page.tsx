'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SettingsPage() {
  const [screenshotFreq, setScreenshotFreq] = useState(1);
  const [idleTimeout, setIdleTimeout] = useState(5);
  const [trackApps, setTrackApps] = useState(true);
  const [trackUrls, setTrackUrls] = useState(true);
  const [blurScreenshots, setBlurScreenshots] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // In production: PATCH to org settings endpoint
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Organization monitoring settings" />

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
          {/* Screenshot frequency */}
          <div>
            <label style={labelStyle}>Screenshot Frequency</label>
            <p style={descStyle}>Number of screenshots per 10-minute interval</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setScreenshotFreq(n)}
                  style={{
                    padding: '8px 20px',
                    border: `1px solid ${screenshotFreq === n ? '#B8982A' : '#E2E1DC'}`,
                    borderRadius: 4,
                    background: screenshotFreq === n ? '#F8F4E6' : '#FFFFFF',
                    color: screenshotFreq === n ? '#B8982A' : '#5C5C6F',
                    fontWeight: screenshotFreq === n ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Idle timeout */}
          <div>
            <label style={labelStyle}>Idle Timeout (minutes)</label>
            <p style={descStyle}>How long before showing idle prompt</p>
            <input
              type="number"
              min={1}
              max={30}
              value={idleTimeout}
              onChange={(e) => setIdleTimeout(parseInt(e.target.value, 10))}
              style={{
                padding: '11px 14px',
                fontSize: 14,
                border: '1px solid #E2E1DC',
                borderRadius: 4,
                outline: 'none',
                width: 120,
                fontFamily: "'JetBrains Mono', monospace",
                marginTop: 8,
              }}
            />
          </div>

          {/* Toggles */}
          <div>
            <label style={labelStyle}>Tracking Options</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={trackApps}
                  onChange={(e) => setTrackApps(e.target.checked)}
                />
                <span>Track application names</span>
              </label>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={trackUrls}
                  onChange={(e) => setTrackUrls(e.target.checked)}
                />
                <span>Track window titles / URLs</span>
              </label>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={blurScreenshots}
                  onChange={(e) => setBlurScreenshots(e.target.checked)}
                />
                <span>Blur screenshots</span>
              </label>
            </div>
          </div>

          <Button onClick={handleSave} loading={saving} style={{ alignSelf: 'flex-start' }}>
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#1A1A2E',
  display: 'block',
};

const descStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8E8E9A',
  marginTop: 2,
};

const toggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#5C5C6F',
  cursor: 'pointer',
};
