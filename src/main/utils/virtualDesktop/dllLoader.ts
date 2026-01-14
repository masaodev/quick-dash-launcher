/**
 * VirtualDesktopAccessor.dllのロードと関数定義
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しのため、any型を使用しています
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from 'path';
import * as fs from 'fs';

import koffi from 'koffi';
import { app } from 'electron';

import { debugLog } from './types.js';

// DLL関数の参照
let virtualDesktopAccessor: any = null;
let MoveWindowToDesktopNumber: any = null;
let _getCurrentDesktopNumber: any = null;
let _isWindowOnDesktopNumber: any = null;
let _getWindowDesktopNumber: any = null;
let _getDesktopCount: any = null;

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
function defineMoveWindowFunction(dllHandle: any): any {
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
function defineIsWindowOnDesktopFunction(dllHandle: any): any {
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
 * GetWindowDesktopNumber関数を定義（複数パターンでフォールバック）
 */
function defineGetWindowDesktopFunction(dllHandle: any): any {
  const patterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () => dllHandle.func('__stdcall', 'GetWindowDesktopNumber', 'int', ['void *']),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () => dllHandle.func('int __stdcall GetWindowDesktopNumber(void *hwnd)'),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () => dllHandle.func('__stdcall', 'GetWindowDesktopNumber', 'int', ['uintptr']),
    },
  ];

  for (const pattern of patterns) {
    try {
      const func = pattern.loader();
      debugLog(`[DllLoader] GetWindowDesktopNumber定義成功（${pattern.name}）`);
      return func;
    } catch (error) {
      console.warn(`[DllLoader] ${pattern.name}失敗:`, error);
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

  virtualDesktopAccessor = koffi.load(dllPath, { global: true, lazy: false });
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

  _getWindowDesktopNumber = defineGetWindowDesktopFunction(virtualDesktopAccessor);
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
} catch (error) {
  console.error('[DllLoader] 初期化失敗:', error);
  console.error('[DllLoader] エラー詳細:', JSON.stringify(error, null, 2));
}

// DLL関数をエクスポート
export function getMoveWindowToDesktopNumber(): any {
  return MoveWindowToDesktopNumber;
}

export function getGetCurrentDesktopNumber(): any {
  return _getCurrentDesktopNumber;
}

export function getIsWindowOnDesktopNumber(): any {
  return _isWindowOnDesktopNumber;
}

export function getGetWindowDesktopNumber(): any {
  return _getWindowDesktopNumber;
}

export function getGetDesktopCount(): any {
  return _getDesktopCount;
}

/**
 * DLLが正常にロードされているか確認
 */
export function isDllLoaded(): boolean {
  return virtualDesktopAccessor !== null;
}
