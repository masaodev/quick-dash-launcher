/**
 * EditableJsonItemのバリデーションテスト
 */

import { describe, it, expect } from 'vitest';
import { validateEditableItem } from '@common/types/editableItem';
import type { JsonItem } from '@common/types';

describe('validateEditableItem', () => {
  describe('通常アイテムのバリデーション', () => {
    it('有効な通常アイテムを承認する', () => {
      const item: JsonItem = {
        id: 'test-1',
        type: 'item',
        displayName: 'Chrome',
        path: 'C:\\Chrome\\chrome.exe',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('displayNameが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-2',
        type: 'item',
        displayName: '',
        path: 'C:\\Chrome\\chrome.exe',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('displayNameが空です');
    });

    it('displayNameが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-3',
        type: 'item',
        displayName: '   ',
        path: 'C:\\Chrome\\chrome.exe',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('displayNameが空です');
    });

    it('pathが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-4',
        type: 'item',
        displayName: 'Chrome',
        path: '',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('pathが空です');
    });

    it('pathが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-5',
        type: 'item',
        displayName: 'Chrome',
        path: '   ',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('pathが空です');
    });

    it('argsが設定されていても有効', () => {
      const item: JsonItem = {
        id: 'test-6',
        type: 'item',
        displayName: 'Chrome',
        path: 'C:\\Chrome\\chrome.exe',
        args: '--profile-default',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });

    it('customIconが設定されていても有効', () => {
      const item: JsonItem = {
        id: 'test-7',
        type: 'item',
        displayName: 'Custom',
        path: 'C:\\App\\app.exe',
        customIcon: 'icon.png',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });
  });

  describe('dirアイテムのバリデーション', () => {
    it('有効なdirアイテムを承認する', () => {
      const item: JsonItem = {
        id: 'test-8',
        type: 'dir',
        path: 'C:\\Documents',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('pathが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-9',
        type: 'dir',
        path: '',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('dirのpathが空です');
    });

    it('pathが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-10',
        type: 'dir',
        path: '   ',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('dirのpathが空です');
    });

    it('depthが0以上の場合、有効', () => {
      const item: JsonItem = {
        id: 'test-11',
        type: 'dir',
        path: 'C:\\Documents',
        options: { depth: 0 },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });

    it('depthが負の値の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-12',
        type: 'dir',
        path: 'C:\\Documents',
        options: { depth: -1 },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('depthは0以上である必要があります');
    });

    it('typesがfileの場合、有効', () => {
      const item: JsonItem = {
        id: 'test-13',
        type: 'dir',
        path: 'C:\\Documents',
        options: { types: 'file' },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });

    it('typesがfolderの場合、有効', () => {
      const item: JsonItem = {
        id: 'test-14',
        type: 'dir',
        path: 'C:\\Documents',
        options: { types: 'folder' },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });

    it('typesがbothの場合、有効', () => {
      const item: JsonItem = {
        id: 'test-15',
        type: 'dir',
        path: 'C:\\Documents',
        options: { types: 'both' },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });

    it('typesが不正な値の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-16',
        type: 'dir',
        path: 'C:\\Documents',
        options: { types: 'invalid' as 'file' },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('typesはfile, folder, bothのいずれかである必要があります');
    });

    it('複数オプションが設定されていても有効', () => {
      const item: JsonItem = {
        id: 'test-17',
        type: 'dir',
        path: 'C:\\Documents',
        options: {
          depth: 2,
          types: 'file',
          filter: '*.txt',
          exclude: 'temp',
        },
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });
  });

  describe('groupアイテムのバリデーション', () => {
    it('有効なgroupアイテムを承認する', () => {
      const item: JsonItem = {
        id: 'test-18',
        type: 'group',
        displayName: 'Work',
        itemNames: ['Gmail', 'Slack'],
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('displayNameが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-19',
        type: 'group',
        displayName: '',
        itemNames: ['Gmail', 'Slack'],
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('groupのdisplayNameが空です');
    });

    it('displayNameが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-20',
        type: 'group',
        displayName: '   ',
        itemNames: ['Gmail', 'Slack'],
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('groupのdisplayNameが空です');
    });

    it('itemNamesが空配列の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-21',
        type: 'group',
        displayName: 'Work',
        itemNames: [],
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('groupのitemNamesが空です');
    });

    it('itemNamesが1つの場合でも有効', () => {
      const item: JsonItem = {
        id: 'test-22',
        type: 'group',
        displayName: 'Single',
        itemNames: ['OnlyOne'],
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });
  });

  describe('windowアイテムのバリデーション', () => {
    it('有効なwindowアイテムを承認する', () => {
      const item: JsonItem = {
        id: 'test-23',
        type: 'window',
        displayName: 'MyWindow',
        windowTitle: 'Title',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('displayNameが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-24',
        type: 'window',
        displayName: '',
        windowTitle: 'Title',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('windowのdisplayNameが空です');
    });

    it('displayNameが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-25',
        type: 'window',
        displayName: '   ',
        windowTitle: 'Title',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('windowのdisplayNameが空です');
    });

    it('windowTitleが空の場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-26',
        type: 'window',
        displayName: 'MyWindow',
        windowTitle: '',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('windowのwindowTitleが空です');
    });

    it('windowTitleが空白のみの場合、エラーを返す', () => {
      const item: JsonItem = {
        id: 'test-27',
        type: 'window',
        displayName: 'MyWindow',
        windowTitle: '   ',
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('windowのwindowTitleが空です');
    });

    it('オプション設定があっても有効', () => {
      const item: JsonItem = {
        id: 'test-28',
        type: 'window',
        displayName: 'MyWindow',
        windowTitle: 'Title',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
        moveToActiveMonitorCenter: true,
      };
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(true);
    });
  });

  describe('未知のタイプ', () => {
    it('未知のアイテムタイプの場合、エラーを返す', () => {
      const item = {
        id: 'test-29',
        type: 'unknown',
      } as unknown as JsonItem;
      const result = validateEditableItem(item);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('未知のアイテムタイプ: unknown');
    });
  });
});
