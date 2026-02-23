'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12"
        style={{
          background: '#1A1A2E',
          backgroundImage: `
            repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 50px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 50px),
            radial-gradient(circle at top right, rgba(184,152,42,0.08), transparent 70%)
          `,
        }}
      >
        <div className="max-w-sm text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div
              className="w-8 h-8 flex items-center justify-center"
              style={{
                background: 'rgba(184,152,42,0.18)',
                borderRadius: 4,
                fontFamily: '"DM Serif Display", Georgia, serif',
                fontSize: 18,
                color: '#B8982A',
              }}
            >
              V
            </div>
            <span
              style={{
                fontFamily: '"DM Serif Display", Georgia, serif',
                fontSize: 22,
                color: '#FFFFFF',
              }}
            >
              Valerie Tracker
            </span>
          </div>
          <p style={{ color: '#9998A8', fontSize: 14, lineHeight: 1.6 }}>
            Real-time activity monitoring and time tracking for virtual assistants.
            See productivity, screenshots, and hours -- all in one dashboard.
          </p>
          <div className="flex justify-center gap-8 mt-8">
            <div className="text-center">
              <div className="font-mono text-lg" style={{ color: '#B8982A' }}>99.9%</div>
              <div style={{ color: '#9998A8', fontSize: 11 }}>Uptime</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg" style={{ color: '#B8982A' }}>60s</div>
              <div style={{ color: '#9998A8', fontSize: 11 }}>Sync Interval</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-lg" style={{ color: '#B8982A' }}>256-bit</div>
              <div style={{ color: '#9998A8', fontSize: 11 }}>Encryption</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8" style={{ background: '#F6F5F2' }}>
        <div className="w-full max-w-sm">
          <h1
            className="mb-2"
            style={{
              fontFamily: '"DM Serif Display", Georgia, serif',
              fontSize: 26,
              color: '#1A1A2E',
            }}
          >
            Sign In
          </h1>
          <p className="mb-8" style={{ color: '#8E8E9A', fontSize: 14 }}>
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                className="block mb-1.5"
                style={{ fontSize: 12, fontWeight: 600, color: '#5C5C6F' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                style={{
                  padding: '11px 14px',
                  fontSize: 14,
                  border: '1px solid #E2E1DC',
                  borderRadius: 4,
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
            </div>

            <div className="mb-6">
              <label
                className="block mb-1.5"
                style={{ fontSize: 12, fontWeight: 600, color: '#5C5C6F' }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                style={{
                  padding: '11px 14px',
                  fontSize: 14,
                  border: '1px solid #E2E1DC',
                  borderRadius: 4,
                  outline: 'none',
                  background: '#FFFFFF',
                }}
              />
            </div>

            {error && (
              <p className="mb-4" style={{ color: '#9B2C2C', fontSize: 13 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                padding: '12px 24px',
                background: '#1A1A2E',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
