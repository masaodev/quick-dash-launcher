/**
 * displayTextConverterのテスト
 */

import { describe, it, expect } from 'vitest';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import type { JsonLauncherItem, JsonDirItem, JsonGroupItem, JsonWindowItem } from '@common/types';

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
        expect(result).toBe(
          'window,"{""displayName"":""MyWindow"",""windowTitle"":""Window Title""}"'
        );
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
});
