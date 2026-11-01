/**
 * 仮想デスクトップ関連の型定義と定数
 *
 * Note: 呼び出しは koffi を使ったネイティブ DLL 呼び出し（virtualDesktop の各ファイル）
 */
import { EnvConfig } from '../../config/envConfig.js';

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
 * レジストリハンドル型（void*ポインタに相当）
 */
export type RegistryHandle = unknown;
