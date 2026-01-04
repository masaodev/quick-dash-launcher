/**
 * ウィンドウアクティブ化ユーティリティ
 *
 * アイテム起動時のウィンドウ検索・アクティブ化・位置サイズ設定を一元管理します。
 */

import { Logger } from 'pino';
import { WindowConfig } from '@common/types';

import { findWindowByTitle } from './windowMatcher.js';
import {
  activateWindow,
  restoreWindow,
  setWindowBounds,
  getWindowBounds,
} from './nativeWindowControl.js';
import { moveWindowToVirtualDesktop, isWindowOnDesktopNumber } from './virtualDesktopControl.js';

/**
 * ウィンドウ位置・サイズ設定の定数
 */
const WINDOW_BOUNDS_CONFIG = {
  /** 位置・サイズ設定のリトライ最大回数 */
  MAX_RETRIES: 3,
  /** リトライ間隔（ミリ秒） */
  RETRY_DELAY_MS: 50,
  /** 位置・サイズの許容誤差（ピクセル） */
  TOLERANCE_PX: 5,
  /** デスクトップ移動完了待機の最大時間（ミリ秒） */
  DESKTOP_MOVE_MAX_WAIT_MS: 2000,
  /** デスクトップ移動完了チェック間隔（ミリ秒） */
  DESKTOP_MOVE_CHECK_INTERVAL_MS: 10,
} as const;

/**
 * ウィンドウアクティブ化の結果
 */
export interface WindowActivationResult {
  /** アクティブ化が成功したかどうか */
  activated: boolean;
  /** ウィンドウが見つかったかどうか */
  windowFound: boolean;
}

/**
 * ウィンドウの位置・サイズ検証結果
 */
interface BoundsValidationResult {
  /** すべての値が許容範囲内かどうか */
  allMatch: boolean;
  /** X座標が一致しているか */
  xMatch: boolean;
  /** Y座標が一致しているか */
  yMatch: boolean;
  /** 幅が一致しているか */
  widthMatch: boolean;
  /** 高さが一致しているか */
  heightMatch: boolean;
}

/**
 * 位置・サイズの境界値
 */
interface Bounds {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * 実際のウィンドウ位置・サイズと目標値を比較検証する
 *
 * @param actual 実際のウィンドウ位置・サイズ
 * @param target 目標の位置・サイズ
 * @param tolerance 許容誤差（ピクセル）
 * @returns 検証結果
 */
function validateBounds(
  actual: { x: number; y: number; width: number; height: number },
  target: Bounds,
  tolerance: number = WINDOW_BOUNDS_CONFIG.TOLERANCE_PX
): BoundsValidationResult {
  const xMatch = target.x === undefined || Math.abs(actual.x - target.x) <= tolerance;
  const yMatch = target.y === undefined || Math.abs(actual.y - target.y) <= tolerance;
  const widthMatch =
    target.width === undefined || Math.abs(actual.width - target.width) <= tolerance;
  const heightMatch =
    target.height === undefined || Math.abs(actual.height - target.height) <= tolerance;

  return {
    allMatch: xMatch && yMatch && widthMatch && heightMatch,
    xMatch,
    yMatch,
    widthMatch,
    heightMatch,
  };
}

/**
 * ウィンドウの位置・サイズをリトライ処理で設定する
 *
 * @param hwnd ウィンドウハンドル
 * @param targetBounds 目標の位置・サイズ
 * @param itemName アイテム名（ログ出力用）
 * @param windowConfig ウィンドウ設定（ログ出力用）
 * @param logger ロガーインスタンス
 * @returns 設定が成功したかどうか
 */
async function setBoundsWithRetry(
  hwnd: bigint | number,
  targetBounds: Bounds,
  itemName: string,
  windowConfig: WindowConfig,
  logger: Logger
): Promise<boolean> {
  for (let attempt = 1; attempt <= WINDOW_BOUNDS_CONFIG.MAX_RETRIES; attempt++) {
    // 位置・サイズを設定
    const setSuccess = setWindowBounds(hwnd, targetBounds);

    if (setSuccess) {
      // 少し待ってから実際の値を確認
      await new Promise((resolve) => setTimeout(resolve, WINDOW_BOUNDS_CONFIG.RETRY_DELAY_MS));

      // 実際の値を取得
      const actualBounds = getWindowBounds(hwnd);

      if (actualBounds) {
        const validation = validateBounds(actualBounds, targetBounds);

        if (validation.allMatch) {
          logger.info(
            {
              name: itemName,
              windowConfig: JSON.stringify(windowConfig),
              attempt,
              actualBounds,
            },
            'ウィンドウの位置・サイズを設定しました'
          );
          return true;
        } else {
          logger.warn(
            {
              name: itemName,
              windowConfig: JSON.stringify(windowConfig),
              attempt,
              targetBounds,
              actualBounds,
            },
            `位置・サイズの検証に失敗しました（試行${attempt}/${WINDOW_BOUNDS_CONFIG.MAX_RETRIES}）`
          );
        }
      } else {
        logger.warn(
          {
            name: itemName,
            windowConfig: JSON.stringify(windowConfig),
            attempt,
          },
          '位置・サイズの取得に失敗しました'
        );
      }
    } else {
      logger.warn(
        {
          name: itemName,
          windowConfig: JSON.stringify(windowConfig),
          attempt,
        },
        `SetWindowPosに失敗しました（試行${attempt}/${WINDOW_BOUNDS_CONFIG.MAX_RETRIES}）`
      );
    }

    // 最後の試行でなければ、少し待機してからリトライ
    if (attempt < WINDOW_BOUNDS_CONFIG.MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, WINDOW_BOUNDS_CONFIG.RETRY_DELAY_MS));
    }
  }

  logger.error(
    { name: itemName, windowConfig: JSON.stringify(windowConfig) },
    'ウィンドウの位置・サイズ設定に失敗しました（全試行終了）'
  );
  return false;
}

/**
 * 仮想デスクトップ移動完了を待機する
 *
 * @param hwnd ウィンドウハンドル
 * @param targetDesktopNumber 目標デスクトップ番号
 * @param itemName アイテム名（ログ出力用）
 * @param windowConfig ウィンドウ設定（ログ出力用）
 * @param logger ロガーインスタンス
 * @returns 移動が完了したかどうか
 */
async function waitForDesktopMove(
  hwnd: bigint | number,
  targetDesktopNumber: number,
  itemName: string,
  windowConfig: WindowConfig,
  logger: Logger
): Promise<boolean> {
  const maxAttempts =
    WINDOW_BOUNDS_CONFIG.DESKTOP_MOVE_MAX_WAIT_MS /
    WINDOW_BOUNDS_CONFIG.DESKTOP_MOVE_CHECK_INTERVAL_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (isWindowOnDesktopNumber(hwnd, targetDesktopNumber)) {
      logger.info(
        {
          name: itemName,
          windowConfig: JSON.stringify(windowConfig),
          desktopNumber: targetDesktopNumber,
          waitTimeMs: attempt * WINDOW_BOUNDS_CONFIG.DESKTOP_MOVE_CHECK_INTERVAL_MS,
        },
        'デスクトップ移動完了を確認しました'
      );
      return true;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, WINDOW_BOUNDS_CONFIG.DESKTOP_MOVE_CHECK_INTERVAL_MS)
    );
  }

  logger.warn(
    {
      name: itemName,
      windowConfig: JSON.stringify(windowConfig),
      desktopNumber: targetDesktopNumber,
      maxWaitMs: WINDOW_BOUNDS_CONFIG.DESKTOP_MOVE_MAX_WAIT_MS,
    },
    'デスクトップ移動完了のタイムアウト（位置・サイズ設定を続行）'
  );
  return false;
}

/**
 * ウィンドウ設定に基づいてウィンドウをアクティブ化する
 *
 * @param windowConfig ウィンドウ設定（WindowConfigまたはundefined）
 * @param windowTitle 旧形式のウィンドウタイトル（後方互換性用、非推奨）
 * @param itemName アイテム名（ログ出力用）
 * @param logger ロガーインスタンス
 * @returns アクティブ化結果
 *
 * @description
 * 以下の処理を順次実行します：
 * 1. ウィンドウ設定からタイトルを取得（windowConfig優先、なければwindowTitle使用）
 * 2. タイトルに一致するウィンドウを検索
 * 3. ウィンドウが見つかった場合：
 *    - 最小化されている場合は復元
 *    - 位置・サイズを設定（指定されている場合）
 *    - ウィンドウをアクティブ化
 * 4. アクティブ化が失敗した場合は警告ログを出力し、通常起動へフォールバック
 */
export async function tryActivateWindow(
  windowConfig: WindowConfig | undefined,
  windowTitle: string | undefined,
  itemName: string,
  logger: Logger
): Promise<WindowActivationResult> {
  // ウィンドウ設定を取得（windowConfig優先、なければwindowTitleから生成）
  const effectiveConfig = windowConfig || (windowTitle ? { title: windowTitle } : undefined);

  if (!effectiveConfig) {
    // ウィンドウ設定が存在しない場合は何もしない
    return { activated: false, windowFound: false };
  }

  // ウィンドウタイトルでウィンドウを検索
  const hwnd = findWindowByTitle(
    effectiveConfig.title,
    effectiveConfig.exactMatch || false,
    effectiveConfig.processName
  );

  if (hwnd === null) {
    // ウィンドウが見つからない場合
    logger.info(
      { name: itemName, windowConfig: JSON.stringify(effectiveConfig) },
      'ウィンドウが見つかりませんでした。通常起動します'
    );
    return { activated: false, windowFound: false };
  }

  // ウィンドウが見つかった場合
  logger.info(
    { name: itemName, windowConfig: JSON.stringify(effectiveConfig), hwnd: String(hwnd) },
    'ウィンドウが見つかりました。アクティブ化と位置・サイズ調整を実行します'
  );

  // 最小化されている場合は復元
  restoreWindow(hwnd);

  // 位置・サイズ設定が必要かチェック
  const needsBoundsChange =
    effectiveConfig.x !== undefined ||
    effectiveConfig.y !== undefined ||
    effectiveConfig.width !== undefined ||
    effectiveConfig.height !== undefined;

  // ウィンドウの位置・サイズを設定（指定されている場合）
  if (needsBoundsChange) {
    const targetBounds = {
      x: effectiveConfig.x,
      y: effectiveConfig.y,
      width: effectiveConfig.width,
      height: effectiveConfig.height,
    };

    await setBoundsWithRetry(hwnd, targetBounds, itemName, effectiveConfig, logger);
  }

  // 最終的なデスクトップに移動
  // virtualDesktopNumberが指定されている場合のみ、そのデスクトップに移動
  let targetDesktopNumber: number | undefined;

  if (effectiveConfig.virtualDesktopNumber !== undefined) {
    targetDesktopNumber = effectiveConfig.virtualDesktopNumber;
  }

  if (targetDesktopNumber !== undefined) {
    const desktopMoveSuccess = moveWindowToVirtualDesktop(hwnd, targetDesktopNumber);

    if (desktopMoveSuccess) {
      logger.info(
        {
          name: itemName,
          windowConfig: JSON.stringify(effectiveConfig),
          desktopNumber: targetDesktopNumber,
        },
        '仮想デスクトップに移動しました'
      );

      // 仮想デスクトップ移動後、位置・サイズが必要な場合は再設定
      // （デスクトップ移動時にWindowsが位置・サイズをリセットすることがあるため）
      if (needsBoundsChange) {
        // デスクトップ移動完了を待機
        await waitForDesktopMove(hwnd, targetDesktopNumber, itemName, effectiveConfig, logger);

        // 位置・サイズを再設定
        const targetBounds = {
          x: effectiveConfig.x,
          y: effectiveConfig.y,
          width: effectiveConfig.width,
          height: effectiveConfig.height,
        };

        const setSuccess = setWindowBounds(hwnd, targetBounds);

        if (setSuccess) {
          // 少し待ってから実際の値を確認
          await new Promise((resolve) => setTimeout(resolve, WINDOW_BOUNDS_CONFIG.RETRY_DELAY_MS));

          const actualBounds = getWindowBounds(hwnd);

          if (actualBounds) {
            const validation = validateBounds(actualBounds, targetBounds);

            if (validation.allMatch) {
              logger.info(
                {
                  name: itemName,
                  windowConfig: JSON.stringify(effectiveConfig),
                  actualBounds,
                },
                'デスクトップ移動後、位置・サイズを再設定しました'
              );
            } else {
              logger.warn(
                {
                  name: itemName,
                  windowConfig: JSON.stringify(effectiveConfig),
                  targetBounds,
                  actualBounds,
                },
                'デスクトップ移動後の位置・サイズ再設定に失敗しました'
              );
            }
          }
        } else {
          logger.warn(
            {
              name: itemName,
              windowConfig: JSON.stringify(effectiveConfig),
            },
            'デスクトップ移動後のSetWindowPosに失敗しました'
          );
        }
      }
    } else {
      logger.warn(
        {
          name: itemName,
          windowConfig: JSON.stringify(effectiveConfig),
          desktopNumber: targetDesktopNumber,
        },
        '仮想デスクトップへの移動に失敗しました'
      );
    }
  }

  // ウィンドウをアクティブ化（activateWindowがfalseの場合はスキップ）
  const shouldActivate = effectiveConfig.activateWindow !== false; // undefined または true の場合はアクティブ化

  if (!shouldActivate) {
    logger.info(
      { name: itemName, windowConfig: JSON.stringify(effectiveConfig) },
      'activateWindow=falseのため、ウィンドウのアクティブ化をスキップしました'
    );
    return { activated: true, windowFound: true }; // ウィンドウ検索・設定は成功
  }

  const success = activateWindow(hwnd);

  if (success) {
    // アクティブ化成功
    return { activated: true, windowFound: true };
  } else {
    // アクティブ化失敗（通常起動へフォールバック）
    logger.warn(
      { name: itemName, windowConfig: JSON.stringify(effectiveConfig) },
      'ウィンドウのアクティブ化に失敗。通常起動にフォールバック'
    );
    return { activated: false, windowFound: true };
  }
}
