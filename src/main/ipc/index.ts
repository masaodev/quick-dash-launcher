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

export function setupIPCHandlers(
  configFolder: string,
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string,
  getMainWindow: () => BrowserWindow | null,
  getWindowPinState: () => boolean,
  setWindowPinState: (pinState: boolean) => void,
  setEditMode: (editMode: boolean) => Promise<void>,
  getEditMode: () => boolean,
  getWindowPinMode: () => WindowPinMode,
  cycleWindowPinMode: () => WindowPinMode,
  setModalMode: (
    isModal: boolean,
    requiredSize?: { width: number; height: number }
  ) => Promise<void>
) {
  setupDataHandlers(configFolder);
  setupItemHandlers(getMainWindow);
  setupConfigHandlers(configFolder);
  setupIconHandlers(faviconsFolder, iconsFolder, extensionsFolder, getMainWindow);
  setupWindowHandlers(
    getWindowPinState,
    setWindowPinState,
    setEditMode,
    getEditMode,
    getWindowPinMode,
    cycleWindowPinMode,
    setModalMode
  );
  registerEditHandlers(configFolder);
  setupSettingsHandlers();
  setupSplashHandlers();
  setupHistoryHandlers(configFolder);
}
