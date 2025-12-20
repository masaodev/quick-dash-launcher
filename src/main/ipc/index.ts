import { BrowserWindow } from 'electron';
import type { WindowPinMode } from '@common/types';

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

export function setupIPCHandlers(
  configFolder: string,
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string,
  getMainWindow: () => BrowserWindow | null,
  setEditMode: (editMode: boolean) => Promise<void>,
  getEditMode: () => boolean,
  getWindowPinMode: () => WindowPinMode,
  cycleWindowPinMode: () => WindowPinMode,
  setModalMode: (
    isModal: boolean,
    requiredSize?: { width: number; height: number }
  ) => Promise<void>,
  setFirstLaunchMode: (isFirstLaunch: boolean) => void
) {
  setupDataHandlers(configFolder);
  setupItemHandlers(getMainWindow, getWindowPinMode);
  setupConfigHandlers(configFolder);
  setupIconHandlers(faviconsFolder, iconsFolder, extensionsFolder, getMainWindow);
  setupWindowHandlers(setEditMode, getEditMode, getWindowPinMode, cycleWindowPinMode, setModalMode);
  registerEditHandlers(configFolder);
  setupSettingsHandlers(setFirstLaunchMode);
  setupSplashHandlers(getMainWindow);
  setupHistoryHandlers(configFolder);
  setupWorkspaceHandlers();
  setupWindowSearchHandlers(getMainWindow, getWindowPinMode);
}
