import React, { useState, useEffect, useRef } from 'react';

interface Project {
  id: string;
  name: string;
  color?: string;
  requireTask: boolean;
  tasks: Array<{ id: string; title: string; status: string }>;
}

interface TimerUpdate {
  elapsedSec: number;
  isRunning: boolean;
  activityPct: number;
}

interface Props {
  onLogout: () => void;
}

export default function MainScreen({ onLogout }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [timerData, setTimerData] = useState<TimerUpdate>({
    elapsedSec: 0,
    isRunning: false,
    activityPct: 0,
  });
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [todayTotalSec, setTodayTotalSec] = useState<number | null>(null);
  const [addingTaskForProject, setAddingTaskForProject] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const addTaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
    fetchTodayTotal();

    window.electronAPI.onTimerUpdate((data) => {
      setTimerData(data as TimerUpdate);
    });

    window.electronAPI.onTimerStopped(() => {
      setTimerData({ elapsedSec: 0, isRunning: false, activityPct: 0 });
      setActiveProject(null);
      setActiveTask(null);
      fetchTodayTotal();
    });

    window.electronAPI.onScreenshotCaptured(() => {
      // Could show a brief indicator
    });

    // Get initial timer status
    window.electronAPI.timer.getStatus().then((status) => {
      if (status.isRunning) {
        setTimerData({
          elapsedSec: status.elapsedSec,
          isRunning: true,
          activityPct: 0,
        });
        setActiveProject(status.projectId);
        setActiveTask(status.taskId);
      }
    });

    // Poll today total every 30 seconds
    const todayInterval = setInterval(fetchTodayTotal, 30_000);
    return () => clearInterval(todayInterval);
  }, []);

  // Focus the add-task input when it appears
  useEffect(() => {
    if (addingTaskForProject && addTaskInputRef.current) {
      addTaskInputRef.current.focus();
    }
  }, [addingTaskForProject]);

  const loadProjects = async () => {
    try {
      const list = await window.electronAPI.projects.list();
      setProjects(list);
    } catch {
      // Projects will remain empty
    }
  };

  const fetchTodayTotal = async () => {
    try {
      const totalSec = await window.electronAPI.time.getTodayTotal();
      setTodayTotalSec(totalSec);
    } catch {
      setTodayTotalSec(null);
    }
  };

  const handlePlay = async (projectId: string, taskId?: string) => {
    await window.electronAPI.timer.start(projectId, taskId);
    setActiveProject(projectId);
    setActiveTask(taskId ?? null);
    fetchTodayTotal();
  };

  const handleStop = async () => {
    await window.electronAPI.timer.stop();
    fetchTodayTotal();
  };

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    onLogout();
  };

  const formatTime = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')} : ${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
  };

  const formatTodayTotal = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `Today: ${h}h ${m}m`;
  };

  const getProjectName = (): string => {
    if (!activeProject) return '';
    const p = projects.find((p) => p.id === activeProject);
    if (!p) return '';
    if (activeTask) {
      const t = p.tasks.find((t) => t.id === activeTask);
      return t ? t.title : p.name;
    }
    return p.name;
  };

  const handleAddTask = async (projectId: string) => {
    const title = newTaskTitle.trim();
    if (!title) return;
    try {
      await window.electronAPI.tasks.create(projectId, title);
      setAddingTaskForProject(null);
      setNewTaskTitle('');
      await loadProjects();
    } catch {
      // Silently fail — task stays in input for retry
    }
  };

  const cancelAddTask = () => {
    setAddingTaskForProject(null);
    setNewTaskTitle('');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <svg viewBox="0 0 214 346" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="m33.29 62.18c3.73-28.09 25-52.9 65.43-52.9 39.09 0 68.97 32.38 68.97 79.43l-0.58-0.17c-12.36-11.18-28.95-17.06-44.93-17.06-21.26 0-35.07 6.46-52.1 19.83 14.24-9.08 27.3-13.2 47.14-13.2 19.5 0 35.72 8.01 52.52 21.55 17.25 2.85 30.25 16.55 31.92 33.74 1.03 10.94-3.94 21.88-12.97 28.62-0.92 3.84-1.85 7.33-2.48 8.89 3.01 0.7 6.74-0.23 8.7-1.79-2.56 4.59-5.8 6.49-9.88 7.14 0.81 5.5 5.89 12.47 13.79 20.36 3.35 3.35 2.02 7.19-2.57 9.53-5.33 2.73-6.79 5.58-3.64 10.4 2.41 3.29 1.32 5.69-2.7 8.36 3.04 2.78 2.55 6.23-1.51 8.02-3.25 1.32-3.89 3.22-3.19 8.04 1.08 6.16 1.43 11.98-7.04 15.17-7.26 2.91-20.85-1.4-25.88-1.4-7.38 0-10.39 2.52-15.1 15.47-7.5 21.78-6.28 35.53 12.77 66.51-15.57 0.53-27.84-6.33-43.01-18.09-14.12-11-32.34-18.52-50.74-13.7l-8.13 4.06c15.68-21.78 29.86-43.56 27.96-68.37-10.26 10.49-15.77 24.19-18.23 42.2-11.27-11.59-9.9-25.19 3.68-37.01l6.37-8.62-17.49 13.63c-10.09 6.87-16.29 8.14-19.54 1.4-5.92-12.16-7.11-20.17-0.91-23.52 7.79-3.35 19.23-1.61 34.29-1.61l0.4-0.58c-19.9-4.59-44.5-11.56-51.82-32.6-8.64-25.85 9.39-56.48 43.97-64.49l8.08-2.23-10.73-0.76c-13-0.4-26.92 4.19-35.95 13.21l-0.4 0.29c-5.14-6.68-7.87-15.14-7.87-27.19 0-23.92 20.54-52.73 65.06-52.03l0.41-0.23c-11.72-4.82-28.97-5.34-42.07 1.09v0.61z" fill="currentColor"/>
            </svg>
          </div>
          <span style={styles.logoText}>Valerie Agent</span>
        </div>
      </div>

      {/* Projects */}
      <div style={styles.projectList}>
        {projects.map((project) => (
          <div key={project.id}>
            <div style={styles.projectRow}>
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                style={styles.expandBtn}
              >
                {expanded[project.id] ? '\u25BC' : '\u25B6'}
              </button>
              <span style={styles.projectName}>{project.name}</span>
              {!project.requireTask && (
                <button
                  onClick={() => handlePlay(project.id)}
                  style={styles.playBtn}
                  title="Start tracking"
                >
                  {'\u25B6'}
                </button>
              )}
            </div>
            {expanded[project.id] && project.tasks.map((task) => (
              <div key={task.id} style={styles.taskRow}>
                <span style={styles.taskName}>{task.title}</span>
                <button
                  onClick={() => handlePlay(project.id, task.id)}
                  style={styles.playBtn}
                  title="Start tracking"
                >
                  {'\u25B6'}
                </button>
              </div>
            ))}
            {expanded[project.id] && (
              addingTaskForProject === project.id ? (
                <div style={styles.taskRow}>
                  <input
                    ref={addTaskInputRef}
                    type="text"
                    placeholder="Task name..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTask(project.id);
                      if (e.key === 'Escape') cancelAddTask();
                    }}
                    onBlur={() => {
                      if (!newTaskTitle.trim()) cancelAddTask();
                    }}
                    style={styles.addTaskInput}
                  />
                  <button
                    onClick={() => handleAddTask(project.id)}
                    style={styles.addTaskConfirmBtn}
                    title="Add task"
                  >
                    {'\u2713'}
                  </button>
                </div>
              ) : (
                <div
                  style={styles.addTaskRow}
                  onClick={() => setAddingTaskForProject(project.id)}
                >
                  <span style={styles.addTaskText}>+ Add task</span>
                </div>
              )
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <p style={styles.emptyText}>No projects yet. Create projects in the dashboard.</p>
        )}
      </div>

      {/* Timer */}
      <div style={styles.timerSection}>
        <div style={styles.statusRow}>
          <div
            style={{
              ...styles.statusDot,
              background: timerData.isRunning ? '#2D6A4F' : '#8E8E9A',
              boxShadow: timerData.isRunning ? '0 0 6px #2D6A4F' : 'none',
            }}
          />
          <span style={styles.statusText}>
            {timerData.isRunning ? `Working \u2014 ${getProjectName()}` : 'Not tracking'}
          </span>
        </div>

        <div style={styles.timerDisplay}>
          {formatTime(timerData.elapsedSec)}
        </div>

        {timerData.isRunning && (
          <button onClick={handleStop} style={styles.stopBtn}>
            STOP
          </button>
        )}
      </div>

      {/* Note */}
      {timerData.isRunning && (
        <div style={styles.noteSection}>
          <input
            type="text"
            placeholder="+ Add note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.noteInput}
          />
        </div>
      )}

      {/* Today Total */}
      <div style={styles.todaySection}>
        <span style={styles.todayText}>
          {todayTotalSec !== null ? formatTodayTotal(todayTotalSec) : 'Today: --'}
        </span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#F8F7F5',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #E2E1DC',
    background: '#1A1A2E',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 22,
    height: 22,
    background: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 600,
    color: '#FFFFFF',
  },
  logoText: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: 600,
    fontSize: 15,
    color: '#FFFFFF',
  },
  projectList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  projectRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    gap: 8,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 10,
    color: '#8E8E9A',
    padding: 4,
  },
  projectName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
  },
  playBtn: {
    background: 'none',
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 10,
    color: '#2D6A4F',
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 16px 6px 44px',
    gap: 8,
  },
  taskName: {
    flex: 1,
    fontSize: 13,
    color: '#5C5C6F',
  },
  addTaskRow: {
    padding: '6px 16px 6px 44px',
    cursor: 'pointer',
  },
  addTaskText: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: '#8E8E9A',
  },
  addTaskInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: 13,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    outline: 'none',
  },
  addTaskConfirmBtn: {
    background: 'none',
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 14,
    color: '#2D6A4F',
  },
  emptyText: {
    textAlign: 'center',
    color: '#8E8E9A',
    fontSize: 13,
    padding: 24,
  },
  timerSection: {
    borderTop: '1px solid #E2E1DC',
    padding: '16px 20px',
    background: '#FFFFFF',
    textAlign: 'center',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 13,
    color: '#5C5C6F',
  },
  timerDisplay: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 16,
    fontWeight: 300,
    letterSpacing: 2,
    marginBottom: 12,
  },
  stopBtn: {
    background: '#1A1A2E',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 4,
    padding: '10px 32px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    marginBottom: 12,
  },
  noteSection: {
    borderTop: '1px solid #E2E1DC',
    padding: '10px 16px',
    background: '#FFFFFF',
  },
  noteInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid #E2E1DC',
    borderRadius: 4,
    outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  todaySection: {
    borderTop: '1px solid #E2E1DC',
    padding: '10px 16px',
    background: '#F8F7F5',
    textAlign: 'center',
  },
  todayText: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 13,
    color: '#8E8E9A',
  },
};
