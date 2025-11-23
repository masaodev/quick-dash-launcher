import type { Page, TestInfo, ElectronApplication } from '@playwright/test';

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

  /**
   * 登録モーダルを開く（プラスボタンをクリック）
   */
  async openRegisterModal(): Promise<void> {
    const registerButton = this.page.locator('.action-button.register-item');
    await registerButton.click();
    await this.page.waitForSelector('.register-modal', { state: 'visible' });
  }

  /**
   * 登録モーダルが表示されているか確認
   */
  async isRegisterModalVisible(): Promise<boolean> {
    try {
      await this.page.waitForSelector('.register-modal', { timeout: 1000, state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 登録モーダルのフィールドに入力
   */
  async fillRegisterForm(data: {
    name?: string;
    path?: string;
    args?: string;
    targetTab?: string;
  }): Promise<void> {
    if (data.name !== undefined) {
      const nameInput = this.page.locator('.register-modal input[placeholder*="表示名"]').first();
      await nameInput.fill(data.name);
    }

    if (data.path !== undefined) {
      const pathInput = this.page
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      await pathInput.fill(data.path);
    }

    if (data.args !== undefined) {
      const argsInput = this.page.locator('.register-modal input[placeholder*="引数"]').first();
      await argsInput.fill(data.args);
    }

    if (data.targetTab !== undefined) {
      const tabSelect = this.page.locator('.register-modal select').first();
      await tabSelect.selectOption({ label: data.targetTab });
    }
  }

  /**
   * 登録モーダルの登録ボタンをクリック
   */
  async clickRegisterButton(): Promise<void> {
    const registerButton = this.page.locator('.register-modal button.primary').first();
    await registerButton.click();
    // モーダルが閉じるまで待機
    await this.page.waitForSelector('.register-modal', { state: 'hidden', timeout: 5000 });
  }

  /**
   * 登録モーダルのキャンセルボタンをクリック
   */
  async clickCancelButton(): Promise<void> {
    const cancelButton = this.page
      .locator('.register-modal button')
      .filter({ hasText: 'キャンセル' })
      .first();
    await cancelButton.click();
    // モーダルが閉じるまで待機
    await this.page.waitForSelector('.register-modal', { state: 'hidden', timeout: 5000 });
  }

  /**
   * アイテムを右クリックして編集メニューを開く
   */
  async rightClickItem(itemName: string): Promise<void> {
    const item = this.page.locator('.item', { hasText: itemName });
    await item.click({ button: 'right' });
  }

  /**
   * 右クリックメニューから編集を選択
   */
  async selectEditFromContextMenu(): Promise<void> {
    const editMenuItem = this.page.locator('.context-menu-item', { hasText: '編集' }).first();
    await editMenuItem.click();
    await this.page.waitForSelector('.register-modal', { state: 'visible' });
  }

  /**
   * アイテムを右クリックして編集モーダルを開く（統合メソッド）
   */
  async editItemByRightClick(itemName: string): Promise<void> {
    await this.rightClickItem(itemName);
    await this.wait(300);
    await this.selectEditFromContextMenu();
  }

  /**
   * スクリーンショットを撮影してtestInfoに添付
   * @param testInfo テスト情報
   * @param name スクリーンショットの名前
   */
  async attachScreenshot(testInfo: TestInfo, name: string): Promise<void> {
    try {
      const screenshot = await this.page.screenshot({ timeout: 5000 });
      await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
    } catch (error) {
      // スクリーンショット撮影に失敗してもテストは続行
      console.warn(`スクリーンショット撮影に失敗しました (${name}):`, error);
    }
  }

  /**
   * 設定ドロップダウンを開いて指定タブをクリック
   * @private
   */
  private async openSettingsDropdownAndClick(tab: 'settings' | 'edit' | 'other'): Promise<void> {
    // 設定ボタン（⚙）をクリック
    const settingsButton = this.page
      .locator('.settings-dropdown')
      .locator('button', { hasText: '⚙' });
    await settingsButton.click();
    await this.wait(200);

    // ドロップダウンから選択
    const menuText = tab === 'settings' ? '基本設定' : tab === 'edit' ? 'アイテム管理' : 'その他';
    const menuItem = this.page.locator('.dropdown-item', { hasText: menuText });
    await menuItem.click();
  }

  /**
   * 管理ウィンドウを開く
   * @param electronApp Electronアプリケーションインスタンス
   * @param tab 開くタブ ('settings' | 'edit' | 'other')
   * @returns 新しく開かれた管理ウィンドウのPageオブジェクト
   */
  async openAdminWindow(
    electronApp: ElectronApplication,
    tab: 'settings' | 'edit' | 'other' = 'settings'
  ): Promise<Page> {
    const [adminWindow] = await Promise.all([
      electronApp.waitForEvent('window', {
        predicate: async (window) => {
          const title = await window.title();
          return title.includes('設定・管理');
        },
        timeout: 10000,
      }),
      this.openSettingsDropdownAndClick(tab),
    ]);

    await adminWindow.waitForLoadState('domcontentloaded');
    return adminWindow;
  }
}
