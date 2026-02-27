import { autoUpdater } from 'electron-updater';
import { Notification } from 'electron';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
let checkInterval: ReturnType<typeof setInterval> | null = null;

export function initAutoUpdater(): void {
  // Install silently when the user naturally quits/restarts — never force-quit mid-work
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoDownload = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Update available: v${info.version}`);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
    // Show OS-level notification via tray — do NOT force restart
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Valerie Tracker',
        body: 'Update ready \u2014 will install on next restart',
      });
      notification.show();
    }
  });

  autoUpdater.on('error', (err) => {
    console.log(`[AutoUpdater] Error: ${err.message}`);
    // Non-fatal — swallow the error, don't crash
  });

  // Initial check
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log(`[AutoUpdater] Initial check failed: ${err.message}`);
  });

  // Recurring check every 4 hours
  checkInterval = setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log(`[AutoUpdater] Scheduled check failed: ${err.message}`);
    });
  }, CHECK_INTERVAL_MS);
}

/** Trigger a manual update check (e.g. from tray menu) */
export function checkForUpdatesManually(): void {
  console.log('[AutoUpdater] Manual check triggered');
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.log(`[AutoUpdater] Manual check failed: ${err.message}`);
  });
}

export function stopAutoUpdater(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}
