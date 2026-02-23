import React, { useState, useEffect } from 'react';
import LoginScreen from './screens/LoginScreen';
import MainScreen from './screens/MainScreen';
import IdleDialog from './screens/IdleDialog';

declare global {
  interface Window {
    electronAPI: {
      auth: {
        login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
        logout: () => Promise<{ success: boolean }>;
        getSession: () => Promise<{ authenticated: boolean }>;
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
    };
  }
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [idlePrompt, setIdlePrompt] = useState<{ idleMinutes: number } | null>(null);

  useEffect(() => {
    window.electronAPI.auth.getSession().then((session) => {
      setAuthenticated(session.authenticated);
      setLoading(false);
    });

    window.electronAPI.onIdlePrompt((data) => {
      setIdlePrompt(data);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#8E8E9A', fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <>
      <MainScreen onLogout={() => setAuthenticated(false)} />
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
