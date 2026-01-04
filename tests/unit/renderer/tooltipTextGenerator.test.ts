import { describe, it, expect } from 'vitest';
import type { WindowInfo, GroupItem, WindowOperationItem, LauncherItem } from '@common/types';

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
      expect(result).toContain('プロセス名: test.exe');
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
      expect(result).not.toContain('プロセス名:');
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

  describe('GroupItem', () => {
    it('グループアイテムの情報が正しくフォーマットされる', () => {
      const item: GroupItem = {
        name: 'TestGroup',
        type: 'group',
        itemNames: ['item1', 'item2', 'item3'],
        sourceFile: 'data.txt',
        lineNumber: 10,
      };

      const result = getTooltipText(item);

      expect(result).toContain('グループ: item1, item2, item3');
      expect(result).toContain('データファイル: data.txt');
      expect(result).toContain('行番号: 10');
    });

    it('メタ情報がない場合', () => {
      const item: GroupItem = {
        name: 'TestGroup',
        type: 'group',
        itemNames: ['item1', 'item2'],
      };

      const result = getTooltipText(item);

      expect(result).toContain('グループ: item1, item2');
      expect(result).not.toContain('データファイル:');
      expect(result).not.toContain('行番号:');
    });
  });

  describe('WindowOperationItem', () => {
    it('ウィンドウ操作アイテムの全情報が正しくフォーマットされる', () => {
      const item: WindowOperationItem = {
        name: 'TestOperation',
        type: 'windowOperation',
        windowTitle: 'Target Window',
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        virtualDesktopNumber: 2,
        activateWindow: false,
        sourceFile: 'data.txt',
        lineNumber: 15,
      };

      const result = getTooltipText(item);

      expect(result).toContain('ウィンドウタイトル: Target Window');
      expect(result).toContain('位置: (0, 0)');
      expect(result).toContain('サイズ: 1920x1080');
      expect(result).toContain('仮想デスクトップ: 2');
      expect(result).toContain('アクティブ化: しない');
      expect(result).toContain('データファイル: data.txt');
      expect(result).toContain('行番号: 15');
    });

    it('オプショナルフィールドがない場合', () => {
      const item: WindowOperationItem = {
        name: 'TestOperation',
        type: 'windowOperation',
        windowTitle: 'Target Window',
      };

      const result = getTooltipText(item);

      expect(result).toContain('ウィンドウタイトル: Target Window');
      expect(result).not.toContain('位置:');
      expect(result).not.toContain('サイズ:');
      expect(result).not.toContain('仮想デスクトップ:');
      expect(result).not.toContain('アクティブ化: しない');
    });

    it('activateWindowがtrueの場合、表示されない', () => {
      const item: WindowOperationItem = {
        name: 'TestOperation',
        type: 'windowOperation',
        windowTitle: 'Target Window',
        activateWindow: true,
      };

      const result = getTooltipText(item);

      expect(result).not.toContain('アクティブ化:');
    });
  });

  describe('LauncherItem', () => {
    it('LauncherItemの情報が正しくフォーマットされる', () => {
      const item: LauncherItem = {
        name: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
        sourceFile: 'data.txt',
        lineNumber: 20,
        expandedFrom: 'C:\\folder',
        expandedOptions: 'recursive',
      };

      const result = getTooltipText(item);

      expect(result).toContain('C:\\test\\app.exe');
      expect(result).toContain('データファイル: data.txt');
      expect(result).toContain('行番号: 20');
      expect(result).toContain('取込元: C:\\folder');
      expect(result).toContain('設定: recursive');
    });

    it('引数がある場合、パスと結合される', () => {
      const item: LauncherItem = {
        name: 'TestApp',
        type: 'app',
        path: 'C:\\test\\app.exe',
        args: '--flag value',
      };

      const result = getTooltipText(item);

      expect(result).toContain('C:\\test\\app.exe --flag value');
    });

    it('メタ情報がない場合', () => {
      const item: LauncherItem = {
        name: 'TestApp',
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
        name: 'TestURL',
        type: 'url',
        path: 'https://example.com',
      };

      const result = getTooltipText(item);

      expect(result).toContain('https://example.com');
    });
  });
});
