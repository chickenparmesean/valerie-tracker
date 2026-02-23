import { Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import { getTimerState, startTimer, stopTimer } from './timer';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let tooltipInterval: ReturnType<typeof setInterval> | null = null;

function createTrayIcon(active: boolean): Electron.NativeImage {
  // Create a simple 16x16 colored square icon programmatically
  const size = 16;
  const color = active ? '#2D6A4F' : '#8E8E9A';
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = r;
    buffer[i * 4 + 1] = g;
    buffer[i * 4 + 2] = b;
    buffer[i * 4 + 3] = 255;
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

export function createTray(win: BrowserWindow): void {
  mainWindow = win;
  tray = new Tray(createTrayIcon(false));
  tray.setToolTip('Valerie Tracker — Not tracking');
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Update tooltip every second
  tooltipInterval = setInterval(() => {
    const state = getTimerState();
    if (state.isRunning) {
      const h = Math.floor(state.elapsedSec / 3600);
      const m = Math.floor((state.elapsedSec % 3600) / 60);
      const s = state.elapsedSec % 60;
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      tray?.setToolTip(`Valerie Tracker — ${time}`);
      tray?.setImage(createTrayIcon(true));
    } else {
      tray?.setToolTip('Valerie Tracker — Not tracking');
      tray?.setImage(createTrayIcon(false));
    }
  }, 1000);
}

export function updateTrayMenu(): void {
  if (!tray) return;

  const state = getTimerState();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: state.isRunning ? `Tracking: ${state.projectId ?? 'Unknown'}` : 'Not tracking',
      enabled: false,
    },
    {
      label: state.isRunning
        ? `Elapsed: ${formatElapsed(state.elapsedSec)}`
        : '',
      enabled: false,
      visible: state.isRunning,
    },
    { type: 'separator' },
    {
      label: state.isRunning ? 'Stop Timer' : 'Start Timer',
      click: () => {
        if (state.isRunning) {
          stopTimer();
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Quit',
      click: () => {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        mainWindow?.destroy();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function destroyTray(): void {
  if (tooltipInterval) {
    clearInterval(tooltipInterval);
    tooltipInterval = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
