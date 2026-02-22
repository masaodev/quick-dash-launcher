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
 * DLL関数を複数パターンでフォールバック定義する汎用関数
 */
function defineDllFunction(
  dllHandle: KoffiLibrary,
  functionName: string,
  extraParams: string[] = []
): KoffiFunction | null {
  const extraProto =
    extraParams.length > 0 ? ', ' + extraParams.map((p, i) => `${p} arg${i}`).join(', ') : '';

  const patterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () => dllHandle.func('__stdcall', functionName, 'int', ['void *', ...extraParams]),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () => dllHandle.func(`int __stdcall ${functionName}(void *hwnd${extraProto})`),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () => dllHandle.func('__stdcall', functionName, 'int', ['uintptr', ...extraParams]),
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

  // HWND + int 引数の関数を定義
  MoveWindowToDesktopNumber = defineDllFunction(
    virtualDesktopAccessor,
    'MoveWindowToDesktopNumber',
    ['int']
  );
  _isWindowOnDesktopNumber = defineDllFunction(virtualDesktopAccessor, 'IsWindowOnDesktopNumber', [
    'int',
  ]);

  // HWND のみの関数を定義
  _getWindowDesktopNumber = defineDllFunction(virtualDesktopAccessor, 'GetWindowDesktopNumber');
  _pinWindow = defineDllFunction(virtualDesktopAccessor, 'PinWindow');
  _unPinWindow = defineDllFunction(virtualDesktopAccessor, 'UnPinWindow');
  _isPinnedWindow = defineDllFunction(virtualDesktopAccessor, 'IsPinnedWindow');

  // 引数なしの関数を定義
  try {
    _getCurrentDesktopNumber = virtualDesktopAccessor.func(
      '__stdcall',
      'GetCurrentDesktopNumber',
      'int',
      []
    );
    debugLog('[DllLoader] GetCurrentDesktopNumber定義成功');
  } catch (error) {
    console.error('[DllLoader] GetCurrentDesktopNumber初期化失敗:', error);
  }

  try {
    _getDesktopCount = virtualDesktopAccessor.func('__stdcall', 'GetDesktopCount', 'int', []);
    debugLog('[DllLoader] GetDesktopCount定義成功');
  } catch (error) {
    console.warn('[DllLoader] GetDesktopCount初期化失敗:', error);
  }

  // GetDesktopName関数を定義（Win11専用）
  try {
    _getDesktopName = virtualDesktopAccessor.func('__stdcall', 'GetDesktopName', 'int', [
      'int',
      'void*',
      'uintptr',
    ]);
    debugLog('[DllLoader] GetDesktopName定義成功');
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
