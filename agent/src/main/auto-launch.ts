import { app } from 'electron';
import { execSync } from 'child_process';

export function enableAutoLaunch(): void {
  const exePath = app.getPath('exe');

  // Try HKLM first (machine-wide, persists across user profiles in golden images)
  try {
    execSync(
      `reg add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieAgent" /t REG_SZ /d "${exePath}" /f`,
      { windowsHide: true }
    );
    console.log('[AutoLaunch] HKLM Run key set');

    // Clean up old HKCU key if it exists
    try {
      execSync(
        'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieAgent" /f',
        { windowsHide: true }
      );
      console.log('[AutoLaunch] Cleaned up old HKCU key');
    } catch {
      // HKCU key didn't exist, that's fine
    }
    return;
  } catch {
    console.log('[AutoLaunch] HKLM write failed (not elevated), falling back to HKCU');
  }

  // Fallback to HKCU (per-user, works without elevation)
  try {
    execSync(
      `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieAgent" /t REG_SZ /d "${exePath}" /f`,
      { windowsHide: true }
    );
    console.log('[AutoLaunch] HKCU Run key set (fallback)');
  } catch (err) {
    console.error('[AutoLaunch] Failed to set Run key:', err);
  }
}

export function disableAutoLaunch(): void {
  // Remove from both hives
  try {
    execSync(
      'reg delete "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieAgent" /f',
      { windowsHide: true }
    );
  } catch {
    // May not have elevation or key may not exist
  }
  try {
    execSync(
      'reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "ValerieAgent" /f',
      { windowsHide: true }
    );
  } catch {
    // Key might not exist
  }
}
