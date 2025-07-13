import { BrowserWindow } from 'electron';

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
  getEditMode: () => boolean
) {
  setupDataHandlers(configFolder);
  setupItemHandlers(getMainWindow);
  setupConfigHandlers(configFolder);
  setupIconHandlers(faviconsFolder, iconsFolder, extensionsFolder);
  setupWindowHandlers(getWindowPinState, setWindowPinState, setEditMode, getEditMode);
  registerEditHandlers(configFolder);
  setupSettingsHandlers();
}
