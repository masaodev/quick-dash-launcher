import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => {
  const pm = {
    getConfigFolder: () => tempRoot.dir,
    getWorkspaceUiStateFilePath: () => path.join(tempRoot.dir, 'workspace-ui-state.json'),
  };
  return { PathManager: pm, default: pm };
});

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  WorkspaceUiStateStore,
  coerceWorkspaceUiState,
  createEmptyWorkspaceUiState,
} from './WorkspaceUiStateStore';

describe('WorkspaceUiStateStore', () => {
  let filePath: string;

  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-ui-state-'));
    filePath = path.join(tempRoot.dir, 'workspace-ui-state.json');
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  it('ファイルが無ければ空の状態を返し、書き込みで作られること', () => {
    const store = new WorkspaceUiStateStore();
    expect(store.exists()).toBe(false);
    expect(store.read()).toEqual(createEmptyWorkspaceUiState());

    store.setGroupsCollapsed(['grAAAAA1'], true);
    expect(store.exists()).toBe(true);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({
      version: 1,
      collapsedGroups: { grAAAAA1: true },
      detachedWindows: {},
    });
  });

  it('折りたたみは true だけ保存し、展開でキーを消すこと', () => {
    const store = new WorkspaceUiStateStore();
    store.setGroupsCollapsed(['a', 'b'], true);
    store.setGroupsCollapsed(['a'], false);
    expect(store.getCollapsedGroups()).toEqual({ b: true });
  });

  it('切り離しウィンドウの状態を部分更新・削除・列挙できること', () => {
    const store = new WorkspaceUiStateStore();
    store.updateDetached('root0001', { pinMode: 1 });
    expect(store.getDetached('root0001')).toEqual({
      collapsedStates: {},
      bounds: { x: 0, y: 0, width: 380, height: 200 },
      pinMode: 1,
    });

    store.updateDetached('root0001', { bounds: { x: 1, y: 2, width: 3, height: 4 } });
    expect(store.getDetached('root0001')?.bounds).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(store.getDetached('root0001')?.pinMode).toBe(1);
    expect(store.listDetachedGroupIds()).toEqual(['root0001']);

    store.removeDetached('root0001');
    expect(store.getDetached('root0001')).toBeNull();
    expect(store.listDetachedGroupIds()).toEqual([]);
  });

  it('pruneMissingGroups は存在しないグループの状態を捨てること', () => {
    const store = new WorkspaceUiStateStore();
    store.setGroupsCollapsed(['keep0001', 'gone0001'], true);
    store.updateDetached('keep0001', { collapsedStates: { keep0001: false, gone0002: true } });
    store.updateDetached('gone0003', {});

    store.pruneMissingGroups(new Set(['keep0001']));

    expect(store.read()).toEqual({
      version: 1,
      collapsedGroups: { keep0001: true },
      detachedWindows: {
        keep0001: {
          collapsedStates: { keep0001: false },
          bounds: { x: 0, y: 0, width: 380, height: 200 },
        },
      },
    });
  });

  it('壊れたファイルはデフォルトで読み、上書きしないこと', () => {
    fs.writeFileSync(filePath, '{ broken', 'utf8');
    const store = new WorkspaceUiStateStore();
    expect(store.read()).toEqual(createEmptyWorkspaceUiState());
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{ broken');
  });

  it('coerceWorkspaceUiState は形の合わない要素だけ捨てること', () => {
    expect(coerceWorkspaceUiState(null)).toBeNull();
    expect(
      coerceWorkspaceUiState({
        version: 1,
        collapsedGroups: { a: true, b: 'yes' },
        detachedWindows: {
          ok: {
            collapsedStates: { x: true },
            bounds: { x: 1, y: 2, width: 3, height: 4 },
            pinMode: 2,
          },
          noBounds: { collapsedStates: {} },
          badBounds: { collapsedStates: {}, bounds: { x: '1', y: 2, width: 3, height: 4 } },
        },
      })
    ).toEqual({
      version: 1,
      collapsedGroups: { a: true },
      detachedWindows: {
        ok: {
          collapsedStates: { x: true },
          bounds: { x: 1, y: 2, width: 3, height: 4 },
          pinMode: 2,
        },
      },
    });
  });
});
