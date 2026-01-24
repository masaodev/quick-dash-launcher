/**
 * loadRawDataFiles関連のテスト
 * JSON形式データファイルからの生データ読み込み機能の検証
 */

import { describe, it, expect } from 'vitest';
import { parseCSVLine } from '@common/utils/csvParser';
import {
  isGroupDirective,
  isDirDirective,
  isWindowOperationDirective,
  parseWindowOperationConfig,
} from '@common/utils/directiveUtils';
import type { RawDataLine } from '@common/types';
import type { JsonDataFile, JsonItem } from '@common/types';
import {
  convertJsonItemToCsvLine,
  convertJsonDataFileToRawDataLines,
  convertRawDataLineToJsonItem,
  convertRawDataLinesToJsonDataFile,
} from '@common/utils/jsonToRawDataConverter';

describe('rawDataLoader: JsonItem → CSV行 変換', () => {
  describe('convertJsonItemToCsvLine - 通常アイテム', () => {
    it('最小限のアイテムを変換できること', () => {
      const item: JsonItem = {
        id: 'a1b2c3d4',
        type: 'item',
        displayName: 'GitHub',
        path: 'https://github.com/',
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('GitHub,https://github.com/');
    });

    it('引数付きアイテムを変換できること', () => {
      const item: JsonItem = {
        id: 'a1b2c3d4',
        type: 'item',
        displayName: 'Cursor',
        path: 'C:\\Program Files\\cursor\\Cursor.exe',
        args: 'C:\\Users\\project',
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('Cursor,C:\\Program Files\\cursor\\Cursor.exe,C:\\Users\\project');
    });

    it('カスタムアイコン付きアイテムを変換できること', () => {
      const item: JsonItem = {
        id: 'a1b2c3d4',
        type: 'item',
        displayName: 'Test',
        path: 'C:\\test.exe',
        customIcon: 'custom.png',
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('Test,C:\\test.exe,,custom.png');
    });

    it('WindowConfig付きアイテムを変換できること', () => {
      const item: JsonItem = {
        id: 'a1b2c3d4',
        type: 'item',
        displayName: 'メモ帳',
        path: 'C:\\notepad.exe',
        windowConfig: {
          title: 'Notepad',
          x: 100,
          y: 200,
        },
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toContain('メモ帳,C:\\notepad.exe');
      expect(csvLine).toContain('"title":"Notepad"');
    });

    it('カンマを含む表示名が正しくエスケープされること', () => {
      const item: JsonItem = {
        id: 'a1b2c3d4',
        type: 'item',
        displayName: 'Test, Item',
        path: 'C:\\test.exe',
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('"Test, Item",C:\\test.exe');
    });
  });

  describe('convertJsonItemToCsvLine - dir', () => {
    it('最小限のdirを変換できること', () => {
      const item: JsonItem = {
        id: 'i9j0k1l2',
        type: 'dir',
        path: 'C:\\tools',
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('dir,C:\\tools');
    });

    it('オプション付きdirを変換できること', () => {
      const item: JsonItem = {
        id: 'i9j0k1l2',
        type: 'dir',
        path: 'C:\\tools',
        options: {
          depth: 1,
          types: 'file',
          filter: '*.exe',
          prefix: 'Tool: ',
        },
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toContain('dir,C:\\tools');
      expect(csvLine).toContain('depth=1');
      expect(csvLine).toContain('types=file');
      expect(csvLine).toContain('filter=*.exe');
      expect(csvLine).toContain('prefix=Tool: ');
    });
  });

  describe('convertJsonItemToCsvLine - group', () => {
    it('groupを変換できること', () => {
      const item: JsonItem = {
        id: 'm3n4o5p6',
        type: 'group',
        displayName: '開発環境',
        itemNames: ['VSCode', 'Git', 'Terminal'],
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toBe('group,開発環境,VSCode,Git,Terminal');
    });
  });

  describe('convertJsonItemToCsvLine - window', () => {
    it('windowを変換できること', () => {
      const item: JsonItem = {
        id: 'q7r8s9t0',
        type: 'window',
        displayName: 'MS To DO',
        windowTitle: 'Microsoft To Do',
        x: 100,
        y: 200,
      };
      const csvLine = convertJsonItemToCsvLine(item);
      expect(csvLine).toContain('window,');
      // JSON部分をパース可能か確認
      const parts = parseCSVLine(csvLine);
      expect(parts[0]).toBe('window');
      const config = JSON.parse(parts[1]);
      expect(config.displayName).toBe('MS To DO');
      expect(config.windowTitle).toBe('Microsoft To Do');
      expect(config.x).toBe(100);
      expect(config.y).toBe(200);
    });
  });
});

describe('rawDataLoader: JsonDataFile → RawDataLine[] 変換', () => {
  it('JsonDataFileをRawDataLine配列に変換できること', () => {
    const jsonData: JsonDataFile = {
      version: '1.0',
      items: [
        {
          id: 'a1b2c3d4',
          type: 'item',
          displayName: 'GitHub',
          path: 'https://github.com/',
        },
        {
          id: 'e5f6g7h8',
          type: 'dir',
          path: 'C:\\tools',
        },
        {
          id: 'i9j0k1l2',
          type: 'group',
          displayName: '開発環境',
          itemNames: ['VSCode', 'Terminal'],
        },
      ],
    };

    const rawLines = convertJsonDataFileToRawDataLines(jsonData, 'data.json');

    expect(rawLines).toHaveLength(3);

    // 1つ目: item
    expect(rawLines[0].type).toBe('item');
    expect(rawLines[0].lineNumber).toBe(1);
    expect(rawLines[0].sourceFile).toBe('data.json');
    expect(rawLines[0].content).toBe('GitHub,https://github.com/');

    // 2つ目: dir (directive)
    expect(rawLines[1].type).toBe('directive');
    expect(rawLines[1].content).toBe('dir,C:\\tools');

    // 3つ目: group (directive)
    expect(rawLines[2].type).toBe('directive');
    expect(rawLines[2].content).toBe('group,開発環境,VSCode,Terminal');
  });

  it('カスタムアイコンが正しく設定されること', () => {
    const jsonData: JsonDataFile = {
      version: '1.0',
      items: [
        {
          id: 'a1b2c3d4',
          type: 'item',
          displayName: 'Test',
          path: 'C:\\test.exe',
          customIcon: 'custom.png',
        },
      ],
    };

    const rawLines = convertJsonDataFileToRawDataLines(jsonData, 'data.json');

    expect(rawLines[0].customIcon).toBe('custom.png');
  });
});

describe('rawDataLoader: RawDataLine から名前を取得', () => {
  /**
   * RawDataLineから表示名を取得する
   * AdminItemManagerListのrenderNameCellと同等のロジック
   */
  function getDisplayName(line: RawDataLine): string {
    const parts = parseCSVLine(line.content);

    if (line.type === 'item') {
      return parts[0] || '';
    } else if (isGroupDirective(line)) {
      return parts[1] || '';
    } else if (isWindowOperationDirective(line)) {
      try {
        const config = parseWindowOperationConfig(parts[1] || '');
        return config.displayName || '';
      } catch {
        return '(JSON形式エラー)';
      }
    } else if (isDirDirective(line)) {
      return ''; // フォルダ取込は名前がない
    }

    return '';
  }

  it('item行から表示名を取得できること', () => {
    const line: RawDataLine = {
      lineNumber: 1,
      content: 'GitHub,https://github.com/',
      type: 'item',
      sourceFile: 'data.json',
    };

    expect(getDisplayName(line)).toBe('GitHub');
  });

  it('group行から表示名を取得できること', () => {
    const line: RawDataLine = {
      lineNumber: 1,
      content: 'group,開発環境,VSCode,Terminal',
      type: 'directive',
      sourceFile: 'data.json',
    };

    expect(getDisplayName(line)).toBe('開発環境');
  });

  it('window行から表示名を取得できること', () => {
    const config = { displayName: 'MS To DO', windowTitle: 'Microsoft To Do' };
    const jsonStr = JSON.stringify(config);
    const escapedJson = `"${jsonStr.replace(/"/g, '""')}"`;

    const line: RawDataLine = {
      lineNumber: 1,
      content: `window,${escapedJson}`,
      type: 'directive',
      sourceFile: 'data.json',
    };

    expect(getDisplayName(line)).toBe('MS To DO');
  });

  it('JSONから変換されたRawDataLineから表示名を取得できること', () => {
    const jsonData: JsonDataFile = {
      version: '1.0',
      items: [
        {
          id: 'a1b2c3d4',
          type: 'item',
          displayName: 'テストアイテム',
          path: 'C:\\test.exe',
        },
        {
          id: 'e5f6g7h8',
          type: 'group',
          displayName: 'テストグループ',
          itemNames: ['Item1', 'Item2'],
        },
        {
          id: 'i9j0k1l2',
          type: 'window',
          displayName: 'テストウィンドウ',
          windowTitle: 'Test Window',
        },
      ],
    };

    const rawLines = convertJsonDataFileToRawDataLines(jsonData, 'data.json');

    expect(getDisplayName(rawLines[0])).toBe('テストアイテム');
    expect(getDisplayName(rawLines[1])).toBe('テストグループ');
    expect(getDisplayName(rawLines[2])).toBe('テストウィンドウ');
  });
});

describe('rawDataLoader: RawDataLine → JsonItem 逆変換', () => {
  describe('convertRawDataLineToJsonItem - 通常アイテム', () => {
    it('基本的なアイテム行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'GitHub,https://github.com/',
        type: 'item',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('item');
      if (item.type === 'item') {
        expect(item.displayName).toBe('GitHub');
        expect(item.path).toBe('https://github.com/');
        expect(item.id).toHaveLength(8);
      }
    });

    it('引数付きアイテム行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'Cursor,C:\\Cursor.exe,C:\\project',
        type: 'item',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('item');
      if (item.type === 'item') {
        expect(item.displayName).toBe('Cursor');
        expect(item.path).toBe('C:\\Cursor.exe');
        expect(item.args).toBe('C:\\project');
      }
    });

    it('カスタムアイコン付きアイテム行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'Test,C:\\test.exe,,custom.png',
        type: 'item',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('item');
      if (item.type === 'item') {
        expect(item.displayName).toBe('Test');
        expect(item.customIcon).toBe('custom.png');
      }
    });
  });

  describe('convertRawDataLineToJsonItem - dir', () => {
    it('基本的なdir行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'dir,C:\\tools',
        type: 'directive',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('dir');
      if (item.type === 'dir') {
        expect(item.path).toBe('C:\\tools');
        expect(item.id).toHaveLength(8);
      }
    });

    it('オプション付きdir行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'dir,C:\\tools,depth=1,types=file,filter=*.exe',
        type: 'directive',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('dir');
      if (item.type === 'dir') {
        expect(item.path).toBe('C:\\tools');
        expect(item.options?.depth).toBe(1);
        expect(item.options?.types).toBe('file');
        expect(item.options?.filter).toBe('*.exe');
      }
    });
  });

  describe('convertRawDataLineToJsonItem - group', () => {
    it('group行をJsonItemに変換できること', () => {
      const line: RawDataLine = {
        lineNumber: 1,
        content: 'group,開発環境,VSCode,Git,Terminal',
        type: 'directive',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('group');
      if (item.type === 'group') {
        expect(item.displayName).toBe('開発環境');
        expect(item.itemNames).toEqual(['VSCode', 'Git', 'Terminal']);
        expect(item.id).toHaveLength(8);
      }
    });
  });

  describe('convertRawDataLineToJsonItem - window', () => {
    it('window行をJsonItemに変換できること', () => {
      const config = { displayName: 'MS To DO', windowTitle: 'Microsoft To Do', x: 100, y: 200 };
      const jsonStr = JSON.stringify(config);
      const escapedJson = `"${jsonStr.replace(/"/g, '""')}"`;

      const line: RawDataLine = {
        lineNumber: 1,
        content: `window,${escapedJson}`,
        type: 'directive',
        sourceFile: 'data.json',
      };

      const item = convertRawDataLineToJsonItem(line);

      expect(item.type).toBe('window');
      if (item.type === 'window') {
        expect(item.displayName).toBe('MS To DO');
        expect(item.windowTitle).toBe('Microsoft To Do');
        expect(item.x).toBe(100);
        expect(item.y).toBe(200);
        expect(item.id).toHaveLength(8);
      }
    });
  });
});

describe('rawDataLoader: RawDataLine[] → JsonDataFile 逆変換', () => {
  it('RawDataLine配列をJsonDataFileに変換できること', () => {
    const rawLines: RawDataLine[] = [
      {
        lineNumber: 1,
        content: 'GitHub,https://github.com/',
        type: 'item',
        sourceFile: 'data.json',
      },
      {
        lineNumber: 2,
        content: 'dir,C:\\tools',
        type: 'directive',
        sourceFile: 'data.json',
      },
      {
        lineNumber: 3,
        content: 'group,開発環境,VSCode,Terminal',
        type: 'directive',
        sourceFile: 'data.json',
      },
    ];

    const jsonData = convertRawDataLinesToJsonDataFile(rawLines);

    expect(jsonData.version).toBe('1.0');
    expect(jsonData.items).toHaveLength(3);
    expect(jsonData.items[0].type).toBe('item');
    expect(jsonData.items[1].type).toBe('dir');
    expect(jsonData.items[2].type).toBe('group');
  });

  it('空行とコメント行はスキップされること', () => {
    const rawLines: RawDataLine[] = [
      {
        lineNumber: 1,
        content: '// コメント行',
        type: 'comment',
        sourceFile: 'data.json',
      },
      {
        lineNumber: 2,
        content: '',
        type: 'empty',
        sourceFile: 'data.json',
      },
      {
        lineNumber: 3,
        content: 'GitHub,https://github.com/',
        type: 'item',
        sourceFile: 'data.json',
      },
    ];

    const jsonData = convertRawDataLinesToJsonDataFile(rawLines);

    expect(jsonData.items).toHaveLength(1);
    expect(jsonData.items[0].type).toBe('item');
  });
});

describe('rawDataLoader: ラウンドトリップテスト', () => {
  it('JsonDataFile → RawDataLine[] → JsonDataFile の往復変換が正しく動作すること', () => {
    const originalJsonData: JsonDataFile = {
      version: '1.0',
      items: [
        {
          id: 'a1b2c3d4',
          type: 'item',
          displayName: 'GitHub',
          path: 'https://github.com/',
        },
        {
          id: 'e5f6g7h8',
          type: 'dir',
          path: 'C:\\tools',
          options: {
            depth: 2,
            types: 'file',
          },
        },
        {
          id: 'i9j0k1l2',
          type: 'group',
          displayName: '開発環境',
          itemNames: ['VSCode', 'Terminal'],
        },
        {
          id: 'q7r8s9t0',
          type: 'window',
          displayName: 'メモ帳',
          windowTitle: 'Notepad',
          x: 100,
          y: 200,
        },
      ],
    };

    // JsonDataFile → RawDataLine[]
    const rawLines = convertJsonDataFileToRawDataLines(originalJsonData, 'data.json');

    // RawDataLine[] → JsonDataFile
    const restoredJsonData = convertRawDataLinesToJsonDataFile(rawLines);

    // 構造が一致することを確認（IDは新規生成されるので除外）
    expect(restoredJsonData.version).toBe('1.0');
    expect(restoredJsonData.items).toHaveLength(4);

    // 各アイテムの内容を確認
    const item0 = restoredJsonData.items[0];
    expect(item0.type).toBe('item');
    if (item0.type === 'item') {
      expect(item0.displayName).toBe('GitHub');
      expect(item0.path).toBe('https://github.com/');
    }

    const item1 = restoredJsonData.items[1];
    expect(item1.type).toBe('dir');
    if (item1.type === 'dir') {
      expect(item1.path).toBe('C:\\tools');
      expect(item1.options?.depth).toBe(2);
      expect(item1.options?.types).toBe('file');
    }

    const item2 = restoredJsonData.items[2];
    expect(item2.type).toBe('group');
    if (item2.type === 'group') {
      expect(item2.displayName).toBe('開発環境');
      expect(item2.itemNames).toEqual(['VSCode', 'Terminal']);
    }

    const item3 = restoredJsonData.items[3];
    expect(item3.type).toBe('window');
    if (item3.type === 'window') {
      expect(item3.displayName).toBe('メモ帳');
      expect(item3.windowTitle).toBe('Notepad');
      expect(item3.x).toBe(100);
      expect(item3.y).toBe(200);
    }
  });
});
