/**
 * koffiを使用したWindows仮想デスクトップAPIの呼び出し
 * VirtualDesktopAccessor.dllを使用してウィンドウを指定された仮想デスクトップに移動する機能を提供
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しのため、any型を使用しています
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as os from 'os';
import * as path from 'path';

import koffi from 'koffi';
import { app } from 'electron';

// advapi32.dllをロード（レジストリアクセス用）
const advapi32 = koffi.load('advapi32.dll');

// VirtualDesktopAccessor.dllをロード
let virtualDesktopAccessor: any = null;
let MoveWindowToDesktopNumber: any = null;
let _GetCurrentDesktopNumber: any = null;
let _GoToDesktopNumber: any = null;

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

  console.log('[VirtualDesktopAccessor] DLLパス:', dllPath);

  // ファイルの存在確認
  const fs = require('fs');
  if (!fs.existsSync(dllPath)) {
    throw new Error(`DLLファイルが見つかりません: ${dllPath}`);
  }

  console.log('[VirtualDesktopAccessor] DLLファイル確認OK');

  // DLLをロード（globalオプションでシンボルをグローバルに利用可能にする）
  virtualDesktopAccessor = koffi.load(dllPath, { global: true, lazy: false });
  console.log('[VirtualDesktopAccessor] DLLロード成功（global: true, lazy: false）');

  // MoveWindowToDesktopNumber関数を定義
  // BOOL MoveWindowToDesktopNumber(HWND hwnd, int desktop_number)
  // セグメンテーションフォルト対策：クラシックシンタックスを使用
  try {
    // パターン1: クラシックシンタックス + __stdcall + void* (推奨)
    MoveWindowToDesktopNumber = virtualDesktopAccessor.func(
      '__stdcall',
      'MoveWindowToDesktopNumber',
      'int',
      ['void *', 'int']
    );
    console.log('[VirtualDesktopAccessor] 関数定義成功（classic __stdcall + void*）');
  } catch (e1) {
    console.warn('[VirtualDesktopAccessor] classic __stdcall+void*失敗、prototypeを試行:', e1);
    try {
      // パターン2: C-likeプロトタイプ + void* (スペース付き)
      MoveWindowToDesktopNumber = virtualDesktopAccessor.func(
        'int __stdcall MoveWindowToDesktopNumber(void *hwnd, int desktop_number)'
      );
      console.log('[VirtualDesktopAccessor] 関数定義成功（prototype __stdcall + void*）');
    } catch (e2) {
      console.warn('[VirtualDesktopAccessor] prototype void*失敗、uintptrを試行:', e2);
      try {
        // パターン3: クラシックシンタックス + uintptr
        MoveWindowToDesktopNumber = virtualDesktopAccessor.func(
          '__stdcall',
          'MoveWindowToDesktopNumber',
          'int',
          ['uintptr', 'int']
        );
        console.log('[VirtualDesktopAccessor] 関数定義成功（classic __stdcall + uintptr）');
      } catch (e3) {
        console.warn('[VirtualDesktopAccessor] classic uintptr失敗、prototype uintptrを試行:', e3);
        // パターン4: C-likeプロトタイプ + uintptr
        MoveWindowToDesktopNumber = virtualDesktopAccessor.func(
          'int __stdcall MoveWindowToDesktopNumber(uintptr hwnd, int desktop_number)'
        );
        console.log('[VirtualDesktopAccessor] 関数定義成功（prototype __stdcall + uintptr）');
      }
    }
  }

  if (MoveWindowToDesktopNumber) {
    console.log('[VirtualDesktopAccessor] MoveWindowToDesktopNumber初期化完了');
  }

  // GetCurrentDesktopNumber関数を定義（将来の機能拡張用）
  // int GetCurrentDesktopNumber()
  try {
    _GetCurrentDesktopNumber = virtualDesktopAccessor.func(
      '__stdcall',
      'GetCurrentDesktopNumber',
      'int',
      []
    );
    console.log('[VirtualDesktopAccessor] GetCurrentDesktopNumber初期化完了');
  } catch (error) {
    console.error('[VirtualDesktopAccessor] GetCurrentDesktopNumber初期化失敗:', error);
  }

  // GoToDesktopNumber関数を定義（将来の機能拡張用）
  // void GoToDesktopNumber(int desktop_number)
  // 注: 戻り値はvoid（なし）
  try {
    _GoToDesktopNumber = virtualDesktopAccessor.func('__stdcall', 'GoToDesktopNumber', 'void', [
      'int',
    ]);
    console.log('[VirtualDesktopAccessor] GoToDesktopNumber初期化完了');
  } catch (error) {
    console.error('[VirtualDesktopAccessor] GoToDesktopNumber初期化失敗:', error);
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
 * レジストリから仮想デスクトップのGUID一覧を取得
 * @returns GUID文字列の配列（失敗時は空配列）
 */
export function getVirtualDesktopGUIDs(): string[] {
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
    return [];
  }

  try {
    // まずデータサイズを取得
    const dataType = [0];
    const dataSize = [0];
    const sizeQueryResult = RegQueryValueExW(
      hKey[0],
      'VirtualDesktopIDs',
      null,
      dataType,
      null,
      dataSize
    );

    console.log('[getVirtualDesktopGUIDs] サイズクエリ結果:', {
      result: sizeQueryResult,
      dataType: dataType[0],
      dataSize: dataSize[0],
    });

    if (sizeQueryResult !== 0 || dataSize[0] === 0) {
      console.warn('[getVirtualDesktopGUIDs] VirtualDesktopIDs値が見つかりません');
      return [];
    }

    if (dataType[0] !== REG_BINARY) {
      console.error(
        `[getVirtualDesktopGUIDs] データ型が不正です。期待値: ${REG_BINARY}, 実際: ${dataType[0]}`
      );
      return [];
    }

    // 16バイトの倍数でない場合はエラー
    if (dataSize[0] % 16 !== 0) {
      console.error(
        `[getVirtualDesktopGUIDs] データサイズが16の倍数ではありません: ${dataSize[0]}`
      );
      return [];
    }

    // データを取得（少し大きめのバッファを確保）
    const bufferSize = dataSize[0] + 16; // 余裕を持たせる
    const buffer = Buffer.alloc(bufferSize);
    const actualDataSize = [bufferSize]; // バッファサイズを設定
    const actualDataType = [0];

    // バッファをゼロで初期化
    buffer.fill(0);

    const dataQueryResult = RegQueryValueExW(
      hKey[0],
      'VirtualDesktopIDs',
      null,
      actualDataType,
      buffer,
      actualDataSize
    );

    console.log('[getVirtualDesktopGUIDs] データクエリ結果:', {
      result: dataQueryResult,
      actualDataSize: actualDataSize[0],
      bufferLength: buffer.length,
      expectedSize: dataSize[0],
    });

    if (dataQueryResult !== 0) {
      console.error(
        `[getVirtualDesktopGUIDs] データの読み取りに失敗しました。エラーコード: ${dataQueryResult}`
      );
      return [];
    }

    // 実際に書き込まれたサイズを使用
    const validDataSize = Math.min(actualDataSize[0], dataSize[0]);

    // 16バイトずつ区切ってGUIDに変換
    const guids: string[] = [];
    for (let i = 0; i < validDataSize; i += 16) {
      if (i + 16 <= validDataSize) {
        const guidBytes = buffer.subarray(i, i + 16);
        // GUIDフォーマット: {xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}
        const guid = bufferToGuidString(guidBytes);
        guids.push(guid);
        console.log(`[getVirtualDesktopGUIDs] GUID ${guids.length}: ${guid}`);
      }
    }

    console.log(`[getVirtualDesktopGUIDs] ${guids.length}個のGUIDを取得しました`);
    return guids;
  } finally {
    RegCloseKey(hKey[0]);
  }
}

/**
 * 16バイトのBufferをGUID文字列に変換
 * @param buffer 16バイトのGUIDバイナリ
 * @returns GUID文字列（{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}形式）
 */
function bufferToGuidString(buffer: Buffer): string {
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
 * GUID文字列を16バイトのBufferに変換
 * @param guidString GUID文字列（{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}形式）
 * @returns 16バイトのGUIDバイナリ
 */
function _guidStringToBuffer(guidString: string): Buffer {
  // 波括弧とハイフンを削除
  const hex = guidString.replace(/[{}-]/g, '');

  if (hex.length !== 32) {
    throw new Error('GUIDフォーマットが不正です');
  }

  const buffer = Buffer.alloc(16);

  // GUIDのバイト順序（リトルエンディアン）
  buffer.writeUInt32LE(parseInt(hex.substring(0, 8), 16), 0);
  buffer.writeUInt16LE(parseInt(hex.substring(8, 12), 16), 4);
  buffer.writeUInt16LE(parseInt(hex.substring(12, 16), 16), 6);
  buffer.writeUInt16BE(parseInt(hex.substring(16, 20), 16), 8);
  Buffer.from(hex.substring(20, 32), 'hex').copy(buffer, 10);

  return buffer;
}

/**
 * GUID文字列をGUID構造体に変換（COM API用）
 * @param guidString GUID文字列（{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}形式）
 * @returns GUID構造体
 */
function _guidStringToStruct(guidString: string): any {
  // 波括弧とハイフンを削除
  const hex = guidString.replace(/[{}-]/g, '');

  if (hex.length !== 32) {
    throw new Error('GUIDフォーマットが不正です');
  }

  // Data4配列を作成（通常のArrayを使用）
  const data4 = [];
  for (let i = 0; i < 8; i++) {
    data4.push(parseInt(hex.substring(16 + i * 2, 18 + i * 2), 16));
  }

  // GUID構造体を作成
  const guid = {
    Data1: parseInt(hex.substring(0, 8), 16),
    Data2: parseInt(hex.substring(8, 12), 16),
    Data3: parseInt(hex.substring(12, 16), 16),
    Data4: data4,
  };

  return guid;
}

/**
 * デスクトップ番号からGUIDを取得
 * @param desktopNumber デスクトップ番号（1から開始）
 * @returns GUID文字列（失敗時はnull）
 */
export function getDesktopGUIDByNumber(desktopNumber: number): string | null {
  if (desktopNumber < 1) {
    console.error(
      `[getDesktopGUIDByNumber] デスクトップ番号は1以上である必要があります: ${desktopNumber}`
    );
    return null;
  }

  const guids = getVirtualDesktopGUIDs();

  if (guids.length === 0) {
    console.warn('[getDesktopGUIDByNumber] 仮想デスクトップが見つかりません');
    return null;
  }

  // 番号を0ベースのインデックスに変換
  const index = desktopNumber - 1;

  if (index >= guids.length) {
    console.warn(
      `[getDesktopGUIDByNumber] デスクトップ番号が範囲外です。番号: ${desktopNumber}, 最大: ${guids.length}`
    );
    return null;
  }

  return guids[index];
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

  console.log('[moveWindowToVirtualDesktop] デバッグ情報:', {
    hwnd: String(hwnd),
    hwndValue: String(hwndValue),
    hwndType: typeof hwndValue,
    desktopNumber,
    desktopIndex,
  });

  try {
    console.log('[moveWindowToVirtualDesktop] 関数呼び出し前チェック:', {
      MoveWindowToDesktopNumber: typeof MoveWindowToDesktopNumber,
      isFunction: typeof MoveWindowToDesktopNumber === 'function',
    });

    // MoveWindowToDesktopNumber呼び出し
    // この関数はウィンドウを指定デスクトップに移動するが、デスクトップ切り替えは行わない
    const result = MoveWindowToDesktopNumber(hwndValue, desktopIndex);

    console.log('[moveWindowToVirtualDesktop] 実行結果:', result, '型:', typeof result);

    // 戻り値の型に応じて処理
    // bool型の場合: true/false
    // int型の場合: 非0 = TRUE (成功), 0 = FALSE (失敗)
    const success = typeof result === 'boolean' ? result : result !== 0;

    if (success) {
      console.log('[moveWindowToVirtualDesktop] ウィンドウ移動成功');
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
