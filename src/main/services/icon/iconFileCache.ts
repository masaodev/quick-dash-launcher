import * as fs from 'fs';

import { FileUtils } from '@common/utils/fileUtils';

/** アイコンバッファをキャッシュに保存し、base64データURLとして返す */
export function cacheAndConvertIcon(iconBuffer: Buffer, cachePath: string): string | null {
  if (!iconBuffer || iconBuffer.length === 0) return null;
  FileUtils.writeBinaryFile(cachePath, iconBuffer);
  return FileUtils.bufferToBase64DataUrl(iconBuffer);
}

/** 候補パスを順に読み込み、最初に読み込めたファイルをbase64データURLとして返す */
export async function readFirstExistingFileAsBase64(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      const buffer = await fs.promises.readFile(p);
      return FileUtils.bufferToBase64DataUrl(buffer);
    } catch {
      // 存在しない候補はスキップして次を試す
    }
  }
  return null;
}

/** 環境変数を展開する（%VAR%形式） */
export function expandEnvironmentVariables(envPath: string): string {
  return envPath.replace(/%([^%]+)%/g, (original, envVar) => process.env[envVar] || original);
}
