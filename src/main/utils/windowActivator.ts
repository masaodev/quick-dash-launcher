/**
 * ウィンドウアクティブ化ユーティリティ
 *
 * アイテム起動時のウィンドウ検索・アクティブ化・位置サイズ設定を一元管理します。
 */

import { Logger } from 'pino';
import { WindowConfig } from '@common/types';

import { findWindowByTitle } from './windowMatcher.js';
import { activateWindow, restoreWindow, setWindowBounds } from './nativeWindowControl.js';
import { moveWindowToVirtualDesktop } from './virtualDesktopControl.js';

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
export function tryActivateWindow(
  windowConfig: WindowConfig | undefined,
  windowTitle: string | undefined,
  itemName: string,
  logger: Logger
): WindowActivationResult {
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

  // 仮想デスクトップへの移動（指定されている場合）
  if (effectiveConfig.virtualDesktopNumber !== undefined) {
    const desktopMoveSuccess = moveWindowToVirtualDesktop(
      hwnd,
      effectiveConfig.virtualDesktopNumber
    );

    if (desktopMoveSuccess) {
      logger.info(
        {
          name: itemName,
          windowConfig: JSON.stringify(effectiveConfig),
          desktopNumber: effectiveConfig.virtualDesktopNumber,
        },
        '仮想デスクトップに移動しました'
      );
    } else {
      logger.warn(
        {
          name: itemName,
          windowConfig: JSON.stringify(effectiveConfig),
          desktopNumber: effectiveConfig.virtualDesktopNumber,
        },
        '仮想デスクトップへの移動に失敗しました'
      );
    }
  }

  // ウィンドウの位置・サイズを設定（指定されている場合）
  if (
    effectiveConfig.x !== undefined ||
    effectiveConfig.y !== undefined ||
    effectiveConfig.width !== undefined ||
    effectiveConfig.height !== undefined
  ) {
    const boundsSuccess = setWindowBounds(hwnd, {
      x: effectiveConfig.x,
      y: effectiveConfig.y,
      width: effectiveConfig.width,
      height: effectiveConfig.height,
    });

    if (!boundsSuccess) {
      logger.warn(
        { name: itemName, windowConfig: JSON.stringify(effectiveConfig) },
        'ウィンドウの位置・サイズ設定に失敗しました'
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
