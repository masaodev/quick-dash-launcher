import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

/**
 * 小さな JSON ファイルの読み書き
 *
 * 壊れていれば警告してデフォルトを返す（消したり上書きしたりはしない）。
 * 設定フォルダ内の UI 状態のような「失っても困らない・AI 編集対象でない」ファイル向け。
 * データファイルやワークスペースの本体は寛容パース＋外部変更検知を持つ専用ストアを使う。
 */
export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly createDefault: () => T,
    /** 読み込んだ生オブジェクトを T に整える。形が違えば null を返してデフォルトに落とす */
    private readonly coerce: (raw: unknown) => T | null
  ) {}

  exists(): boolean {
    return FileUtils.exists(this.filePath);
  }

  read(): T {
    const content = FileUtils.safeReadTextFile(this.filePath);
    if (content === null) return this.createDefault();

    try {
      const coerced = this.coerce(JSON.parse(content));
      if (coerced !== null) return coerced;
      logger.warn(
        { filePath: this.filePath },
        'JSON ファイルの形が想定と違うためデフォルトを使います'
      );
    } catch (error) {
      logger.warn(
        { error, filePath: this.filePath },
        'JSON ファイルを読めないためデフォルトを使います'
      );
    }
    return this.createDefault();
  }

  write(value: T): boolean {
    const ok = FileUtils.safeWriteTextFile(this.filePath, JSON.stringify(value, null, 2));
    if (!ok) {
      logger.error({ filePath: this.filePath }, 'JSON ファイルの書き込みに失敗しました');
    }
    return ok;
  }
}
