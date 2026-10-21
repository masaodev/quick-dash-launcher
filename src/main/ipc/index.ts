import { BrowserWindow } from 'electron';
import type { WindowPinMode } from '@common/types';

import { LaunchUsageService } from '../services/launchUsageService.js';

import { setupDataHandlers } from './dataHandlers';
import { setupItemHandlers } from './itemHandlers';
import { setupConfigHandlers } from './configHandlers';
import { setupIconHandlers } from './iconHandlers';
import { setupWindowHandlers } from './windowHandlers';
import { registerEditHandlers } from './editHandlers';
import { setupSettingsHandlers } from './settingsHandlers';
import { setupSplashHandlers } from './splashHandlers';
import { setupHistoryHandlers } from './historyHandlers';
import { setupWorkspaceHandlers } from './workspaceHandlers';
import { setupWindowSearchHandlers } from './windowSearchHandlers';
import { setupNotificationHandlers } from './notificationHandlers';
import { setupContextMenuHandlers } from './contextMenuHandlers';
import { setupClipboardHandlers } from './clipboardHandlers';
import { setupBookmarkAutoImportHandlers } from './bookmarkAutoImportHandlers';
import { setupBackupHandlers } from './backupHandlers';

export function setupIPCHandlers(
  configFolder: string,
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string,
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode,
  setWindowPinMode: (mode: WindowPinMode) => void,
  setFirstLaunchMode: (isFirstLaunch: boolean) => void
) {
  LaunchUsageService.initialize(configFolder);
  setupDataHandlers(configFolder);
  setupItemHandlers();
  setupConfigHandlers(configFolder);
  setupIconHandlers(faviconsFolder, iconsFolder, extensionsFolder);
  setupWindowHandlers(getWindowPinMode, setWindowPinMode);
  registerEditHandlers(configFolder);
  setupSettingsHandlers(setFirstLaunchMode);
  setupSplashHandlers(getMainWindow);
  setupHistoryHandlers(configFolder);
  setupWorkspaceHandlers();
  setupWindowSearchHandlers(getMainWindow);
  setupNotificationHandlers();
  setupContextMenuHandlers();
  setupClipboardHandlers();
  setupBookmarkAutoImportHandlers();
  setupBackupHandlers();
}
