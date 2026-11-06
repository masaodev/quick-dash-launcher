import { FileUtils } from '@common/utils/fileUtils';

import { rememberIconFile } from './iconMemoryCache.js';

/** アイコンバッファをキャッシュに保存し、base64データURLとして返す（保存できたらメモリにも覚える） */
export function cacheAndConvertIcon(iconBuffer: Buffer, cachePath: string): string | null {
  if (!iconBuffer || iconBuffer.length === 0) return null;
  const written = FileUtils.writeBinaryFile(cachePath, iconBuffer);
  const dataUrl = FileUtils.bufferToBase64DataUrl(iconBuffer);
  rememberIconFile(cachePath, written ? dataUrl : null);
  return dataUrl;
}

/** 環境変数を展開する（%VAR%形式） */
export function expandEnvironmentVariables(envPath: string): string {
  return envPath.replace(/%([^%]+)%/g, (original, envVar) => process.env[envVar] || original);
}
