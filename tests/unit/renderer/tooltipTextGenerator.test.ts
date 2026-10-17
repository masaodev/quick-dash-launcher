import { describe, it, expect } from 'vitest';
import type { WindowInfo, SetItem, LauncherItem, ClipboardItem } from '@common/types';

import { getTooltipText } from '../../../src/renderer/utils/tooltipTextGenerator';

describe('tooltipTextGenerator', () => {
  describe('WindowInfo', () => {
    it('全フィールドが設定されている場合、正しくフォーマットされる', () => {
      const item: WindowInfo = {
        hwnd: 12345,
        title: 'Test Window',
        processName: 'test.exe',
        executablePath: 'C:\\test\\test.exe',
        windowState: 'maximized',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        processId: 5678,
        isVisible: true,
      };

      const result = getTooltipText(item);

      expect(result).toContain('ウィンドウタイトル: Test Window');
      expect(result).toContain('exe 名: test.exe');
      expect(result).toContain('実行ファイルパス: C:\\test\\test.exe');
      expect(result).toContain('状態: 最大化');
      expect(result).toContain('位置: (100, 200)');
      expect(result).toContain('サイズ: 800x600');
      expect(result).toContain('プロセスID: 5678');
    });

    it('オプショナルフィールドが欠けている場合、エラーにならない', () => {
      const item: WindowInfo = {
        hwnd: 12345,
        title: 'Test Window',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        processId: 5678,
        isVisible: true,
      };

      const result = getTooltipText(item);

      expect(result).toContain('ウィンドウタイトル: Test Window');
      expect(result).not.toContain('exe 名:');
      expect(result).not.toContain('実行ファイルパス:');
      expect(result).not.toContain('状態:');
    });

    it('windowStateが最小化の場合', () => {
      const item: WindowInfo = {
        hwnd: 12345,
        title: 'Test Window',
        windowState: 'minimized',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        processId: 5678,
        isVisible: true,
      };

      const result = getTooltipText(item);

      expect(result).toContain('状態: 最小化');
    });

    it('windowStateが通常の場合', () => {
      const item: WindowInfo = {
        hwnd: 12345,
        title: 'Test Window',
        windowState: 'normal',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        processId: 5678,
        isVisible: true,
      };

      const result = getTooltipText(item);

      expect(result).toContain('状態: 通常');
    });
  });

  describe('SetItem', () => {
    it('行の数とウィンドウ位置のある行の数、データファイルを出す', () => {
      const item: SetItem = {
        displayName: 'TestSet',
        type: 'set',
        entries: [{ itemId: 'a' }, { window: { processName: 'x.exe' }, placement: { x: 0, y: 0 } }],
        sourceFile: 'data.json',
        id: 'abc12345',
      };

      const result = getTooltipText(item);

      expect(result).toContain('セット: 2 件');
      expect(result).toContain('ウィンドウ位置のある行: 1 件');
      expect(result).toContain('データファイル: data.json');
      expect(result).toContain('ID: abc12345');
    });
  });

  describe('LauncherItem', () => {
    it('LauncherItemの情報が正しくフォーマットされる', () => {
      const item: LauncherItem = {
        displayName: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
        sourceFile: 'data.json',
        lineNumber: 20,
        expandedFrom: 'C:\\folder',
        expandedOptions: { depth: -1, types: 'both' },
      };

      const result = getTooltipText(item);

      expect(result).toContain('C:\\test\\app.exe');
      expect(result).toContain('データファイル: data.json');
      expect(result).toContain('行番号: 20');
      expect(result).toContain('取込元: C:\\folder');
      expect(result).toContain('設定: 深さ:無制限, タイプ:ファイルとフォルダ');
    });

    it('IDが設定されている場合、IDが表示され行番号は表示されない', () => {
      const item: LauncherItem = {
        displayName: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
        sourceFile: 'data.json',
        id: 'app12345',
        lineNumber: 20,
      };

      const result = getTooltipText(item);

      expect(result).toContain('ID: app12345');
      expect(result).not.toContain('行番号:');
    });

    it('フォルダ取込展開アイテムの場合、展開元IDが表示される', () => {
      const item: LauncherItem = {
        displayName: 'test.exe',
        path: 'C:\\folder\\test.exe',
        type: 'app',
        sourceFile: 'data.json',
        expandedFromId: 'dir-abc1',
        expandedFrom: 'C:\\folder',
        expandedOptions: { depth: 2, types: 'file', filter: '*.pdf' },
        lineNumber: 20,
      };

      const result = getTooltipText(item);

      expect(result).toContain('展開元ID: dir-abc1');
      expect(result).toContain('取込元: C:\\folder');
      expect(result).toContain('設定: 深さ:2, タイプ:ファイルのみ, フィルター:*.pdf');
      // 個別IDフィールドは持たないことを確認（展開元IDとは異なる）
      expect(result).not.toMatch(/^ID: /m); // 行頭に"ID: "がないことを確認
      expect(result).not.toContain('行番号:');
    });

    it('引数がある場合、パスと結合される', () => {
      const item: LauncherItem = {
        displayName: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
        args: '--flag value',
      };

      const result = getTooltipText(item);

      expect(result).toContain('C:\\test\\app.exe --flag value');
    });

    it('メタ情報がない場合', () => {
      const item: LauncherItem = {
        displayName: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
      };

      const result = getTooltipText(item);

      expect(result).toContain('C:\\test\\app.exe');
      expect(result).not.toContain('データファイル:');
      expect(result).not.toContain('行番号:');
      expect(result).not.toContain('取込元:');
      expect(result).not.toContain('設定:');
    });

    it('URL型の場合も正しく処理される', () => {
      const item: LauncherItem = {
        displayName: 'TestURL',
        type: 'url',
        path: 'https://example.com',
      };

      const result = getTooltipText(item);

      expect(result).toContain('https://example.com');
    });
  });

  describe('ClipboardItem', () => {
    it('クリップボードアイテムの情報が正しくフォーマットされる', () => {
      const item: ClipboardItem = {
        displayName: 'TestClipboard',
        type: 'clipboard',
        clipboardDataRef: 'clipboard-data/test1234.json',
        formats: ['text', 'html'],
        preview: 'Sample text content',
        savedAt: 1704067200000, // 2024-01-01 00:00:00 UTC
        sourceFile: 'clipboard.json',
        lineNumber: 5,
      };

      const result = getTooltipText(item);

      expect(result).toContain('フォーマット: テキスト, HTML');
      expect(result).toContain('プレビュー: Sample text content');
      expect(result).toContain('保存日時:');
      expect(result).toContain('データファイル: clipboard.json');
      expect(result).toContain('行番号: 5');
    });

    it('IDが設定されている場合、IDが表示され行番号は表示されない', () => {
      const item: ClipboardItem = {
        displayName: 'TestClipboard',
        type: 'clipboard',
        clipboardDataRef: 'clipboard-data/test5678.json',
        formats: ['text'],
        preview: 'Sample text',
        savedAt: 1704067200000,
        sourceFile: 'clipboard.json',
        id: 'clip1234',
        lineNumber: 5,
      };

      const result = getTooltipText(item);

      expect(result).toContain('ID: clip1234');
      expect(result).not.toContain('行番号:');
    });
  });
});
