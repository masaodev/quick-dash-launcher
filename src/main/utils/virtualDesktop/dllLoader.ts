/**
 * VirtualDesktopAccessor.dllのロードと関数定義
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しを行います
 */
import * as path from 'path';
import * as fs from 'fs';

import koffiModule from 'koffi';
import { app } from 'electron';

import { debugLog } from './types.js';

// koffi関連の型エイリアス
type KoffiLibrary = ReturnType<typeof koffiModule.load>;
type KoffiFunction = ReturnType<KoffiLibrary['func']>;

// DLL関数の参照
let virtualDesktopAccessor: KoffiLibrary | null = null;
let MoveWindowToDesktopNumber: KoffiFunction | null = null;
let _getCurrentDesktopNumber: KoffiFunction | null = null;
let _isWindowOnDesktopNumber: KoffiFunction | null = null;
let _getWindowDesktopNumber: KoffiFunction | null = null;
let _getDesktopCount: KoffiFunction | null = null;
let _pinWindow: KoffiFunction | null = null;
let _unPinWindow: KoffiFunction | null = null;
let _isPinnedWindow: KoffiFunction | null = null;
let _getDesktopName: KoffiFunction | null = null;

/**
 * DLLのベースパスを取得
 */
function getDllBasePath(): string {
  if (app && app.isPackaged) {
    return process.resourcesPath;
  }
  return process.cwd();
}

/**
 * MoveWindowToDesktopNumber関数を定義（複数パターンでフォールバック）
 */
function defineMoveWindowFunction(dllHandle: KoffiLibrary): KoffiFunction | null {
  const patterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () =>
        dllHandle.func('__stdcall', 'MoveWindowToDesktopNumber', 'int', ['void *', 'int']),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () =>
        dllHandle.func('int __stdcall MoveWindowToDesktopNumber(void *hwnd, int desktop_number)'),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () =>
        dllHandle.func('__stdcall', 'MoveWindowToDesktopNumber', 'int', ['uintptr', 'int']),
    },
    {
      name: 'prototype __stdcall + uintptr',
      loader: () =>
        dllHandle.func('int __stdcall MoveWindowToDesktopNumber(uintptr hwnd, int desktop_number)'),
    },
  ];

  for (const pattern of patterns) {
    try {
      const func = pattern.loader();
      debugLog(`[DllLoader] MoveWindowToDesktopNumber定義成功（${pattern.name}）`);
      return func;
    } catch (error) {
      console.warn(`[DllLoader] ${pattern.name}失敗:`, error);
    }
  }
  return null;
}

/**
 * IsWindowOnDesktopNumber関数を定義（複数パターンでフォールバック）
 */
function defineIsWindowOnDesktopFunction(dllHandle: KoffiLibrary): KoffiFunction | null {
  const patterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () =>
        dllHandle.func('__stdcall', 'IsWindowOnDesktopNumber', 'int', ['void *', 'int']),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () =>
        dllHandle.func('int __stdcall IsWindowOnDesktopNumber(void *hwnd, int desktop_number)'),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () =>
        dllHandle.func('__stdcall', 'IsWindowOnDesktopNumber', 'int', ['uintptr', 'int']),
    },
  ];

  for (const pattern of patterns) {
    try {
      const func = pattern.loader();
      debugLog(`[DllLoader] IsWindowOnDesktopNumber定義成功（${pattern.name}）`);
      return func;
    } catch (error) {
      console.warn(`[DllLoader] ${pattern.name}失敗:`, error);
    }
  }
  return null;
}

/**
 * 単一パラメータ（HWND）の関数を定義（複数パターンでフォールバック）
 * PinWindow、UnPinWindow、IsPinnedWindow等の共通パターン
 */
function defineSingleHwndFunction(
  dllHandle: KoffiLibrary,
  functionName: string
): KoffiFunction | null {
  const patterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () => dllHandle.func('__stdcall', functionName, 'int', ['void *']),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () => dllHandle.func(`int __stdcall ${functionName}(void *hwnd)`),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () => dllHandle.func('__stdcall', functionName, 'int', ['uintptr']),
    },
  ];

  for (const pattern of patterns) {
    try {
      const func = pattern.loader();
      debugLog(`[DllLoader] ${functionName}定義成功（${pattern.name}）`);
      return func;
    } catch (error) {
      console.warn(`[DllLoader] ${functionName} ${pattern.name}失敗:`, error);
    }
  }
  return null;
}

// DLLを初期化
try {
  const basePath = getDllBasePath();
  const dllPath = path.join(basePath, 'resources', 'native', 'VirtualDesktopAccessor.dll');

  debugLog('[DllLoader] DLLパス:', dllPath);

  if (!fs.existsSync(dllPath)) {
    throw new Error(`DLLファイルが見つかりません: ${dllPath}`);
  }

  debugLog('[DllLoader] DLLファイル確認OK');

  virtualDesktopAccessor = koffiModule.load(dllPath, { global: true, lazy: false });
  debugLog('[DllLoader] DLLロード成功');

  // 関数を定義
  MoveWindowToDesktopNumber = defineMoveWindowFunction(virtualDesktopAccessor);
  if (MoveWindowToDesktopNumber) {
    debugLog('[DllLoader] MoveWindowToDesktopNumber初期化完了');
  }

  // GetCurrentDesktopNumber関数を定義
  try {
    _getCurrentDesktopNumber = virtualDesktopAccessor.func(
      '__stdcall',
      'GetCurrentDesktopNumber',
      'int',
      []
    );
    debugLog('[DllLoader] GetCurrentDesktopNumber初期化完了');
  } catch (error) {
    console.error('[DllLoader] GetCurrentDesktopNumber初期化失敗:', error);
  }

  _isWindowOnDesktopNumber = defineIsWindowOnDesktopFunction(virtualDesktopAccessor);
  if (_isWindowOnDesktopNumber) {
    debugLog('[DllLoader] IsWindowOnDesktopNumber初期化完了');
  }

  _getWindowDesktopNumber = defineSingleHwndFunction(
    virtualDesktopAccessor,
    'GetWindowDesktopNumber'
  );
  if (_getWindowDesktopNumber) {
    debugLog('[DllLoader] GetWindowDesktopNumber初期化完了');
  }

  // GetDesktopCount関数を定義
  try {
    _getDesktopCount = virtualDesktopAccessor.func('__stdcall', 'GetDesktopCount', 'int', []);
    debugLog('[DllLoader] GetDesktopCount初期化完了');
  } catch (error) {
    console.warn('[DllLoader] GetDesktopCount初期化失敗:', error);
  }

  // PinWindow関数を定義
  _pinWindow = defineSingleHwndFunction(virtualDesktopAccessor, 'PinWindow');
  if (_pinWindow) {
    debugLog('[DllLoader] PinWindow初期化完了');
  }

  // UnPinWindow関数を定義
  _unPinWindow = defineSingleHwndFunction(virtualDesktopAccessor, 'UnPinWindow');
  if (_unPinWindow) {
    debugLog('[DllLoader] UnPinWindow初期化完了');
  }

  // IsPinnedWindow関数を定義
  _isPinnedWindow = defineSingleHwndFunction(virtualDesktopAccessor, 'IsPinnedWindow');
  if (_isPinnedWindow) {
    debugLog('[DllLoader] IsPinnedWindow初期化完了');
  }

  // GetDesktopName関数を定義（Win11専用）
  try {
    _getDesktopName = virtualDesktopAccessor.func('__stdcall', 'GetDesktopName', 'int', [
      'int',
      'void*',
      'uintptr',
    ]);
    debugLog('[DllLoader] GetDesktopName初期化完了');
  } catch (error) {
    console.warn('[DllLoader] GetDesktopName初期化失敗（Win11専用）:', error);
  }
} catch (error) {
  console.error('[DllLoader] 初期化失敗:', error);
  console.error('[DllLoader] エラー詳細:', JSON.stringify(error, null, 2));
}

// DLL関数をエクスポート
export function getMoveWindowToDesktopNumber(): KoffiFunction | null {
  return MoveWindowToDesktopNumber;
}

export function getGetCurrentDesktopNumber(): KoffiFunction | null {
  return _getCurrentDesktopNumber;
}

export function getIsWindowOnDesktopNumber(): KoffiFunction | null {
  return _isWindowOnDesktopNumber;
}

export function getGetWindowDesktopNumber(): KoffiFunction | null {
  return _getWindowDesktopNumber;
}

export function getGetDesktopCount(): KoffiFunction | null {
  return _getDesktopCount;
}

export function getPinWindow(): KoffiFunction | null {
  return _pinWindow;
}

export function getUnPinWindow(): KoffiFunction | null {
  return _unPinWindow;
}

export function getIsPinnedWindow(): KoffiFunction | null {
  return _isPinnedWindow;
}

export function getGetDesktopName(): KoffiFunction | null {
  return _getDesktopName;
}

/**
 * DLLが正常にロードされているか確認
 */
export function isDllLoaded(): boolean {
  return virtualDesktopAccessor !== null;
}
