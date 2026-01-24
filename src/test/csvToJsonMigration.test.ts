/**
 * csvToJsonMigration.ts のテスト
 * CSV形式からJSON形式へのマイグレーション機能の検証
 */

import { describe, it, expect } from 'vitest';
import {
  detectCsvLineType,
  convertCsvLineToJsonItem,
  convertCsvToJsonDataFile,
  convertCsvToJsonDataFileWithSkip,
  convertCsvFileNameToJson,
  convertJsonFileNameToCsv,
  isCsvDataFile,
  isJsonDataFile,
} from '@common/utils/csvToJsonMigration';
import type {
  JsonLauncherItem,
  JsonDirItem,
  JsonGroupItem,
  JsonWindowItem,
} from '@common/types';
import { isValidId } from '@common/utils/jsonParser';

describe('csvToJsonMigration: 行種別判定', () => {
  describe('detectCsvLineType', () => {
    it('空行を正しく判定すること', () => {
      expect(detectCsvLineType('')).toBe('empty');
      expect(detectCsvLineType('   ')).toBe('empty');
      expect(detectCsvLineType('\t')).toBe('empty');
    });

    it('コメント行を正しく判定すること', () => {
      expect(detectCsvLineType('// コメント')).toBe('comment');
      expect(detectCsvLineType('//コメント')).toBe('comment');
      expect(detectCsvLineType('  //  indented comment')).toBe('comment');
    });

    it('dirディレクティブを正しく判定すること', () => {
      expect(detectCsvLineType('dir,C:\\tools')).toBe('dir');
      expect(detectCsvLineType('dir,C:\\docs,depth=2')).toBe('dir');
    });

    it('groupディレクティブを正しく判定すること', () => {
      expect(detectCsvLineType('group,開発ツール,VSCode,Git')).toBe('group');
    });

    it('windowディレクティブを正しく判定すること', () => {
      expect(detectCsvLineType('window,{"displayName":"Chrome","windowTitle":"Google Chrome"}')).toBe('window');
    });

    it('通常のアイテム行を正しく判定すること', () => {
      expect(detectCsvLineType('GitHub,https://github.com/')).toBe('item');
      expect(detectCsvLineType('VSCode,C:\\Program Files\\code.exe')).toBe('item');
    });
  });
});

describe('csvToJsonMigration: CSV行の変換', () => {
  describe('convertCsvLineToJsonItem - 通常アイテム', () => {
    it('最小限のアイテム行を変換できること', () => {
      const result = convertCsvLineToJsonItem('GitHub,https://github.com/');
      expect(result).not.toBeNull();
      const item = result as JsonLauncherItem;
      expect(item.type).toBe('item');
      expect(item.displayName).toBe('GitHub');
      expect(item.path).toBe('https://github.com/');
      expect(isValidId(item.id)).toBe(true);
    });

    it('引数付きアイテムを変換できること', () => {
      const result = convertCsvLineToJsonItem('Cursor,C:\\Program Files\\cursor\\Cursor.exe,C:\\Users\\project');
      const item = result as JsonLauncherItem;
      expect(item.args).toBe('C:\\Users\\project');
    });

    it('カスタムアイコン付きアイテムを変換できること', () => {
      const result = convertCsvLineToJsonItem('Test,C:\\test.exe,,custom.png');
      const item = result as JsonLauncherItem;
      expect(item.args).toBeUndefined();
      expect(item.customIcon).toBe('custom.png');
    });

    it('WindowConfig付きアイテムを変換できること', () => {
      const csvLine = 'メモ帳,C:\\notepad.exe,,,{"title":"Notepad","x":100,"y":200}';
      const result = convertCsvLineToJsonItem(csvLine);
      const item = result as JsonLauncherItem;
      expect(item.windowConfig).toBeDefined();
      expect(item.windowConfig?.title).toBe('Notepad');
      expect(item.windowConfig?.x).toBe(100);
      expect(item.windowConfig?.y).toBe(200);
    });

    it('文字列形式のWindowConfigも変換できること', () => {
      const csvLine = 'Chrome,C:\\chrome.exe,,,Google Chrome';
      const result = convertCsvLineToJsonItem(csvLine);
      const item = result as JsonLauncherItem;
      expect(item.windowConfig).toBeDefined();
      expect(item.windowConfig?.title).toBe('Google Chrome');
    });
  });

  describe('convertCsvLineToJsonItem - dir', () => {
    it('最小限のdir行を変換できること', () => {
      const result = convertCsvLineToJsonItem('dir,C:\\tools');
      const item = result as JsonDirItem;
      expect(item.type).toBe('dir');
      expect(item.path).toBe('C:\\tools');
      expect(isValidId(item.id)).toBe(true);
    });

    it('オプション付きdir行を変換できること', () => {
      const result = convertCsvLineToJsonItem('dir,C:\\tools,depth=1,types=file,filter=*.exe,prefix=Tool: ');
      const item = result as JsonDirItem;
      expect(item.options?.depth).toBe(1);
      expect(item.options?.types).toBe('file');
      expect(item.options?.filter).toBe('*.exe');
      expect(item.options?.prefix).toBe('Tool: ');
    });

    it('types=folderのdir行を変換できること', () => {
      const result = convertCsvLineToJsonItem('dir,C:\\git,types=folder,prefix=【git】');
      const item = result as JsonDirItem;
      expect(item.options?.types).toBe('folder');
      expect(item.options?.prefix).toBe('【git】');
    });
  });

  describe('convertCsvLineToJsonItem - group', () => {
    it('group行を変換できること', () => {
      const result = convertCsvLineToJsonItem('group,開発環境,VSCode,Git,Terminal');
      const item = result as JsonGroupItem;
      expect(item.type).toBe('group');
      expect(item.displayName).toBe('開発環境');
      expect(item.itemNames).toEqual(['VSCode', 'Git', 'Terminal']);
      expect(isValidId(item.id)).toBe(true);
    });

    it('日本語のグループ名とアイテム名を変換できること', () => {
      const result = convertCsvLineToJsonItem('group,日本語グループ,アイテム１,アイテム２');
      const item = result as JsonGroupItem;
      expect(item.displayName).toBe('日本語グループ');
      expect(item.itemNames).toEqual(['アイテム１', 'アイテム２']);
    });
  });

  describe('convertCsvLineToJsonItem - window', () => {
    it('window行を変換できること', () => {
      const csvLine = 'window,{"displayName":"MS To DO","windowTitle":"Microsoft To Do","x":100,"y":200}';
      const result = convertCsvLineToJsonItem(csvLine);
      const item = result as JsonWindowItem;
      expect(item.type).toBe('window');
      expect(item.displayName).toBe('MS To DO');
      expect(item.windowTitle).toBe('Microsoft To Do');
      expect(item.x).toBe(100);
      expect(item.y).toBe(200);
      expect(isValidId(item.id)).toBe(true);
    });

    it('全オプション付きwindow行を変換できること', () => {
      const config = {
        displayName: 'Chrome',
        windowTitle: 'Google Chrome',
        processName: 'chrome.exe',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        virtualDesktopNumber: 2,
        activateWindow: false,
        pinToAllDesktops: true,
      };
      const csvLine = `window,${JSON.stringify(config)}`;
      const result = convertCsvLineToJsonItem(csvLine);
      const item = result as JsonWindowItem;
      expect(item.processName).toBe('chrome.exe');
      expect(item.width).toBe(1920);
      expect(item.height).toBe(1080);
      expect(item.virtualDesktopNumber).toBe(2);
      expect(item.activateWindow).toBe(false);
      expect(item.pinToAllDesktops).toBe(true);
    });

    it('旧形式のnameフィールドも対応すること', () => {
      const csvLine = 'window,{"name":"旧形式","windowTitle":"Test Window"}';
      const result = convertCsvLineToJsonItem(csvLine);
      const item = result as JsonWindowItem;
      expect(item.displayName).toBe('旧形式');
    });
  });

  describe('convertCsvLineToJsonItem - コメントと空行', () => {
    it('空行はnullを返すこと', () => {
      expect(convertCsvLineToJsonItem('')).toBeNull();
      expect(convertCsvLineToJsonItem('   ')).toBeNull();
    });

    it('コメント行はnullを返すこと', () => {
      expect(convertCsvLineToJsonItem('// コメント')).toBeNull();
      expect(convertCsvLineToJsonItem('//コメント')).toBeNull();
    });
  });

  describe('convertCsvLineToJsonItem - エラーケース', () => {
    it('フィールドが不足しているアイテム行でエラーをスローすること', () => {
      expect(() => convertCsvLineToJsonItem('OnlyName')).toThrow();
    });

    it('displayNameが空のアイテム行でエラーをスローすること', () => {
      expect(() => convertCsvLineToJsonItem(',C:\\test.exe')).toThrow();
    });

    it('pathが空のdir行でエラーをスローすること', () => {
      expect(() => convertCsvLineToJsonItem('dir,')).toThrow();
    });

    it('不正なJSONのwindow行でエラーをスローすること', () => {
      expect(() => convertCsvLineToJsonItem('window,{invalid}')).toThrow();
    });
  });
});

describe('csvToJsonMigration: ファイル全体の変換', () => {
  describe('convertCsvToJsonDataFile', () => {
    it('複数行のCSVファイルを変換できること', () => {
      const csvContent = `// データファイル
GitHub,https://github.com/
dir,C:\\tools
group,Dev,VSCode,Terminal

`;
      const result = convertCsvToJsonDataFile(csvContent);
      expect(result.version).toBe('1.0');
      expect(result.items).toHaveLength(3);
      expect(result.items[0].type).toBe('item');
      expect(result.items[1].type).toBe('dir');
      expect(result.items[2].type).toBe('group');
    });

    it('エラーがある行で例外をスローすること', () => {
      const csvContent = `ValidItem,https://example.com
InvalidItem`;
      expect(() => convertCsvToJsonDataFile(csvContent)).toThrow('CSV conversion errors');
    });
  });

  describe('convertCsvToJsonDataFileWithSkip', () => {
    it('エラー行をスキップして変換できること', () => {
      const csvContent = `ValidItem,https://example.com
InvalidItem
AnotherValid,C:\\test.exe`;
      const { data, skippedLines } = convertCsvToJsonDataFileWithSkip(csvContent);
      expect(data.items).toHaveLength(2);
      expect(skippedLines).toHaveLength(1);
      expect(skippedLines[0].lineNumber).toBe(2);
      expect(skippedLines[0].content).toBe('InvalidItem');
    });

    it('全ての行が有効な場合はスキップ行が空になること', () => {
      const csvContent = `Item1,https://example.com
Item2,C:\\test.exe`;
      const { data, skippedLines } = convertCsvToJsonDataFileWithSkip(csvContent);
      expect(data.items).toHaveLength(2);
      expect(skippedLines).toHaveLength(0);
    });
  });
});

describe('csvToJsonMigration: ファイル名変換', () => {
  describe('convertCsvFileNameToJson', () => {
    it('.txtを.jsonに変換すること', () => {
      expect(convertCsvFileNameToJson('data.txt')).toBe('data.json');
      expect(convertCsvFileNameToJson('data2.txt')).toBe('data2.json');
      expect(convertCsvFileNameToJson('data3.txt')).toBe('data3.json');
    });

    it('.txt以外のファイル名でエラーをスローすること', () => {
      expect(() => convertCsvFileNameToJson('data.json')).toThrow();
      expect(() => convertCsvFileNameToJson('data')).toThrow();
    });
  });

  describe('convertJsonFileNameToCsv', () => {
    it('.jsonを.txtに変換すること', () => {
      expect(convertJsonFileNameToCsv('data.json')).toBe('data.txt');
      expect(convertJsonFileNameToCsv('data2.json')).toBe('data2.txt');
    });

    it('.json以外のファイル名でエラーをスローすること', () => {
      expect(() => convertJsonFileNameToCsv('data.txt')).toThrow();
    });
  });

  describe('isCsvDataFile', () => {
    it('data*.txt形式のファイル名を正しく判定すること', () => {
      expect(isCsvDataFile('data.txt')).toBe(true);
      expect(isCsvDataFile('data2.txt')).toBe(true);
      expect(isCsvDataFile('data100.txt')).toBe(true);
    });

    it('data*.txt形式でないファイル名をfalseにすること', () => {
      expect(isCsvDataFile('data.json')).toBe(false);
      expect(isCsvDataFile('other.txt')).toBe(false);
      expect(isCsvDataFile('data')).toBe(false);
    });
  });

  describe('isJsonDataFile', () => {
    it('data*.json形式のファイル名を正しく判定すること', () => {
      expect(isJsonDataFile('data.json')).toBe(true);
      expect(isJsonDataFile('data2.json')).toBe(true);
      expect(isJsonDataFile('data100.json')).toBe(true);
    });

    it('data*.json形式でないファイル名をfalseにすること', () => {
      expect(isJsonDataFile('data.txt')).toBe(false);
      expect(isJsonDataFile('other.json')).toBe(false);
      expect(isJsonDataFile('data')).toBe(false);
    });
  });
});

describe('csvToJsonMigration: 実際のデータ形式の変換', () => {
  it('計画書のサンプルCSVを変換できること', () => {
    const csvContent = `// テストデータ
window,{"displayName":"MS To DO","windowTitle":"Microsoft To Do","x":1273,"y":1,"width":1293,"height":1397,"virtualDesktopNumber":1,"activateWindow":false}
dir,C:\\Users\\daido\\.myahk_v2\\tools
dir,C:\\Users\\daido\\git\\masao\\github,types=folder,prefix=【git local】
group,claude用_quick dash wt 5つ+main,claude code用_quick dash main,claude code用_quick dash wt1,claude code用_quick dash wt2
WSL HOME（Windowsで開く）,\\\\wsl.localhost\\Ubuntu-24.04\\home\\masao
一時メモ,C:\\Users\\daido\\.myahk_v2\\一時メモ.txt,,,{"title":"一時メモ.txt - sakura","processName":"sakura.exe","x":846,"y":244,"width":1708,"height":1032}
npm,https://www.npmjs.com/
`;

    const result = convertCsvToJsonDataFile(csvContent);
    expect(result.version).toBe('1.0');
    expect(result.items).toHaveLength(7);

    // window アイテムの検証
    const windowItem = result.items[0] as JsonWindowItem;
    expect(windowItem.type).toBe('window');
    expect(windowItem.displayName).toBe('MS To DO');
    expect(windowItem.windowTitle).toBe('Microsoft To Do');
    expect(windowItem.virtualDesktopNumber).toBe(1);
    expect(windowItem.activateWindow).toBe(false);

    // dir アイテムの検証
    const dirItem = result.items[1] as JsonDirItem;
    expect(dirItem.type).toBe('dir');
    expect(dirItem.path).toBe('C:\\Users\\daido\\.myahk_v2\\tools');

    // dir with options の検証
    const dirWithOptions = result.items[2] as JsonDirItem;
    expect(dirWithOptions.options?.types).toBe('folder');
    expect(dirWithOptions.options?.prefix).toBe('【git local】');

    // group アイテムの検証
    const groupItem = result.items[3] as JsonGroupItem;
    expect(groupItem.type).toBe('group');
    expect(groupItem.displayName).toBe('claude用_quick dash wt 5つ+main');
    expect(groupItem.itemNames).toHaveLength(3);

    // 通常アイテムの検証
    const launcherItem = result.items[4] as JsonLauncherItem;
    expect(launcherItem.type).toBe('item');
    expect(launcherItem.displayName).toBe('WSL HOME（Windowsで開く）');

    // WindowConfig付きアイテムの検証
    const itemWithWindowConfig = result.items[5] as JsonLauncherItem;
    expect(itemWithWindowConfig.windowConfig).toBeDefined();
    expect(itemWithWindowConfig.windowConfig?.title).toBe('一時メモ.txt - sakura');
    expect(itemWithWindowConfig.windowConfig?.processName).toBe('sakura.exe');

    // URL アイテムの検証
    const urlItem = result.items[6] as JsonLauncherItem;
    expect(urlItem.path).toBe('https://www.npmjs.com/');
  });
});
