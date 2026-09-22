import { describe, it, expect } from 'vitest';
import { isValidId } from '@common/utils/jsonParser';
import {
  createWorkspaceParseContext,
  parseWorkspaceArchiveFileLenient,
  parseWorkspaceFileLenient,
} from '@common/utils/workspaceParser';

import { isLegacyWorkspaceFile, migrateGroupColor, migrateWorkspaceV1 } from './workspaceMigration';

const NOW = 1_700_000_000_000;

/** dev2 実データに近い v1 の workspace.json */
const legacyMain = {
  items: [
    {
      id: '363ec5dd-798c-471e-9f41-373eb0a6a18c',
      displayName: 'エクスプローラー',
      originalName: 'エクスプローラー',
      path: 'explorer.exe',
      type: 'app',
      args: 'C:\\',
      order: 0,
      addedAt: 1,
      groupId: '83a03470-5df2-47ff-a621-6b609edf66f2',
      workspaceId: 'default',
      label: 'legacy',
      icon: 'data:image/png;base64,AAAA',
    },
    {
      id: 'f1e2d3c4-0000-0000-0000-000000000001',
      displayName: 'Chrome を左へ',
      originalName: 'Chrome',
      path: '[ウィンドウ操作: *Google Chrome]',
      type: 'windowOperation',
      processName: 'chrome.exe',
      windowX: 0,
      windowY: 0,
      windowWidth: 1280,
      windowHeight: 1400,
      activateWindow: true,
      order: 1,
      addedAt: 1,
      groupId: '83a03470-5df2-47ff-a621-6b609edf66f2',
      workspaceId: 'default',
    },
    {
      id: 'f1e2d3c4-0000-0000-0000-000000000002',
      displayName: 'プロセス名だけ',
      originalName: 'x',
      path: '[ウィンドウ操作: ]',
      type: 'windowOperation',
      processName: 'notepad.exe',
      order: 2,
      addedAt: 1,
      workspaceId: 'default',
    },
    {
      id: 'f1e2d3c4-0000-0000-0000-000000000003',
      displayName: '朝のセット',
      originalName: '朝のセット',
      path: '[グループ: 2件]',
      type: 'group',
      itemNames: ['GitHub', 'メモ帳'],
      order: 3,
      addedAt: 1,
      workspaceId: 'default',
    },
    {
      id: 'f1e2d3c4-0000-0000-0000-000000000004',
      displayName: 'クリップ',
      originalName: 'クリップ',
      path: '[クリップボード: hello...]',
      type: 'clipboard',
      clipboardDataRef: 'clipboard-data/abc.json',
      clipboardFormats: ['text'],
      clipboardSavedAt: 5,
      memo: 'めも',
      order: 4,
      addedAt: 1,
      workspaceId: 'default',
    },
    {
      id: 'f1e2d3c4-0000-0000-0000-000000000005',
      displayName: '配置',
      originalName: '配置',
      path: '[レイアウト: 1件]',
      type: 'layout',
      layoutEntries: [{ windowTitle: 'a', launchApp: false, icon: 'data:image/png;base64,BBBB' }],
      order: 5,
      addedAt: 1,
      workspaceId: 'default',
    },
  ],
  groups: [
    {
      id: '83a03470-5df2-47ff-a621-6b609edf66f2',
      displayName: '開発',
      color: 'var(--color-primary)',
      order: 0,
      collapsed: true,
      createdAt: 1,
      workspaceId: 'default',
    },
    {
      id: '9b9b9b9b-0000-0000-0000-000000000001',
      name: '古い名前フィールド',
      color: '#00897b',
      order: 1,
      collapsed: false,
      createdAt: 1,
      parentGroupId: '83a03470-5df2-47ff-a621-6b609edf66f2',
      workspaceId: 'default',
    },
  ],
  workspaces: [{ id: 'default', displayName: 'デフォルト', order: 0, createdAt: 0 }],
};

const legacyArchive = {
  groups: [
    {
      id: 'arch-group-0000-0000-000000000001',
      displayName: '昔の',
      color: '#ff5722',
      order: 0,
      collapsed: false,
      createdAt: 1,
      workspaceId: 'default',
      archivedAt: 9,
      originalOrder: 2,
      itemCount: 1,
    },
  ],
  items: [
    {
      id: 'arch-item-0000-0000-000000000001',
      displayName: 'Old',
      originalName: 'Old',
      path: 'https://old.example.com/',
      type: 'url',
      order: 0,
      addedAt: 1,
      groupId: 'arch-group-0000-0000-000000000001',
      workspaceId: 'default',
      archivedAt: 9,
      archivedGroupId: 'arch-group-0000-0000-000000000001',
    },
  ],
};

const legacyDetached = {
  windows: {
    '83a03470-5df2-47ff-a621-6b609edf66f2': {
      collapsedStates: {
        '83a03470-5df2-47ff-a621-6b609edf66f2': false,
        '9b9b9b9b-0000-0000-0000-000000000001': true,
      },
      bounds: { x: 10, y: 20, width: 300, height: 400 },
      pinMode: 1,
    },
    'missing-group': { collapsedStates: {}, bounds: { x: 0, y: 0, width: 1, height: 1 } },
  },
};

describe('workspaceMigration: 判定', () => {
  it('version を持たないオブジェクトを旧形式と判定すること', () => {
    expect(isLegacyWorkspaceFile(legacyMain)).toBe(true);
    expect(isLegacyWorkspaceFile({ version: '2.0', items: [] })).toBe(false);
    expect(isLegacyWorkspaceFile(null)).toBe(false);
    expect(isLegacyWorkspaceFile([])).toBe(false);
  });
});

describe('workspaceMigration: 色', () => {
  it('CSS 変数名・パレット hex・トークン・任意 hex を変換すること', () => {
    expect(migrateGroupColor('var(--color-success)', 0)).toBe('success');
    expect(migrateGroupColor('#00897b', 0)).toBe('teal');
    expect(migrateGroupColor('#FF5722', 0)).toBe('orange');
    expect(migrateGroupColor('purple', 0)).toBe('purple');
    expect(migrateGroupColor('#123456', 0)).toBe('#123456');
    expect(migrateGroupColor(undefined, 1)).toBe('teal');
    expect(migrateGroupColor('rgb(1,2,3)', 2)).toBe('secondary');
  });
});

describe('workspaceMigration: v1 → 2.0', () => {
  const result = migrateWorkspaceV1(
    { main: legacyMain, archive: legacyArchive, detached: legacyDetached },
    { now: NOW }
  );
  const main = result.main as {
    workspaces: Array<Record<string, unknown>>;
    groups: Array<Record<string, unknown>>;
    items: Array<Record<string, unknown>>;
  };
  const byName = (name: string) => main.items.find((i) => i.displayName === name)!;

  it('全 id を 8 文字英数字に採番し直し、idMap に旧→新を残すこと', () => {
    const ids = [
      ...main.workspaces.map((w) => w.id),
      ...main.groups.map((g) => g.id),
      ...main.items.map((i) => i.id),
    ];
    expect(ids.every((id) => isValidId(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(result.idMap.get('default')).toBe(main.workspaces[0].id);
    expect(result.idMap.get('83a03470-5df2-47ff-a621-6b609edf66f2')).toBe(main.groups[0].id);
  });

  it('参照（workspaceId / groupId / parentGroupId）を新 id に追随させること', () => {
    const wsId = main.workspaces[0].id;
    const devGroupId = main.groups[0].id;
    expect(main.groups.every((g) => g.workspaceId === wsId)).toBe(true);
    expect(main.items.every((i) => i.workspaceId === wsId)).toBe(true);
    expect(main.groups[1].parentGroupId).toBe(devGroupId);
    expect(byName('エクスプローラー').groupId).toBe(devGroupId);
  });

  it('判定済み type を item に畳み、originalName / label / icon を落とすこと', () => {
    const item = byName('エクスプローラー');
    expect(item).toMatchObject({ type: 'item', path: 'explorer.exe', args: 'C:\\' });
    expect(item).not.toHaveProperty('originalName');
    expect(item).not.toHaveProperty('label');
    expect(item).not.toHaveProperty('icon');
  });

  it('windowOperation を window にし、path の疑似文字列から windowTitle を取り出すこと', () => {
    const item = byName('Chrome を左へ');
    expect(item).toMatchObject({
      type: 'window',
      windowTitle: '*Google Chrome',
      processName: 'chrome.exe',
      x: 0,
      y: 0,
      width: 1280,
      height: 1400,
      activateWindow: true,
    });
    expect(item).not.toHaveProperty('path');
    expect(item).not.toHaveProperty('windowX');
  });

  it('タイトル空でプロセス名だけのウィンドウ操作は windowTitle を "*" にすること', () => {
    expect(byName('プロセス名だけ')).toMatchObject({ type: 'window', windowTitle: '*' });
  });

  it('group / clipboard / layout のフィールド名をデータファイルに揃えること', () => {
    expect(byName('朝のセット')).toMatchObject({ type: 'group', itemNames: ['GitHub', 'メモ帳'] });
    expect(byName('クリップ')).toMatchObject({
      type: 'clipboard',
      dataFileRef: 'clipboard-data/abc.json',
      formats: ['text'],
      savedAt: 5,
      memo: 'めも',
    });
    const layout = byName('配置');
    expect(layout.type).toBe('layout');
    expect(layout.entries).toEqual([{ windowTitle: 'a', launchApp: false }]);
    expect(layout).not.toHaveProperty('layoutEntries');
  });

  it('groups: name → displayName、color をトークンに、collapsed を UI 状態へ移すこと', () => {
    expect(main.groups[0]).toMatchObject({ displayName: '開発', color: 'primary' });
    expect(main.groups[1]).toMatchObject({ displayName: '古い名前フィールド', color: 'teal' });
    expect(main.groups[0]).not.toHaveProperty('collapsed');
    expect(result.uiState.collapsedGroups).toEqual({ [main.groups[0].id as string]: true });
  });

  it('archive の id・参照も同じ名前空間で変換すること', () => {
    const archive = result.archive as {
      groups: Array<Record<string, unknown>>;
      items: Array<Record<string, unknown>>;
    };
    expect(isValidId(archive.groups[0].id)).toBe(true);
    expect(archive.groups[0]).toMatchObject({
      color: 'orange',
      archivedAt: 9,
      originalOrder: 2,
      itemCount: 1,
    });
    expect(archive.items[0]).toMatchObject({
      type: 'item',
      path: 'https://old.example.com/',
      archivedAt: 9,
      archivedGroupId: archive.groups[0].id,
      groupId: archive.groups[0].id,
      workspaceId: main.workspaces[0].id,
    });
  });

  it('detached を UI 状態に取り込み、キーを新 id に、main に無いルートは捨てること', () => {
    const devGroupId = main.groups[0].id as string;
    const subGroupId = main.groups[1].id as string;
    expect(Object.keys(result.uiState.detachedWindows)).toEqual([devGroupId]);
    expect(result.uiState.detachedWindows[devGroupId]).toEqual({
      collapsedStates: { [devGroupId]: false, [subGroupId]: true },
      bounds: { x: 10, y: 20, width: 300, height: 400 },
      pinMode: 1,
    });
  });

  it('変換結果は寛容パースを問題なしで通ること', () => {
    const ctx = createWorkspaceParseContext(NOW);
    const parsedMain = parseWorkspaceFileLenient(JSON.stringify(result.main), ctx);
    expect(parsedMain.issues).toEqual([]);
    expect(parsedMain.data.items).toHaveLength(6);
    const parsedArchive = parseWorkspaceArchiveFileLenient(JSON.stringify(result.archive), ctx);
    expect(parsedArchive.issues).toEqual([]);
    expect(parsedArchive.data.items).toHaveLength(1);
  });
});

describe('workspaceMigration: 端のケース', () => {
  it('workspaces が無いさらに古い形式は既定ワークスペースを作って全部そこに入れること', () => {
    const result = migrateWorkspaceV1(
      {
        main: {
          items: [
            { id: 'x', displayName: 'a', path: 'C:\\a.exe', type: 'file', order: 0, addedAt: 1 },
          ],
          groups: [
            { id: 'g', displayName: 'g', color: 'x', order: 0, collapsed: false, createdAt: 1 },
          ],
        },
      },
      { now: NOW }
    );
    const main = result.main as {
      workspaces: Array<Record<string, unknown>>;
      groups: Array<Record<string, unknown>>;
      items: Array<Record<string, unknown>>;
    };
    expect(main.workspaces).toHaveLength(1);
    expect(main.workspaces[0]).toMatchObject({ displayName: 'デフォルト', createdAt: NOW });
    expect(main.groups[0].workspaceId).toBe(main.workspaces[0].id);
    expect(main.items[0].workspaceId).toBe(main.workspaces[0].id);
    expect(result.idMap.get('default')).toBe(main.workspaces[0].id);
  });

  it('既に 8 文字形式の id は据え置き、reservedIds と衝突するものは採番し直すこと', () => {
    const result = migrateWorkspaceV1(
      {
        main: {
          workspaces: [{ id: 'wsAAAAA1', displayName: 'a', order: 0, createdAt: 1 }],
          groups: [],
          items: [
            {
              id: 'usedID01',
              displayName: 'a',
              path: 'C:\\a',
              type: 'file',
              order: 0,
              addedAt: 1,
              workspaceId: 'wsAAAAA1',
            },
          ],
        },
      },
      { now: NOW, reservedIds: new Set(['usedID01']) }
    );
    const main = result.main as {
      workspaces: Array<Record<string, unknown>>;
      items: Array<Record<string, unknown>>;
    };
    expect(main.workspaces[0].id).toBe('wsAAAAA1');
    expect(main.items[0].id).not.toBe('usedID01');
  });

  it('未知の type は path があれば item に、無ければ生のまま残すこと', () => {
    const result = migrateWorkspaceV1(
      {
        main: {
          workspaces: [{ id: 'wsAAAAA1', displayName: 'a', order: 0, createdAt: 1 }],
          groups: [],
          items: [
            {
              id: 'a',
              displayName: 'a',
              path: 'C:\\a',
              type: 'mystery',
              order: 0,
              addedAt: 1,
              workspaceId: 'wsAAAAA1',
            },
            {
              id: 'b',
              displayName: 'b',
              type: 'mystery',
              order: 1,
              addedAt: 1,
              workspaceId: 'wsAAAAA1',
            },
          ],
        },
      },
      { now: NOW }
    );
    const main = result.main as { items: Array<Record<string, unknown>> };
    expect(main.items[0].type).toBe('item');
    expect(main.items[1].type).toBe('mystery');
  });
});
