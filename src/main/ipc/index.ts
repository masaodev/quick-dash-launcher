import { BrowserWindow } from 'electron';
import type { WindowPinMode } from '@common/types';

import { setupDataHandlers } from './dataHandlers';
import { setupItemHandlers } from './itemHandlers';
import { setupConfigHandlers } from './configHandlers';
import { setupIconHandlers } from './iconHandlers';
import { setupWindowHandlers } from './windowHandlers';
import { registerEditHandlers } from './editHandlers';
import { setupSettingsHandlers } from './settingsHandlers';

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
  cycleWindowPinMode: () => WindowPinMode
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
    cycleWindowPinMode
  );
  registerEditHandlers(configFolder);
  setupSettingsHandlers();
}
