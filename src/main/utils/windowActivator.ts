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
import {
  moveWindowToVirtualDesktop,
  isWindowOnDesktopNumber,
} from './virtualDesktopControl.js';

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
  const hwnd = findWindowByTitle(effectiveConfig.title);

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

    // リトライ処理（最大3回）
    let boundsSetSuccess = false;
    const maxRetries = 3;
    const retryDelayMs = 50; // 50ミリ秒待機

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 位置・サイズを設定
      const setSuccess = setWindowBounds(hwnd, targetBounds);

      if (setSuccess) {
        // 少し待ってから実際の値を確認
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));

        // 実際の値を取得
        const actualBounds = getWindowBounds(hwnd);

        if (actualBounds) {
          // 許容誤差（±5ピクセル）
          const tolerance = 5;
          const xMatch =
            targetBounds.x === undefined ||
            Math.abs(actualBounds.x - targetBounds.x) <= tolerance;
          const yMatch =
            targetBounds.y === undefined ||
            Math.abs(actualBounds.y - targetBounds.y) <= tolerance;
          const widthMatch =
            targetBounds.width === undefined ||
            Math.abs(actualBounds.width - targetBounds.width) <= tolerance;
          const heightMatch =
            targetBounds.height === undefined ||
            Math.abs(actualBounds.height - targetBounds.height) <= tolerance;

          if (xMatch && yMatch && widthMatch && heightMatch) {
            boundsSetSuccess = true;
            logger.info(
              {
                name: itemName,
                windowConfig: JSON.stringify(effectiveConfig),
                attempt,
                actualBounds,
              },
              'ウィンドウの位置・サイズを設定しました'
            );
            break;
          } else {
            logger.warn(
              {
                name: itemName,
                windowConfig: JSON.stringify(effectiveConfig),
                attempt,
                targetBounds,
                actualBounds,
              },
              `位置・サイズの検証に失敗しました（試行${attempt}/${maxRetries}）`
            );
          }
        } else {
          logger.warn(
            {
              name: itemName,
              windowConfig: JSON.stringify(effectiveConfig),
              attempt,
            },
            '位置・サイズの取得に失敗しました'
          );
        }
      } else {
        logger.warn(
          {
            name: itemName,
            windowConfig: JSON.stringify(effectiveConfig),
            attempt,
          },
          `SetWindowPosに失敗しました（試行${attempt}/${maxRetries}）`
        );
      }

      // 最後の試行でなければ、少し待機してからリトライ
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    if (!boundsSetSuccess) {
      logger.error(
        { name: itemName, windowConfig: JSON.stringify(effectiveConfig) },
        'ウィンドウの位置・サイズ設定に失敗しました（全試行終了）'
      );
    }
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
        // ポーリングで移動完了を確認（最大2秒、10msごとにチェック）
        const maxWaitMs = 2000;
        const checkIntervalMs = 10;
        const maxAttempts = maxWaitMs / checkIntervalMs;
        let moveCompleted = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (isWindowOnDesktopNumber(hwnd, targetDesktopNumber)) {
            moveCompleted = true;
            logger.info(
              {
                name: itemName,
                windowConfig: JSON.stringify(effectiveConfig),
                desktopNumber: targetDesktopNumber,
                waitTimeMs: attempt * checkIntervalMs,
              },
              'デスクトップ移動完了を確認しました'
            );
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
        }

        if (!moveCompleted) {
          logger.warn(
            {
              name: itemName,
              windowConfig: JSON.stringify(effectiveConfig),
              desktopNumber: targetDesktopNumber,
              maxWaitMs,
            },
            'デスクトップ移動完了のタイムアウト（位置・サイズ設定を続行）'
          );
        }

        const targetBounds = {
          x: effectiveConfig.x,
          y: effectiveConfig.y,
          width: effectiveConfig.width,
          height: effectiveConfig.height,
        };

        // 位置・サイズを再設定
        const setSuccess = setWindowBounds(hwnd, targetBounds);

        if (setSuccess) {
          // 少し待ってから実際の値を確認
          await new Promise((resolve) => setTimeout(resolve, 50));

          const actualBounds = getWindowBounds(hwnd);

          if (actualBounds) {
            const tolerance = 5;
            const xMatch =
              targetBounds.x === undefined ||
              Math.abs(actualBounds.x - targetBounds.x) <= tolerance;
            const yMatch =
              targetBounds.y === undefined ||
              Math.abs(actualBounds.y - targetBounds.y) <= tolerance;
            const widthMatch =
              targetBounds.width === undefined ||
              Math.abs(actualBounds.width - targetBounds.width) <= tolerance;
            const heightMatch =
              targetBounds.height === undefined ||
              Math.abs(actualBounds.height - targetBounds.height) <= tolerance;

            if (xMatch && yMatch && widthMatch && heightMatch) {
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
