import { describe, it, expect, vi } from 'vitest';
import type { AppItem, WorkspaceItem, WorkspaceRefItem } from '@common/types';

vi.mock('../mainI18n.js', () => ({
  mainI18n: { t: (key: string) => key },
}));

import {
  buildMainItemIndex,
  countRefsByItemId,
  isReferenceableAppItem,
  resolveWorkspaceItem,
} from './workspaceRefResolver';

const main: AppItem[] = [
  {
    id: 'Main0001',
    displayName: 'Visual Studio Code',
    path: 'C:\\Code\\Code.exe',
    type: 'app',
    memo: 'メインのメモ',
    sourceFile: 'datafiles/data2.json',
  },
  {
    id: 'Clip0001',
    type: 'clipboard',
    displayName: 'スクショ',
    clipboardDataRef: 'clipboard-data/Clip0001.json',
    savedAt: 1,
    formats: ['image'],
    sourceFile: 'datafiles/data.json',
  },
  {
    displayName: 'a.txt',
    path: 'C:\\docs\\a.txt',
    type: 'file',
    isDirExpanded: true,
    expandedFromId: 'Dir00001',
  },
];

const index = buildMainItemIndex(main, [
  { name: 'メイン', files: ['datafiles/data.json'] },
  { name: '開発', files: ['datafiles/data2.json'] },
]);

function ref(refItemId: string, alias?: string, lastKnownName?: string): WorkspaceRefItem {
  return {
    id: 'Ws000001',
    type: 'ref',
    refItemId,
    displayName: alias ?? lastKnownName ?? '',
    workspaceId: 'W1',
    groupId: 'G1',
    order: 3,
    addedAt: 10,
    ref: { itemId: refItemId, alias, lastKnownName, status: 'missing' },
  };
}

describe('workspaceRefResolver', () => {
  it('参照できるのは id を持つアイテムだけ（展開したもの・ウィンドウ検索の結果は除く）', () => {
    expect(isReferenceableAppItem(main[0])).toBe(true);
    expect(isReferenceableAppItem(main[1])).toBe(true);
    expect(isReferenceableAppItem(main[2])).toBe(false);
    expect(index.byId.has('Main0001')).toBe(true);
    expect(index.folderImportIds.has('Dir00001')).toBe(true);
  });

  it('見つかった参照は指す先の種別の形になり、id・所属はワークスペース、メモはメインのもの', () => {
    const resolved = resolveWorkspaceItem(ref('Main0001'), index);
    expect(resolved).toMatchObject({
      id: 'Ws000001',
      type: 'item',
      displayName: 'Visual Studio Code',
      path: 'C:\\Code\\Code.exe',
      launcherType: 'app',
      memo: 'メインのメモ',
      workspaceId: 'W1',
      groupId: 'G1',
      order: 3,
      ref: {
        itemId: 'Main0001',
        status: 'ok',
        mainDisplayName: 'Visual Studio Code',
        tabName: '開発',
      },
    });
  });

  it('ワークスペースでの表示名があればそれを出す', () => {
    expect(resolveWorkspaceItem(ref('Main0001', 'VSC'), index).displayName).toBe('VSC');
  });

  it('クリップボードはメインの実データを指す（複製しない）', () => {
    expect(resolveWorkspaceItem(ref('Clip0001'), index)).toMatchObject({
      type: 'clipboard',
      dataFileRef: 'clipboard-data/Clip0001.json',
    });
  });

  it('見つからない参照は ref のまま、表示名は最後に見た名前、フォルダ取込は unsupported', () => {
    expect(resolveWorkspaceItem(ref('Gone0001', undefined, '旧ツール'), index)).toMatchObject({
      type: 'ref',
      displayName: '旧ツール',
      ref: { status: 'missing' },
    });
    expect(resolveWorkspaceItem(ref('Gone0001'), index).displayName).toBe(
      'workspace.ref.unknownName'
    );
    expect(resolveWorkspaceItem(ref('Dir00001'), index).ref?.status).toBe('unsupported');
    expect(resolveWorkspaceItem(ref('Main0001'), null).ref?.status).toBe('missing');
  });

  it('アーカイブの情報は引き継ぐ', () => {
    const archived = { ...ref('Main0001'), archivedAt: 5, archivedGroupId: 'AG1' };
    expect(resolveWorkspaceItem(archived, index)).toMatchObject({
      archivedAt: 5,
      archivedGroupId: 'AG1',
    });
  });

  it('参照でないアイテムはそのまま返し、参照の数を指す先ごとに数える', () => {
    const copy = {
      id: 'X',
      type: 'set',
      displayName: 's',
      entries: [],
    } as unknown as WorkspaceItem;
    expect(resolveWorkspaceItem(copy, index)).toBe(copy);
    const counts = countRefsByItemId([ref('Main0001'), ref('Main0001'), ref('Gone0001'), copy]);
    expect(Object.fromEntries(counts)).toEqual({ Main0001: 2, Gone0001: 1 });
  });
});
