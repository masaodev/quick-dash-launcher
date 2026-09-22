/**
 * jsonParser.ts のテスト
 * JSON形式データファイルのパース・シリアライズ・ID生成機能の検証
 */

import { describe, it, expect } from 'vitest';
import {
  generateId,
  isValidId,
  parseJsonDataFile,
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
  createJsonLauncherItem,
  createJsonDirItem,
  createJsonGroupItem,
  createJsonWindowItem,
} from '@common/utils/jsonParser';
import type {
  JsonDataFile,
  JsonLauncherItem,
  JsonDirItem,
  JsonGroupItem,
  JsonWindowItem,
} from '@common/types';
import { JSON_DATA_VERSION, JSON_DATA_SCHEMA_REF, JSON_ID_LENGTH } from '@common/types';

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
      expect(item.windowConfig).toBeDefined();
      expect(item.windowConfig?.title).toBe('Cursor*');
      expect(item.windowConfig?.x).toBe(100);
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

    it('JsonGroupItemを正しくパースできること', () => {
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
      const result = parseJsonDataFile(json);
      const item = result.items[0] as JsonGroupItem;
      expect(item.type).toBe('group');
      expect(item.displayName).toBe('開発環境スタート');
      expect(item.itemNames).toEqual(['VS Code', 'GitHub', 'Terminal']);
    });

    it('JsonWindowItemを正しくパースできること', () => {
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
      const item = result.items[0] as JsonWindowItem;
      expect(item.type).toBe('window');
      expect(item.displayName).toBe('MS To DO');
      expect(item.windowTitle).toBe('Microsoft To Do');
      expect(item.x).toBe(1273);
      expect(item.activateWindow).toBe(false);
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

    it('無効なIDでエラーをスローすること', () => {
      const json = JSON.stringify({
        version: '1.0',
        items: [{ id: 'invalid!', type: 'item', displayName: 'Test', path: '/test' }],
      });
      expect(() => parseJsonDataFile(json)).toThrow('Invalid or missing id');
    });
  });

  describe('parseJsonDataFile: $schema', () => {
    it('$schema を保持すること', () => {
      const parsed = parseJsonDataFile(
        JSON.stringify({ $schema: JSON_DATA_SCHEMA_REF, version: '1.0', items: [] })
      );
      expect(parsed.$schema).toBe(JSON_DATA_SCHEMA_REF);
    });

    it('$schema が無ければ付けないこと', () => {
      const parsed = parseJsonDataFile(JSON.stringify({ version: '1.0', items: [] }));
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

    it('$schema → version → items の順で出力し、$schema が無ければ補うこと', () => {
      const result = serializeJsonDataFile({ version: '1.0', items: [] }, false);
      expect(result).toBe(`{"$schema":"${JSON_DATA_SCHEMA_REF}","version":"1.0","items":[]}`);
    });

    it('パースとシリアライズがラウンドトリップすること', () => {
      const original: JsonDataFile = {
        $schema: JSON_DATA_SCHEMA_REF,
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
      expect(result.$schema).toBe(JSON_DATA_SCHEMA_REF);
      expect(result.version).toBe(JSON_DATA_VERSION);
      expect(result.items).toEqual([]);
    });
  });
});

describe('jsonParser: アイテム作成ヘルパー', () => {
  describe('createJsonLauncherItem', () => {
    it('IDを自動生成すること', () => {
      const item = createJsonLauncherItem('Test', '/path');
      expect(isValidId(item.id)).toBe(true);
      expect(item.type).toBe('item');
      expect(item.displayName).toBe('Test');
      expect(item.path).toBe('/path');
    });

    it('オプションフィールドを設定できること', () => {
      const item = createJsonLauncherItem('Test', '/path', {
        args: '--flag',
        customIcon: 'icon.png',
      });
      expect(item.args).toBe('--flag');
      expect(item.customIcon).toBe('icon.png');
    });
  });

  describe('createJsonDirItem', () => {
    it('IDを自動生成すること', () => {
      const item = createJsonDirItem('C:\\tools');
      expect(isValidId(item.id)).toBe(true);
      expect(item.type).toBe('dir');
      expect(item.path).toBe('C:\\tools');
    });

    it('オプションを設定できること', () => {
      const item = createJsonDirItem('C:\\tools', {
        depth: 2,
        types: 'file',
        filter: '*.exe',
      });
      expect(item.options?.depth).toBe(2);
      expect(item.options?.types).toBe('file');
      expect(item.options?.filter).toBe('*.exe');
    });
  });

  describe('createJsonGroupItem', () => {
    it('IDを自動生成すること', () => {
      const item = createJsonGroupItem('Dev Tools', ['VS Code', 'Chrome']);
      expect(isValidId(item.id)).toBe(true);
      expect(item.type).toBe('group');
      expect(item.displayName).toBe('Dev Tools');
      expect(item.itemNames).toEqual(['VS Code', 'Chrome']);
    });
  });

  describe('createJsonWindowItem', () => {
    it('IDを自動生成すること', () => {
      const item = createJsonWindowItem('Chrome', 'Google Chrome');
      expect(isValidId(item.id)).toBe(true);
      expect(item.type).toBe('window');
      expect(item.displayName).toBe('Chrome');
      expect(item.windowTitle).toBe('Google Chrome');
    });

    it('オプションフィールドを設定できること', () => {
      const item = createJsonWindowItem('Chrome', 'Google Chrome', {
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        activateWindow: false,
      });
      expect(item.x).toBe(100);
      expect(item.y).toBe(200);
      expect(item.activateWindow).toBe(false);
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
          type: 'group',
          displayName: 'claude用_quick dash wt 5つ+main',
          itemNames: [
            'claude code用_quick dash main',
            'claude code用_quick dash wt1',
            'claude code用_quick dash wt2',
          ],
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
    expect(result.items[0].type).toBe('window');
    expect(result.items[1].type).toBe('dir');
    expect(result.items[3].type).toBe('group');
    expect(result.items[4].type).toBe('item');
  });
});

describe('jsonParser: 寛容パース（parseJsonDataFileLenient）', () => {
  const validItem = { id: 'abcdefgh', type: 'item', displayName: 'A', path: 'C:\\a.exe' };

  /** $schema 付きの正常なファイル文字列を作る（補完で normalized が混ざらないように） */
  const fileWith = (items: unknown[], extra: Record<string, unknown> = {}): string =>
    JSON.stringify({ $schema: JSON_DATA_SCHEMA_REF, version: '1.0', items, ...extra });

  it('正常なファイルは問題なし・未変更として返すこと', () => {
    const result = parseJsonDataFileLenient(fileWith([validItem]));

    expect(result.issues).toEqual([]);
    expect(result.modified).toBe(false);
    expect(result.validItems).toHaveLength(1);
    expect(result.data.items).toHaveLength(1);
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

  it('ウィンドウ操作のタイトル空・プロセス名だけは "*" に正規化し、書き戻し要にすること', () => {
    const processOnly = {
      id: 'wnAAAAA1',
      type: 'window',
      displayName: 'メモ帳',
      windowTitle: '',
      processName: 'notepad.exe',
    };
    const result = parseJsonDataFileLenient(fileWith([processOnly]));

    expect(result.validItems).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({ windowTitle: '*', processName: 'notepad.exe' });
    expect(result.issues).toEqual([
      expect.objectContaining({ index: 0, kind: 'normalized', id: 'wnAAAAA1' }),
    ]);
    expect(result.modified).toBe(true);
  });

  it('ウィンドウ操作のタイトル空でプロセス名も無ければ invalid のままにすること', () => {
    const result = parseJsonDataFileLenient(
      fileWith([{ id: 'wnAAAAA2', type: 'window', displayName: 'x', windowTitle: '' }])
    );
    expect(result.validItems).toHaveLength(0);
    expect(result.issues).toEqual([expect.objectContaining({ kind: 'invalid', id: 'wnAAAAA2' })]);
    expect(result.issues[0].reason).toContain('windowTitle');
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
    const result = parseJsonDataFileLenient(
      JSON.stringify({ $schema: JSON_DATA_SCHEMA_REF, items: [validItem] })
    );

    expect(result.data.version).toBe(JSON_DATA_VERSION);
    expect(result.modified).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ index: -1, kind: 'normalized' })]);
    expect(result.issues[0].reason).toContain('version');
  });

  it('$schema が無ければ補い、normalized として報告すること', () => {
    const result = parseJsonDataFileLenient(JSON.stringify({ version: '1.0', items: [validItem] }));

    expect(result.data.$schema).toBe(JSON_DATA_SCHEMA_REF);
    expect(result.modified).toBe(true);
    expect(result.issues).toEqual([expect.objectContaining({ index: -1, kind: 'normalized' })]);
    expect(result.issues[0].reason).toContain('$schema');
    // アイテム自体は正常なので validItems はそのまま
    expect(result.validItems).toHaveLength(1);
  });

  it('$schema が同梱スキーマと違えば直し、normalized として報告すること', () => {
    const result = parseJsonDataFileLenient(
      fileWith([validItem], { $schema: 'https://example.com/other.json' })
    );

    expect(result.data.$schema).toBe(JSON_DATA_SCHEMA_REF);
    expect(result.modified).toBe(true);
    expect(result.issues[0].reason).toContain('https://example.com/other.json');
  });

  it('$schema が正しければ保持し、未変更として返すこと', () => {
    const result = parseJsonDataFileLenient(fileWith([validItem]));

    expect(result.data.$schema).toBe(JSON_DATA_SCHEMA_REF);
    expect(result.modified).toBe(false);
  });

  it('寛容パースの結果をシリアライズすると不正アイテムも含めてラウンドトリップすること', () => {
    const broken = { id: 'zzzzzzzz', type: 'group', displayName: 'g', itemNames: 'not-array' };
    const original = { $schema: JSON_DATA_SCHEMA_REF, version: '1.0', items: [validItem, broken] };
    const result = parseJsonDataFileLenient(JSON.stringify(original));

    expect(JSON.parse(serializeJsonDataFile(result.data))).toEqual(original);
  });
});
