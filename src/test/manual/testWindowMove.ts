/**
 * ウィンドウ移動の単体テストスクリプト
 *
 * 使い方:
 * 1. テスト対象のウィンドウを開く（例: Microsoft To Do）
 * 2. ターミナルで以下を実行:
 *    npm run test:window-move "ウィンドウタイトル" [x] [y] [width] [height] [desktopNumber]
 *
 * 例:
 *    npm run test:window-move "Microsoft To Do" 100 100 800 600 2
 */
/* eslint-disable no-console -- 手動テスト用スクリプトのため、標準出力にコンソール出力が必要 */

import { findWindowByTitle } from '../../main/utils/windowMatcher.js';
import { getWindowBounds, setWindowBounds } from '../../main/utils/nativeWindowControl.js';
import {
  getCurrentDesktopNumber,
  isWindowOnDesktopNumber,
  moveWindowToVirtualDesktop,
} from '../../main/utils/virtualDesktop/index.js';

interface TestResult {
  success: boolean;
  message: string;
  details?: {
    windowFound: boolean;
    originalDesktop?: number;
    targetDesktop?: number;
    originalBounds?: { x: number; y: number; width: number; height: number };
    targetBounds?: { x: number; y: number; width: number; height: number };
    actualBounds?: { x: number; y: number; width: number; height: number };
    desktopSwitched?: boolean;
    boundsMatch?: boolean;
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ウィンドウの位置・サイズを設定するテスト
 */
async function testWindowMove(
  windowTitle: string,
  targetX?: number,
  targetY?: number,
  targetWidth?: number,
  targetHeight?: number,
  targetDesktop?: number
): Promise<TestResult> {
  const result: TestResult = {
    success: false,
    message: '',
    details: {
      windowFound: false,
    },
  };

  // 1. ウィンドウを検索
  console.log(`\n[1/6] ウィンドウを検索中: "${windowTitle}"`);
  const hwnd = findWindowByTitle(windowTitle);

  if (!hwnd) {
    result.message = `ウィンドウが見つかりませんでした: "${windowTitle}"`;
    result.details!.windowFound = false;
    return result;
  }

  result.details!.windowFound = true;
  console.log(`✓ ウィンドウが見つかりました (hwnd: ${hwnd})`);

  // 2. 現在の状態を取得
  console.log('\n[2/6] 現在の状態を取得中...');
  const originalUserDesktop = getCurrentDesktopNumber();
  const originalBounds = getWindowBounds(hwnd);

  if (!originalBounds) {
    result.message = 'ウィンドウの現在位置を取得できませんでした';
    return result;
  }

  result.details!.originalDesktop = originalUserDesktop;
  result.details!.originalBounds = originalBounds;

  console.log(`✓ ユーザーデスクトップ: ${originalUserDesktop}`);
  console.log(
    `✓ 現在位置: x=${originalBounds.x}, y=${originalBounds.y}, w=${originalBounds.width}, h=${originalBounds.height}`
  );

  // ウィンドウがどのデスクトップにいるか検索
  let windowDesktop = originalUserDesktop;
  for (let desktop = 1; desktop <= 20; desktop++) {
    if (isWindowOnDesktopNumber(hwnd, desktop)) {
      windowDesktop = desktop;
      break;
    }
  }
  console.log(`✓ ウィンドウのデスクトップ: ${windowDesktop}`);

  // 3. デスクトップ切り替えはスキップ
  console.log('\n[3/6] デスクトップ切り替えなし（直接SetWindowPosを実行）');

  // 4. 位置・サイズを設定
  const needsBoundsChange =
    targetX !== undefined ||
    targetY !== undefined ||
    targetWidth !== undefined ||
    targetHeight !== undefined;

  if (needsBoundsChange) {
    console.log('\n[4/6] 位置・サイズを設定中...');

    const targetBounds = {
      x: targetX ?? originalBounds!.x,
      y: targetY ?? originalBounds!.y,
      width: targetWidth ?? originalBounds!.width,
      height: targetHeight ?? originalBounds!.height,
    };
    result.details!.targetBounds = targetBounds;

    console.log(
      `目標位置: x=${targetX ?? '変更なし'}, y=${targetY ?? '変更なし'}, w=${targetWidth ?? '変更なし'}, h=${targetHeight ?? '変更なし'}`
    );

    // リトライロジック（最大3回）
    let boundsSetSuccess = false;
    const maxRetries = 3;
    const retryDelayMs = 50;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`\n  試行 ${attempt}/${maxRetries}...`);

      const setSuccess = setWindowBounds(hwnd, targetBounds);

      if (!setSuccess) {
        console.log(`  ✗ SetWindowPos 失敗`);
        continue;
      }

      await sleep(retryDelayMs);

      const actualBounds = getWindowBounds(hwnd);

      if (!actualBounds) {
        console.log(`  ✗ 位置取得失敗`);
        continue;
      }

      console.log(
        `  実際位置: x=${actualBounds.x}, y=${actualBounds.y}, w=${actualBounds.width}, h=${actualBounds.height}`
      );

      // 許容誤差（±5ピクセル）
      const tolerance = 5;
      const xMatch = targetX === undefined || Math.abs(actualBounds.x - targetX) <= tolerance;
      const yMatch = targetY === undefined || Math.abs(actualBounds.y - targetY) <= tolerance;
      const widthMatch =
        targetWidth === undefined || Math.abs(actualBounds.width - targetWidth) <= tolerance;
      const heightMatch =
        targetHeight === undefined || Math.abs(actualBounds.height - targetHeight) <= tolerance;

      result.details!.actualBounds = actualBounds;

      if (xMatch && yMatch && widthMatch && heightMatch) {
        boundsSetSuccess = true;
        console.log(`  ✓ 位置・サイズ設定成功`);
        break;
      } else {
        console.log(`  ✗ 検証失敗 (x:${xMatch}, y:${yMatch}, w:${widthMatch}, h:${heightMatch})`);
      }
    }

    result.details!.boundsMatch = boundsSetSuccess;

    if (!boundsSetSuccess) {
      result.message = '位置・サイズ設定に失敗しました（全試行終了）';
      return result;
    }
  } else {
    console.log('\n[4/6] 位置・サイズ設定不要');
  }

  // 5. デスクトップ復元はスキップ
  console.log('\n[5/6] デスクトップ復元なし');

  // 6. 最終的なデスクトップ移動（指定されている場合）
  if (targetDesktop !== undefined) {
    console.log(`\n[6/6] ウィンドウをデスクトップ ${targetDesktop} に移動中...`);
    result.details!.targetDesktop = targetDesktop;

    const desktopMoveSuccess = moveWindowToVirtualDesktop(hwnd, targetDesktop);

    if (!desktopMoveSuccess) {
      result.message = '仮想デスクトップへの移動に失敗しました';
      result.details!.desktopSwitched = false;
      return result;
    }

    // 移動完了を確認（ポーリング: 最大2秒、10msごと）
    const maxWaitMs = 2000;
    const checkIntervalMs = 10;
    const maxAttempts = maxWaitMs / checkIntervalMs;
    let moveCompleted = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (isWindowOnDesktopNumber(hwnd, targetDesktop)) {
        moveCompleted = true;
        console.log(`✓ デスクトップ移動完了確認 (${attempt * checkIntervalMs}ms)`);
        break;
      }
      await sleep(checkIntervalMs);
    }

    result.details!.desktopSwitched = moveCompleted;

    if (!moveCompleted) {
      result.message = 'デスクトップ移動のタイムアウト';
      return result;
    }
  } else {
    console.log('\n[6/6] デスクトップ移動不要');
  }

  result.success = true;
  result.message = 'テスト成功';
  return result;
}

// コマンドライン引数を解析して実行
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error(`
使い方:
  npm run test:window-move "ウィンドウタイトル" [x] [y] [width] [height] [desktopNumber]

例:
  npm run test:window-move "Microsoft To Do"
  npm run test:window-move "Microsoft To Do" 100 100 800 600
  npm run test:window-move "Microsoft To Do" 100 100 800 600 2
`);
    process.exit(1);
  }

  const windowTitle = args[0];
  const x = args[1] ? parseInt(args[1], 10) : undefined;
  const y = args[2] ? parseInt(args[2], 10) : undefined;
  const width = args[3] ? parseInt(args[3], 10) : undefined;
  const height = args[4] ? parseInt(args[4], 10) : undefined;
  const desktop = args[5] ? parseInt(args[5], 10) : undefined;

  console.log('='.repeat(60));
  console.log('ウィンドウ移動テスト');
  console.log('='.repeat(60));

  const result = await testWindowMove(windowTitle, x, y, width, height, desktop);

  console.log('\n' + '='.repeat(60));
  console.log('テスト結果');
  console.log('='.repeat(60));
  console.log(`ステータス: ${result.success ? '✓ 成功' : '✗ 失敗'}`);
  console.log(`メッセージ: ${result.message}`);

  if (result.details) {
    console.log('\n詳細:');
    console.log(JSON.stringify(result.details, null, 2));
  }

  process.exit(result.success ? 0 : 1);
}

main();
