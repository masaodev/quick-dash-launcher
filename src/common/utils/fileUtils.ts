import * as fs from 'fs';
import * as path from 'path';

/**
 * ファイル操作の共通ユーティリティクラス
 */
export class FileUtils {
  /**
   * テキストファイルを安全に読み込む（存在しない場合やエラー時はnull）
   */
  static safeReadTextFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (_error) {
      return null;
    }
  }

  /**
   * テキストファイルを安全に書き込む（ディレクトリも自動作成・アトミック）
   */
  static safeWriteTextFile(filePath: string, content: string): boolean {
    return this.atomicWrite(filePath, (tmpPath) => fs.writeFileSync(tmpPath, content, 'utf8'));
  }

  /**
   * ディレクトリが存在しない場合は再帰的に作成する
   */
  static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * バイナリファイルを読み込み、Base64エンコードされたデータURLとして返す
   */
  static readCachedBinaryAsBase64(filePath: string, mimeType = 'image/png'): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const cachedData = fs.readFileSync(filePath);
      return this.bufferToBase64DataUrl(cachedData, mimeType);
    } catch (_error) {
      return null;
    }
  }

  /**
   * バイナリデータをファイルに書き込む（ディレクトリも自動作成・アトミック）
   */
  static writeBinaryFile(filePath: string, data: Buffer): boolean {
    return this.atomicWrite(filePath, (tmpPath) => fs.writeFileSync(tmpPath, data));
  }

  /**
   * ファイルを安全にコピーする（コピー先ディレクトリも自動作成・アトミック）
   */
  static safeCopyFile(sourcePath: string, targetPath: string): boolean {
    if (!fs.existsSync(sourcePath)) {
      return false;
    }
    return this.atomicWrite(targetPath, (tmpPath) => fs.copyFileSync(sourcePath, tmpPath));
  }

  /**
   * 一時ファイルへ書き込んでから rename する共通パターン。
   * 直接上書きだと truncate→書き込みの途中でクラッシュ・電源断が起きた際に
   * ファイルが破損する（データファイル全損につながる）ため、必ず経由すること。
   */
  private static atomicWrite(filePath: string, writeFn: (tmpPath: string) => void): boolean {
    const tmpPath = `${filePath}.tmp`;
    try {
      this.ensureDirectory(path.dirname(filePath));
      writeFn(tmpPath);
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch (_error) {
      try {
        fs.rmSync(tmpPath, { force: true });
      } catch {
        // 一時ファイルの掃除失敗は無視（次回の書き込みで上書きされる）
      }
      return false;
    }
  }

  /**
   * 指定されたパスがディレクトリかどうかをチェックする
   */
  static isDirectory(filePath: string): boolean {
    try {
      return fs.statSync(filePath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * ファイルの存在をチェックする
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 2つのファイルの内容が同じかどうかを比較する
   */
  static areFilesEqual(filePath1: string, filePath2: string): boolean {
    try {
      if (!fs.existsSync(filePath1) || !fs.existsSync(filePath2)) {
        return false;
      }

      const stat1 = fs.statSync(filePath1);
      const stat2 = fs.statSync(filePath2);
      if (stat1.size !== stat2.size) {
        return false;
      }

      const content1 = fs.readFileSync(filePath1);
      const content2 = fs.readFileSync(filePath2);
      return content1.equals(content2);
    } catch (_error) {
      return false;
    }
  }

  /**
   * バッファをBase64エンコードされたデータURLに変換する
   */
  static bufferToBase64DataUrl(buffer: Buffer, mimeType = 'image/png'): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}
