import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { BackupService } from '../services/backupService.js';

export function setupBackupHandlers(): void {
  const getService = () => BackupService.getInstance();

  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS, async () =>
    (await getService()).listSnapshots()
  );

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).restoreSnapshot(timestamp)
  );

  ipcMain.handle(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).deleteSnapshot(timestamp)
  );

  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_STATUS, async () => (await getService()).getStatus());
}
