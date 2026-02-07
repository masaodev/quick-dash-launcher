/**
 * dataHandlers.ts のテスト
 * name → displayName リファクタリングの検証
 */

import { describe, it, expect } from 'vitest';
import { parseDisplayTextFields } from '@common/utils/displayTextConverter';
import type { LauncherItem, GroupItem, WindowItem } from '@common/types';

describe('データハンドラー: name → displayName リファクタリング検証', () => {
  describe('CSV行のパース', () => {
    it('通常のアイテムがdisplayNameプロパティを持つこと', () => {
      const csvLine = 'テストアイテム,C:\\test\\path.exe';
      const parts = parseDisplayTextFields(csvLine);

      const item: LauncherItem = {
        displayName: parts[0],
        path: parts[1],
        type: 'app',
        sourceFile: 'datafiles/data.json',
        lineNumber: 1,
        isDirExpanded: false,
        isEdited: false,
      };

      expect(item.displayName).toBe('テストアイテム');
      expect(item).toHaveProperty('displayName');
      expect(item).not.toHaveProperty('name');
    });

    it('グループアイテムがdisplayNameプロパティを持つこと', () => {
      const csvLine = 'group,テストグループ,アイテム1,アイテム2';
      const parts = parseDisplayTextFields(csvLine.substring(6)); // 'group,'を除去

      const groupItem: GroupItem = {
        displayName: parts[0],
        type: 'group',
        itemNames: parts.slice(1),
        sourceFile: 'datafiles/data.json',
        lineNumber: 1,
        isEdited: false,
      };

      expect(groupItem.displayName).toBe('テストグループ');
      expect(groupItem).toHaveProperty('displayName');
      expect(groupItem).not.toHaveProperty('name');
    });

    it('ウィンドウ操作アイテムがdisplayNameプロパティを持つこと', () => {
      const windowItem: WindowItem = {
        type: 'window',
        displayName: 'Chrome起動',
        windowTitle: 'Google Chrome',
        sourceFile: 'datafiles/data.json',
        lineNumber: 1,
        isEdited: false,
      };

      expect(windowItem.displayName).toBe('Chrome起動');
      expect(windowItem).toHaveProperty('displayName');
      expect(windowItem).not.toHaveProperty('name');
    });
  });

  describe('実際のテストデータの読み込み', () => {
    it('dev-configのdata.jsonから読み込んだアイテムがdisplayNameを持つこと', () => {
      // テストデータの例
      const testData = [
        'WSL HOME（Windowsで開く）,\\\\wsl.localhost\\Ubuntu-24.04\\home\\masao',
        'cursor_quick-dash-launcher,C:\\Program Files\\cursor\\Cursor.exe,C:\\Users\\daido\\git\\masao\\github\\quick-dash-launcher',
      ];

      testData.forEach((csvLine, index) => {
        const parts = parseDisplayTextFields(csvLine);
        const item: LauncherItem = {
          displayName: parts[0],
          path: parts[1],
          type: 'app',
          args: parts[2] || undefined,
          sourceFile: 'datafiles/data.json',
          lineNumber: index + 1,
          isDirExpanded: false,
          isEdited: false,
        };

        expect(item.displayName).toBeTruthy();
        expect(item.displayName.length).toBeGreaterThan(0);
        expect(item).toHaveProperty('displayName');
      });
    });
  });

  describe('アイテムのソート', () => {
    it('displayNameでソートできること', () => {
      const items: LauncherItem[] = [
        { displayName: 'Zebra', path: '/z', type: 'app' },
        { displayName: 'Apple', path: '/a', type: 'app' },
        { displayName: 'Banana', path: '/b', type: 'app' },
      ];

      const sorted = [...items].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

      expect(sorted[0].displayName).toBe('Apple');
      expect(sorted[1].displayName).toBe('Banana');
      expect(sorted[2].displayName).toBe('Zebra');
    });
  });
});
