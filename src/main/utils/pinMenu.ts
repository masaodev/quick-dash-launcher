import { Menu } from 'electron';
import type { BrowserWindow } from 'electron';
import type { PinLevel, WindowPinMode } from '@common/types';
import { isPinLevel } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { mainI18n } from '../services/mainI18n.js';

/**
 * ピン留めの段階を扱う共通処理（メイン・ワークスペース・切り離しで同じ決まり）
 *
 * 📌 のクリックは「表示固定」のオン・オフ、「常に最前面」は右クリックのメニューで選ぶ。
 */

const WINDOW_PIN_MODE_TO_LEVEL: Record<WindowPinMode, PinLevel> = {
  normal: 0,
  stayVisible: 1,
  alwaysOnTop: 2,
};

const LEVEL_TO_WINDOW_PIN_MODE: Record<PinLevel, WindowPinMode> = {
  0: 'normal',
  1: 'stayVisible',
  2: 'alwaysOnTop',
};

/** メインウィンドウのピンモード（文字列）を段階に直す */
export function pinModeToLevel(mode: WindowPinMode): PinLevel {
  return WINDOW_PIN_MODE_TO_LEVEL[mode];
}

/** 段階をメインウィンドウのピンモード（文字列）に直す */
export function levelToPinMode(level: PinLevel): WindowPinMode {
  return LEVEL_TO_WINDOW_PIN_MODE[level];
}

export { isPinLevel };

/**
 * 段階が変わったことを、そのウィンドウ（の 📌 ボタン）に知らせる
 * メインプロセス側で変えたとき（読み替え・編集画面の一時的な最前面・開いた直後）もボタンを合わせるため
 */
export function notifyPinLevel(win: BrowserWindow | null | undefined, level: PinLevel): void {
  if (win && !win.isDestroyed()) win.webContents.send(IPC_CHANNELS.EVENT_PIN_CHANGED, level);
}

/** メニューで選んだ項目から、次の段階を求める */
export function nextPinLevelFromMenu(
  current: PinLevel,
  item: 'stayVisible' | 'alwaysOnTop'
): PinLevel {
  if (item === 'stayVisible') {
    return current >= 1 ? 0 : 1;
  }
  return current === 2 ? 1 : 2;
}

/**
 * 📌 の右クリックメニューを出し、選ばれた段階を返す（何も選ばずに閉じたら今の段階）
 */
export function showPinMenu(win: BrowserWindow, current: PinLevel): Promise<PinLevel> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (level: PinLevel) => {
      if (settled) return;
      settled = true;
      resolve(level);
    };
    const menu = Menu.buildFromTemplate([
      {
        label: mainI18n.t('menu.pin.stayVisible'),
        type: 'checkbox',
        checked: current >= 1,
        click: () => finish(nextPinLevelFromMenu(current, 'stayVisible')),
      },
      {
        label: mainI18n.t('menu.pin.alwaysOnTop'),
        type: 'checkbox',
        checked: current === 2,
        click: () => finish(nextPinLevelFromMenu(current, 'alwaysOnTop')),
      },
    ]);
    // 閉じた通知が項目のクリックより先に来ることがあるので、少し待ってから「選ばなかった」とみなす
    menu.popup({ window: win, callback: () => setTimeout(() => finish(current), 100) });
  });
}
