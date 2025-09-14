import * as fs from 'fs';
import * as path from 'path';

/**
 * ファイル操作の共通ユーティリティクラス
 * プロジェクト全体で重複しているファイル操作を統一し、エラーハンドリングを標準化する
 */
export class FileUtils {
  /**
   * ファイルが存在するかチェックし、安全にテキストファイルを読み込む
   * @param filePath - 読み込み対象のファイルパス
   * @returns ファイル内容またはnull（ファイルが存在しない、または読み込み失敗）
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
   * ディレクトリが存在することを確認し、安全にテキストファイルを書き込む
   * @param filePath - 書き込み対象のファイルパス
   * @param content - 書き込み内容
   * @returns 書き込み成功時はtrue、失敗時はfalse
   */
  static safeWriteTextFile(filePath: string, content: string): boolean {
    try {
      const dirPath = path.dirname(filePath);
      this.ensureDirectory(dirPath);
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * ディレクトリが存在しない場合は再帰的に作成する
   * @param dirPath - 作成対象のディレクトリパス
   */
  static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * バイナリファイルをキャッシュから読み込み、Base64エンコードされたデータURLとして返す
   * @param filePath - 読み込み対象のファイルパス
   * @param mimeType - MIMEタイプ（デフォルト: 'image/png'）
   * @returns base64エンコードされたデータURL、失敗時はnull
   */
  static readCachedBinaryAsBase64(filePath: string, mimeType = 'image/png'): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const cachedData = fs.readFileSync(filePath);
      const base64 = cachedData.toString('base64');
      return `data:${mimeType};base64,${base64}`;
    } catch (_error) {
      return null;
    }
  }

  /**
   * バイナリデータをファイルに書き込む
   * @param filePath - 書き込み対象のファイルパス
   * @param data - 書き込み対象のバイナリデータ
   * @returns 書き込み成功時はtrue、失敗時はfalse
   */
  static writeBinaryFile(filePath: string, data: Buffer): boolean {
    try {
      const dirPath = path.dirname(filePath);
      this.ensureDirectory(dirPath);
      fs.writeFileSync(filePath, data);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * ファイルを安全にコピーする
   * @param sourcePath - コピー元のファイルパス
   * @param targetPath - コピー先のファイルパス
   * @returns コピー成功時はtrue、失敗時はfalse
   */
  static safeCopyFile(sourcePath: string, targetPath: string): boolean {
    try {
      if (!fs.existsSync(sourcePath)) {
        return false;
      }
      const targetDir = path.dirname(targetPath);
      this.ensureDirectory(targetDir);
      fs.copyFileSync(sourcePath, targetPath);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * 指定されたパスがディレクトリかどうかを安全にチェックする
   * @param filePath - チェック対象のパス
   * @returns ディレクトリの場合はtrue、それ以外はfalse
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
   * @param filePath - チェック対象のファイルパス
   * @returns ファイルが存在する場合はtrue、それ以外はfalse
   */
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * 2つのファイルの内容が同じかどうかを比較する
   * @param filePath1 - 比較対象のファイルパス1
   * @param filePath2 - 比較対象のファイルパス2
   * @returns ファイル内容が同じ場合はtrue、異なる場合やエラー時はfalse
   */
  static areFilesEqual(filePath1: string, filePath2: string): boolean {
    try {
      // どちらかのファイルが存在しない場合
      if (!fs.existsSync(filePath1) || !fs.existsSync(filePath2)) {
        return false;
      }

      // ファイルサイズを比較（高速な事前チェック）
      const stat1 = fs.statSync(filePath1);
      const stat2 = fs.statSync(filePath2);
      if (stat1.size !== stat2.size) {
        return false;
      }

      // ファイル内容を比較
      const content1 = fs.readFileSync(filePath1, 'utf8');
      const content2 = fs.readFileSync(filePath2, 'utf8');
      return content1 === content2;
    } catch (_error) {
      return false;
    }
  }
}
