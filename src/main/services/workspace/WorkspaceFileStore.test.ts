import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isValidId } from '@common/utils/jsonParser';
import { FileUtils } from '@common/utils/fileUtils';

const tempRoot = vi.hoisted(() => ({ dir: '' }));

vi.mock('../../config/pathManager.js', () => {
  const pm = {
    getConfigFolder: () => tempRoot.dir,
    getWorkspaceUiStateFilePath: () => path.join(tempRoot.dir, 'workspace-ui-state.json'),
  };
  return { PathManager: pm, default: pm };
});
vi.mock('../../config/pathManager', () => {
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

import { resetDataFileTrackerForTesting } from '../dataFileTracker';

import {
  WorkspaceCorruptedError,
  WorkspaceExternalChangeConflictError,
  WorkspaceFileStore,
  WorkspaceWriteError,
} from './WorkspaceFileStore';
import { WorkspaceUiStateStore } from './WorkspaceUiStateStore';

const NOW = 1_700_000_000_000;

const ws = { id: 'wsAAAAA1', displayName: 'メイン', order: 0, createdAt: 1 };
const group = {
  id: 'grAAAAA1',
  displayName: '開発',
  color: 'primary',
  order: 0,
  createdAt: 1,
  workspaceId: 'wsAAAAA1',
};
const launcher = {
  id: 'itAAAAA1',
  type: 'item',
  displayName: 'GitHub',
  path: 'https://github.com/',
  workspaceId: 'wsAAAAA1',
  groupId: 'grAAAAA1',
  order: 0,
  addedAt: 1,
};

function v2File(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      $schema: './schemas/workspace.schema.json',
      version: '2.0',
      workspaces: [ws],
      groups: [group],
      items: [launcher],
      ...overrides,
    },
    null,
    2
  );
}

const legacyFile = {
  workspaces: [{ id: 'default', displayName: 'デフォルト', order: 0, createdAt: 0 }],
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
  ],
  items: [
    {
      id: '363ec5dd-798c-471e-9f41-373eb0a6a18c',
      displayName: 'Chrome',
      originalName: 'Chrome',
      path: '[ウィンドウ操作: *Chrome]',
      type: 'windowOperation',
      windowX: 1,
      windowY: 2,
      order: 0,
      addedAt: 1,
      groupId: '83a03470-5df2-47ff-a621-6b609edf66f2',
      workspaceId: 'default',
    },
  ],
};

describe('WorkspaceFileStore', () => {
  let paths: { main: string; archive: string; legacyDetached: string };
  let uiState: WorkspaceUiStateStore;
  let snapshotCalls: number;

  function createStore(hooks: { failSnapshot?: boolean } = {}) {
    return new WorkspaceFileStore(paths, uiState, {
      now: () => NOW,
      createPreMigrationSnapshot: async () => {
        snapshotCalls++;
        if (hooks.failSnapshot) throw new Error('snapshot failed');
      },
    });
  }

  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-ws-store-'));
    paths = {
      main: path.join(tempRoot.dir, 'workspace.json'),
      archive: path.join(tempRoot.dir, 'workspace-archive.json'),
      legacyDetached: path.join(tempRoot.dir, 'workspace-detached.json'),
    };
    uiState = new WorkspaceUiStateStore(path.join(tempRoot.dir, 'workspace-ui-state.json'));
    snapshotCalls = 0;
    resetDataFileTrackerForTesting();
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

  it('ファイルが無ければ既定ワークスペース 1 件の空ファイルを作ること', async () => {
    const store = createStore();
    await store.reload();

    expect(fs.existsSync(paths.main)).toBe(true);
    expect(fs.existsSync(paths.archive)).toBe(true);
    const main = readJson(paths.main);
    expect(main.version).toBe('2.0');
    expect(main.workspaces).toHaveLength(1);
    expect(isValidId(main.workspaces[0].id)).toBe(true);
    expect(store.get('items')).toEqual([]);
    expect(store.resolveDefaultWorkspaceId()).toBe(main.workspaces[0].id);

    const { files } = store.consumeLoadReports();
    expect(files.map((f) => f.file)).toEqual(['workspace.json', 'workspace-archive.json']);
    expect(files[0].rewritten).toBe(true);
    // 自分で書いたファイルなので外部変更ではない
    expect(files[0].externallyChanged).toBe(false);
  });

  it('2.0 のファイルを読み、通常アイテムに launcherType を付けること', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();

    const items = store.get('items');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'item', launcherType: 'url' });
    const { files } = store.consumeLoadReports();
    expect(files[0]).toMatchObject({ status: 'ok', accepted: 1, issues: [], rewritten: false });
    // 2 回読んでも「変更あり」にならない
    expect((await store.reload()).changed).toBe(false);
  });

  it('set は実行時フィールド（icon / launcherType）を落として書き、キャッシュを更新すること', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();

    const items = store.get('items');
    items[0].icon = 'data:image/png;base64,AAAA';
    items[0].displayName = 'GitHub 2';
    store.set('items', items);

    const written = readJson(paths.main);
    expect(written.items[0]).toEqual({ ...launcher, displayName: 'GitHub 2' });
    expect(written.items[0]).not.toHaveProperty('icon');
    expect(written.items[0]).not.toHaveProperty('launcherType');
    expect(store.get('items')[0].displayName).toBe('GitHub 2');
  });

  it('update / updateBoth は 1 回の書き込みで複数配列を更新すること', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();

    store.updateBoth((main, archive) => {
      const [item] = main.items;
      main.items = [];
      main.groups = [];
      archive.groups.push({ ...group, archivedAt: 5, originalOrder: 0, itemCount: 1 });
      archive.items.push({ ...item, archivedAt: 5, archivedGroupId: group.id });
    }, 'archive');

    expect(readJson(paths.main).items).toEqual([]);
    expect(readJson(paths.archive).items[0]).toMatchObject({
      id: 'itAAAAA1',
      archivedGroupId: 'grAAAAA1',
    });
    expect(store.archiveStore.get('items')).toHaveLength(1);
    expect(store.allIds()).toEqual(new Set(['wsAAAAA1', 'grAAAAA1', 'itAAAAA1']));
  });

  it('QDL の外で変更されたファイルへの書き込みは拒否すること（楽観ロック）', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();

    // 外部編集
    fs.writeFileSync(paths.main, v2File({ items: [] }), 'utf8');

    expect(() => store.set('workspaces', store.get('workspaces'))).toThrow(
      WorkspaceExternalChangeConflictError
    );
    // ファイルは外部編集のまま
    expect(readJson(paths.main).items).toEqual([]);

    // 再読込すると外部変更として報告され、以後は書ける
    const result = await store.reload();
    expect(result.changed).toBe(true);
    const { files, externallyChanged } = store.consumeLoadReports();
    expect(files[0].externallyChanged).toBe(true);
    expect(externallyChanged).toEqual([{ relativePath: 'workspace.json', content: v2File() }]);
    expect(() => store.set('workspaces', store.get('workspaces'))).not.toThrow();
  });

  it('壊れた JSON は corrupted として報告し、書き込みを全部拒否すること', async () => {
    fs.writeFileSync(paths.main, '{ broken', 'utf8');
    const store = createStore();
    await store.reload();

    expect(store.isCorrupted()).toBe(true);
    const { files } = store.consumeLoadReports();
    expect(files[0].status).toBe('corrupted');
    expect(files[1].status).toBe('unreadable');
    expect(store.get('items')).toEqual([]);
    expect(() => store.set('items', [])).toThrow(WorkspaceCorruptedError);
    expect(() => store.updateArchive(() => {})).toThrow(WorkspaceCorruptedError);
    // 元ファイルは無傷
    expect(fs.readFileSync(paths.main, 'utf8')).toBe('{ broken');
  });

  it('不正な要素は読み込みから外しつつ、書き戻しで末尾に残すこと', async () => {
    const broken = {
      id: 'brokenit',
      type: 'item',
      displayName: 'no path',
      workspaceId: 'wsAAAAA1',
    };
    fs.writeFileSync(paths.main, v2File({ items: [broken, launcher] }), 'utf8');
    const store = createStore();
    await store.reload();

    expect(store.get('items').map((i) => i.id)).toEqual(['itAAAAA1']);
    const { files } = store.consumeLoadReports();
    expect(files[0].issues).toEqual([
      expect.objectContaining({ kind: 'invalid', section: 'items', id: 'brokenit' }),
    ]);
    // 補正（末尾寄せ）で書き戻される
    expect(files[0].rewritten).toBe(true);
    expect(readJson(paths.main).items.map((i: { id: string }) => i.id)).toEqual([
      'itAAAAA1',
      'brokenit',
    ]);

    // 以後の書き込みでも不正要素は消えない
    store.set('items', store.get('items'));
    expect(readJson(paths.main).items.map((i: { id: string }) => i.id)).toEqual([
      'itAAAAA1',
      'brokenit',
    ]);
  });

  it('旧形式（version なし）は _pre-migration を作ってから 2.0 に変換し、UI 状態へ移すこと', async () => {
    fs.writeFileSync(paths.main, JSON.stringify(legacyFile, null, 2), 'utf8');
    fs.writeFileSync(
      paths.legacyDetached,
      JSON.stringify({
        windows: {
          '83a03470-5df2-47ff-a621-6b609edf66f2': {
            collapsedStates: {},
            bounds: { x: 1, y: 2, width: 3, height: 4 },
          },
        },
      }),
      'utf8'
    );
    const store = createStore();
    await store.reload();

    expect(snapshotCalls).toBe(1);
    const main = readJson(paths.main);
    expect(main.version).toBe('2.0');
    expect(main.workspaces[0].id).not.toBe('default');
    expect(isValidId(main.workspaces[0].id)).toBe(true);
    expect(main.items[0]).toMatchObject({ type: 'window', windowTitle: '*Chrome', x: 1, y: 2 });
    expect(main.items[0].groupId).toBe(main.groups[0].id);
    expect(main.groups[0]).not.toHaveProperty('collapsed');
    expect(main.groups[0].color).toBe('primary');

    const ui = uiState.read();
    expect(ui.collapsedGroups).toEqual({ [main.groups[0].id]: true });
    expect(Object.keys(ui.detachedWindows)).toEqual([main.groups[0].id]);
    expect(fs.existsSync(paths.legacyDetached)).toBe(false);

    const { files, externallyChanged } = store.consumeLoadReports();
    expect(files[0].rewritten).toBe(true);
    expect(files[0].issues[0]).toMatchObject({ kind: 'normalized' });
    expect(files[0].issues[0].reason).toContain('2.0');
    // 移行は QDL 自身の書き込みなので外部変更にはならない
    expect(externallyChanged).toEqual([]);

    // 2 回目の読み込みでは移行されない
    await store.reload();
    expect(snapshotCalls).toBe(1);
    expect(store.consumeLoadReports().files[0].issues).toEqual([]);
  });

  it('スナップショットに失敗したら移行せず、元ファイルを無傷で残すこと', async () => {
    const content = JSON.stringify(legacyFile, null, 2);
    fs.writeFileSync(paths.main, content, 'utf8');
    const store = createStore({ failSnapshot: true });
    await store.reload();

    expect(fs.readFileSync(paths.main, 'utf8')).toBe(content);
    expect(store.isCorrupted()).toBe(true);
    const { files } = store.consumeLoadReports();
    expect(files[0].status).toBe('corrupted');
    expect(files[0].error).toContain('変換に失敗');
    expect(() => store.set('items', [])).toThrow(WorkspaceCorruptedError);
  });

  it('存在するのに読めないファイルは unreadable にし、空ファイルで上書きしないこと', async () => {
    // ディレクトリを置いて「存在するが読めない」状態を作る
    fs.mkdirSync(paths.main);
    const store = createStore();
    await store.reload();

    expect(fs.statSync(paths.main).isDirectory()).toBe(true);
    const { files } = store.consumeLoadReports();
    expect(files[0].status).toBe('unreadable');
    expect(store.isCorrupted()).toBe(true);
    expect(() => store.set('items', [])).toThrow(WorkspaceCorruptedError);
  });

  it('main が旧形式で archive が壊れているときは移行せず、main も書き換えないこと', async () => {
    const content = JSON.stringify(legacyFile, null, 2);
    fs.writeFileSync(paths.main, content, 'utf8');
    fs.writeFileSync(paths.archive, '{ broken', 'utf8');
    const store = createStore();
    await store.reload();

    expect(snapshotCalls).toBe(0);
    expect(fs.readFileSync(paths.main, 'utf8')).toBe(content);
    const { files } = store.consumeLoadReports();
    expect(files[0].status).toBe('unreadable');
    expect(files[0].error).toContain('workspace-archive.json');
    expect(files[1].status).toBe('corrupted');
    expect(() => store.set('items', [])).toThrow(WorkspaceCorruptedError);

    // archive を直せば移行が走る
    fs.writeFileSync(paths.archive, '{"groups":[],"items":[]}', 'utf8');
    await store.reload();
    expect(snapshotCalls).toBe(1);
    expect(readJson(paths.main).version).toBe('2.0');
  });

  it('updateBoth は受け取る側を先に書き、2 回目が失敗しても要素が消えないこと', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();

    // archive の書き込みだけ失敗させる
    const original = FileUtils.safeWriteTextFile.bind(FileUtils);
    const spy = vi
      .spyOn(FileUtils, 'safeWriteTextFile')
      .mockImplementation((filePath, content) =>
        filePath === paths.archive ? false : original(filePath, content)
      );
    try {
      // アーカイブ操作: archive（受け取る側）を先に書く → 失敗 → main は無傷
      expect(() =>
        store.updateBoth((main, archive) => {
          const [item] = main.items;
          main.items = [];
          archive.items.push({ ...item, archivedAt: 5, archivedGroupId: group.id });
        }, 'archive')
      ).toThrow(WorkspaceWriteError);
      expect(readJson(paths.main).items).toHaveLength(1);
      expect(store.get('items')).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('外部で書き換えた 2.0 ファイルを reload すると changed になり、外部変更として記録されること', async () => {
    fs.writeFileSync(paths.main, v2File(), 'utf8');
    const store = createStore();
    await store.reload();
    store.consumeLoadReports();

    fs.writeFileSync(
      paths.main,
      v2File({ items: [launcher, { ...launcher, id: undefined, displayName: '追加' }] }),
      'utf8'
    );
    const result = await store.reload();
    expect(result.changed).toBe(true);
    expect(store.get('items')).toHaveLength(2);
    const { files } = store.consumeLoadReports();
    expect(files[0].externallyChanged).toBe(true);
    expect(files[0].issues.map((i) => i.kind)).toEqual(['idAssigned']);
    expect(files[0].rewritten).toBe(true);
  });
});
