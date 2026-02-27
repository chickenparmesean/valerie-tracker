import React, { useState, useEffect } from 'react';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import IdleDialog from './screens/IdleDialog';
import ErrorScreen from './screens/ErrorScreen';

declare global {
  interface Window {
    electronAPI: {
      auth: {
        login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
        logout: () => Promise<{ success: boolean }>;
        getSession: () => Promise<{
          authenticated: boolean;
          mode: 'dev' | 'normal';
          error?: 'not-configured' | 'key-invalid' | null;
        }>;
      };
      timer: {
        start: (projectId: string, taskId?: string) => Promise<{ success: boolean }>;
        stop: () => Promise<{ success: boolean }>;
        getStatus: () => Promise<{
          isRunning: boolean;
          projectId: string | null;
          taskId: string | null;
          elapsedSec: number;
          activeSec: number;
          idleSec: number;
        }>;
      };
      projects: {
        list: () => Promise<Array<{
          id: string;
          name: string;
          color?: string;
          requireTask: boolean;
          tasks: Array<{ id: string; title: string; status: string }>;
        }>>;
      };
      config: {
        retry: () => Promise<{ status: string; error?: string | null }>;
        getState: () => Promise<{ ready: boolean; error?: string | null; mode: string }>;
      };
      time: {
        getTodayTotal: () => Promise<number>;
      };
      tasks: {
        create: (projectId: string, title: string) => Promise<{ success: boolean; error?: string; task?: unknown }>;
      };
      app: {
        minimize: () => Promise<void>;
        quit: () => Promise<void>;
        getVersion: () => Promise<string>;
      };
      idle: {
        respond: (choice: 'keep' | 'discard-resume' | 'discard-stop') => void;
      };
      onTimerUpdate: (callback: (data: {
        elapsedSec: number;
        isRunning: boolean;
        activityPct: number;
      }) => void) => void;
      onTimerStopped: (callback: () => void) => void;
      onIdlePrompt: (callback: (data: { idleMinutes: number }) => void) => void;
      onScreenshotCaptured: (callback: () => void) => void;
      onConfigReady: (callback: () => void) => void;
      onConfigError: (callback: (error: string) => void) => void;
    };
  }
}

type AppScreen = 'loading' | 'login' | 'main' | 'error';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [mode, setMode] = useState<'dev' | 'normal'>('normal');
  const [errorType, setErrorType] = useState<'not-configured' | 'key-invalid'>('not-configured');
  const [idlePrompt, setIdlePrompt] = useState<{ idleMinutes: number } | null>(null);

  useEffect(() => {
    // Check initial session state
    window.electronAPI.auth.getSession().then((session) => {
      setMode(session.mode);

      if (session.error) {
        setErrorType(session.error);
        setScreen('error');
      } else if (session.authenticated) {
        setScreen('main');
      } else if (session.mode === 'dev') {
        setScreen('login');
      } else {
        // Normal mode, not authenticated yet — wait for config events
        setScreen('loading');
      }
    });

    // Listen for config events from main process
    window.electronAPI.onConfigReady(() => {
      setScreen('main');
    });

    window.electronAPI.onConfigError((error) => {
      setErrorType(error as 'not-configured' | 'key-invalid');
      setScreen('error');
    });

    window.electronAPI.onIdlePrompt((data) => {
      setIdlePrompt(data);
    });
  }, []);

  const handleRetry = async () => {
    setScreen('loading');
    const result = await window.electronAPI.config.retry();
    if (result.status === 'ready') {
      setScreen('main');
    } else {
      setErrorType((result.error as 'not-configured' | 'key-invalid') ?? 'not-configured');
      setScreen('error');
    }
  };

  if (screen === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#8E8E9A', fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (screen === 'error') {
    return <ErrorScreen error={errorType} onRetry={handleRetry} />;
  }

  if (screen === 'login') {
    return <LoginScreen onLogin={() => setScreen('main')} />;
  }

  return (
    <>
      <MainScreen onLogout={() => setScreen(mode === 'dev' ? 'login' : 'loading')} />
      {idlePrompt && (
        <IdleDialog
          idleMinutes={idlePrompt.idleMinutes}
          onRespond={(choice) => {
            window.electronAPI.idle.respond(choice);
            setIdlePrompt(null);
          }}
        />
      )}
    </>
  );
}
