/**
 * displayTextConverterのテスト
 */

import { describe, it, expect } from 'vitest';
import { jsonItemToDisplayText, displayTextToJsonItem } from '@common/utils/displayTextConverter';
import type {
  JsonItem,
  JsonLauncherItem,
  JsonDirItem,
  JsonGroupItem,
  JsonWindowItem,
} from '@common/types';

describe('displayTextConverter', () => {
  describe('jsonItemToDisplayText', () => {
    describe('通常アイテム', () => {
      it('基本的な通常アイテムを変換できる', () => {
        const item: JsonLauncherItem = {
          id: 'test-1',
          type: 'item',
          displayName: 'Chrome',
          path: 'C:\\Program Files\\Chrome\\chrome.exe',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('Chrome,C:\\Program Files\\Chrome\\chrome.exe');
      });

      it('引数付きの通常アイテムを変換できる', () => {
        const item: JsonLauncherItem = {
          id: 'test-2',
          type: 'item',
          displayName: 'Chrome',
          path: 'C:\\Chrome\\chrome.exe',
          args: '--profile-default',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('Chrome,C:\\Chrome\\chrome.exe,--profile-default');
      });

      it('カスタムアイコン付きの通常アイテムを変換できる', () => {
        const item: JsonLauncherItem = {
          id: 'test-3',
          type: 'item',
          displayName: 'Custom',
          path: 'C:\\App\\app.exe',
          customIcon: 'custom-icon.png',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('Custom,C:\\App\\app.exe,,custom-icon.png');
      });

      it('引数とカスタムアイコン両方を持つアイテムを変換できる', () => {
        const item: JsonLauncherItem = {
          id: 'test-4',
          type: 'item',
          displayName: 'App',
          path: 'C:\\App\\app.exe',
          args: '--debug',
          customIcon: 'icon.png',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('App,C:\\App\\app.exe,--debug,icon.png');
      });

      it('カンマを含むdisplayNameを正しくエスケープする', () => {
        const item: JsonLauncherItem = {
          id: 'test-5',
          type: 'item',
          displayName: 'My, App',
          path: 'C:\\App\\app.exe',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('"My, App",C:\\App\\app.exe');
      });

      it('ダブルクォートを含むdisplayNameを正しくエスケープする', () => {
        const item: JsonLauncherItem = {
          id: 'test-6',
          type: 'item',
          displayName: 'My "App"',
          path: 'C:\\App\\app.exe',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('"My ""App""",C:\\App\\app.exe');
      });
    });

    describe('dirアイテム', () => {
      it('基本的なdirアイテムを変換できる', () => {
        const item: JsonDirItem = {
          id: 'test-7',
          type: 'dir',
          path: 'C:\\Documents',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('dir,C:\\Documents');
      });

      it('depthオプション付きのdirアイテムを変換できる', () => {
        const item: JsonDirItem = {
          id: 'test-8',
          type: 'dir',
          path: 'C:\\Documents',
          options: { depth: 2 },
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('dir,C:\\Documents,depth=2');
      });

      it('複数オプション付きのdirアイテムを変換できる', () => {
        const item: JsonDirItem = {
          id: 'test-9',
          type: 'dir',
          path: 'C:\\Documents',
          options: {
            depth: 2,
            types: 'file',
            filter: '*.txt',
          },
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('dir,C:\\Documents,depth=2,types=file,filter=*.txt');
      });

      it('全オプション付きのdirアイテムを変換できる', () => {
        const item: JsonDirItem = {
          id: 'test-10',
          type: 'dir',
          path: 'C:\\Documents',
          options: {
            depth: 3,
            types: 'both',
            filter: '*.md',
            exclude: 'node_modules',
            prefix: '[DOC]',
            suffix: '.bak',
          },
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe(
          'dir,C:\\Documents,depth=3,types=both,filter=*.md,exclude=node_modules,prefix=[DOC],suffix=.bak'
        );
      });
    });

    describe('groupアイテム', () => {
      it('基本的なgroupアイテムを変換できる', () => {
        const item: JsonGroupItem = {
          id: 'test-11',
          type: 'group',
          displayName: 'Work',
          itemNames: ['Gmail', 'Slack', 'VSCode'],
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('group,Work,Gmail,Slack,VSCode');
      });

      it('1つのアイテムを持つgroupアイテムを変換できる', () => {
        const item: JsonGroupItem = {
          id: 'test-12',
          type: 'group',
          displayName: 'Single',
          itemNames: ['OnlyOne'],
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('group,Single,OnlyOne');
      });
    });

    describe('windowアイテム', () => {
      it('基本的なwindowアイテムを変換できる', () => {
        const item: JsonWindowItem = {
          id: 'test-13',
          type: 'window',
          displayName: 'MyWindow',
          windowTitle: 'Window Title',
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toBe('window,"{""displayName"":""MyWindow"",""windowTitle"":""Window Title""}"');
      });

      it('全オプション付きのwindowアイテムを変換できる', () => {
        const item: JsonWindowItem = {
          id: 'test-14',
          type: 'window',
          displayName: 'MyWindow',
          windowTitle: 'Title',
          processName: 'app.exe',
          x: 100,
          y: 200,
          width: 800,
          height: 600,
          moveToActiveMonitorCenter: true,
          virtualDesktopNumber: 2,
          activateWindow: true,
          pinToAllDesktops: false,
        };
        const result = jsonItemToDisplayText(item);
        expect(result).toContain('window,');
        expect(result).toContain('displayName');
        expect(result).toContain('MyWindow');
        // JSON文字列が正しくエスケープされているか確認
        expect(result).toContain('""');
      });
    });
  });

  describe('displayTextToJsonItem', () => {
    describe('通常アイテム', () => {
      it('基本的な通常アイテムを解析できる', () => {
        const text = 'Chrome,C:\\Program Files\\Chrome\\chrome.exe';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('item');
        expect(result.displayName).toBe('Chrome');
        expect(result.path).toBe('C:\\Program Files\\Chrome\\chrome.exe');
      });

      it('引数付きの通常アイテムを解析できる', () => {
        const text = 'Chrome,C:\\Chrome\\chrome.exe,--profile-default';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('item');
        expect(result.displayName).toBe('Chrome');
        expect(result.path).toBe('C:\\Chrome\\chrome.exe');
        expect(result.args).toBe('--profile-default');
      });

      it('カスタムアイコン付きの通常アイテムを解析できる', () => {
        const text = 'Custom,C:\\App\\app.exe,,custom-icon.png';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('item');
        expect(result.displayName).toBe('Custom');
        expect(result.path).toBe('C:\\App\\app.exe');
        expect(result.customIcon).toBe('custom-icon.png');
      });

      it('エスケープされたカンマを含むdisplayNameを解析できる', () => {
        const text = '"My, App",C:\\App\\app.exe';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('item');
        expect(result.displayName).toBe('My, App');
        expect(result.path).toBe('C:\\App\\app.exe');
      });

      it('エスケープされたダブルクォートを含むdisplayNameを解析できる', () => {
        const text = '"My ""App""",C:\\App\\app.exe';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('item');
        expect(result.displayName).toBe('My "App"');
        expect(result.path).toBe('C:\\App\\app.exe');
      });
    });

    describe('dirアイテム', () => {
      it('基本的なdirアイテムを解析できる', () => {
        const text = 'dir,C:\\Documents';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('dir');
        expect(result.path).toBe('C:\\Documents');
      });

      it('depthオプション付きのdirアイテムを解析できる', () => {
        const text = 'dir,C:\\Documents,depth=2';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('dir');
        expect(result.path).toBe('C:\\Documents');
        expect(result.options?.depth).toBe(2);
      });

      it('複数オプション付きのdirアイテムを解析できる', () => {
        const text = 'dir,C:\\Documents,depth=2,types=file,filter=*.txt';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('dir');
        expect(result.path).toBe('C:\\Documents');
        expect(result.options?.depth).toBe(2);
        expect(result.options?.types).toBe('file');
        expect(result.options?.filter).toBe('*.txt');
      });

      it('全オプション付きのdirアイテムを解析できる', () => {
        const text =
          'dir,C:\\Documents,depth=3,types=both,filter=*.md,exclude=node_modules,prefix=[DOC],suffix=.bak';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('dir');
        expect(result.path).toBe('C:\\Documents');
        expect(result.options?.depth).toBe(3);
        expect(result.options?.types).toBe('both');
        expect(result.options?.filter).toBe('*.md');
        expect(result.options?.exclude).toBe('node_modules');
        expect(result.options?.prefix).toBe('[DOC]');
        expect(result.options?.suffix).toBe('.bak');
      });
    });

    describe('groupアイテム', () => {
      it('基本的なgroupアイテムを解析できる', () => {
        const text = 'group,Work,Gmail,Slack,VSCode';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('group');
        expect(result.displayName).toBe('Work');
        expect(result.itemNames).toEqual(['Gmail', 'Slack', 'VSCode']);
      });

      it('1つのアイテムを持つgroupアイテムを解析できる', () => {
        const text = 'group,Single,OnlyOne';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('group');
        expect(result.displayName).toBe('Single');
        expect(result.itemNames).toEqual(['OnlyOne']);
      });
    });

    describe('windowアイテム', () => {
      it('基本的なwindowアイテムを解析できる', () => {
        const text = 'window,"{""displayName"":""MyWindow"",""windowTitle"":""Window Title""}"';
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('window');
        expect(result.displayName).toBe('MyWindow');
        expect(result.windowTitle).toBe('Window Title');
      });

      it('全オプション付きのwindowアイテムを解析できる', () => {
        const config = {
          displayName: 'MyWindow',
          windowTitle: 'Title',
          processName: 'app.exe',
          x: 100,
          y: 200,
          width: 800,
          height: 600,
          moveToActiveMonitorCenter: true,
          virtualDesktopNumber: 2,
          activateWindow: true,
          pinToAllDesktops: false,
        };
        const text = `window,"${JSON.stringify(config).replace(/"/g, '""')}"`;
        const result = displayTextToJsonItem(text);
        expect(result.type).toBe('window');
        expect(result.displayName).toBe('MyWindow');
        expect(result.windowTitle).toBe('Title');
        expect(result.processName).toBe('app.exe');
        expect(result.x).toBe(100);
        expect(result.y).toBe(200);
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
        expect(result.moveToActiveMonitorCenter).toBe(true);
        expect(result.virtualDesktopNumber).toBe(2);
        expect(result.activateWindow).toBe(true);
        expect(result.pinToAllDesktops).toBe(false);
      });
    });

    describe('既存IDの保持', () => {
      it('existingIdが指定された場合、そのIDを使用する', () => {
        const text = 'Chrome,C:\\Chrome\\chrome.exe';
        const result = displayTextToJsonItem(text, 'existing-id-123');
        expect(result.id).toBe('existing-id-123');
      });

      it('existingIdが指定されない場合、新しいIDを生成する', () => {
        const text = 'Chrome,C:\\Chrome\\chrome.exe';
        const result = displayTextToJsonItem(text);
        expect(result.id).toBeDefined();
        expect(result.id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('相互変換の整合性', () => {
    it('通常アイテムの相互変換が整合している', () => {
      const original: JsonLauncherItem = {
        id: 'test-1',
        type: 'item',
        displayName: 'Chrome',
        path: 'C:\\Chrome\\chrome.exe',
        args: '--profile',
      };
      const text = jsonItemToDisplayText(original);
      const converted = displayTextToJsonItem(text, original.id);
      expect(converted).toEqual(original);
    });

    it('dirアイテムの相互変換が整合している', () => {
      const original: JsonDirItem = {
        id: 'test-2',
        type: 'dir',
        path: 'C:\\Documents',
        options: {
          depth: 2,
          types: 'file',
        },
      };
      const text = jsonItemToDisplayText(original);
      const converted = displayTextToJsonItem(text, original.id);
      expect(converted).toEqual(original);
    });

    it('groupアイテムの相互変換が整合している', () => {
      const original: JsonGroupItem = {
        id: 'test-3',
        type: 'group',
        displayName: 'Work',
        itemNames: ['Gmail', 'Slack'],
      };
      const text = jsonItemToDisplayText(original);
      const converted = displayTextToJsonItem(text, original.id);
      expect(converted).toEqual(original);
    });

    it('windowアイテムの相互変換が整合している', () => {
      const original: JsonWindowItem = {
        id: 'test-4',
        type: 'window',
        displayName: 'MyWindow',
        windowTitle: 'Title',
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      };
      const text = jsonItemToDisplayText(original);
      const converted = displayTextToJsonItem(text, original.id);
      expect(converted).toEqual(original);
    });
  });
});
