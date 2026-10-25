import { IPC_CHANNELS } from '@common/ipcChannels';

import { BackupService } from '../services/backupService.js';
import { handleIpc } from '../utils/ipcWrapper';

export function setupBackupHandlers(): void {
  const getService = () => BackupService.getInstance();

  handleIpc(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS, async () => (await getService()).listSnapshots());

  handleIpc(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).restoreSnapshot(timestamp)
  );

  handleIpc(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, async (_e, timestamp: string) =>
    (await getService()).deleteSnapshot(timestamp)
  );

  handleIpc(IPC_CHANNELS.BACKUP_GET_STATUS, async () => (await getService()).getStatus());
}
