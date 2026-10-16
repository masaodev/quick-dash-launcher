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
  windowConfigToSwitchFields,
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

describe('switchToWindowConfig（編集画面の一時つなぎ）', () => {
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

describe('windowConfigToSwitchFields', () => {
  it('windowConfig が無い・条件が無ければ空', () => {
    expect(windowConfigToSwitchFields(undefined)).toEqual({});
    expect(windowConfigToSwitchFields({ title: '' })).toEqual({});
  });

  it('前面に出すはチェックの値をそのまま書く', () => {
    expect(windowConfigToSwitchFields({ title: 'a', activateWindow: true })).toEqual({
      window: { title: 'a' },
      activateWindow: true,
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
  it('windowConfig を持つ単一アイテムだけを変換する', () => {
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
    expect(converted[1]).toBe(items[1]);
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
