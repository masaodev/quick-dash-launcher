import { describe, it, expect } from 'vitest';
import {
  isGroupDirective,
  isDirDirective,
  isWindowOperationDirective,
  parseGroupDirective,
  parseDirDirective,
  parseWindowOperationDirective,
} from '@common/utils/directiveUtils';
import type { RawDataLine } from '@common/types';

describe('directiveUtils', () => {
  describe('isGroupDirective', () => {
    it('グループディレクティブを正しく判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'group,開発ツール,VSCode,Git,Docker',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isGroupDirective(line)).toBe(true);
    });

    it('非グループディレクティブをfalseと判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'dir,C:\\docs',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isGroupDirective(line)).toBe(false);
    });

    it('アイテム行をfalseと判定する', () => {
      const line: RawDataLine = {
        type: 'item',
        content: 'Google,https://google.com',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isGroupDirective(line)).toBe(false);
    });
  });

  describe('isDirDirective', () => {
    it('フォルダ取込ディレクティブを正しく判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'dir,C:\\docs,depth=2',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isDirDirective(line)).toBe(true);
    });

    it('非フォルダ取込ディレクティブをfalseと判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'group,開発ツール,VSCode',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isDirDirective(line)).toBe(false);
    });
  });

  describe('isWindowOperationDirective', () => {
    it('ウィンドウ操作ディレクティブ（JSON形式）を正しく判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'window,{"name":"表示名","windowTitle":"Chrome"}',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isWindowOperationDirective(line)).toBe(true);
    });

    it('非ウィンドウ操作ディレクティブをfalseと判定する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'group,開発ツール,VSCode',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      expect(isWindowOperationDirective(line)).toBe(false);
    });
  });

  describe('parseGroupDirective', () => {
    it('グループディレクティブを正しく解析する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'group,開発ツール,VSCode,Git,Docker',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      const result = parseGroupDirective(line);
      expect(result).toEqual({
        groupName: '開発ツール',
        itemNames: ['VSCode', 'Git', 'Docker'],
      });
    });

    it('アイテムが空のグループディレクティブを解析する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'group,空グループ',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      const result = parseGroupDirective(line);
      expect(result).toEqual({
        groupName: '空グループ',
        itemNames: [],
      });
    });
  });

  describe('parseDirDirective', () => {
    it('フォルダ取込ディレクティブを正しく解析する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'dir,C:\\docs,depth=2,filter=*.pdf',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      const result = parseDirDirective(line);
      expect(result.dirPath).toBe('C:\\docs');
      expect(result.options.depth).toBe(2);
      expect(result.options.filter).toBe('*.pdf');
    });

    it('オプションなしのフォルダ取込ディレクティブを解析する', () => {
      const line: RawDataLine = {
        type: 'directive',
        content: 'dir,C:\\docs',
        lineNumber: 1,
        sourceFile: 'data.txt',
      };
      const result = parseDirDirective(line);
      expect(result.dirPath).toBe('C:\\docs');
      // parseDirOptionsFromStringはオプション文字列が空の場合、デフォルト値を返す
      // dataConverters.tsのDirOptionsのデフォルト値を確認する必要がある
      expect(result.options.types).toBe('both'); // デフォルト値
    });
  });

  describe('parseWindowOperationDirective', () => {
    describe('JSON形式の解析', () => {
      it('基本的なJSON形式を正しくパースする（CSV形式でエスケープ済み）', () => {
        const line: RawDataLine = {
          type: 'directive',
          // 実際のdata.txtに保存される形式（CSV形式でエスケープされたJSON）
          content: 'window,"{""name"":""表示名"",""windowTitle"":""Chrome""}"',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        const result = parseWindowOperationDirective(line);
        expect(result.name).toBe('表示名');
        expect(result.windowTitle).toBe('Chrome');
        expect(result.x).toBeUndefined();
        expect(result.y).toBeUndefined();
      });

      it('すべてのフィールドを含むJSON形式をパースする（CSV形式でエスケープ済み）', () => {
        const line: RawDataLine = {
          type: 'directive',
          // 実際のdata.txtに保存される形式（CSV形式でエスケープされたJSON）
          content:
            'window,"{""name"":""TODOキャンパス"",""windowTitle"":""Obsidian"",""x"":100,""y"":200,""width"":1920,""height"":1080,""virtualDesktopNumber"":2,""activateWindow"":true}"',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        const result = parseWindowOperationDirective(line);
        expect(result.name).toBe('TODOキャンパス');
        expect(result.windowTitle).toBe('Obsidian');
        expect(result.x).toBe(100);
        expect(result.y).toBe(200);
        expect(result.width).toBe(1920);
        expect(result.height).toBe(1080);
        expect(result.virtualDesktopNumber).toBe(2);
        expect(result.activateWindow).toBe(true);
      });

      it('CSV形式でエスケープされたJSON形式をパースする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,"{""name"":""表示名"",""windowTitle"":""Chrome""}"',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        const result = parseWindowOperationDirective(line);
        expect(result.name).toBe('表示名');
        expect(result.windowTitle).toBe('Chrome');
      });

      it('オプションフィールドが欠けている場合はundefinedを返す', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,"{""name"":""表示名"",""windowTitle"":""Chrome"",""x"":100}"',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        const result = parseWindowOperationDirective(line);
        expect(result.x).toBe(100);
        expect(result.y).toBeUndefined();
        expect(result.width).toBeUndefined();
        expect(result.height).toBeUndefined();
        expect(result.virtualDesktopNumber).toBeUndefined();
        expect(result.activateWindow).toBeUndefined();
      });
    });

    describe('エラーハンドリング', () => {
      it('JSON形式でない場合はエラーをスローする（旧CSV形式）', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,Chrome,100,100,1920,1080',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        expect(() => parseWindowOperationDirective(line)).toThrow(
          'ウィンドウ操作アイテムはJSON形式で記述する必要があります'
        );
      });

      it('不正なJSON形式の場合はエラーをスローする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,{invalid json}',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        expect(() => parseWindowOperationDirective(line)).toThrow('JSON形式が不正です');
      });

      it('第2フィールドが空の場合はエラーをスローする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        expect(() => parseWindowOperationDirective(line)).toThrow(
          'ウィンドウ操作アイテムはJSON形式で記述する必要があります'
        );
      });

      it('{で始まらない文字列の場合はエラーをスローする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,not json',
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        expect(() => parseWindowOperationDirective(line)).toThrow(
          'ウィンドウ操作アイテムはJSON形式で記述する必要があります'
        );
      });

      it('JSON.parseでSyntaxErrorが発生した場合に詳細なエラーメッセージをスローする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content: 'window,{"name":"test"', // 閉じ括弧なし
          lineNumber: 1,
          sourceFile: 'data.txt',
        };
        expect(() => parseWindowOperationDirective(line)).toThrow('JSON形式が不正です');
      });
    });

    describe('実際のデータ形式でのテスト', () => {
      it('data.txtに保存される実際の形式（CSV形式でエスケープされたJSON）をパースする', () => {
        const line: RawDataLine = {
          type: 'directive',
          content:
            'window,"{""name"":""TODOキャンパス"",""windowTitle"":""TODOキャンパス - obsidian-pri - Obsidian v1.10.6"",""x"":2565,""y"":0,""width"":1990,""height"":1392,""activateWindow"":false}"',
          lineNumber: 70,
          sourceFile: 'data.txt',
        };
        const result = parseWindowOperationDirective(line);
        expect(result.name).toBe('TODOキャンパス');
        expect(result.windowTitle).toBe('TODOキャンパス - obsidian-pri - Obsidian v1.10.6');
        expect(result.x).toBe(2565);
        expect(result.y).toBe(0);
        expect(result.width).toBe(1990);
        expect(result.height).toBe(1392);
        expect(result.activateWindow).toBe(false);
        expect(result.virtualDesktopNumber).toBeUndefined();
      });
    });
  });
});
