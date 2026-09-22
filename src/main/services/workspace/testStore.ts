/**
 * マネージャーの単体テスト用: 一時フォルダに実ファイルを置いた WorkspaceFileStore を作る
 *
 * pathManager と logger の vi.mock は各テストファイル側で行う（vi.mock はファイル単位で hoist されるため）
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { resetDataFileTrackerForTesting } from '../dataFileTracker';

import { WorkspaceFileStore } from './WorkspaceFileStore';
import { WorkspaceUiStateStore } from './WorkspaceUiStateStore';

export interface TestWorkspaceStore {
  dir: string;
  store: WorkspaceFileStore;
  uiState: WorkspaceUiStateStore;
  /** workspace.json を読む */
  readMain: () => { workspaces: unknown[]; groups: unknown[]; items: unknown[] };
  /** workspace-archive.json を読む */
  readArchive: () => { groups: unknown[]; items: unknown[] };
  cleanup: () => void;
}

/**
 * @param onDirCreated 一時フォルダを作った直後（reload の前）に呼ぶ。pathManager の mock に反映するために使う
 */
export async function createTestWorkspaceStore(
  prefix = 'qdl-ws-',
  onDirCreated?: (dir: string) => void
): Promise<TestWorkspaceStore> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  onDirCreated?.(dir);
  resetDataFileTrackerForTesting();
  const uiState = new WorkspaceUiStateStore(path.join(dir, 'workspace-ui-state.json'));
  const store = new WorkspaceFileStore(
    {
      main: path.join(dir, 'workspace.json'),
      archive: path.join(dir, 'workspace-archive.json'),
      legacyDetached: path.join(dir, 'workspace-detached.json'),
    },
    uiState,
    { createPreMigrationSnapshot: async () => {} }
  );
  await store.reload();
  const readJson = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  return {
    dir,
    store,
    uiState,
    readMain: () => readJson('workspace.json'),
    readArchive: () => readJson('workspace-archive.json'),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
