/**
 * レジストリアクセス機能
 * advapi32.dllを使用して仮想デスクトップ関連のレジストリ情報を取得
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しを行います
 */
import * as os from 'os';

import koffi from 'koffi';

import { HKEY_CURRENT_USER, KEY_READ, REG_BINARY, debugLog, type RegistryHandle } from './types.js';
import { bufferToGuidString } from './guidUtils.js';

// advapi32.dllをロード（レジストリアクセス用）
const advapi32 = koffi.load('advapi32.dll');

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
  const registryHandle = [null];
  const result = RegOpenKeyExW(
    HKEY_CURRENT_USER,
    'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops',
    0,
    KEY_READ,
    registryHandle
  );

  if (result === 0 && registryHandle[0]) {
    RegCloseKey(registryHandle[0]);
    return true;
  }

  return false;
}

/**
 * レジストリキーを開く
 * @returns [成功フラグ, レジストリキーハンドル]
 */
function openVirtualDesktopRegistryKey(): [boolean, RegistryHandle] {
  const registryHandle = [null];
  const openResult = RegOpenKeyExW(
    HKEY_CURRENT_USER,
    'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VirtualDesktops',
    0,
    KEY_READ,
    registryHandle
  );

  if (openResult !== 0 || !registryHandle[0]) {
    console.error('[Registry] レジストリキーのオープンに失敗しました');
    return [false, null];
  }

  return [true, registryHandle[0]];
}

/**
 * レジストリからデータサイズと型を取得
 * @param registryHandle - レジストリキーハンドル
 * @returns [成功フラグ, データサイズ, データ型]
 */
function queryRegistryDataSize(registryHandle: RegistryHandle): [boolean, number, number] {
  const dataType = [0];
  const dataSize = [0];
  const sizeQueryResult = RegQueryValueExW(
    registryHandle,
    'VirtualDesktopIDs',
    null,
    dataType,
    null,
    dataSize
  );

  debugLog('[Registry] サイズクエリ結果:', {
    result: sizeQueryResult,
    dataType: dataType[0],
    dataSize: dataSize[0],
  });

  if (sizeQueryResult !== 0 || dataSize[0] === 0) {
    console.warn('[Registry] VirtualDesktopIDs値が見つかりません');
    return [false, 0, 0];
  }

  if (dataType[0] !== REG_BINARY) {
    console.error(`[Registry] データ型が不正です。期待値: ${REG_BINARY}, 実際: ${dataType[0]}`);
    return [false, 0, 0];
  }

  if (dataSize[0] % 16 !== 0) {
    console.error(`[Registry] データサイズが16の倍数ではありません: ${dataSize[0]}`);
    return [false, 0, 0];
  }

  return [true, dataSize[0], dataType[0]];
}

/**
 * レジストリからバイナリデータを取得
 * @param registryHandle - レジストリキーハンドル
 * @param expectedSize - 期待されるデータサイズ
 * @returns [成功フラグ, バッファ, 実際のデータサイズ]
 */
function queryRegistryBinaryData(
  registryHandle: RegistryHandle,
  expectedSize: number
): [boolean, Buffer, number] {
  const bufferSize = expectedSize + 16; // 余裕を持たせる
  const buffer = Buffer.alloc(bufferSize);
  const actualDataSize = [bufferSize];
  const actualDataType = [0];

  buffer.fill(0);

  const dataQueryResult = RegQueryValueExW(
    registryHandle,
    'VirtualDesktopIDs',
    null,
    actualDataType,
    buffer,
    actualDataSize
  );

  debugLog('[Registry] データクエリ結果:', {
    result: dataQueryResult,
    actualDataSize: actualDataSize[0],
    bufferLength: buffer.length,
    expectedSize: expectedSize,
  });

  if (dataQueryResult !== 0) {
    console.error(`[Registry] データの読み取りに失敗しました。エラーコード: ${dataQueryResult}`);
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
function parseGUIDsFromBuffer(buffer: Buffer, dataSize: number): string[] {
  const guids: string[] = [];
  for (let i = 0; i < dataSize; i += 16) {
    if (i + 16 <= dataSize) {
      const guidBytes = buffer.subarray(i, i + 16);
      const guid = bufferToGuidString(guidBytes);
      guids.push(guid);
      debugLog(`[Registry] GUID ${guids.length}: ${guid}`);
    }
  }
  debugLog(`[Registry] ${guids.length}個のGUIDを取得しました`);
  return guids;
}

/**
 * レジストリから仮想デスクトップのGUID一覧を取得
 * @returns GUID文字列の配列（失敗時は空配列）
 */
export function getVirtualDesktopGUIDs(): string[] {
  const [openSuccess, registryHandle] = openVirtualDesktopRegistryKey();
  if (!openSuccess) {
    return [];
  }

  try {
    const [sizeSuccess, dataSize] = queryRegistryDataSize(registryHandle);
    if (!sizeSuccess) {
      return [];
    }

    const [dataSuccess, buffer, validDataSize] = queryRegistryBinaryData(registryHandle, dataSize);
    if (!dataSuccess) {
      return [];
    }

    return parseGUIDsFromBuffer(buffer, validDataSize);
  } finally {
    RegCloseKey(registryHandle);
  }
}
