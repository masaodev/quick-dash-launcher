import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

/** 壊れたファイルの退避先（`<名前>.broken-YYYYMMDDTHHmmss<拡張子>`。同じフォルダに置く） */
export function brokenFilePath(filePath: string, now: Date = new Date()): string {
  const ext = path.extname(filePath);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return path.join(path.dirname(filePath), `${path.basename(filePath, ext)}.broken-${stamp}${ext}`);
}

/**
 * 小さな JSON ファイルの読み書き
 *
 * 壊れていれば警告してデフォルトを返す。次に書くときは、壊れたファイルを別名（`brokenFilePath()`）で
 * 退避してから書く（元に戻す手がかりを残す）。退避できなければ書かない。
 * 設定フォルダ内の UI 状態のような「失っても困らない・AI 編集対象でない」ファイル向け。
 * データファイルやワークスペースの本体は寛容パース＋外部変更検知を持つ専用ストアを使う。
 */
export class JsonFileStore<T> {
  /** 最後に読んだとき、ファイルはあったのに読めなかったか（次に書く前に退避する） */
  private unreadable = false;

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
    this.unreadable = false;
    const content = FileUtils.safeReadTextFile(this.filePath);
    if (content === null) {
      // あるのに読めない（ロックなど）ときも、壊れているときと同じく次に書く前に退避する
      if (this.exists()) {
        this.unreadable = true;
        logger.warn({ filePath: this.filePath }, 'JSON ファイルを読めないためデフォルトを使います');
      }
      return this.createDefault();
    }

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
    this.unreadable = true;
    return this.createDefault();
  }

  write(value: T): boolean {
    if (this.unreadable && !this.moveAsideBrokenFile()) return false;
    const ok = FileUtils.safeWriteTextFile(this.filePath, JSON.stringify(value, null, 2));
    if (!ok) {
      logger.error({ filePath: this.filePath }, 'JSON ファイルの書き込みに失敗しました');
    }
    return ok;
  }

  /** 読めなかったファイルを別名で退避する。退避できなければ false（書かずに残す） */
  private moveAsideBrokenFile(): boolean {
    if (!this.exists()) {
      this.unreadable = false;
      return true;
    }
    const dest = brokenFilePath(this.filePath);
    try {
      fs.renameSync(this.filePath, dest);
      this.unreadable = false;
      logger.warn(
        { filePath: this.filePath, movedTo: dest },
        '読めなかった JSON ファイルを別名で退避しました'
      );
      return true;
    } catch (error) {
      logger.error(
        { error, filePath: this.filePath },
        '読めなかった JSON ファイルを退避できないため、書き込みをやめました'
      );
      return false;
    }
  }
}
