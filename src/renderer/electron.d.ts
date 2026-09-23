import type { ElectronAPI } from '@common/types/electronApi';

export type { ElectronAPI };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
