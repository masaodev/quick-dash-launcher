/**
 * workspaceConverters.ts のテスト
 * AppItem → 本体 / WorkspaceItem ⇄ RegisterItem / 表示文字列
 */

import { describe, it, expect } from 'vitest';
import {
  appItemToWorkspaceItemBody,
  describeWorkspaceItem,
  registerItemToWorkspaceItemUpdate,
  toToastItemType,
  workspaceItemToRegisterItem,
} from '@common/utils/workspaceConverters';
import type { AppItem, WorkspaceItem } from '@common/types';

const meta = { id: 'itAAAAA1', workspaceId: 'wsAAAAA1', order: 0, addedAt: 1 } as const;

const launcher: WorkspaceItem = {
  ...meta,
  type: 'item',
  displayName: 'GitHub',
  path: 'https://github.com/',
  args: '--x',
  memo: 'めも',
  launcherType: 'url',
};
const windowItem: WorkspaceItem = {
  ...meta,
  type: 'window',
  displayName: 'Chrome',
  windowTitle: '*Chrome',
  processName: 'chrome.exe',
  x: 1,
  y: 2,
  width: 3,
  height: 4,
  activateWindow: false,
};
const groupItem: WorkspaceItem = {
  ...meta,
  type: 'group',
  displayName: 'セット',
  itemNames: ['a', 'b'],
};
const clipboardItem: WorkspaceItem = {
  ...meta,
  type: 'clipboard',
  displayName: 'クリップ',
  dataFileRef: 'clipboard-data/x.json',
  savedAt: 9,
  preview: 'hello',
  formats: ['text'],
};
const layoutItem: WorkspaceItem = {
  ...meta,
  type: 'layout',
  displayName: '配置',
  entries: [{ windowTitle: 'a', launchApp: false, icon: 'data:image/png;base64,AAAA' }],
};

describe('workspaceConverters: appItemToWorkspaceItemBody', () => {
  it('AppItem の各型をファイル形式の本体に変換し、memo を全型でコピーすること', () => {
    const launcherApp: AppItem = {
      displayName: 'GitHub',
      path: 'https://github.com/',
      type: 'url',
      args: '--x',
      memo: 'm1',
      icon: 'data:image/png;base64,AAAA',
    };
    expect(appItemToWorkspaceItemBody(launcherApp)).toEqual({
      type: 'item',
      displayName: 'GitHub',
      path: 'https://github.com/',
      args: '--x',
      memo: 'm1',
    });

    const windowApp: AppItem = {
      type: 'window',
      displayName: 'Chrome',
      windowTitle: '*Chrome',
      x: 1,
      memo: 'm2',
    };
    expect(appItemToWorkspaceItemBody(windowApp)).toEqual({
      type: 'window',
      displayName: 'Chrome',
      windowTitle: '*Chrome',
      x: 1,
      memo: 'm2',
    });

    const clipboardApp: AppItem = {
      type: 'clipboard',
      displayName: 'クリップ',
      clipboardDataRef: 'clipboard-data/x.json',
      savedAt: 9,
      formats: ['text'],
      memo: 'm3',
    };
    expect(appItemToWorkspaceItemBody(clipboardApp)).toEqual({
      type: 'clipboard',
      displayName: 'クリップ',
      dataFileRef: 'clipboard-data/x.json',
      savedAt: 9,
      formats: ['text'],
      memo: 'm3',
    });

    const layoutApp: AppItem = {
      type: 'layout',
      displayName: '配置',
      entries: [{ windowTitle: 'a', launchApp: false, icon: 'data:image/png;base64,AAAA' }],
    };
    expect(appItemToWorkspaceItemBody(layoutApp)).toEqual({
      type: 'layout',
      displayName: '配置',
      entries: [{ windowTitle: 'a', launchApp: false }],
    });
  });

  it('WindowInfo は受け付けないこと', () => {
    const windowInfo = { hwnd: 1, title: 't', processName: 'p' } as unknown as AppItem;
    expect(() => appItemToWorkspaceItemBody(windowInfo)).toThrow('WindowInfo');
  });
});

describe('workspaceConverters: WorkspaceItem ⇄ RegisterItem', () => {
  it('window は RegisterItem の windowOperationConfig と往復すること', () => {
    const register = workspaceItemToRegisterItem(windowItem);
    expect(register.itemCategory).toBe('window');
    expect(register.windowOperationConfig).toMatchObject({
      windowTitle: '*Chrome',
      processName: 'chrome.exe',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      activateWindow: false,
    });

    const update = registerItemToWorkspaceItemUpdate(register);
    expect(update).toEqual({
      type: 'window',
      displayName: 'Chrome',
      windowTitle: '*Chrome',
      processName: 'chrome.exe',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      activateWindow: false,
    });
  });

  it('item は launcherType を RegisterItem.type に写し、更新では path 系だけ返すこと', () => {
    const register = workspaceItemToRegisterItem(launcher);
    expect(register).toMatchObject({
      itemCategory: 'item',
      type: 'url',
      path: 'https://github.com/',
    });
    expect(registerItemToWorkspaceItemUpdate(register)).toEqual({
      type: 'item',
      displayName: 'GitHub',
      path: 'https://github.com/',
      args: '--x',
      memo: 'めも',
    });
  });

  it('group / clipboard / layout がデータファイルと同じフィールド名で往復すること', () => {
    expect(registerItemToWorkspaceItemUpdate(workspaceItemToRegisterItem(groupItem))).toEqual({
      type: 'group',
      displayName: 'セット',
      itemNames: ['a', 'b'],
    });
    expect(registerItemToWorkspaceItemUpdate(workspaceItemToRegisterItem(clipboardItem))).toEqual({
      type: 'clipboard',
      displayName: 'クリップ',
      dataFileRef: 'clipboard-data/x.json',
      savedAt: 9,
      preview: 'hello',
      formats: ['text'],
    });
    expect(registerItemToWorkspaceItemUpdate(workspaceItemToRegisterItem(layoutItem))).toEqual({
      type: 'layout',
      displayName: '配置',
      entries: [{ windowTitle: 'a', launchApp: false }],
    });
  });

  it('種別を変える更新でも古い種別のフィールドが混ざらないこと', () => {
    const register = workspaceItemToRegisterItem(windowItem);
    const update = registerItemToWorkspaceItemUpdate({
      ...register,
      itemCategory: 'item',
      path: 'C:\\a.exe',
    });
    expect(update).toEqual({ type: 'item', displayName: 'Chrome', path: 'C:\\a.exe' });
  });
});

describe('workspaceConverters: 表示', () => {
  it('describeWorkspaceItem は種別に応じた 1 行を返すこと', () => {
    expect(describeWorkspaceItem(launcher)).toBe('https://github.com/');
    expect(describeWorkspaceItem(windowItem)).toBe('ウィンドウ操作: *Chrome（chrome.exe）');
    expect(describeWorkspaceItem(groupItem)).toBe('グループ: 2件');
    expect(describeWorkspaceItem(clipboardItem)).toBe('クリップボード: hello');
    expect(describeWorkspaceItem(layoutItem)).toBe('レイアウト: 1件');
  });

  it('toToastItemType は通常アイテムに launcherType、ウィンドウ操作に windowOperation を返すこと', () => {
    expect(toToastItemType(launcher)).toBe('url');
    expect(toToastItemType(windowItem)).toBe('windowOperation');
    expect(toToastItemType(groupItem)).toBe('group');
    expect(toToastItemType(layoutItem)).toBe('layout');
  });
});
