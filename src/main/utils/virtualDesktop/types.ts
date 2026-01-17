/**
 * 仮想デスクトップ関連の型定義と定数
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しを行います
 */
import type koffi from 'koffi';

import { EnvConfig } from '../../config/envConfig.js';

// koffi関連の型エイリアス
type KoffiLibrary = ReturnType<typeof koffi.load>;
type KoffiFunction = ReturnType<KoffiLibrary['func']>;

// レジストリアクセス定数
export const HKEY_CURRENT_USER = 0x80000001;
export const KEY_READ = 0x20019;
export const REG_BINARY = 3;

// デバッグログヘルパー（開発環境でのみ出力）
export const debugLog = (...args: unknown[]): void => {
  if (EnvConfig.isDevelopment) {
    console.warn('[VirtualDesktop]', ...args);
  }
};

/**
 * DLL関数の参照を保持する型
 */
export interface DllFunctions {
  MoveWindowToDesktopNumber: KoffiFunction | null;
  getCurrentDesktopNumber: KoffiFunction | null;
  isWindowOnDesktopNumber: KoffiFunction | null;
  getWindowDesktopNumber: KoffiFunction | null;
  getDesktopCount: KoffiFunction | null;
}

/**
 * レジストリAPI関数の参照を保持する型
 */
export interface RegistryFunctions {
  RegOpenKeyExW: KoffiFunction;
  RegQueryValueExW: KoffiFunction;
  RegCloseKey: KoffiFunction;
}

/**
 * レジストリハンドル型（void*ポインタに相当）
 */
export type RegistryHandle = unknown;
