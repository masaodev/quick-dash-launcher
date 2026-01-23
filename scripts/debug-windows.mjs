#!/usr/bin/env node
/**
 * ウィンドウデバッグツール
 *
 * ウィンドウ検索機能のトラブルシューティングと動作確認に使用します。
 * - ウィンドウ一覧の取得
 * - 除外ルールの動作確認
 * - プロセス名・クラス名・実行パスの確認
 *
 * 使い方:
 *   node scripts/debug-windows.mjs [オプション]
 *
 * オプション:
 *   --all-desktops   全仮想デスクトップのウィンドウを取得
 *   --show-excluded  除外されたウィンドウも表示
 *   --show-paths     実行パスも表示
 *   --output <file>  結果をファイルに保存
 *
 * 例:
 *   node scripts/debug-windows.mjs --all-desktops --show-excluded
 *   npm run debug:windows -- --all-desktops --show-excluded
 */

import koffi from 'koffi';
import fs from 'fs';

// =====================================================================
// Win32 API Setup
// =====================================================================

const user32 = koffi.load('user32.dll');
const kernel32 = koffi.load('kernel32.dll');
const dwmapi = koffi.load('dwmapi.dll');

const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(void* hwnd, intptr lParam)');
const EnumWindows = user32.func('EnumWindows', 'bool', [koffi.pointer(EnumWindowsProc), 'intptr']);
const GetWindowTextW = user32.func('GetWindowTextW', 'int', ['void*', 'str16', 'int']);
const GetWindowTextLengthW = user32.func('GetWindowTextLengthW', 'int', ['void*']);
const GetClassNameW = user32.func('GetClassNameW', 'int', ['void*', 'str16', 'int']);
const IsWindowVisible = user32.func('IsWindowVisible', 'bool', ['void*']);
const GetWindowThreadProcessId = user32.func('GetWindowThreadProcessId', 'uint32', [
  'void*',
  koffi.out(koffi.pointer('uint32', 1)),
]);
const OpenProcess = kernel32.func('OpenProcess', 'void*', ['uint32', 'bool', 'uint32']);
const CloseHandle = kernel32.func('CloseHandle', 'bool', ['void*']);
const QueryFullProcessImageNameW = kernel32.func('QueryFullProcessImageNameW', 'bool', [
  'void*',
  'uint32',
  'void*',
  koffi.inout(koffi.pointer('uint32', 1)),
]);
const DwmGetWindowAttribute = dwmapi.func('DwmGetWindowAttribute', 'long', [
  'void*',
  'uint32',
  koffi.out(koffi.pointer('int', 1)),
  'uint32',
]);

const DWMWA_CLOAKED = 14;
const DWM_CLOAKED_SHELL = 0x2;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

// =====================================================================
// Exclusion Rules (実装と同期)
// =====================================================================

const EXCLUDED_WINDOWS = [
  {
    processName: 'TextInputHost.exe',
    className: 'Windows.UI.Core.CoreWindow',
    description: 'Windows 入力エクスペリエンス',
  },
  {
    processName: 'ShellExperienceHost.exe',
    className: 'Windows.UI.Core.CoreWindow',
    description: 'Windowsシェルエクスペリエンス',
  },
  {
    processName: 'explorer.exe',
    className: 'Progman',
    description: 'デスクトップ壁紙（Program Manager）',
  },
];

// =====================================================================
// Helper Functions
// =====================================================================

function getProcessPath(processId) {
  let hProcess = null;
  try {
    hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
    if (!hProcess || koffi.address(hProcess) === 0n) {
      return undefined;
    }

    const buffer = Buffer.alloc(32768);
    const sizeArr = [16384];
    const success = QueryFullProcessImageNameW(hProcess, 0, buffer, sizeArr);

    if (!success || sizeArr[0] === 0) {
      return undefined;
    }

    return buffer.toString('utf16le').substring(0, sizeArr[0]);
  } catch (error) {
    return undefined;
  } finally {
    if (hProcess && koffi.address(hProcess) !== 0n) {
      CloseHandle(hProcess);
    }
  }
}

function getClassName(hwnd) {
  try {
    const buffer = Buffer.alloc(512);
    const length = GetClassNameW(hwnd, buffer, 256);
    if (length === 0) return undefined;
    return buffer.toString('utf16le').substring(0, length);
  } catch (error) {
    return undefined;
  }
}

function isWindowCloaked(hwnd, includeAllDesktops) {
  try {
    const cloakedArr = [0];
    const hr = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakedArr, 4);

    if (hr !== 0 || cloakedArr[0] === 0) {
      return false;
    }

    if (includeAllDesktops) {
      return (cloakedArr[0] & ~DWM_CLOAKED_SHELL) !== 0;
    } else {
      return true;
    }
  } catch {
    return false;
  }
}

// =====================================================================
// Main Window Enumeration
// =====================================================================

function getWindows(includeAllDesktops = false) {
  const visibleWindows = [];
  const excludedWindows = [];

  const callback = koffi.register(
    (hwnd, _lParam) => {
      try {
        if (!IsWindowVisible(hwnd)) return true;

        const length = GetWindowTextLengthW(hwnd);
        if (length === 0) return true;

        const buffer = Buffer.alloc((length + 1) * 2);
        const titleLength = GetWindowTextW(hwnd, buffer, length + 1);
        const title = buffer.toString('utf16le').substring(0, titleLength);

        if (!title || title.trim() === '') return true;

        if (isWindowCloaked(hwnd, includeAllDesktops)) return true;

        const processIdArr = [0];
        GetWindowThreadProcessId(hwnd, processIdArr);
        const processId = processIdArr[0];

        const executablePath = getProcessPath(processId);
        const processName = executablePath ? executablePath.split('\\').pop() : 'N/A';
        const className = getClassName(hwnd);

        const windowInfo = {
          title,
          processName,
          className: className || 'N/A',
          executablePath: executablePath || 'N/A',
          hwnd: koffi.address(hwnd).toString(),
        };

        // 除外チェック
        const matchedRule = EXCLUDED_WINDOWS.find(
          (rule) => rule.processName === processName && rule.className === className
        );

        if (matchedRule) {
          excludedWindows.push({
            ...windowInfo,
            excludeReason: matchedRule.description,
          });
        } else {
          visibleWindows.push(windowInfo);
        }
      } catch (error) {
        console.error('エラー:', error);
      }
      return true;
    },
    koffi.pointer(EnumWindowsProc)
  );

  try {
    EnumWindows(callback, 0);
  } finally {
    koffi.unregister(callback);
  }

  return { visibleWindows, excludedWindows };
}

// =====================================================================
// Output Formatting
// =====================================================================

function formatWindowInfo(win, index, showPaths = false) {
  let info = `[${index + 1}] ${win.title}\n`;
  info += `  プロセス名: ${win.processName}\n`;
  info += `  クラス名:   ${win.className}\n`;
  if (showPaths) {
    info += `  実行パス:   ${win.executablePath}\n`;
  }
  if (win.excludeReason) {
    info += `  除外理由:   ${win.excludeReason}\n`;
  }
  return info;
}

function generateOutput(visibleWindows, excludedWindows, options) {
  let output = '';

  output += '================================================================================\n';
  output += 'ウィンドウデバッグツール\n';
  output += '================================================================================\n\n';

  output += `取得範囲: ${options.allDesktops ? '全仮想デスクトップ' : '現在のデスクトップのみ'}\n`;
  output += `✓ 表示されるウィンドウ: ${visibleWindows.length}個\n`;
  output += `✗ 除外されるウィンドウ: ${excludedWindows.length}個\n\n`;

  // 表示されるウィンドウ
  output += '================================================================================\n';
  output += '表示されるウィンドウ:\n';
  output += '================================================================================\n\n';

  visibleWindows.forEach((win, index) => {
    output += formatWindowInfo(win, index, options.showPaths);
    output += '\n';
  });

  // 除外されたウィンドウ
  if (options.showExcluded && excludedWindows.length > 0) {
    output += '================================================================================\n';
    output += '除外されたウィンドウ:\n';
    output += '================================================================================\n\n';

    excludedWindows.forEach((win, index) => {
      output += formatWindowInfo(win, index, options.showPaths);
      output += '\n';
    });
  }

  // 除外ルール
  output += '================================================================================\n';
  output += '除外ルール（プロセス名とクラス名の両方が一致する必要あり）:\n';
  output += '================================================================================\n\n';

  EXCLUDED_WINDOWS.forEach((rule, index) => {
    output += `[${index + 1}] ${rule.description}\n`;
    output += `  プロセス名: ${rule.processName}\n`;
    output += `  クラス名:   ${rule.className}\n\n`;
  });

  output += '================================================================================\n';

  return output;
}

// =====================================================================
// CLI Argument Parsing
// =====================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    allDesktops: args.includes('--all-desktops'),
    showExcluded: args.includes('--show-excluded'),
    showPaths: args.includes('--show-paths'),
    outputFile: args.includes('--output') ? args[args.indexOf('--output') + 1] : null,
  };
}

// =====================================================================
// Main
// =====================================================================

function main() {
  const options = parseArgs();

  const { visibleWindows, excludedWindows } = getWindows(options.allDesktops);
  const output = generateOutput(visibleWindows, excludedWindows, options);

  console.log(output);

  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, output, 'utf8');
    console.log(`\n結果を ${options.outputFile} に保存しました`);
  }
}

main();
