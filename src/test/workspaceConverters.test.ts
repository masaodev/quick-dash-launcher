/**
 * workspaceConverters.ts のテスト
 * AppItem → 本体 / WorkspaceItem ⇄ RegisterItem / 表示文字列
 */

import { describe, it, expect } from 'vitest';
import { createI18n } from '@common/i18n';
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
/** パスの無い単一アイテム（廃止したウィンドウ操作はこれに変換する） */
const pathlessItem: WorkspaceItem = {
  ...meta,
  type: 'item',
  displayName: 'Chrome',
  path: '',
  window: { processName: 'chrome.exe', title: '*Chrome' },
  placement: { x: 1, y: 2, width: 3, height: 4 },
  activateWindow: false,
  launcherType: 'windowSwitch',
};
const groupItem: WorkspaceItem = {
  ...meta,
  type: 'set',
  displayName: 'セット',
  entries: [{ itemId: 'aaaaaaaa' }, { open: { path: 'C:\b.exe' } }],
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
  type: 'set',
  displayName: '配置',
  launchMode: 'parallel',
  entries: [{ window: { title: 'a' }, placement: { x: 0, y: 0 } }],
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

    const pathlessApp: AppItem = {
      type: 'windowSwitch',
      displayName: 'Chrome',
      path: '',
      window: { title: '*Chrome' },
      placement: { x: 1 },
      memo: 'm2',
    };
    expect(appItemToWorkspaceItemBody(pathlessApp)).toEqual({
      type: 'item',
      displayName: 'Chrome',
      path: '',
      window: { title: '*Chrome' },
      placement: { x: 1 },
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

    const setApp: AppItem = {
      type: 'set',
      displayName: '配置',
      entries: [{ window: { title: 'a' }, placement: { x: 0, y: 0 } }],
      launchMode: 'parallel',
    };
    expect(appItemToWorkspaceItemBody(setApp)).toEqual({
      type: 'set',
      displayName: '配置',
      entries: [{ window: { title: 'a' }, placement: { x: 0, y: 0 } }],
      launchMode: 'parallel',
    });
  });

  it('WindowInfo（ウィンドウ検索結果）は exe 名とタイトルだけのパスの無い単一アイテムになること', () => {
    // #327 でウィンドウ検索結果をワークスペースに登録できるようにした（位置は付けない）
    const windowInfo = {
      hwnd: 1,
      title: 't',
      processName: 'p',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    } as unknown as AppItem;
    expect(appItemToWorkspaceItemBody(windowInfo)).toEqual({
      type: 'item',
      displayName: 't',
      path: '',
      window: { processName: 'p', title: 't' },
    });
  });
});

describe('workspaceConverters: WorkspaceItem ⇄ RegisterItem', () => {
  it('パスの無い単一アイテムは RegisterItem と往復すること', () => {
    const register = workspaceItemToRegisterItem(pathlessItem);
    expect(register).toMatchObject({
      itemCategory: 'item',
      type: 'windowSwitch',
      path: '',
      window: { processName: 'chrome.exe', title: '*Chrome' },
      placement: { x: 1, y: 2, width: 3, height: 4 },
      activateWindow: false,
    });

    expect(registerItemToWorkspaceItemUpdate(register)).toEqual({
      type: 'item',
      displayName: 'Chrome',
      path: '',
      window: { processName: 'chrome.exe', title: '*Chrome' },
      placement: { x: 1, y: 2, width: 3, height: 4 },
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

  it('item のウィンドウ切り替え（ifOpen・waitSeconds・placement.state を含む）が往復で消えないこと', () => {
    const withSwitch: WorkspaceItem = {
      ...launcher,
      window: { processName: 'sakura.exe', title: '*メモ*' },
      placement: { x: 0, y: 0, width: 800, height: 600, state: 'maximized' },
      ifOpen: 'openNew',
      activateWindow: false,
      waitSeconds: 10,
      pinToAllDesktops: true,
    };
    const register = workspaceItemToRegisterItem(withSwitch);
    expect(register).toMatchObject({
      window: { processName: 'sakura.exe', title: '*メモ*' },
      placement: { state: 'maximized' },
      ifOpen: 'openNew',
      waitSeconds: 10,
    });
    expect(registerItemToWorkspaceItemUpdate(register)).toEqual({
      type: 'item',
      displayName: 'GitHub',
      path: 'https://github.com/',
      args: '--x',
      window: { processName: 'sakura.exe', title: '*メモ*' },
      placement: { x: 0, y: 0, width: 800, height: 600, state: 'maximized' },
      ifOpen: 'openNew',
      activateWindow: false,
      waitSeconds: 10,
      pinToAllDesktops: true,
      memo: 'めも',
    });
  });

  it('item の対象ウィンドウを外したら、残ったウィンドウ位置なども保存しないこと', () => {
    const register = {
      ...workspaceItemToRegisterItem(launcher),
      placement: { x: 0, y: 0 },
      waitSeconds: 5,
    };
    expect(registerItemToWorkspaceItemUpdate(register)).not.toHaveProperty('placement');
    expect(registerItemToWorkspaceItemUpdate(register)).not.toHaveProperty('waitSeconds');
  });

  it('set / clipboard がデータファイルと同じフィールド名で往復すること', () => {
    expect(registerItemToWorkspaceItemUpdate(workspaceItemToRegisterItem(groupItem))).toEqual({
      type: 'set',
      displayName: 'セット',
      entries: [{ itemId: 'aaaaaaaa' }, { open: { path: 'C:\b.exe' } }],
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
      type: 'set',
      displayName: '配置',
      launchMode: 'parallel',
      entries: [{ window: { title: 'a' }, placement: { x: 0, y: 0 } }],
    });
  });

  it('種別を変える更新でも古い種別のフィールドが混ざらないこと', () => {
    const register = workspaceItemToRegisterItem(clipboardItem);
    const update = registerItemToWorkspaceItemUpdate({
      ...register,
      itemCategory: 'item',
      path: 'C:\\a.exe',
    });
    expect(update).toEqual({ type: 'item', displayName: 'クリップ', path: 'C:\\a.exe' });
  });
});

describe('workspaceConverters: 表示', () => {
  it('describeWorkspaceItem は種別に応じた 1 行を返すこと', () => {
    const t = createI18n('ja').t;
    expect(describeWorkspaceItem(launcher, t)).toBe('https://github.com/');
    expect(describeWorkspaceItem(pathlessItem, t)).toBe(
      '開いているウィンドウに切り替えるだけ: chrome.exe / *Chrome'
    );
    expect(describeWorkspaceItem(groupItem, t)).toBe('セット: 2件');
    expect(describeWorkspaceItem(clipboardItem, t)).toBe('クリップボード: hello');
  });

  it('describeWorkspaceItem は表示言語が英語なら英語の 1 行を返すこと', () => {
    const t = createI18n('en').t;
    expect(describeWorkspaceItem(groupItem, t)).toBe('Set: 2 items');
    expect(describeWorkspaceItem(layoutItem, t)).toBe('Set: 1 item');
  });

  it('toToastItemType は通常アイテムに launcherType（パスの無い単一アイテムは windowSwitch）を返すこと', () => {
    expect(toToastItemType(launcher)).toBe('url');
    expect(toToastItemType(pathlessItem)).toBe('windowSwitch');
    expect(toToastItemType(groupItem)).toBe('set');
  });
});
