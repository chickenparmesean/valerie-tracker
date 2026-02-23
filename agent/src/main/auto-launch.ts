import { app } from 'electron';
import { execSync } from 'child_process';

export function enableAutoLaunch(): void {
  try {
    const exePath = app.getPath('exe');
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieTracker" /t REG_SZ /d "${exePath}" /f`,
      { windowsHide: true }
    );
  } catch (err) {
    console.error('Failed to enable auto-launch:', err);
  }
}

export function disableAutoLaunch(): void {
  try {
    execSync(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieTracker" /f',
      { windowsHide: true }
    );
  } catch {
    // Key might not exist
  }
}
