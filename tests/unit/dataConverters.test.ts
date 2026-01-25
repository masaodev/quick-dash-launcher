import { describe, it, expect } from 'vitest';
import { convertRegisterItemToRawDataLine } from '@common/utils/dataConverters';
import type { RegisterItem, RawDataLine } from '@common/types';

describe('convertRegisterItemToRawDataLine', () => {
  describe('通常のアイテム（引数なし）', () => {
    it('基本的なアイテムを正しく変換する', () => {
      const item: RegisterItem = {
        displayName: 'Google',
        path: 'https://google.com',
        type: 'url',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: 'Google,https://google.com',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('Google,https://google.com,');
      expect(result.type).toBe('item');
    });
  });

  describe('引数を含むアイテム', () => {
    it('カンマを含まない引数を正しく処理する', () => {
      const item: RegisterItem = {
        displayName: 'Git Bash',
        path: 'wt.exe',
        type: 'app',
        args: '-p "Git Bash" -d "C:\\Users\\test" --title "test"',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      // ダブルクォートを含むので、escapeDisplayTextFieldがエスケープする
      expect(result.content).toBe(
        'Git Bash,wt.exe,"-p ""Git Bash"" -d ""C:\\Users\\test"" --title ""test"""'
      );
    });

    it('カンマを含む引数を正しくエスケープする', () => {
      const item: RegisterItem = {
        displayName: 'Custom App',
        path: 'app.exe',
        type: 'app',
        args: '-p "value1,value2" --flag',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      // カンマを含むので、escapeDisplayTextFieldがエスケープする
      expect(result.content).toBe('Custom App,app.exe,"-p ""value1,value2"" --flag"');
    });

    it('複雑なパスと引数を正しく処理する', () => {
      const item: RegisterItem = {
        displayName: 'claude code用_myahk_v2',
        path: 'wt.exe',
        type: 'app',
        args: '-p "Git Bash" -d "C:\\Users\\daido\\git\\masao\\masaoroot\\05_会社と共有\\myahk_v2" --title "myahk_v2"',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      // ダブルクォートを含むので、エスケープされる
      expect(result.content).toBe(
        'claude code用_myahk_v2,wt.exe,"-p ""Git Bash"" -d ""C:\\Users\\daido\\git\\masao\\masaoroot\\05_会社と共有\\myahk_v2"" --title ""myahk_v2"""'
      );
    });
  });

  describe('カスタムアイコンを含むアイテム', () => {
    it('引数とカスタムアイコン両方を含むアイテムを正しく処理する', () => {
      const item: RegisterItem = {
        displayName: 'VSCode',
        path: 'code.exe',
        type: 'app',
        args: '--new-window',
        customIcon: 'vscode.ico',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('VSCode,code.exe,--new-window,vscode.ico');
    });

    it('カンマを含むカスタムアイコン名を正しくエスケープする', () => {
      const item: RegisterItem = {
        displayName: 'App',
        path: 'app.exe',
        type: 'app',
        customIcon: 'icon,v2.png',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('App,app.exe,,"icon,v2.png"');
    });
  });

  describe('フォルダ取込アイテム', () => {
    it('基本的なフォルダ取込アイテムを正しく変換する', () => {
      const item: RegisterItem = {
        displayName: '',
        path: 'C:\\Users\\test',
        type: 'folder',
        targetTab: 'data.txt',
        itemCategory: 'dir',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'directive',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('dir,C:\\Users\\test');
      expect(result.type).toBe('directive');
    });

    it('オプション付きフォルダ取込アイテムを正しく変換する', () => {
      const item: RegisterItem = {
        displayName: '',
        path: 'C:\\Projects',
        type: 'folder',
        targetTab: 'data.txt',
        itemCategory: 'dir',
        dirOptions: {
          depth: 2,
          types: 'file',
          filter: '*.js',
        },
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'directive',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('dir,C:\\Projects,depth=2,types=file,filter=*.js');
      expect(result.type).toBe('directive');
    });
  });

  describe('グループアイテム', () => {
    it('基本的なグループアイテムを正しく変換する', () => {
      const item: RegisterItem = {
        displayName: '開発環境',
        path: '',
        type: 'app',
        targetTab: 'data.txt',
        itemCategory: 'group',
        groupItemNames: ['VSCode', 'Chrome', 'Terminal'],
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'directive',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('group,開発環境,VSCode,Chrome,Terminal');
      expect(result.type).toBe('directive');
    });
  });

  describe('エッジケース', () => {
    it('空の引数を正しく処理する', () => {
      const item: RegisterItem = {
        displayName: 'App',
        path: 'app.exe',
        type: 'app',
        args: '',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('App,app.exe,');
    });

    it('名前にカンマを含むアイテムを正しくエスケープする', () => {
      const item: RegisterItem = {
        displayName: 'App, Version 2',
        path: 'app.exe',
        type: 'app',
        targetTab: 'data.txt',
        itemCategory: 'item',
      };

      const originalLine: RawDataLine = {
        lineNumber: 1,
        content: '',
        type: 'item',
        sourceFile: 'data.txt',
      };

      const result = convertRegisterItemToRawDataLine(item, originalLine);

      expect(result.content).toBe('"App, Version 2",app.exe,');
    });
  });
});
