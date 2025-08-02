import type { Page } from 'playwright';

/**
 * テスト用のユーティリティ関数
 */
export class TestUtils {
  constructor(private page: Page) {}

  /**
   * 指定されたセレクタの要素が表示されるまで待機
   */
  async waitForElement(selector: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout,
    });
  }

  /**
   * 指定されたテキストを含む要素をクリック
   */
  async clickByText(text: string): Promise<void> {
    await this.page.click(`text=${text}`);
  }

  /**
   * 入力フィールドに値を設定
   */
  async fillInput(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  /**
   * スクリーンショットを撮影（テスト名付き）
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true,
    });
  }

  /**
   * ウィンドウのタイトルを取得
   */
  async getWindowTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * 指定された要素のテキストを取得
   */
  async getElementText(selector: string): Promise<string> {
    return (await this.page.textContent(selector)) || '';
  }

  /**
   * ウィンドウが表示されているかチェック
   */
  async isWindowVisible(): Promise<boolean> {
    try {
      // ウィンドウのbodyが存在するかチェック
      await this.page.waitForSelector('body', { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 検索ボックスに文字を入力
   */
  async searchFor(query: string): Promise<void> {
    const searchInput =
      'input[type="text"], input[placeholder*="検索"], input[placeholder*="search"]';
    await this.waitForElement(searchInput);
    await this.fillInput(searchInput, query);
  }

  /**
   * ショートカットキーを送信
   */
  async sendShortcut(shortcut: string): Promise<void> {
    await this.page.keyboard.press(shortcut);
  }

  /**
   * 要素の存在をチェック
   */
  async elementExists(selector: string): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ページの読み込み完了を待機
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 指定した時間待機
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }
}
