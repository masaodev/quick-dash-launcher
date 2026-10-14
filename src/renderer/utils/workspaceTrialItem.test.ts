import { describe, expect, it } from 'vitest';
import type { RegisterItem, WorkspaceItem } from '@common/types';

import { toTrialWorkspaceItem } from './workspaceTrialItem';

const savedLauncher: WorkspaceItem = {
  id: 'w1',
  type: 'item',
  displayName: '旧名',
  path: 'C:/old.exe',
  args: '--old',
  launcherType: 'app',
  order: 0,
  workspaceId: 'ws1',
  addedAt: 0,
};

const editingBase: RegisterItem = {
  displayName: '新名',
  path: 'https://example.com',
  type: 'url',
  targetTab: 'data.json',
  itemCategory: 'item',
};

describe('toTrialWorkspaceItem', () => {
  it('通常のアイテムは編集中のパス・引数・起動種別で試す', () => {
    const result = toTrialWorkspaceItem(savedLauncher, editingBase);
    expect(result).toMatchObject({
      id: 'w1',
      displayName: '新名',
      path: 'https://example.com',
      launcherType: 'url',
    });
    expect(result.type === 'item' && result.args).toBeUndefined();
  });

  it('クリップボードは取り直していなければ保存済みの中身で試す', () => {
    const saved: WorkspaceItem = {
      id: 'c1',
      type: 'clipboard',
      displayName: 'clip',
      dataFileRef: 'clipboard-data/a.json',
      savedAt: 0,
      formats: ['text'],
      order: 0,
      workspaceId: 'ws1',
      addedAt: 0,
    };
    const result = toTrialWorkspaceItem(saved, {
      ...editingBase,
      itemCategory: 'clipboard',
      clipboardDataRef: undefined,
    });
    expect(result.type === 'clipboard' && result.dataFileRef).toBe('clipboard-data/a.json');
  });

  it('セットは編集中の行と開き方で試す', () => {
    const saved: WorkspaceItem = {
      id: 's1',
      type: 'set',
      displayName: '朝',
      entries: [{ itemId: 'aaaa1111' }],
      order: 0,
      workspaceId: 'ws1',
      addedAt: 0,
    };
    const result = toTrialWorkspaceItem(saved, {
      ...editingBase,
      itemCategory: 'set',
      setEntries: [{ itemId: 'bbbb2222' }, { open: { path: 'C:/a.txt' } }],
      setLaunchMode: 'parallel',
    });
    expect(result).toMatchObject({
      type: 'set',
      entries: [{ itemId: 'bbbb2222' }, { open: { path: 'C:/a.txt' } }],
      launchMode: 'parallel',
    });
  });
});
