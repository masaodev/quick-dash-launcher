/**
 * 仮想デスクトップ関連の型定義と定数
 *
 * Note: koffiライブラリを使用したネイティブDLL呼び出しのため、any型を使用しています
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { EnvConfig } from '../../config/envConfig.js';

// レジストリアクセス定数
export const HKEY_CURRENT_USER = 0x80000001;
export const KEY_READ = 0x20019;
export const REG_BINARY = 3;

// デバッグログヘルパー（開発環境でのみ出力）
export const debugLog = (...args: any[]): void => {
  if (EnvConfig.isDevelopment) {
    console.warn('[VirtualDesktop]', ...args);
  }
};

/**
 * DLL関数の参照を保持する型
 */
export interface DllFunctions {
  MoveWindowToDesktopNumber: any;
  getCurrentDesktopNumber: any;
  isWindowOnDesktopNumber: any;
  getWindowDesktopNumber: any;
  getDesktopCount: any;
}

/**
 * レジストリAPI関数の参照を保持する型
 */
export interface RegistryFunctions {
  RegOpenKeyExW: any;
  RegQueryValueExW: any;
  RegCloseKey: any;
}
