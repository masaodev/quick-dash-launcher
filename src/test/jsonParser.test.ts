/**
 * jsonParser.ts のテスト
 * JSON形式データファイルのパース・シリアライズ・ID生成機能の検証
 */

import { describe, it, expect } from 'vitest';
import { createI18n } from '@common/i18n';
import {
  generateId,
  isValidId,
  parseJsonDataFile,
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import type { JsonDataFile, JsonLauncherItem, JsonDirItem } from '@common/types';
import { JSON_DATA_VERSION, JSON_ID_LENGTH } from '@common/types';

/** 旧版（v0.8.0-beta.5 まで）がファイルに書いていた $schema */
const OLD_SCHEMA_REF = '../schemas/data.schema.json';

describe('jsonParser: ID生成', () => {
  describe('generateId', () => {
    it('8文字のIDを生成すること', () => {
      const id = generateId();
      expect(id).toHaveLength(JSON_ID_LENGTH);
    });

    it('英数字のみで構成されること', () => {
      const id = generateId();
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('異なるIDを生成すること', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      // 100回生成して、衝突がないことを確認（確率的に衝突はほぼ不可能）
      expect(ids.size).toBe(100);
    });
  });

  describe('isValidId', () => {
    it('有効なIDを正しく判定すること', () => {
      expect(isValidId('a1B2c3D4')).toBe(true);
      expect(isValidId('ABCD1234')).toBe(true);
      expect(isValidId('abcd1234')).toBe(true);
    });

    it('無効なIDを正しく判定すること', () => {
      expect(isValidId('')).toBe(false);
      expect(isValidId('abc')).toBe(false); // 短すぎる
      expect(isValidId('abc123456789')).toBe(false); // 長すぎる
      expect(isValidId('abc-1234')).toBe(false); // ハイフン含む
      expect(isValidId('abc_1234')).toBe(false); // アンダースコア含む
      expect(isValidId(null)).toBe(false);
      expect(isValidId(undefined)).toBe(false);
      expect(isValidId(12345678)).toBe(false);
    });
  });
});

describe('jsonParser: パースとシリアライズ', () => {
  describe('parseJsonDataFile', () => {
    it('空のitemsを持つ有効なJSONをパースできること', () => {
      const json = '{"version":"1.0","items":[]}';
      const result = parseJsonDataFile(json);
      expect(result.version).toBe('1.0');
      expect(result.items).toEqual([]);
    });

    it('JsonLauncherItemを正しくパースできること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'a1b2c3d4',
            type: 'item',
            displayName: 'GitHub',
            path: 'https://github.com/',
          },
        ],
      });
      const result = parseJsonDataFile(json);
      expect(result.items).toHaveLength(1);
      const item = result.items[0] as JsonLauncherItem;
      expect(item.type).toBe('item');
      expect(item.displayName).toBe('GitHub');
      expect(item.path).toBe('https://github.com/');
    });

    it('JsonLauncherItemのオプションフィールドをパースできること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'a1b2c3d4',
            type: 'item',
            displayName: 'Cursor',
            path: 'C:\\Program Files\\cursor\\Cursor.exe',
            args: 'C:\\Users\\project',
            customIcon: 'cursor.png',
            windowConfig: {
              title: 'Cursor*',
              processName: 'Cursor.exe',
              x: 100,
              y: 200,
              width: 1920,
              height: 1080,
            },
          },
        ],
      });
      const result = parseJsonDataFile(json);
      const item = result.items[0] as JsonLauncherItem;
      expect(item.args).toBe('C:\\Users\\project');
      expect(item.customIcon).toBe('cursor.png');
      // 旧形式の windowConfig は、その場でセットの行と同じキーに直す
      expect(item).not.toHaveProperty('windowConfig');
      expect(item.window).toEqual({ processName: 'Cursor.exe', title: 'Cursor*' });
      expect(item.placement).toEqual({ x: 100, y: 200, width: 1920, height: 1080 });
      expect(item.activateWindow).toBe(true);
    });

    it('JsonDirItemを正しくパースできること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'i9j0k1l2',
            type: 'dir',
            path: 'C:\\tools',
          },
        ],
      });
      const result = parseJsonDataFile(json);
      const item = result.items[0] as JsonDirItem;
      expect(item.type).toBe('dir');
      expect(item.path).toBe('C:\\tools');
    });

    it('JsonDirItemのオプションをパースできること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'i9j0k1l2',
            type: 'dir',
            path: 'C:\\tools',
            options: {
              depth: 1,
              types: 'both',
              filter: '*.exe',
              exclude: '*.tmp',
              prefix: 'Tool: ',
              suffix: '',
            },
          },
        ],
      });
      const result = parseJsonDataFile(json);
      const item = result.items[0] as JsonDirItem;
      expect(item.options?.depth).toBe(1);
      expect(item.options?.types).toBe('both');
      expect(item.options?.filter).toBe('*.exe');
    });

    it('旧形式のグループは不正なアイテムとして扱うこと（セットへの変換は読み込み時に別に行う）', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'm3n4o5p6',
            type: 'group',
            displayName: '開発環境スタート',
            itemNames: ['VS Code', 'GitHub', 'Terminal'],
          },
        ],
      });
      expect(() => parseJsonDataFile(json)).toThrow();
    });

    it('廃止したウィンドウ操作は、同じ id のパスの無い単一アイテムとして読むこと', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [
          {
            id: 'q7r8s9t0',
            type: 'window',
            displayName: 'MS To DO',
            windowTitle: 'Microsoft To Do',
            x: 1273,
            y: 1,
            width: 1293,
            height: 1397,
            virtualDesktopNumber: 1,
            activateWindow: false,
          },
        ],
      });
      const result = parseJsonDataFile(json);
      expect(result.items[0]).toEqual({
        id: 'q7r8s9t0',
        type: 'item',
        displayName: 'MS To DO',
        path: '',
        window: { title: 'Microsoft To Do' },
        placement: { x: 1273, y: 1, width: 1293, height: 1397, virtualDesktopNumber: 1 },
        activateWindow: false,
      });
    });

    it('不正なJSONでエラーをスローすること', () => {
      expect(() => parseJsonDataFile('{')).toThrow('JSON parse error');
    });

    it('versionがない場合にエラーをスローすること', () => {
      expect(() => parseJsonDataFile('{"items":[]}')).toThrow('version must be a string');
    });

    it('itemsがない場合にエラーをスローすること', () => {
      expect(() => parseJsonDataFile('{"version":"1.0"}')).toThrow('items must be an array');
    });

    it('無効なアイテムタイプでエラーをスローすること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [{ id: 'a1b2c3d4', type: 'invalid' }],
      });
      expect(() => parseJsonDataFile(json)).toThrow('Unknown item type');
    });

    it('単一アイテムの runAsAdmin（常に管理者として実行）は真偽値だけを受けること', () => {
      const parse = (runAsAdmin: unknown) =>
        parseJsonDataFile(
          JSON.stringify({
            version: '1.0',
            items: [
              { id: 'a1b2c3d4', type: 'item', displayName: 'T', path: 'C:\\t.exe', runAsAdmin },
            ],
          })
        );
      expect((parse(true).items[0] as JsonLauncherItem).runAsAdmin).toBe(true);
      expect(() => parse('yes')).toThrow('runAsAdmin must be a boolean');
    });

    it('無効なIDでエラーをスローすること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [{ id: 'invalid!', type: 'item', displayName: 'Test', path: '/test' }],
      });
      expect(() => parseJsonDataFile(json)).toThrow('Invalid or missing id');
    });
  });

  describe('parseJsonDataFile: 旧版の $schema', () => {
    it('旧版が書いた $schema は読み飛ばすこと', () => {
      const parsed = parseJsonDataFile(
        JSON.stringify({ $schema: OLD_SCHEMA_REF, version: '1.0', items: [] })
      );
      expect(parsed).not.toHaveProperty('$schema');
    });
  });

  describe('serializeJsonDataFile', () => {
    it('整形出力がデフォルトであること', () => {
      const data: JsonDataFile = {
        version: '1.0',
        items: [],
      };
      const result = serializeJsonDataFile(data);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });

    it('非整形出力ができること', () => {
      const data: JsonDataFile = {
        version: '1.0',
        items: [],
      };
      const result = serializeJsonDataFile(data, false);
      expect(result).not.toContain('\n');
    });

    it('version → items の順で出力し、$schema は付けないこと', () => {
      const result = serializeJsonDataFile({ version: '1.0', items: [] }, false);
      expect(result).toBe('{"version":"1.0","items":[]}');
    });

    it('パースとシリアライズがラウンドトリップすること', () => {
      const original: JsonDataFile = {
        version: '1.0',
        items: [
          {
            id: 'a1b2c3d4',
            type: 'item',
            displayName: 'Test',
            path: '/test',
          },
        ],
      };
      const serialized = serializeJsonDataFile(original, false);
      const parsed = parseJsonDataFile(serialized);
      expect(parsed).toEqual(original);
    });
  });

  describe('createEmptyJsonDataFile', () => {
    it('正しい構造の空ファイルを作成すること', () => {
      const result = createEmptyJsonDataFile();
      expect(result).not.toHaveProperty('$schema');
      expect(result.version).toBe(JSON_DATA_VERSION);
      expect(result.items).toEqual([]);
    });
  });
});

describe('jsonParser: 完全なJSONファイルの処理', () => {
  it('計画書のサンプルJSONをパースできること', () => {
    const sampleJson = JSON.stringify({
      version: '1.0',
      items: [
        {
          id: 'w1x2y3z4',
          type: 'window',
          displayName: 'MS To DO',
          windowTitle: 'Microsoft To Do',
          x: 1273,
          y: 1,
          width: 1293,
          height: 1397,
          virtualDesktopNumber: 1,
          activateWindow: false,
        },
        {
          id: 'a1b2c3d4',
          type: 'dir',
          path: 'C:\\Users\\daido\\.myahk_v2\\tools',
        },
        {
          id: 'e5f6g7h8',
          type: 'dir',
          path: 'C:\\Users\\daido\\git\\masao\\github',
          options: {
            types: 'folder',
            prefix: '【git local】',
          },
        },
        {
          id: 'i9j0k1l2',
          type: 'set',
          displayName: 'claude用_quick dash wt 5つ+main',
          entries: [{ itemId: 'a1b2c3d4' }, { itemId: 'e5f6g7h8' }],
        },
        {
          id: 'm3n4o5p6',
          type: 'item',
          displayName: 'WSL HOME（Windowsで開く）',
          path: '\\\\wsl.localhost\\Ubuntu-24.04\\home\\masao',
        },
        {
          id: 'q7r8s9t0',
          type: 'item',
          displayName: '一時メモ',
          path: 'C:\\Users\\daido\\.myahk_v2\\一時メモ.txt',
          windowConfig: {
            title: '一時メモ.txt - sakura',
            processName: 'sakura.exe',
            x: 846,
            y: 244,
            width: 1708,
            height: 1032,
          },
        },
        {
          id: 'u1v2w3x4',
          type: 'item',
          displayName: 'npm',
          path: 'https://www.npmjs.com/',
        },
      ],
    });

    const result = parseJsonDataFile(sampleJson);
    expect(result.version).toBe('1.0');
    expect(result.items).toHaveLength(7);

    // 各タイプの検証
    // ウィンドウ操作はパスの無い単一アイテムとして読む
    expect(result.items[0]).toMatchObject({ type: 'item', path: '' });
    expect(result.items[1].type).toBe('dir');
    expect(result.items[3].type).toBe('set');
    expect(result.items[4].type).toBe('item');
  });
});

describe('jsonParser: 寛容パース（parseJsonDataFileLenient）', () => {
  const validItem = { id: 'abcdefgh', type: 'item', displayName: 'A', path: 'C:\\a.exe' };

  /** 正常なファイル文字列を作る（補完で normalized が混ざらないように） */
  const fileWith = (items: unknown[], extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ version: '1.0', items, ...extra });

  it('正常なファイルは問題なし・未変更として返すこと', () => {
    const result = parseJsonDataFileLenient(fileWith([validItem]));

    expect(result.issues).toEqual([]);
    expect(result.modified).toBe(false);
    expect(result.newerFormat).toBe(false);
    expect(result.validItems).toHaveLength(1);
    expect(result.data.items).toHaveLength(1);
  });

  it('新しい版の QDL が保存したファイルは newerFormat にし、採番しても書き戻しを求めないこと', () => {
    const { id: _id, ...noId } = validItem;
    const result = parseJsonDataFileLenient(fileWith([noId], { version: '1.1' }));

    expect(result.newerFormat).toBe(true);
    expect(result.modified).toBe(false);
    expect(result.validItems).toHaveLength(1);
    expect(result.data.version).toBe('1.1');
  });

  it('版が数値でも、新しい版なら newerFormat にし、書き戻しを求めないこと（1 は "1.0" と同じ版）', () => {
    const newer = parseJsonDataFileLenient(fileWith([validItem], { version: 2 }));
    expect(newer.newerFormat).toBe(true);
    expect(newer.modified).toBe(false);

    const same = parseJsonDataFileLenient(fileWith([validItem], { version: 1 }));
    expect(same.newerFormat).toBe(false);
  });

  it('理由は渡した t の言語で書くこと（省略時は日本語）', () => {
    const { id: _id, ...noId } = validItem;
    const content = fileWith([noId]);

    expect(parseJsonDataFileLenient(content).issues[0].reason).toBe('id が無いため採番しました');
    expect(parseJsonDataFileLenient(content, { t: createI18n('en').t }).issues[0].reason).toBe(
      'id was missing, so a new one was assigned'
    );
  });

  it('JSON 構文エラーはファイル全体のエラーとしてスローすること', () => {
    expect(() => parseJsonDataFileLenient('{ broken')).toThrow('JSON parse error');
  });

  it('root がオブジェクトでない・items が配列でない場合はスローすること', () => {
    expect(() => parseJsonDataFileLenient('[]')).toThrow('root must be an object');
    expect(() => parseJsonDataFileLenient('{"version":"1.0"}')).toThrow('items must be an array');
  });

  it('id が無いアイテムに採番して書き戻し要と判定すること', () => {
    const { id: _id, ...noId } = validItem;
    const result = parseJsonDataFileLenient(fileWith([noId]));

    expect(result.modified).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].kind).toBe('idAssigned');
    expect(result.issues[0].index).toBe(0);
    expect(isValidId(result.data.items[0].id)).toBe(true);
    expect(result.issues[0].id).toBe(result.data.items[0].id);
    expect(result.validItems).toHaveLength(1);
  });

  it('不正な id は採番し直すこと', () => {
    const result = parseJsonDataFileLenient(fileWith([{ ...validItem, id: 'x' }]));

    expect(result.issues[0].kind).toBe('idAssigned');
    expect(result.issues[0].reason).toContain('不正');
    expect(isValidId(result.data.items[0].id)).toBe(true);
  });

  it('同一ファイル内で重複する id は 2 件目以降を採番し直すこと', () => {
    const result = parseJsonDataFileLenient(
      fileWith([validItem, { ...validItem, displayName: 'B' }])
    );

    expect(result.data.items[0].id).toBe('abcdefgh');
    expect(result.data.items[1].id).not.toBe('abcdefgh');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].index).toBe(1);
    expect(result.issues[0].reason).toContain('重複');
  });

  it('reservedIds（他ファイルの id）と重複する id も採番し直すこと', () => {
    const result = parseJsonDataFileLenient(fileWith([validItem]), {
      reservedIds: new Set(['abcdefgh']),
    });

    expect(result.data.items[0].id).not.toBe('abcdefgh');
    expect(result.modified).toBe(true);
  });

  it('不正なアイテムはスキップしつつ data.items には元のまま残すこと', () => {
    const broken = { id: 'zzzzzzzz', type: 'item', displayName: 'no path' };
    const result = parseJsonDataFileLenient(fileWith([validItem, broken]));

    expect(result.validItems).toHaveLength(1);
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[1]).toEqual(broken);
    expect(result.issues).toEqual([
      expect.objectContaining({ index: 1, kind: 'invalid', id: 'zzzzzzzz' }),
    ]);
    expect(result.issues[0].reason).toContain('path');
    // 不正アイテムを残すだけなら書き戻しは不要
    expect(result.modified).toBe(false);
  });

  it('フォルダ取込の depth は -1 か 0 以上の整数だけ受け付け、それ以外はスキップすること', () => {
    const dirWith = (id: string, depth: unknown) => ({
      id,
      type: 'dir',
      path: 'C:\\work',
      options: { depth },
    });
    const result = parseJsonDataFileLenient(
      fileWith([
        dirWith('dirAAAA1', -1),
        dirWith('dirAAAA2', 0),
        dirWith('dirAAAA3', 3),
        dirWith('dirAAAA4', -2),
        dirWith('dirAAAA5', 1.5),
        dirWith('dirAAAA6', '1'),
      ])
    );

    expect(result.validItems.map((item) => item.id)).toEqual(['dirAAAA1', 'dirAAAA2', 'dirAAAA3']);
    expect(result.issues.map((issue) => [issue.id, issue.kind])).toEqual([
      ['dirAAAA4', 'invalid'],
      ['dirAAAA5', 'invalid'],
      ['dirAAAA6', 'invalid'],
    ]);
    expect(result.issues[0].reason).toContain('options.depth');
  });

  it('ウィンドウ操作はその場でパスの無い単一アイテムに直し、書き戻し要にはしないこと（変換は移行が行う）', () => {
    const processOnly = {
      id: 'wnAAAAA1',
      type: 'window',
      displayName: 'メモ帳',
      windowTitle: '',
      processName: 'notepad.exe',
    };
    const result = parseJsonDataFileLenient(fileWith([processOnly]));

    expect(result.validItems).toEqual([
      {
        id: 'wnAAAAA1',
        type: 'item',
        displayName: 'メモ帳',
        path: '',
        window: { processName: 'notepad.exe' },
      },
    ]);
    expect(result.issues).toEqual([]);
    expect(result.modified).toBe(false);
  });

  it('ウィンドウ操作のタイトル空でプロセス名も無ければ invalid にし、ファイル上は元のまま残すこと', () => {
    const result = parseJsonDataFileLenient(
      fileWith([{ id: 'wnAAAAA2', type: 'window', displayName: 'x', windowTitle: '' }])
    );
    expect(result.validItems).toHaveLength(0);
    expect(result.issues).toEqual([expect.objectContaining({ kind: 'invalid', id: 'wnAAAAA2' })]);
    expect(result.issues[0].reason).toContain('path');
    expect(result.data.items[0]).toMatchObject({ type: 'window', windowTitle: '' });
  });

  it('未知の type はスキップし、他のアイテムは生かすこと', () => {
    const result = parseJsonDataFileLenient(
      fileWith([{ id: 'aaaaaaaa', type: 'unknown', displayName: 'x' }, validItem])
    );

    expect(result.validItems).toHaveLength(1);
    expect(result.validItems[0].id).toBe('abcdefgh');
    expect(result.issues[0].reason).toContain('Unknown item type');
  });

  it('オブジェクトでない要素は削除し、index を -1・reason に元の位置を書くこと', () => {
    const result = parseJsonDataFileLenient(fileWith([null, 'text', validItem]));

    expect(result.data.items).toHaveLength(1);
    expect(result.modified).toBe(true);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toEqual(expect.objectContaining({ index: -1, kind: 'invalid' }));
    expect(result.issues[0].reason).toContain('items[0]');
    expect(result.issues[1].reason).toContain('items[1]');
  });

  it('削除があっても issue.index は data.items 上の位置を指すこと', () => {
    const broken = { id: 'zzzzzzzz', type: 'item' };
    const result = parseJsonDataFileLenient(fileWith([null, validItem, broken]));

    const invalidIssue = result.issues.find((i) => i.kind === 'invalid' && i.index >= 0);
    expect(invalidIssue?.index).toBe(1);
    expect(result.data.items[1]).toEqual(broken);
  });

  it('version が無ければ補い、normalized として報告すること', () => {
    const result = parseJsonDataFileLenient(JSON.stringify({ items: [validItem] }));

    expect(result.data.version).toBe(JSON_DATA_VERSION);
    expect(result.modified).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ index: -1, kind: 'normalized' })]);
    expect(result.issues[0].reason).toContain('version');
  });

  it('旧版が書いた $schema は読み飛ばし、補正にも書き戻しの理由にもしないこと', () => {
    const result = parseJsonDataFileLenient(fileWith([validItem], { $schema: OLD_SCHEMA_REF }));

    expect(result.data).not.toHaveProperty('$schema');
    expect(result.modified).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.validItems).toHaveLength(1);
  });

  it('寛容パースの結果をシリアライズすると不正アイテムも含めてラウンドトリップすること', () => {
    const broken = { id: 'zzzzzzzz', type: 'group', displayName: 'g', itemNames: 'not-array' };
    const original = { version: '1.0', items: [validItem, broken] };
    const result = parseJsonDataFileLenient(JSON.stringify(original));

    expect(JSON.parse(serializeJsonDataFile(result.data))).toEqual(original);
  });
});

describe('jsonParser: セット', () => {
  it('知っている項目だけを写し、型の合わない項目は捨てる', () => {
    const file = parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [
          {
            id: 'set1aaaa',
            type: 'set',
            displayName: '朝の準備',
            launchMode: 'parallel',
            entries: [
              { itemId: 'abcd1234' },
              {
                open: { path: 'C:\\Apps\\Obsidian.exe', args: '' },
                window: { processName: 'Obsidian.exe', title: 42 },
                placement: { x: 0, y: 0, width: 960, height: 'wide', state: 'maximized' },
                ifOpen: 'openNew',
                activateWindow: false,
                waitSeconds: -1,
                unknown: true,
              },
            ],
          },
        ],
      })
    );
    expect(file.items[0]).toEqual({
      id: 'set1aaaa',
      type: 'set',
      displayName: '朝の準備',
      launchMode: 'parallel',
      entries: [
        { itemId: 'abcd1234' },
        {
          open: { path: 'C:\\Apps\\Obsidian.exe' },
          window: { processName: 'Obsidian.exe' },
          placement: { x: 0, y: 0, width: 960, state: 'maximized' },
          ifOpen: 'openNew',
          activateWindow: false,
        },
      ],
    });
  });

  it('仮想デスクトップ番号は 1 以上の整数だけ読む（0・負の数・小数は指定なし）', () => {
    const file = parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [
          {
            id: 'set1aaaa',
            type: 'set',
            displayName: 'x',
            entries: [0, -1, 1.5, 2].map((n) => ({
              itemId: 'abcd1234',
              placement: { x: 0, y: 0, width: 1, height: 1, virtualDesktopNumber: n },
            })),
          },
        ],
      })
    );
    const entries = (
      file.items[0] as { entries: { placement?: { virtualDesktopNumber?: number } }[] }
    ).entries;
    expect(entries.map((e) => e.placement?.virtualDesktopNumber)).toEqual([
      undefined,
      undefined,
      undefined,
      2,
    ]);
  });

  it('中身の無い見つけ方は持たない（どのウィンドウにも合ってしまうため）', () => {
    const file = parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [
          {
            id: 'set1aaaa',
            type: 'set',
            displayName: 'x',
            entries: [{ itemId: 'abcd1234', window: { processName: '', title: 1 } }],
          },
        ],
      })
    );
    expect(file.items[0]).toMatchObject({ entries: [{ itemId: 'abcd1234' }] });
    expect((file.items[0] as { entries: object[] }).entries[0]).not.toHaveProperty('window');
  });

  it('行の pinToAllDesktops は true のときだけ持つ', () => {
    const file = parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [
          {
            id: 'set1aaaa',
            type: 'set',
            displayName: 'x',
            entries: [
              { itemId: 'abcd1234', pinToAllDesktops: true },
              { itemId: 'abcd1234', pinToAllDesktops: false },
              { itemId: 'abcd1234', pinToAllDesktops: 'yes' },
            ],
          },
        ],
      })
    );
    const entries = (file.items[0] as { entries: object[] }).entries;
    expect(entries[0]).toEqual({ itemId: 'abcd1234', pinToAllDesktops: true });
    expect(entries[1]).not.toHaveProperty('pinToAllDesktops');
    expect(entries[2]).not.toHaveProperty('pinToAllDesktops');
  });

  it('行がオブジェクトでなければエラー', () => {
    expect(() =>
      parseJsonDataFile(
        JSON.stringify({
          version: JSON_DATA_VERSION,
          items: [{ id: 'set1aaaa', type: 'set', displayName: 'x', entries: ['bad'] }],
        })
      )
    ).toThrow();
  });
});

describe('jsonParser: 単一アイテムのウィンドウ切り替え', () => {
  const parseOne = (item: Record<string, unknown>) =>
    parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [{ id: 'item1aaa', type: 'item', displayName: 'x', path: 'notepad.exe', ...item }],
      })
    ).items[0];

  it('セットの行と同じキーを読み、型の合わない値は捨てる', () => {
    expect(
      parseOne({
        window: { processName: 'x.exe', title: 3 },
        placement: { x: 0, y: 'top', virtualDesktopNumber: 2, state: 'maximized' },
        ifOpen: 'openNew',
        activateWindow: false,
        waitSeconds: 10,
        pinToAllDesktops: true,
      })
    ).toEqual({
      id: 'item1aaa',
      type: 'item',
      displayName: 'x',
      path: 'notepad.exe',
      window: { processName: 'x.exe' },
      placement: { x: 0, virtualDesktopNumber: 2, state: 'maximized' },
      ifOpen: 'openNew',
      activateWindow: false,
      waitSeconds: 10,
      pinToAllDesktops: true,
    });
  });

  it('windowConfig は受け付けて新しいキーに直す（中央に配置は捨てる）', () => {
    expect(
      parseOne({
        windowConfig: {
          title: '*',
          processName: 'x.exe',
          moveToActiveMonitorCenter: true,
          activateWindow: false,
        },
      })
    ).toEqual({
      id: 'item1aaa',
      type: 'item',
      displayName: 'x',
      path: 'notepad.exe',
      window: { processName: 'x.exe' },
      activateWindow: false,
    });
  });

  it('windowConfig と新しいキーが両方あれば windowConfig を優先し、ifOpen・waitSeconds は残す', () => {
    const item = parseOne({
      window: { processName: 'old.exe' },
      placement: { x: 1, y: 1 },
      ifOpen: 'openNew',
      waitSeconds: 5,
      windowConfig: { title: 'New' },
    });
    expect(item).toMatchObject({
      window: { title: 'New' },
      activateWindow: true,
      ifOpen: 'openNew',
      waitSeconds: 5,
    });
    expect(item).not.toHaveProperty('placement');
  });

  it('windowConfig の型が合わなければ、今までどおり不正にする', () => {
    expect(() => parseOne({ windowConfig: 'bad' })).toThrow('windowConfig must be an object');
    expect(() => parseOne({ windowConfig: { x: '1' } })).toThrow('windowConfig.x must be a number');
  });
});

describe('jsonParser: パスの無い単一アイテム', () => {
  const parseOne = (item: Record<string, unknown>) =>
    parseJsonDataFile(
      JSON.stringify({
        version: JSON_DATA_VERSION,
        items: [{ id: 'item1aaa', type: 'item', displayName: 'x', ...item }],
      })
    ).items[0];

  it('対象ウィンドウ（exe 名かタイトル）があれば path が空でも読める', () => {
    expect(parseOne({ path: '', window: { processName: 'ApplicationFrameHost.exe' } })).toEqual({
      id: 'item1aaa',
      type: 'item',
      displayName: 'x',
      path: '',
      window: { processName: 'ApplicationFrameHost.exe' },
    });
    expect(parseOne({ path: '', window: { title: 'Microsoft To Do' } })).toMatchObject({
      path: '',
      window: { title: 'Microsoft To Do' },
    });
  });

  it('旧形式の windowConfig から対象ウィンドウが取れれば、path が空でも読める', () => {
    expect(parseOne({ path: '', windowConfig: { title: 'Microsoft To Do' } })).toMatchObject({
      path: '',
      window: { title: 'Microsoft To Do' },
    });
  });

  it('path も対象ウィンドウも空なら不正にする', () => {
    expect(() => parseOne({ path: '' })).toThrow(/path must not be empty/);
    expect(() => parseOne({ path: '  ', window: {} })).toThrow(/path must not be empty/);
    // タイトルが "*" だけの windowConfig は対象ウィンドウにならない
    expect(() => parseOne({ path: '', windowConfig: { title: '*' } })).toThrow(
      /path must not be empty/
    );
  });

  it('path が無い・文字列でないものは今までどおり不正にする', () => {
    expect(() => parseOne({ window: { processName: 'a.exe' } })).toThrow(/path is required/);
    expect(() => parseOne({ path: 3, window: { processName: 'a.exe' } })).toThrow(
      /path is required/
    );
  });
});

describe('jsonParser: WSグループ', () => {
  const fileWith = (items: unknown[]): string => JSON.stringify({ version: '1.0', items });

  it('scope・groupIds・options・memo を読むこと', () => {
    const result = parseJsonDataFileLenient(
      fileWith([
        {
          id: 'wsgrp001',
          type: 'wsgroup',
          scope: 'selected',
          groupIds: ['grpAAAA1', 'grpBBBB2'],
          options: { prefix: 'WS: ', suffix: '' },
          memo: 'メモ',
        },
      ])
    );

    expect(result.issues).toEqual([]);
    expect(result.validItems).toEqual([
      {
        id: 'wsgrp001',
        type: 'wsgroup',
        scope: 'selected',
        groupIds: ['grpAAAA1', 'grpBBBB2'],
        options: { prefix: 'WS: ', suffix: '' },
        memo: 'メモ',
      },
    ]);
  });

  it('scope が all か selected でなければ不正とすること', () => {
    const result = parseJsonDataFileLenient(
      fileWith([{ id: 'wsgrp002', type: 'wsgroup', scope: 'some' }])
    );

    expect(result.validItems).toHaveLength(0);
    expect(result.issues[0].kind).toBe('invalid');
  });

  it('groupIds に空の文字列や文字列でない値があれば不正とすること', () => {
    const result = parseJsonDataFileLenient(
      fileWith([{ id: 'wsgrp003', type: 'wsgroup', scope: 'selected', groupIds: ['ok', 1] }])
    );

    expect(result.validItems).toHaveLength(0);
  });
});
