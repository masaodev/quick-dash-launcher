/**
 * ウィンドウ一覧の取得テストスクリプト
 *
 * 使い方:
 * 1. ターミナルで以下を実行:
 *    npm run test:window-list [--all-desktops]
 *
 * 例:
 *    npm run test:window-list
 *    npm run test:window-list --all-desktops
 *
 * 結果はコンソールと window-list-output.txt に出力されます
 */
/* eslint-disable no-console -- 手動テスト用スクリプトのため、標準出力にコンソール出力が必要 */

import { getAllWindows } from '../../main/utils/nativeWindowControl.js';
import {
  getCurrentDesktopNumber,
  getDesktopCount,
  isVirtualDesktopSupported,
} from '../../main/utils/virtualDesktop/index.js';

import * as fs from 'fs';
import * as path from 'path';

// 出力バッファ
let outputBuffer = '';

/**
 * コンソールとバッファに出力
 */
function log(message: string) {
  console.log(message);
  outputBuffer += message + '\n';
}

/**
 * ウィンドウ情報をフォーマットして表示
 */
function displayWindowInfo() {
  const args = process.argv.slice(2);
  const includeAllDesktops = args.includes('--all-desktops');

  log('='.repeat(80));
  log('ウィンドウ一覧取得テスト');
  log('='.repeat(80));

  // 仮想デスクトップ情報を表示
  const vdSupported = isVirtualDesktopSupported();
  if (vdSupported) {
    const currentDesktop = getCurrentDesktopNumber();
    const desktopCount = getDesktopCount();
    log(`\n仮想デスクトップ: ${currentDesktop}/${desktopCount}`);
  } else {
    log('\n仮想デスクトップ: サポートされていません');
  }

  log(`取得範囲: ${includeAllDesktops ? '全デスクトップ' : '現在のデスクトップのみ'}`);

  // ウィンドウ一覧を取得
  log('\nウィンドウ情報を取得中...\n');
  const windows = getAllWindows({ includeAllVirtualDesktops: includeAllDesktops });

  if (windows.length === 0) {
    log('ウィンドウが見つかりませんでした。');
    return;
  }

  log(`取得されたウィンドウ数: ${windows.length}\n`);
  log('='.repeat(80));

  // 各ウィンドウ情報を表示
  windows.forEach((win, index) => {
    log(`\n[${index + 1}] ${win.title}`);
    log(`  HWND:         ${win.hwnd}`);
    log(`  プロセス名:   ${win.processName || 'N/A'}`);
    log(`  クラス名:     ${win.className || 'N/A'}`);
    log(`  実行ファイル: ${win.executablePath || 'N/A'}`);
    log(`  位置:         x=${win.x}, y=${win.y}`);
    log(`  サイズ:       width=${win.width}, height=${win.height}`);
    log(`  状態:         ${win.windowState || 'N/A'}`);
    log(`  デスクトップ: ${win.desktopNumber || 'N/A'}`);
    log(`  ピン止め:     ${win.isPinned ? 'はい' : 'いいえ'}`);
    log(`  アイコン:     ${win.icon ? 'あり' : 'なし'}`);
  });

  log('\n' + '='.repeat(80));

  // プロセス名・クラス名の統計を表示
  const processNames = new Map<string, number>();
  const classNames = new Map<string, number>();

  windows.forEach((win) => {
    if (win.processName) {
      processNames.set(win.processName, (processNames.get(win.processName) || 0) + 1);
    }
    if (win.className) {
      classNames.set(win.className, (classNames.get(win.className) || 0) + 1);
    }
  });

  log('\nプロセス名の統計:');
  Array.from(processNames.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      log(`  ${name}: ${count}個`);
    });

  log('\nクラス名の統計:');
  Array.from(classNames.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      log(`  ${name}: ${count}個`);
    });

  log('\n' + '='.repeat(80));

  // ファイルに保存
  const outputFile = path.join(process.cwd(), 'window-list-output.txt');
  try {
    fs.writeFileSync(outputFile, outputBuffer, 'utf8');
    log(`\n結果をファイルに保存しました: ${outputFile}`);
  } catch (error) {
    console.error('ファイル保存エラー:', error);
  }
}

// 実行
try {
  displayWindowInfo();
  process.exit(0);
} catch (error) {
  console.error('エラーが発生しました:', error);
  if (error instanceof Error) {
    console.error('スタックトレース:', error.stack);
  }
  process.exit(1);
}
