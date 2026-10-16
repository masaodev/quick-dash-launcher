import { useEffect, useState } from 'react';
import type { WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';

/** ウィンドウ切り替えの欄（対象ウィンドウ・ウィンドウ位置）が使う、今の画面まわりの情報 */
export interface WindowEnvironment {
  /** 今開いているウィンドウ（全デスクトップ。対象ウィンドウの「今合うウィンドウ」を数える） */
  windows: WindowInfo[];
  /** 仮想デスクトップの数（使えないときは 0。2 未満なら、ウィンドウから位置を取るときに番号を記録しない） */
  desktopCount: number;
  /** 仮想デスクトップの名前（ウィンドウ位置の表示に添える） */
  desktopNames: Record<number, string | undefined>;
  /** 画面の並び（ウィンドウ位置を「画面 1・右半分」のような言葉にする） */
  screens: ScreenArea[];
}

interface UseWindowEnvironmentOptions {
  /** false のあいだは読まない（画面を閉じているときなど） */
  active: boolean;
  /** 変わったら読み直す（行の詳細で、別の行を開いたとき） */
  reloadKey?: unknown;
  /** 開いているウィンドウを読むか（既定 true。たたんだ欄では読まない） */
  windows?: boolean;
  /** 画面の並びを読むか（既定 false。呼び出し側がもう持っているときは読まない） */
  screens?: boolean;
}

/**
 * ウィンドウ一覧・仮想デスクトップ・画面の並びを読む（セットの行の詳細と、単一アイテムのウィンドウ切り替えの欄で使う）
 */
export function useWindowEnvironment({
  active,
  reloadKey,
  windows: loadWindows = true,
  screens: loadScreens = false,
}: UseWindowEnvironmentOptions): WindowEnvironment {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [desktopCount, setDesktopCount] = useState(0);
  const [desktopNames, setDesktopNames] = useState<Record<number, string | undefined>>({});
  const [screens, setScreens] = useState<ScreenArea[]>([]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    if (loadWindows) {
      window.electronAPI
        .getAllWindowsAllDesktops()
        .then((all) => {
          if (alive) setWindows(all);
        })
        .catch(() => {
          if (alive) setWindows([]);
        });
    }
    window.electronAPI
      .getVirtualDesktopInfo()
      .then((info) => {
        if (!alive) return;
        setDesktopCount(info.supported ? info.desktopCount : 0);
        setDesktopNames(info.desktopNames ?? {});
      })
      .catch(() => {
        if (alive) setDesktopCount(0);
      });
    if (loadScreens) {
      window.electronAPI
        .getScreenAreas()
        .then((areas) => {
          if (alive) setScreens(areas);
        })
        .catch(() => {
          if (alive) setScreens([]);
        });
    }
    return () => {
      alive = false;
    };
  }, [active, reloadKey, loadWindows, loadScreens]);

  return { windows, desktopCount, desktopNames, screens };
}
