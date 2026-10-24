import { describe, it, expect } from 'vitest';

import type { EditableJsonItem, JsonLauncherItem, JsonSetItem } from '../types';

import {
  convertEditableJsonItemToRegisterItem,
  convertRegisterItemToJsonItem,
} from './dataConverters';

describe('dataConverters のセット', () => {
  const layout: JsonSetItem = {
    id: 'Lay0ut01',
    type: 'set',
    displayName: '作業レイアウト',
    entries: [{ window: { title: 'メモ帳' }, placement: { x: 0, y: 0, width: 800, height: 600 } }],
    launchMode: 'parallel',
    customIcon: 'layout-icon.png',
    memo: 'メモ',
  };
  const editable: EditableJsonItem = {
    item: layout,
    displayText: '',
    meta: { sourceFile: 'datafiles/data.json', lineNumber: 0, isValid: true },
  };
  const tabs = [{ name: 'メイン', files: ['datafiles/data.json'] }];

  it('編集用に変換してもカスタムアイコンを保つ', () => {
    const registerItem = convertEditableJsonItemToRegisterItem(editable, tabs);

    expect(registerItem.customIcon).toBe('layout-icon.png');
  });

  it('編集用に変換して戻しても、カスタムアイコンが消えない', () => {
    const registerItem = convertEditableJsonItemToRegisterItem(editable, tabs);
    const saved = convertRegisterItemToJsonItem(registerItem, layout.id);

    expect(saved).toMatchObject({
      id: layout.id,
      type: 'set',
      displayName: layout.displayName,
      entries: layout.entries,
      launchMode: 'parallel',
      customIcon: 'layout-icon.png',
      memo: 'メモ',
    });
  });
});

describe('dataConverters の単一アイテムのウィンドウ切り替え', () => {
  const item: JsonLauncherItem = {
    id: 'Item0001',
    type: 'item',
    displayName: '一時メモ',
    path: 'C:/memo.txt',
    window: { processName: 'sakura.exe', title: '*一時メモ.txt*' },
    placement: { x: 10, y: 20, width: 800, height: 600, state: 'maximized' },
    ifOpen: 'openNew',
    waitSeconds: 15,
    pinToAllDesktops: true,
  };
  const editable: EditableJsonItem = {
    item,
    displayText: '',
    meta: { sourceFile: 'datafiles/data.json', lineNumber: 0, isValid: true },
  };
  const tabs = [{ name: 'メイン', files: ['datafiles/data.json'] }];

  it('編集用に変換して戻しても、ifOpen・waitSeconds・placement.state が消えない', () => {
    const registerItem = convertEditableJsonItemToRegisterItem(editable, tabs);
    expect(registerItem.window).toEqual(item.window);

    const saved = convertRegisterItemToJsonItem(registerItem, item.id);
    expect(saved).toMatchObject({
      window: item.window,
      placement: item.placement,
      ifOpen: 'openNew',
      waitSeconds: 15,
      pinToAllDesktops: true,
    });
    expect(saved).not.toHaveProperty('windowConfig');
  });
});

describe('dataConverters の「常に管理者として実行」', () => {
  const tabs = [{ name: 'メイン', files: ['datafiles/data.json'] }];
  const editableOf = (item: JsonLauncherItem): EditableJsonItem => ({
    item,
    displayText: '',
    meta: { sourceFile: 'datafiles/data.json', lineNumber: 0, isValid: true },
  });

  it('アプリは編集用に変換して戻しても runAsAdmin を保つ', () => {
    const item: JsonLauncherItem = {
      id: 'Admin001',
      type: 'item',
      displayName: '管理ツール',
      path: 'C:\\Tools\\admin.exe',
      runAsAdmin: true,
    };
    const registerItem = convertEditableJsonItemToRegisterItem(editableOf(item), tabs);
    expect(registerItem.runAsAdmin).toBe(true);
    expect(convertRegisterItemToJsonItem(registerItem, item.id)).toMatchObject({
      runAsAdmin: true,
    });
  });

  it('パスをアプリ以外に変えたら、隠れたチェックの値を保存しない', () => {
    const item: JsonLauncherItem = {
      id: 'Admin002',
      type: 'item',
      displayName: 'サイト',
      path: 'C:\\Tools\\admin.exe',
      runAsAdmin: true,
    };
    const registerItem = convertEditableJsonItemToRegisterItem(editableOf(item), tabs);
    const saved = convertRegisterItemToJsonItem(
      { ...registerItem, path: 'https://example.com/', type: 'url' },
      item.id
    );
    expect(saved).not.toHaveProperty('runAsAdmin');
  });
});
