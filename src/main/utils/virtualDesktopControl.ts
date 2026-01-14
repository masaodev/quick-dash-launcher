/**
 * koffiを使用したWindows仮想デスクトップAPIの呼び出し
 * VirtualDesktopAccessor.dllを使用してウィンドウを指定された仮想デスクトップに移動する機能を提供
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しのため、any型を使用しています
 *
 * TODO（将来のリファクタリング）:
 * このファイルは複数の責務を持っており、以下のように分割することを推奨します：
 * - virtualDesktopRegistry.ts: レジストリアクセス（GUID取得、レジストリ読み書き）
 * - virtualDesktopGuid.ts: GUID変換（Buffer⇔GUID文字列）
 * - virtualDesktopWindow.ts: ウィンドウ操作（移動、チェック、デスクトップ番号取得）
 * 現状でも動作に問題はありませんが、保守性・テスト容易性向上のため検討してください。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import koffi from 'koffi';
import { app } from 'electron';

// デバッグログヘルパー（開発環境でのみ出力）
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[VirtualDesktop]', ...args);
  }
};

// advapi32.dllをロード（レジストリアクセス用）
const advapi32 = koffi.load('advapi32.dll');

// VirtualDesktopAccessor.dllをロード
let virtualDesktopAccessor: any = null;
let MoveWindowToDesktopNumber: any = null;
let _getCurrentDesktopNumber: any = null;
let _isWindowOnDesktopNumber: any = null;
let _getWindowDesktopNumber: any = null;
let _getDesktopCount: any = null;

try {
  // DLLのパスを設定（resources/native/VirtualDesktopAccessor.dll）
  // テスト環境ではappオブジェクトが未定義の場合があるため、条件分岐を追加
  let basePath: string;
  if (app && app.isPackaged) {
    basePath = process.resourcesPath;
  } else {
    basePath = process.cwd();
  }

  // C++版のVirtualDesktopAccessor.dllを使用
  // 注: Rust版DLLとkoffiの互換性問題により、C++版（skottmckayフォーク）を使用
  const dllPath = path.join(basePath, 'resources', 'native', 'VirtualDesktopAccessor.dll');

  debugLog('[VirtualDesktopAccessor] DLLパス:', dllPath);

  // ファイルの存在確認
  if (!fs.existsSync(dllPath)) {
    throw new Error(`DLLファイルが見つかりません: ${dllPath}`);
  }

  debugLog('[VirtualDesktopAccessor] DLLファイル確認OK');

  // DLLをロード（globalオプションでシンボルをグローバルに利用可能にする）
  virtualDesktopAccessor = koffi.load(dllPath, { global: true, lazy: false });
  debugLog('[VirtualDesktopAccessor] DLLロード成功（global: true, lazy: false）');

  // MoveWindowToDesktopNumber関数を定義
  // BOOL MoveWindowToDesktopNumber(HWND hwnd, int desktop_number)
  // セグメンテーションフォルト対策：複数パターンをフォールバックで試行
  const moveWindowPatterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'MoveWindowToDesktopNumber', 'int', [
          'void *',
          'int',
        ]),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () =>
        virtualDesktopAccessor.func(
          'int __stdcall MoveWindowToDesktopNumber(void *hwnd, int desktop_number)'
        ),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'MoveWindowToDesktopNumber', 'int', [
          'uintptr',
          'int',
        ]),
    },
    {
      name: 'prototype __stdcall + uintptr',
      loader: () =>
        virtualDesktopAccessor.func(
          'int __stdcall MoveWindowToDesktopNumber(uintptr hwnd, int desktop_number)'
        ),
    },
  ];

  for (const pattern of moveWindowPatterns) {
    try {
      MoveWindowToDesktopNumber = pattern.loader();
      debugLog(`[VirtualDesktopAccessor] 関数定義成功（${pattern.name}）`);
      break;
    } catch (error) {
      console.warn(`[VirtualDesktopAccessor] ${pattern.name}失敗:`, error);
    }
  }

  if (MoveWindowToDesktopNumber) {
    debugLog('[VirtualDesktopAccessor] MoveWindowToDesktopNumber初期化完了');
  }

  // GetCurrentDesktopNumber関数を定義
  // int GetCurrentDesktopNumber()
  try {
    _getCurrentDesktopNumber = virtualDesktopAccessor.func(
      '__stdcall',
      'GetCurrentDesktopNumber',
      'int',
      []
    );
    debugLog('[VirtualDesktopAccessor] GetCurrentDesktopNumber初期化完了');
  } catch (error) {
    console.error('[VirtualDesktopAccessor] GetCurrentDesktopNumber初期化失敗:', error);
  }

  // IsWindowOnDesktopNumber関数を定義
  // BOOL IsWindowOnDesktopNumber(HWND hwnd, int desktop_number)
  // セグメンテーションフォルト対策：複数パターンをフォールバックで試行
  const isWindowPatterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'IsWindowOnDesktopNumber', 'int', [
          'void *',
          'int',
        ]),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () =>
        virtualDesktopAccessor.func(
          'int __stdcall IsWindowOnDesktopNumber(void *hwnd, int desktop_number)'
        ),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'IsWindowOnDesktopNumber', 'int', [
          'uintptr',
          'int',
        ]),
    },
  ];

  for (const pattern of isWindowPatterns) {
    try {
      _isWindowOnDesktopNumber = pattern.loader();
      debugLog(`[VirtualDesktopAccessor] IsWindowOnDesktopNumber定義成功（${pattern.name}）`);
      break;
    } catch (error) {
      console.warn(`[VirtualDesktopAccessor] ${pattern.name}失敗:`, error);
    }
  }

  if (_isWindowOnDesktopNumber) {
    debugLog('[VirtualDesktopAccessor] IsWindowOnDesktopNumber初期化完了');
  }

  // GetWindowDesktopNumber関数を定義
  // int GetWindowDesktopNumber(HWND hwnd)
  const getWindowDesktopPatterns = [
    {
      name: 'classic __stdcall + void*',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'GetWindowDesktopNumber', 'int', ['void *']),
    },
    {
      name: 'prototype __stdcall + void*',
      loader: () => virtualDesktopAccessor.func('int __stdcall GetWindowDesktopNumber(void *hwnd)'),
    },
    {
      name: 'classic __stdcall + uintptr',
      loader: () =>
        virtualDesktopAccessor.func('__stdcall', 'GetWindowDesktopNumber', 'int', ['uintptr']),
    },
  ];

  for (const pattern of getWindowDesktopPatterns) {
    try {
      _getWindowDesktopNumber = pattern.loader();
      debugLog(`[VirtualDesktopAccessor] GetWindowDesktopNumber定義成功（${pattern.name}）`);
      break;
    } catch (error) {
      console.warn(`[VirtualDesktopAccessor] ${pattern.name}失敗:`, error);
    }
  }

  if (_getWindowDesktopNumber) {
    debugLog('[VirtualDesktopAccessor] GetWindowDesktopNumber初期化完了');
  }

  // GetDesktopCount関数を定義
  // int GetDesktopCount()
  try {
    _getDesktopCount = virtualDesktopAccessor.func('__stdcall', 'GetDesktopCount', 'int', []);
    debugLog('[VirtualDesktopAccessor] GetDesktopCount初期化完了');
  } catch (error) {
    console.warn('[VirtualDesktopAccessor] GetDesktopCount初期化失敗:', error);
  }
} catch (error) {
  console.error('[VirtualDesktopAccessor] 初期化失敗:', error);
  console.error('[VirtualDesktopAccessor] エラー詳細:', JSON.stringify(error, null, 2));
}

// レジストリアクセス定数
const HKEY_CURRENT_USER = 0x80000001;
const KEY_READ = 0x20019;
const REG_BINARY = 3;

// レジストリAPI関数の定義
const RegOpenKeyExW = advapi32.func('RegOpenKeyExW', 'long', [
  'uintptr', // hKey (定義済みハンドル用)
  'str16', // lpSubKey
  'uint32', // ulOptions
  'uint32', // samDesired
  koffi.out(koffi.pointer('void*', 1)), // phkResult
]);

const RegQueryValueExW = advapi32.func('RegQueryValueExW', 'long', [
  'void*', // hKey
  'str16', // lpValueName
  'void*', // lpReserved
  koffi.out(koffi.pointer('uint32', 1)), // lpType
  koffi.out('void*'), // lpData (出力用バッファ)
  koffi.inout(koffi.pointer('uint32', 1)), // lpcbData (入出力)
]);

const RegCloseKey = advapi32.func('RegCloseKey', 'long', ['void*']);

/**
 * Windows 10以降で仮想デスクトップがサポートされているか確認
 * @returns サポートされている場合true
 */
export function isVirtualDesktopSupported(): boolean {
  // Windows 10のビルド番号は10.0.10240以降
  const release = os.release();
  const parts = release.split('.');
  if (parts.length < 3) {
    return false;
  }

  const major = parseInt(parts[0], 10);
  const build = parseInt(parts[2], 10);

  // Windows 10以降（メジャーバージョン10以上、ビルド10240以降）
  if (major < 10) {
    return false;
  }

  if (major === 10 && build < 10240) {
    return false;
  }

  // レジストリキーの存在確認
  const hKey = [null];
  const result = RegOpenKeyExW(
    HKEY_CURRENT_USER,
    'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops',
    0,
    KEY_READ,
    hKey
  );

  if (result === 0 && hKey[0]) {
    RegCloseKey(hKey[0]);
    return true;
  }

  return false;
}

/**
 * レジストリキーを開く
 * @returns [成功フラグ, レジストリキーハンドル]
 */
function _openVirtualDesktopRegistryKey(): [boolean, any] {
  const hKey = [null];
  const openResult = RegOpenKeyExW(
    HKEY_CURRENT_USER,
    'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops',
    0,
    KEY_READ,
    hKey
  );

  if (openResult !== 0 || !hKey[0]) {
    console.error('[getVirtualDesktopGUIDs] レジストリキーのオープンに失敗しました');
    return [false, null];
  }

  return [true, hKey[0]];
}

/**
 * レジストリからデータサイズと型を取得
 * @param hKey - レジストリキーハンドル
 * @returns [成功フラグ, データサイズ, データ型]
 */
function _queryRegistryDataSize(hKey: any): [boolean, number, number] {
  const dataType = [0];
  const dataSize = [0];
  const sizeQueryResult = RegQueryValueExW(
    hKey,
    'VirtualDesktopIDs',
    null,
    dataType,
    null,
    dataSize
  );

  debugLog('[getVirtualDesktopGUIDs] サイズクエリ結果:', {
    result: sizeQueryResult,
    dataType: dataType[0],
    dataSize: dataSize[0],
  });

  if (sizeQueryResult !== 0 || dataSize[0] === 0) {
    console.warn('[getVirtualDesktopGUIDs] VirtualDesktopIDs値が見つかりません');
    return [false, 0, 0];
  }

  if (dataType[0] !== REG_BINARY) {
    console.error(
      `[getVirtualDesktopGUIDs] データ型が不正です。期待値: ${REG_BINARY}, 実際: ${dataType[0]}`
    );
    return [false, 0, 0];
  }

  if (dataSize[0] % 16 !== 0) {
    console.error(`[getVirtualDesktopGUIDs] データサイズが16の倍数ではありません: ${dataSize[0]}`);
    return [false, 0, 0];
  }

  return [true, dataSize[0], dataType[0]];
}

/**
 * レジストリからバイナリデータを取得
 * @param hKey - レジストリキーハンドル
 * @param expectedSize - 期待されるデータサイズ
 * @returns [成功フラグ, バッファ, 実際のデータサイズ]
 */
function _queryRegistryBinaryData(hKey: any, expectedSize: number): [boolean, Buffer, number] {
  const bufferSize = expectedSize + 16; // 余裕を持たせる
  const buffer = Buffer.alloc(bufferSize);
  const actualDataSize = [bufferSize];
  const actualDataType = [0];

  buffer.fill(0);

  const dataQueryResult = RegQueryValueExW(
    hKey,
    'VirtualDesktopIDs',
    null,
    actualDataType,
    buffer,
    actualDataSize
  );

  debugLog('[getVirtualDesktopGUIDs] データクエリ結果:', {
    result: dataQueryResult,
    actualDataSize: actualDataSize[0],
    bufferLength: buffer.length,
    expectedSize: expectedSize,
  });

  if (dataQueryResult !== 0) {
    console.error(
      `[getVirtualDesktopGUIDs] データの読み取りに失敗しました。エラーコード: ${dataQueryResult}`
    );
    return [false, buffer, 0];
  }

  const validDataSize = Math.min(actualDataSize[0], expectedSize);
  return [true, buffer, validDataSize];
}

/**
 * バイナリデータからGUID配列を抽出
 * @param buffer - バイナリデータ
 * @param dataSize - データサイズ
 * @returns GUID文字列の配列
 */
function _parseGUIDsFromBuffer(buffer: Buffer, dataSize: number): string[] {
  const guids: string[] = [];
  for (let i = 0; i < dataSize; i += 16) {
    if (i + 16 <= dataSize) {
      const guidBytes = buffer.subarray(i, i + 16);
      const guid = _bufferToGuidString(guidBytes);
      guids.push(guid);
      debugLog(`[getVirtualDesktopGUIDs] GUID ${guids.length}: ${guid}`);
    }
  }
  debugLog(`[getVirtualDesktopGUIDs] ${guids.length}個のGUIDを取得しました`);
  return guids;
}

/**
 * レジストリから仮想デスクトップのGUID一覧を取得
 * @returns GUID文字列の配列（失敗時は空配列）
 */
export function getVirtualDesktopGUIDs(): string[] {
  const [openSuccess, hKey] = _openVirtualDesktopRegistryKey();
  if (!openSuccess) {
    return [];
  }

  try {
    const [sizeSuccess, dataSize] = _queryRegistryDataSize(hKey);
    if (!sizeSuccess) {
      return [];
    }

    const [dataSuccess, buffer, validDataSize] = _queryRegistryBinaryData(hKey, dataSize);
    if (!dataSuccess) {
      return [];
    }

    return _parseGUIDsFromBuffer(buffer, validDataSize);
  } finally {
    RegCloseKey(hKey);
  }
}

/**
 * 16バイトのBufferをGUID文字列に変換
 * @param buffer 16バイトのGUIDバイナリ
 * @returns GUID文字列（{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}形式）
 */
function _bufferToGuidString(buffer: Buffer): string {
  if (buffer.length !== 16) {
    throw new Error('GUIDは16バイトである必要があります');
  }

  // GUIDのバイト順序（リトルエンディアン）
  const part1 = buffer.readUInt32LE(0).toString(16).padStart(8, '0');
  const part2 = buffer.readUInt16LE(4).toString(16).padStart(4, '0');
  const part3 = buffer.readUInt16LE(6).toString(16).padStart(4, '0');
  const part4 = buffer.readUInt16BE(8).toString(16).padStart(4, '0');
  const part5 = buffer.subarray(10, 16).toString('hex');

  return `{${part1}-${part2}-${part3}-${part4}-${part5}}`;
}

/**
 * 現在の仮想デスクトップ番号を取得
 * @returns デスクトップ番号（1から開始）。失敗時は-1
 */
export function getCurrentDesktopNumber(): number {
  // サポート確認
  if (!isVirtualDesktopSupported()) {
    console.warn('[getCurrentDesktopNumber] 仮想デスクトップはサポートされていません');
    return -1;
  }

  // DLLロード確認
  if (!_getCurrentDesktopNumber) {
    console.error('[getCurrentDesktopNumber] VirtualDesktopAccessor.dllがロードされていません');
    return -1;
  }

  try {
    // GetCurrentDesktopNumber呼び出し（0ベースのインデックスを返す）
    const desktopIndex = _getCurrentDesktopNumber();

    debugLog('[getCurrentDesktopNumber] 現在のデスクトップインデックス:', desktopIndex);

    // 1ベースの番号に変換して返す
    return desktopIndex + 1;
  } catch (error) {
    console.error('[getCurrentDesktopNumber] 例外発生:', error);
    return -1;
  }
}

/**
 * ウィンドウを指定された仮想デスクトップに移動
 * VirtualDesktopAccessor.dllを使用
 * 現在のデスクトップは変更されません（移動前のデスクトップに自動的に戻ります）
 * @param hwnd ウィンドウハンドル
 * @param desktopNumber デスクトップ番号（1から開始、0ベースに変換される）
 * @returns 成功したらtrue
 */
export function moveWindowToVirtualDesktop(hwnd: number | bigint, desktopNumber: number): boolean {
  // サポート確認
  if (!isVirtualDesktopSupported()) {
    console.warn('[moveWindowToVirtualDesktop] 仮想デスクトップはサポートされていません');
    return false;
  }

  // DLLロード確認
  if (!MoveWindowToDesktopNumber) {
    console.error('[moveWindowToVirtualDesktop] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  // デスクトップ番号の検証（1から開始、0ベースに変換）
  if (desktopNumber < 1) {
    console.error(
      `[moveWindowToVirtualDesktop] デスクトップ番号は1以上である必要があります: ${desktopNumber}`
    );
    return false;
  }

  // VirtualDesktopAccessorは0ベースのインデックスを使用
  const desktopIndex = desktopNumber - 1;

  // HWNDの型変換（関数定義の型に応じて適切に変換）
  // koffiでint64型定義した場合はBigInt、それ以外は数値として扱う
  let hwndValue: number | bigint;
  if (typeof hwnd === 'bigint') {
    // bigintのまま渡す（int64型定義の場合に対応）
    hwndValue = hwnd;
  } else {
    // numberの場合もそのまま渡す
    hwndValue = hwnd;
  }

  debugLog('[moveWindowToVirtualDesktop] デバッグ情報:', {
    hwnd: String(hwnd),
    hwndValue: String(hwndValue),
    hwndType: typeof hwndValue,
    desktopNumber,
    desktopIndex,
  });

  try {
    debugLog('[moveWindowToVirtualDesktop] 関数呼び出し前チェック:', {
      MoveWindowToDesktopNumber: typeof MoveWindowToDesktopNumber,
      isFunction: typeof MoveWindowToDesktopNumber === 'function',
    });

    // MoveWindowToDesktopNumber呼び出し
    // この関数はウィンドウを指定デスクトップに移動するが、デスクトップ切り替えは行わない
    const result = MoveWindowToDesktopNumber(hwndValue, desktopIndex);

    debugLog('[moveWindowToVirtualDesktop] 実行結果:', result, '型:', typeof result);

    // 戻り値の型に応じて処理
    // bool型の場合: true/false
    // int型の場合: 非0 = TRUE (成功), 0 = FALSE (失敗)
    const success = typeof result === 'boolean' ? result : result !== 0;

    if (success) {
      debugLog('[moveWindowToVirtualDesktop] ウィンドウ移動成功');
      return true;
    } else {
      console.error(`[moveWindowToVirtualDesktop] ウィンドウ移動失敗。戻り値: ${result}`);
      return false;
    }
  } catch (error) {
    console.error('[moveWindowToVirtualDesktop] 例外発生:', error);
    console.error('[moveWindowToVirtualDesktop] エラースタック:', (error as Error).stack);
    return false;
  }
}

/**
 * ウィンドウが指定された仮想デスクトップにあるかチェック
 * @param hwnd ウィンドウハンドル
 * @param desktopNumber デスクトップ番号（1から開始、0ベースに変換される）
 * @returns 指定されたデスクトップにある場合true、それ以外false
 */
export function isWindowOnDesktopNumber(hwnd: number | bigint, desktopNumber: number): boolean {
  // サポート確認
  if (!isVirtualDesktopSupported()) {
    console.warn('[isWindowOnDesktopNumber] 仮想デスクトップはサポートされていません');
    return false;
  }

  // DLLロード確認
  if (!_isWindowOnDesktopNumber) {
    console.error('[isWindowOnDesktopNumber] VirtualDesktopAccessor.dllがロードされていません');
    return false;
  }

  // デスクトップ番号の検証（1から開始、0ベースに変換）
  if (desktopNumber < 1) {
    console.error(
      `[isWindowOnDesktopNumber] デスクトップ番号は1以上である必要があります: ${desktopNumber}`
    );
    return false;
  }

  // VirtualDesktopAccessorは0ベースのインデックスを使用
  const desktopIndex = desktopNumber - 1;

  // HWNDの型変換
  let hwndValue: number | bigint;
  if (typeof hwnd === 'bigint') {
    hwndValue = hwnd;
  } else {
    hwndValue = hwnd;
  }

  try {
    // IsWindowOnDesktopNumber呼び出し
    const result = _isWindowOnDesktopNumber(hwndValue, desktopIndex);

    // 戻り値の型に応じて処理
    // bool型の場合: true/false
    // int型の場合: 非0 = TRUE (指定デスクトップにある), 0 = FALSE (別のデスクトップにある)
    const isOnDesktop = typeof result === 'boolean' ? result : result !== 0;

    debugLog(
      '[isWindowOnDesktopNumber] チェック結果:',
      isOnDesktop,
      'デスクトップ:',
      desktopNumber
    );

    return isOnDesktop;
  } catch (error) {
    console.error('[isWindowOnDesktopNumber] 例外発生:', error);
    return false;
  }
}

/**
 * ウィンドウが所属する仮想デスクトップ番号を取得
 * @param hwnd ウィンドウハンドル
 * @returns デスクトップ番号（1から開始）。失敗時は-1
 */
export function getWindowDesktopNumber(hwnd: number | bigint): number {
  // サポート確認
  if (!isVirtualDesktopSupported()) {
    return -1;
  }

  // DLLロード確認
  if (!_getWindowDesktopNumber) {
    return -1;
  }

  // HWNDの型変換
  const hwndValue = typeof hwnd === 'bigint' ? hwnd : hwnd;

  try {
    // GetWindowDesktopNumber呼び出し（0ベースのインデックスを返す）
    const desktopIndex = _getWindowDesktopNumber(hwndValue);

    if (desktopIndex < 0) {
      return -1;
    }

    // 1ベースの番号に変換して返す
    return desktopIndex + 1;
  } catch (error) {
    console.error('[getWindowDesktopNumber] 例外発生:', error);
    return -1;
  }
}

/**
 * 仮想デスクトップの数を取得
 * @returns デスクトップ数。失敗時は-1
 */
export function getDesktopCount(): number {
  // サポート確認
  if (!isVirtualDesktopSupported()) {
    return -1;
  }

  // DLLロード確認
  if (!_getDesktopCount) {
    // DLLが利用できない場合はレジストリから取得
    const guids = getVirtualDesktopGUIDs();
    return guids.length > 0 ? guids.length : -1;
  }

  try {
    const count = _getDesktopCount();
    return count > 0 ? count : -1;
  } catch (error) {
    console.error('[getDesktopCount] 例外発生:', error);
    // フォールバック: レジストリから取得
    const guids = getVirtualDesktopGUIDs();
    return guids.length > 0 ? guids.length : -1;
  }
}
