import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { BackupService } from '../services/backupService.js';

export function setupBackupHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS, async () => {
    const service = await BackupService.getInstance();
    return service.listSnapshots();
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, async (_e, timestamp: string) => {
    const service = await BackupService.getInstance();
    return service.restoreSnapshot(timestamp);
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, async (_e, timestamp: string) => {
    const service = await BackupService.getInstance();
    return service.deleteSnapshot(timestamp);
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_STATUS, async () => {
    const service = await BackupService.getInstance();
    return service.getStatus();
  });
}
