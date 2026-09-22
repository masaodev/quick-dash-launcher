/**
 * workspaceParser.ts のテスト
 * ワークスペース設定ファイル（2.0）の寛容パース・参照解決・シリアライズの検証
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyWorkspaceFile,
  createWorkspaceParseContext,
  parseWorkspaceArchiveFileLenient,
  parseWorkspaceFileLenient,
  serializeWorkspaceArchiveFile,
  serializeWorkspaceFile,
} from '@common/utils/workspaceParser';
import { isValidId } from '@common/utils/jsonParser';
import {
  JSON_WORKSPACE_VERSION,
  WORKSPACE_ARCHIVE_SCHEMA_REF,
  WORKSPACE_SCHEMA_REF,
} from '@common/types';

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
const windowItem = {
  id: 'itAAAAA2',
  type: 'window',
  displayName: 'Chrome',
  windowTitle: '*Chrome',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  workspaceId: 'wsAAAAA1',
  order: 1,
  addedAt: 1,
};

function file(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    $schema: WORKSPACE_SCHEMA_REF,
    version: JSON_WORKSPACE_VERSION,
    workspaces: [ws],
    groups: [group],
    items: [launcher, windowItem],
    ...overrides,
  });
}

describe('workspaceParser: 正常系', () => {
  it('完全なファイルは問題なし・未変更として返し、キー順を揃えること', () => {
    const result = parseWorkspaceFileLenient(file(), createWorkspaceParseContext(NOW));

    expect(result.issues).toEqual([]);
    expect(result.modified).toBe(false);
    expect(result.data.workspaces).toEqual([ws]);
    expect(result.data.groups).toEqual([group]);
    expect(result.data.items).toHaveLength(2);
    expect(Object.keys(result.data.items[0])).toEqual([
      'id',
      'type',
      'displayName',
      'path',
      'workspaceId',
      'groupId',
      'order',
      'addedAt',
    ]);
    expect(result.invalid).toEqual({ workspaces: [], groups: [], items: [] });
  });

  it('パースとシリアライズがラウンドトリップすること', () => {
    const ctx = createWorkspaceParseContext(NOW);
    const first = parseWorkspaceFileLenient(file(), ctx);
    const serialized = serializeWorkspaceFile(first.data, first.invalid);
    const second = parseWorkspaceFileLenient(serialized, createWorkspaceParseContext(NOW));

    expect(second.modified).toBe(false);
    expect(second.data).toEqual(first.data);
    expect(serialized.startsWith('{\n  "$schema": ')).toBe(true);
  });

  it('createEmptyWorkspaceFile は既定ワークスペース 1 件を持ち、パースで問題なしになること', () => {
    const empty = createEmptyWorkspaceFile('wsAAAAA9', NOW);
    const result = parseWorkspaceFileLenient(
      serializeWorkspaceFile(empty),
      createWorkspaceParseContext(NOW)
    );
    expect(result.issues).toEqual([]);
    expect(result.data).toEqual(empty);
  });
});

describe('workspaceParser: 構造エラー', () => {
  it('JSON 構文エラー・root 不正・配列でないフィールドは throw すること', () => {
    expect(() => parseWorkspaceFileLenient('{ broken')).toThrow('JSON parse error');
    expect(() => parseWorkspaceFileLenient('[]')).toThrow('root must be an object');
    expect(() => parseWorkspaceFileLenient(file({ items: 'x' }))).toThrow('items must be an array');
  });

  it('配列フィールドが無ければ空配列として補い normalized にすること', () => {
    const result = parseWorkspaceFileLenient(
      JSON.stringify({ version: '2.0', workspaces: [ws] }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.groups).toEqual([]);
    expect(result.data.items).toEqual([]);
    expect(result.issues.filter((i) => i.kind === 'normalized').map((i) => i.section)).toEqual(
      expect.arrayContaining(['groups', 'items'])
    );
  });
});

describe('workspaceParser: ヘッダ・ワークスペースの補完', () => {
  it('$schema / version が無ければ補うこと', () => {
    const result = parseWorkspaceFileLenient(
      JSON.stringify({ workspaces: [ws], groups: [], items: [] }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.$schema).toBe(WORKSPACE_SCHEMA_REF);
    expect(result.data.version).toBe(JSON_WORKSPACE_VERSION);
    expect(result.modified).toBe(true);
    expect(result.issues.map((i) => i.reason)).toEqual([
      expect.stringContaining('$schema'),
      expect.stringContaining('version'),
    ]);
  });

  it('ワークスペースが 0 件なら既定ワークスペースを作ること', () => {
    const ctx = createWorkspaceParseContext(NOW);
    const result = parseWorkspaceFileLenient(file({ workspaces: [] }), ctx);
    expect(result.data.workspaces).toHaveLength(1);
    expect(result.data.workspaces[0].displayName).toBe('デフォルト');
    expect(isValidId(result.data.workspaces[0].id)).toBe(true);
    expect(ctx.defaultWorkspaceId).toBe(result.data.workspaces[0].id);
    // 既存の参照は新しい既定ワークスペースへ寄せられる
    expect(result.data.groups[0].workspaceId).toBe(ctx.defaultWorkspaceId);
    expect(result.data.items.every((i) => i.workspaceId === ctx.defaultWorkspaceId)).toBe(true);
  });

  it('order / createdAt / addedAt が無ければ補うこと', () => {
    const result = parseWorkspaceFileLenient(
      file({
        workspaces: [{ id: 'wsAAAAA1', displayName: 'メイン' }],
        groups: [{ id: 'grAAAAA1', displayName: 'g', color: 'teal', workspaceId: 'wsAAAAA1' }],
        items: [{ type: 'item', displayName: 'a', path: 'C:\\a.exe', workspaceId: 'wsAAAAA1' }],
      }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.workspaces[0]).toMatchObject({ order: 0, createdAt: NOW });
    expect(result.data.groups[0]).toMatchObject({ order: 0, createdAt: NOW });
    expect(result.data.items[0]).toMatchObject({ order: 0, addedAt: NOW });
    expect(isValidId(result.data.items[0].id)).toBe(true);
    expect(result.issues.some((i) => i.kind === 'idAssigned' && i.section === 'items')).toBe(true);
  });
});

describe('workspaceParser: id の採番と参照の追随', () => {
  it('不正な id（UUID など）は採番し直し、参照も新 id に書き換えること', () => {
    const result = parseWorkspaceFileLenient(
      file({
        workspaces: [{ ...ws, id: 'ws-uuid' }],
        groups: [{ ...group, id: 'group-uuid', workspaceId: 'ws-uuid' }],
        items: [{ ...launcher, id: 'item-uuid', workspaceId: 'ws-uuid', groupId: 'group-uuid' }],
      }),
      createWorkspaceParseContext(NOW)
    );
    const [w] = result.data.workspaces;
    const [g] = result.data.groups;
    const [i] = result.data.items;
    expect(isValidId(w.id) && isValidId(g.id) && isValidId(i.id)).toBe(true);
    expect(g.workspaceId).toBe(w.id);
    expect(i.workspaceId).toBe(w.id);
    expect(i.groupId).toBe(g.id);
    expect(result.issues.filter((x) => x.kind === 'idAssigned')).toHaveLength(3);
  });

  it('重複する id は 2 件目を採番し直し、参照は最初の要素を指したままにすること', () => {
    const result = parseWorkspaceFileLenient(
      file({
        groups: [group, { ...group, displayName: '複製' }],
        items: [launcher],
      }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.groups[0].id).toBe('grAAAAA1');
    expect(result.data.groups[1].id).not.toBe('grAAAAA1');
    expect(result.data.items[0].groupId).toBe('grAAAAA1');
  });

  it('存在しない groupId / parentGroupId は外し、存在しない workspaceId は既定へ寄せること', () => {
    const result = parseWorkspaceFileLenient(
      file({
        groups: [
          group,
          { ...group, id: 'grAAAAA2', parentGroupId: 'nowhere1', workspaceId: 'nowhere2' },
        ],
        items: [{ ...launcher, groupId: 'nowhere3' }],
      }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.groups[1].parentGroupId).toBeUndefined();
    expect(result.data.groups[1].workspaceId).toBe('wsAAAAA1');
    expect(result.data.items[0].groupId).toBeUndefined();
    expect(result.issues.filter((i) => i.kind === 'normalized')).toHaveLength(3);
  });

  it('不正なグループへの参照（groupId / parentGroupId）は外さず保つこと', () => {
    const result = parseWorkspaceFileLenient(
      file({
        groups: [
          { ...group, displayName: '' }, // invalid（id: grAAAAA1）
          { ...group, id: 'grAAAAA2', parentGroupId: 'grAAAAA1' },
        ],
        items: [launcher], // groupId: grAAAAA1
      }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.invalid.groups).toHaveLength(1);
    expect(result.data.groups[0].parentGroupId).toBe('grAAAAA1');
    expect(result.data.items[0].groupId).toBe('grAAAAA1');
    expect(result.issues.filter((i) => i.kind === 'normalized')).toEqual([]);
  });

  it('parentGroupId の循環と深さ超過は親を外して normalized にすること', () => {
    const g = (id: string, parentGroupId?: string) => ({ ...group, id, parentGroupId });
    const result = parseWorkspaceFileLenient(
      file({
        groups: [
          g('cycleAA1', 'cycleAA2'),
          g('cycleAA2', 'cycleAA1'),
          g('depthAA0'),
          g('depthAA1', 'depthAA0'),
          g('depthAA2', 'depthAA1'),
          g('depthAA3', 'depthAA2'), // 3 段目は超過
        ],
        items: [],
      }),
      createWorkspaceParseContext(NOW)
    );
    const byId = Object.fromEntries(result.data.groups.map((x) => [x.id, x]));
    expect(byId.cycleAA1.parentGroupId ?? byId.cycleAA2.parentGroupId).toBeDefined();
    expect(byId.cycleAA1.parentGroupId && byId.cycleAA2.parentGroupId).toBeFalsy();
    expect(byId.depthAA2.parentGroupId).toBe('depthAA1');
    expect(byId.depthAA3.parentGroupId).toBeUndefined();
    const reasons = result.issues.filter((i) => i.kind === 'normalized').map((i) => i.reason);
    expect(reasons.some((r) => r.includes('循環'))).toBe(true);
    expect(reasons.some((r) => r.includes('段を超える'))).toBe(true);
  });

  it('自分自身を親にしたグループは親を外すこと', () => {
    const result = parseWorkspaceFileLenient(
      file({ groups: [{ ...group, parentGroupId: 'grAAAAA1' }] }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.groups[0].parentGroupId).toBeUndefined();
  });
});

describe('workspaceParser: 不正な要素', () => {
  it('不正なアイテムは invalid として外し、生のまま返して書き戻し時に末尾へ付けること', () => {
    const broken = {
      id: 'brokenit',
      type: 'item',
      displayName: 'no path',
      workspaceId: 'wsAAAAA1',
    };
    const result = parseWorkspaceFileLenient(
      file({ items: [broken, launcher] }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.items.map((i) => i.id)).toEqual(['itAAAAA1']);
    expect(result.invalid.items).toEqual([broken]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'invalid', section: 'items', index: 0, id: 'brokenit' }),
      ])
    );
    const written = JSON.parse(serializeWorkspaceFile(result.data, result.invalid));
    expect(written.items.at(-1)).toEqual(broken);
  });

  it('未知の type・displayName 欠落・color 不正の扱い', () => {
    const result = parseWorkspaceFileLenient(
      file({
        groups: [
          { ...group, color: 'var(--color-primary)' },
          { ...group, id: 'grAAAAA2', displayName: '' },
        ],
        items: [{ ...launcher, type: 'dir' }],
      }),
      createWorkspaceParseContext(NOW)
    );
    // color 不正は invalid にせず既定色へ
    expect(result.data.groups).toHaveLength(1);
    expect(result.data.groups[0].color).toBe('primary');
    expect(result.invalid.groups).toHaveLength(1);
    // 'dir' はワークスペースでは使えない
    expect(result.data.items).toHaveLength(0);
    expect(
      result.issues.find((i) => i.section === 'items' && i.kind === 'invalid')?.reason
    ).toContain('Unknown item type');
  });

  it('ウィンドウ操作のタイトル空・プロセス名だけは "*" に正規化して normalized にすること', () => {
    const result = parseWorkspaceFileLenient(
      file({ items: [{ ...windowItem, windowTitle: '', processName: 'notepad.exe' }] }),
      createWorkspaceParseContext(NOW)
    );
    expect(result.data.items[0]).toMatchObject({ windowTitle: '*', processName: 'notepad.exe' });
    expect(result.issues).toEqual([
      expect.objectContaining({ kind: 'normalized', section: 'items', id: windowItem.id }),
    ]);
    expect(result.modified).toBe(true);
  });

  it('アイテム本体の検証はデータファイルと同じで、未知のフィールドは落ちること', () => {
    const result = parseWorkspaceFileLenient(
      file({
        items: [{ ...launcher, unknownField: 1, autoImportRuleId: 'rule0001', updatedAt: 5 }],
      }),
      createWorkspaceParseContext(NOW)
    );
    const item = result.data.items[0] as unknown as Record<string, unknown>;
    expect(item.unknownField).toBeUndefined();
    expect(item.autoImportRuleId).toBeUndefined();
    expect(item.updatedAt).toBeUndefined();
  });
});

describe('workspaceParser: アーカイブ', () => {
  const archivedGroup = {
    ...group,
    id: 'agAAAAA1',
    archivedAt: 2,
    originalOrder: 3,
    itemCount: 1,
  };
  const archivedItem = {
    ...launcher,
    id: 'aiAAAAA1',
    groupId: 'agAAAAA1',
    archivedAt: 2,
    archivedGroupId: 'agAAAAA1',
  };

  function archiveFile(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      $schema: WORKSPACE_ARCHIVE_SCHEMA_REF,
      version: JSON_WORKSPACE_VERSION,
      groups: [archivedGroup],
      items: [archivedItem],
      ...overrides,
    });
  }

  it('main のパース後に呼ぶ必要があること', () => {
    expect(() =>
      parseWorkspaceArchiveFileLenient(archiveFile(), createWorkspaceParseContext(NOW))
    ).toThrow();
  });

  it('正常なアーカイブは未変更で、id 名前空間を main と共有すること', () => {
    const ctx = createWorkspaceParseContext(NOW);
    parseWorkspaceFileLenient(file(), ctx);
    const result = parseWorkspaceArchiveFileLenient(archiveFile(), ctx);

    expect(result.modified).toBe(false);
    expect(result.data.groups[0]).toEqual(archivedGroup);
    expect(result.data.items[0]).toMatchObject({ archivedAt: 2, archivedGroupId: 'agAAAAA1' });
    expect(ctx.reservedIds.has('aiAAAAA1')).toBe(true);

    const roundTrip = parseWorkspaceArchiveFileLenient(
      serializeWorkspaceArchiveFile(result.data, result.invalid),
      (() => {
        const c = createWorkspaceParseContext(NOW);
        parseWorkspaceFileLenient(file(), c);
        return c;
      })()
    );
    expect(roundTrip.data).toEqual(result.data);
  });

  it('main と重複する id は採番し直すこと', () => {
    const ctx = createWorkspaceParseContext(NOW);
    parseWorkspaceFileLenient(file(), ctx);
    const result = parseWorkspaceArchiveFileLenient(
      archiveFile({ items: [{ ...archivedItem, id: 'itAAAAA1' }] }),
      ctx
    );
    expect(result.data.items[0].id).not.toBe('itAAAAA1');
    expect(result.issues.some((i) => i.kind === 'idAssigned')).toBe(true);
  });

  it('所属するアーカイブグループが無いアイテムと archivedGroupId 欠落は invalid として生のまま残すこと', () => {
    const ctx = createWorkspaceParseContext(NOW);
    parseWorkspaceFileLenient(file(), ctx);
    const { archivedGroupId: _omit, ...noArchivedGroup } = archivedItem;
    const orphan = { ...archivedItem, archivedGroupId: 'missing1' };
    const result = parseWorkspaceArchiveFileLenient(
      archiveFile({ items: [orphan, { ...noArchivedGroup, id: 'aiAAAAA2' }] }),
      ctx
    );
    expect(result.data.items).toHaveLength(0);
    expect(result.issues.map((i) => i.kind)).toEqual(['invalid', 'invalid']);
    // 書き戻しで消えない（グループを直せば戻る）
    expect(result.invalid.items).toHaveLength(2);
    expect(result.invalid.items).toEqual(
      expect.arrayContaining([orphan, { ...noArchivedGroup, id: 'aiAAAAA2' }])
    );
  });

  it('アーカイブグループが不正でも、配下のアイテムは archivedGroupId を保ったまま invalid に残すこと', () => {
    const ctx = createWorkspaceParseContext(NOW);
    parseWorkspaceFileLenient(file(), ctx);
    const result = parseWorkspaceArchiveFileLenient(
      archiveFile({ groups: [{ ...archivedGroup, displayName: '' }] }),
      ctx
    );
    expect(result.invalid.groups).toHaveLength(1);
    expect(result.invalid.items).toHaveLength(1);
    expect((result.invalid.items[0] as { archivedGroupId: string }).archivedGroupId).toBe(
      'agAAAAA1'
    );
  });

  it('アーカイブグループの parentGroupId は main のグループも参照できること', () => {
    const ctx = createWorkspaceParseContext(NOW);
    parseWorkspaceFileLenient(file(), ctx);
    const result = parseWorkspaceArchiveFileLenient(
      archiveFile({ groups: [{ ...archivedGroup, parentGroupId: 'grAAAAA1' }] }),
      ctx
    );
    expect(result.data.groups[0].parentGroupId).toBe('grAAAAA1');
  });
});
