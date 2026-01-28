import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import PathManager from '../../main/config/pathManager.js';

/**
 * テスト用のパス管理ヘルパークラス
 * テスト実行時に一時的な設定フォルダを作成・管理する
 */
export class PathTestHelper {
  private originalConfigFolder: string | null = null;
  private tempConfigFolder: string | null = null;

  /**
   * テスト用の一時設定フォルダをセットアップ
   * @param testName テスト名（フォルダ名に使用）
   * @returns 作成された一時フォルダのパス
   */
  setup(testName: string = 'test'): string {
    // 一時ディレクトリに一意のフォルダを作成
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    this.tempConfigFolder = path.join(
      os.tmpdir(),
      `quick-dash-test-${testName}-${timestamp}-${randomSuffix}`
    );

    // 一時フォルダを作成
    if (!fs.existsSync(this.tempConfigFolder)) {
      fs.mkdirSync(this.tempConfigFolder, { recursive: true });
    }

    // PathManagerに一時フォルダを設定
    PathManager.setConfigFolderForTesting(this.tempConfigFolder);

    // 必要なサブディレクトリを作成
    PathManager.ensureDirectories();

    return this.tempConfigFolder;
  }

  /**
   * テスト用の設定をクリーンアップ
   */
  cleanup(): void {
    // PathManagerの設定をリセット
    PathManager.resetConfigFolder();

    // 一時フォルダを削除
    if (this.tempConfigFolder && fs.existsSync(this.tempConfigFolder)) {
      try {
        fs.rmSync(this.tempConfigFolder, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp folder: ${this.tempConfigFolder}`, error);
      }
      this.tempConfigFolder = null;
    }
  }

  /**
   * 一時設定フォルダのパスを取得
   * @returns 一時設定フォルダのパス、未セットアップの場合はnull
   */
  getTempConfigFolder(): string | null {
    return this.tempConfigFolder;
  }

  /**
   * テストデータファイルを作成
   * @param fileName ファイル名（デフォルト: 'data.json'）
   * @param content ファイル内容
   */
  createTestDataFile(fileName: string = 'data.json', content: string): void {
    if (!this.tempConfigFolder) {
      throw new Error('Setup must be called before createTestDataFile');
    }

    const filePath = path.join(this.tempConfigFolder, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  /**
   * テストデータファイルを読み込み
   * @param fileName ファイル名（デフォルト: 'data.json'）
   * @returns ファイル内容
   */
  readTestDataFile(fileName: string = 'data.json'): string {
    if (!this.tempConfigFolder) {
      throw new Error('Setup must be called before readTestDataFile');
    }

    const filePath = path.join(this.tempConfigFolder, fileName);
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * テストファイルが存在するか確認
   * @param fileName ファイル名
   * @returns 存在する場合true
   */
  testFileExists(fileName: string): boolean {
    if (!this.tempConfigFolder) {
      return false;
    }

    const filePath = path.join(this.tempConfigFolder, fileName);
    return fs.existsSync(filePath);
  }

  /**
   * サブフォルダのパスを取得
   * @param subFolder サブフォルダ名
   * @returns サブフォルダのパス
   */
  getSubFolderPath(subFolder: string): string {
    if (!this.tempConfigFolder) {
      throw new Error('Setup must be called before getSubFolderPath');
    }

    return path.join(this.tempConfigFolder, subFolder);
  }
}

/**
 * テスト用のヘルパー関数
 * beforeEach/afterEachで使用することを想定
 */
export function createPathTestHelper(): PathTestHelper {
  return new PathTestHelper();
}

/**
 * 環境変数を使用してカスタム設定フォルダを設定するヘルパー
 * @param customPath カスタム設定フォルダのパス
 */
export function setConfigFolderViaEnv(customPath: string): void {
  process.env.QUICK_DASH_CONFIG_DIR = customPath;
}

/**
 * 環境変数をクリア
 */
export function clearConfigFolderEnv(): void {
  delete process.env.QUICK_DASH_CONFIG_DIR;
}

export default PathTestHelper;
