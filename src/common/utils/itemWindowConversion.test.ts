import { describe, it, expect } from 'vitest';

import {
  convertLegacyWindowConfigs,
  hasItemWindowSwitch,
  hasLegacyWindowConfig,
  omitItemWindowSwitch,
  pickItemWindowSwitch,
  replaceWindowConfig,
  switchToWindowConfig,
  windowConfigToSwitch,
  windowItemToPathlessItem,
  itemWindowSwitchFields,
} from './itemWindowConversion';

describe('windowConfigToSwitch', () => {
  it('タイトル・プロセス名を window に、座標・大きさを placement にまとめ、前面に出すを明示する', () => {
    expect(
      windowConfigToSwitch({
        title: '一時メモ.txt - sakura',
        processName: 'sakura.exe',
        x: 846,
        y: 244,
        width: 1708,
        height: 1032,
      })
    ).toEqual({
      window: { processName: 'sakura.exe', title: '一時メモ.txt - sakura' },
      placement: { x: 846, y: 244, width: 1708, height: 1032 },
      activateWindow: true,
    });
  });

  it('位置が 1 つも無ければ placement を付けない', () => {
    expect(windowConfigToSwitch({ title: 'Cursor*' })).toEqual({
      window: { title: 'Cursor*' },
      activateWindow: true,
    });
  });

  it('タイトルが空・"*" ならタイトルを書かない（プロセス名だけで探す）', () => {
    expect(windowConfigToSwitch({ title: '', processName: 'x.exe' })?.window).toEqual({
      processName: 'x.exe',
    });
    expect(windowConfigToSwitch({ title: '*', processName: 'x.exe' })?.window).toEqual({
      processName: 'x.exe',
    });
  });

  it('探すウィンドウの条件が無ければ undefined', () => {
    expect(windowConfigToSwitch({ title: '' })).toBeUndefined();
    expect(windowConfigToSwitch({ title: '*', x: 0, y: 0 })).toBeUndefined();
  });

  it('activateWindow: false・ピン止め・仮想デスクトップはそのまま、中央に配置は捨てる', () => {
    expect(
      windowConfigToSwitch({
        title: 'a',
        activateWindow: false,
        pinToAllDesktops: true,
        virtualDesktopNumber: 2,
        moveToActiveMonitorCenter: true,
      })
    ).toEqual({
      window: { title: 'a' },
      placement: { virtualDesktopNumber: 2 },
      activateWindow: false,
      pinToAllDesktops: true,
    });
  });

  it('仮想デスクトップ番号は 1 以上の整数だけ', () => {
    expect(windowConfigToSwitch({ title: 'a', virtualDesktopNumber: 0 })).not.toHaveProperty(
      'placement'
    );
  });
});

describe('switchToWindowConfig（セットの行がアイテムの対象ウィンドウを借りるとき）', () => {
  it('windowConfig に戻し、往復しても同じ形になる', () => {
    const original = {
      window: { processName: 'sakura.exe', title: 'メモ' },
      placement: { x: 1, y: 2, width: 3, height: 4, virtualDesktopNumber: 2 },
      activateWindow: false,
      pinToAllDesktops: true,
    };
    const config = switchToWindowConfig(original);
    expect(config).toEqual({
      title: 'メモ',
      processName: 'sakura.exe',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      virtualDesktopNumber: 2,
      activateWindow: false,
      pinToAllDesktops: true,
    });
    expect(windowConfigToSwitch(config!)).toEqual(original);
  });

  it('タイトルの無い見つけ方はタイトル空にする。window が無ければ undefined', () => {
    expect(switchToWindowConfig({ window: { processName: 'x.exe' } })).toEqual({
      title: '',
      processName: 'x.exe',
    });
    expect(switchToWindowConfig({})).toBeUndefined();
  });
});

describe('itemWindowSwitchFields', () => {
  it('対象ウィンドウが無ければ、ウィンドウ位置などが残っていても何も書かない', () => {
    expect(itemWindowSwitchFields({})).toEqual({});
    expect(
      itemWindowSwitchFields({ placement: { x: 0, y: 0 }, waitSeconds: 5, pinToAllDesktops: true })
    ).toEqual({});
  });

  it('ifOpen・waitSeconds・placement.state も含めて、値のあるキーをそのまま写す', () => {
    const value = {
      displayName: 'x',
      window: { processName: 'sakura.exe', title: '*メモ*' },
      placement: { x: 1, y: 2, width: 3, height: 4, state: 'maximized' as const },
      ifOpen: 'openNew' as const,
      activateWindow: false,
      waitSeconds: 10,
      pinToAllDesktops: true,
      args: undefined,
    };
    expect(itemWindowSwitchFields(value)).toEqual({
      window: { processName: 'sakura.exe', title: '*メモ*' },
      placement: { x: 1, y: 2, width: 3, height: 4, state: 'maximized' },
      ifOpen: 'openNew',
      activateWindow: false,
      waitSeconds: 10,
      pinToAllDesktops: true,
    });
  });
});

describe('hasItemWindowSwitch・pickItemWindowSwitch・omitItemWindowSwitch', () => {
  it('探すウィンドウの条件があるときだけ持つとみなす', () => {
    expect(hasItemWindowSwitch({ window: { processName: 'x.exe' } })).toBe(true);
    expect(hasItemWindowSwitch({ placement: { x: 0 } })).toBe(false);
  });

  it('ウィンドウ切り替えのキーだけを写す・除く', () => {
    const item = {
      displayName: 'x',
      window: { title: 'a' },
      waitSeconds: 5,
      memo: undefined,
    };
    expect(pickItemWindowSwitch(item)).toEqual({ window: { title: 'a' }, waitSeconds: 5 });
    expect(omitItemWindowSwitch(item)).toEqual({ displayName: 'x', memo: undefined });
  });
});

describe('replaceWindowConfig', () => {
  it('windowConfig のあった位置に新しいキーを書く', () => {
    const replaced = replaceWindowConfig({
      id: 'abcd1234',
      type: 'item',
      displayName: 'x',
      path: 'x.exe',
      windowConfig: { title: 'a', x: 0, y: 0 },
      memo: 'm',
    });
    expect(Object.keys(replaced!)).toEqual([
      'id',
      'type',
      'displayName',
      'path',
      'window',
      'placement',
      'activateWindow',
      'memo',
    ]);
  });

  it('条件の無い windowConfig は消すだけ', () => {
    expect(replaceWindowConfig({ type: 'item', windowConfig: { title: '' } })).toEqual({
      type: 'item',
    });
  });

  it('windowConfig がオブジェクトでなければ undefined', () => {
    expect(replaceWindowConfig({ type: 'item', windowConfig: 'x' })).toBeUndefined();
  });
});

describe('hasLegacyWindowConfig・convertLegacyWindowConfigs', () => {
  it('windowConfig を持つ単一アイテムとウィンドウ操作を変換する', () => {
    const items = [
      { id: 'a', type: 'item', displayName: 'A', path: 'a.exe', windowConfig: { title: 'A' } },
      { id: 'b', type: 'window', displayName: 'B', windowTitle: 'B' },
      { id: 'c', type: 'item', displayName: 'C', path: 'c.exe' },
    ];
    expect(hasLegacyWindowConfig(items)).toBe(true);
    const { items: converted, changed } = convertLegacyWindowConfigs(items);
    expect(changed).toBe(true);
    expect(converted[0]).toEqual({
      id: 'a',
      type: 'item',
      displayName: 'A',
      path: 'a.exe',
      window: { title: 'A' },
      activateWindow: true,
    });
    expect(converted[1]).toEqual({
      id: 'b',
      type: 'item',
      displayName: 'B',
      path: '',
      window: { title: 'B' },
    });
    expect(converted[2]).toBe(items[2]);
    expect(hasLegacyWindowConfig(converted)).toBe(false);
  });

  it('壊れた windowConfig は残し、変換したとはみなさない', () => {
    const items = [{ id: 'a', type: 'item', windowConfig: 'bad' }];
    expect(hasLegacyWindowConfig(items)).toBe(true);
    expect(convertLegacyWindowConfigs(items)).toEqual({ items, changed: false });
  });

  it('配列でなければ持たないとみなす', () => {
    expect(hasLegacyWindowConfig(undefined)).toBe(false);
  });
});

describe('windowItemToPathlessItem', () => {
  it('同じ id・表示名・メモのパスの無い単一アイテムにし、位置は placement にまとめる', () => {
    expect(
      windowItemToPathlessItem({
        id: 'w1',
        type: 'window',
        displayName: '一時メモ',
        windowTitle: '一時メモ.txt - sakura',
        processName: 'sakura.exe',
        x: 10,
        y: 20,
        width: 800,
        height: 600,
        virtualDesktopNumber: 2,
        moveToActiveMonitorCenter: true,
        activateWindow: false,
        pinToAllDesktops: true,
        customIcon: 'memo.png',
        memo: 'メモ',
        updatedAt: 123,
      })
    ).toEqual({
      id: 'w1',
      type: 'item',
      displayName: '一時メモ',
      path: '',
      customIcon: 'memo.png',
      memo: 'メモ',
      updatedAt: 123,
      window: { processName: 'sakura.exe', title: '一時メモ.txt - sakura' },
      placement: { x: 10, y: 20, width: 800, height: 600, virtualDesktopNumber: 2 },
      activateWindow: false,
      pinToAllDesktops: true,
    });
  });

  it('タイトル "*" はタイトルを問わない（exe 名だけで探す）。前面に出す（既定）は書かない', () => {
    const converted = windowItemToPathlessItem({
      id: 'w2',
      type: 'window',
      displayName: 'Chrome',
      windowTitle: '*',
      processName: 'chrome.exe',
      activateWindow: true,
    });
    expect(converted).toEqual({
      id: 'w2',
      type: 'item',
      displayName: 'Chrome',
      path: '',
      window: { processName: 'chrome.exe' },
    });
  });

  it('exe 名が無くタイトルが "*" だけなら、探す条件として "*" を残す', () => {
    expect(
      windowItemToPathlessItem({ id: 'w3', type: 'window', displayName: '何か', windowTitle: '*' })
        .window
    ).toEqual({ title: '*' });
  });

  it('ワークスペースの所属・並び順は残す', () => {
    const converted = windowItemToPathlessItem({
      id: 'w4',
      type: 'window',
      displayName: 'メモ帳',
      windowTitle: '*メモ帳*',
      workspaceId: 'ws',
      groupId: 'g',
      order: 3,
      addedAt: 1,
    });
    expect(converted).toMatchObject({ workspaceId: 'ws', groupId: 'g', order: 3, addedAt: 1 });
    expect(converted).not.toHaveProperty('windowTitle');
  });
});
