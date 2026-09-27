import type { Page, TestInfo, ElectronApplication } from '@playwright/test';

import { IPC_CHANNELS } from '../../../src/common/ipcChannels';

/**
 * ウィンドウを閉じる操作（登録・キャンセル・Escape）は、操作の完了報告より先に
 * 子ウィンドウが閉じることがあり「Target page ... has been closed」で落ちる。
 * 閉じるのが目的の操作ではこのエラーだけ無視する
 */
function ignoreClosedError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('has been closed')) {
    throw error;
  }
}

/**
 * テスト用のユーティリティ関数
 */
export class TestUtils {
  /**
   * メイン画面から開いた登録・編集ウィンドウ（独立した子ウィンドウ）
   * openRegisterModal() で取得し、フォーム操作はこのページに対して行う。
   * 管理画面のように同じウィンドウ内にモーダルを描く場合は null のまま
   */
  private registerWindow: Page | null = null;

  /** 一度使った登録・編集ウィンドウ（閉じかけのものを次の検出で拾わないため） */
  private usedRegisterWindows = new WeakSet<Page>();

  constructor(private page: Page) {}

  /** 登録フォームを描いているページ（子ウィンドウがあればそれ、なければ自分） */
  get registerPage(): Page {
    return this.registerWindow ?? this.page;
  }

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
   * F5 でデータ再読込を要求する
   *
   * F5 は React の onKeyDown（.app / 検索入力）で処理されるため、フォーカスが外れていると
   * キー入力が捨てられる。検索入力にフォーカスを戻してから押す
   */
  async reloadWithF5(): Promise<void> {
    const searchInput = this.page.locator('input[type="text"]').first();
    await searchInput.focus();
    await this.page.keyboard.press('F5');
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
   * メイン画面から開かれた登録・編集ウィンドウ（子ウィンドウ）を待つ
   *
   * 子ウィンドウは about:blank で開いてから中身を書き込むため、`.register-modal` が
   * 描かれるまで待つ。開いたページを registerPage として記憶する
   */
  async waitForRegisterWindow(electronApp: ElectronApplication, timeout = 15000): Promise<Page> {
    // 子ウィンドウは open 直後に window イベントが飛ぶが、中身（.register-modal）が描かれるのは
    // 少し後。イベント待ちだと取りこぼすことがあるので、既存ウィンドウを含めて描画を繰り返し探す
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      for (const win of electronApp.windows()) {
        if (win === this.page || win.isClosed() || this.usedRegisterWindows.has(win)) continue;
        try {
          if ((await win.locator('.register-modal').count()) > 0) {
            await win.locator('.register-modal').waitFor({ state: 'visible', timeout: 5000 });
            this.usedRegisterWindows.add(win);
            this.registerWindow = win;
            return win;
          }
        } catch {
          // 書き込み前・閉じた直後のウィンドウは無視して次を見る
        }
      }
      await this.page.waitForTimeout(200);
    }
    throw new Error('登録・編集ウィンドウが開きませんでした');
  }

  /**
   * 登録モーダルを開く
   *
   * プラスボタンはサブメニュー（簡易登録 / ブックマーク取込 / アプリ取込）を開くため、
   * その中の「簡易登録」を選ぶ。メイン画面では登録フォームは独立した子ウィンドウで開くので、
   * electronApp を渡すとその子ウィンドウを待って返す（以降のフォーム操作はそのページに対して行う）
   */
  async openRegisterModal(electronApp?: ElectronApplication): Promise<Page> {
    const registerButton = this.page.locator('.action-btn[title="アイテムを登録"]');
    await registerButton.click();

    const simpleRegisterItem = this.page.locator('.dropdown-item', { hasText: '簡易登録' });
    await simpleRegisterItem.click();

    if (electronApp) {
      return this.waitForRegisterWindow(electronApp);
    }
    await this.page.waitForSelector('.register-modal', { state: 'visible' });
    return this.page;
  }

  /**
   * 登録モーダル（または登録ウィンドウ）が表示されているか確認
   */
  async isRegisterModalVisible(): Promise<boolean> {
    const win = this.registerWindow;
    if (win) {
      if (win.isClosed()) {
        this.registerWindow = null;
        return false;
      }
      try {
        await win.waitForSelector('.register-modal', { timeout: 1000, state: 'visible' });
        return true;
      } catch {
        return false;
      }
    }
    try {
      await this.page.waitForSelector('.register-modal', { timeout: 1000, state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 登録モーダルが閉じるのを待つ（子ウィンドウならウィンドウが閉じるのを待つ）
   */
  private async waitForRegisterModalClosed(timeout = 5000): Promise<void> {
    const win = this.registerWindow;
    if (win) {
      if (!win.isClosed()) {
        await win.waitForEvent('close', { timeout });
      }
      this.registerWindow = null;
      return;
    }
    await this.page.waitForSelector('.register-modal', { state: 'hidden', timeout });
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
    const page = this.registerPage;
    if (data.name !== undefined) {
      const nameInput = page.locator('.register-modal input[placeholder*="表示名"]').first();
      await nameInput.fill(data.name);
    }

    if (data.path !== undefined) {
      const pathInput = page
        .locator('.register-modal input[placeholder*="パス"], input[placeholder*="URL"]')
        .first();
      await pathInput.fill(data.path);
    }

    if (data.args !== undefined) {
      const argsInput = page.locator('.register-modal input[placeholder*="引数"]').first();
      await argsInput.fill(data.args);
    }

    if (data.targetTab !== undefined) {
      const tabSelect = page.locator('.register-modal select').first();
      await tabSelect.selectOption({ label: data.targetTab });
    }
  }

  /**
   * 登録モーダルの登録ボタンをクリック
   */
  async clickRegisterButton(): Promise<void> {
    // ボタンのテキスト「登録」で検索（.primaryクラスではなくテキストで探す）
    const registerButton = this.registerPage
      .locator('.register-modal button', { hasText: '登録' })
      .first();
    await this.closeRegisterModalBy(() => registerButton.click());
  }

  /**
   * 登録モーダル（子ウィンドウ）を閉じる操作を行い、閉じるまで待つ
   * 子ウィンドウが操作の途中で閉じても落とさない
   */
  async closeRegisterModalBy(action: () => Promise<void>): Promise<void> {
    await Promise.all([this.waitForRegisterModalClosed(), action().catch(ignoreClosedError)]);
  }

  /**
   * Escape で登録モーダル（子ウィンドウ）を閉じる
   */
  async pressEscapeToCloseRegisterModal(): Promise<void> {
    await this.closeRegisterModalBy(() => this.registerPage.keyboard.press('Escape'));
  }

  /**
   * 登録モーダルのキャンセルボタンをクリック
   */
  async clickCancelButton(): Promise<void> {
    const cancelButton = this.registerPage
      .locator('.register-modal button')
      .filter({ hasText: 'キャンセル' })
      .first();
    await this.closeRegisterModalBy(() => cancelButton.click());
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

  // ==================== Phase 1: 最適化ヘルパーメソッド ====================

  /**
   * 要素が表示されるまで待機（waitForElementのエイリアス）
   */
  async waitForVisible(selector: string, timeout = 5000): Promise<void> {
    await this.waitForElement(selector, timeout);
  }

  /**
   * 要素が有効になるまで待機
   */
  async waitForEnabled(selector: string, timeout = 5000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'attached', timeout });
    await this.page.locator(selector).waitFor({ state: 'attached', timeout });
  }

  /**
   * 保存完了を待機
   * @param expectedText 保存されたアイテムの名前（オプション）
   * @param timeout タイムアウト時間
   */
  async waitForSave(expectedText?: string, timeout = 5000): Promise<void> {
    // IPC通信の最小限の待機
    await this.wait(200);

    if (expectedText) {
      // 指定されたテキストを含むアイテムが表示されるまで待機
      await this.page.waitForSelector(`.item:has-text("${expectedText}")`, {
        state: 'visible',
        timeout,
      });
    }
  }

  /**
   * フォーム入力 + 送信を統合
   * @param data フォームデータ
   */
  async fillAndSubmitRegisterForm(data: {
    name?: string;
    path?: string;
    args?: string;
    targetTab?: string;
  }): Promise<void> {
    await this.fillRegisterForm(data);
    await this.clickRegisterButton();

    // 保存完了を待機
    if (data.name) {
      await this.waitForSave(data.name);
    }
  }
}

/** ランチャーメニュー操作タイプ */
type LauncherMenuAction =
  | 'edit'
  | 'copyPath'
  | 'copyParentPath'
  | 'openParentFolder'
  | 'addToWorkspace'
  | 'copyShortcutPath'
  | 'copyShortcutParentPath'
  | 'openShortcutParentFolder';

/** ワークスペースメニュー操作タイプ */
type WorkspaceMenuAction = 'rename' | 'launch' | 'remove';

/** 管理画面メニュー操作タイプ */
type AdminMenuAction = 'duplicate' | 'edit' | 'delete';

const LAUNCHER_MENU_CHANNELS: Record<LauncherMenuAction, string> = {
  edit: IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM,
  copyPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH,
  copyParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH,
  openParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER,
  addToWorkspace: IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE,
  copyShortcutPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH,
  copyShortcutParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
  openShortcutParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
};

const WORKSPACE_MENU_CHANNELS: Record<WorkspaceMenuAction, string> = {
  rename: IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM,
  launch: IPC_CHANNELS.EVENT_WORKSPACE_MENU_LAUNCH_ITEM,
  remove: IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM,
};

const ADMIN_MENU_CHANNELS: Record<AdminMenuAction, string> = {
  duplicate: IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS,
  edit: IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM,
  delete: IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS,
};

/**
 * ネイティブコンテキストメニューをテストするためのヘルパークラス
 *
 * Electronのネイティブメニュー（Menu.popup()）はPlaywrightから直接アクセスできないため、
 * IPCイベントを直接送信してメニュー項目のクリックをシミュレートします。
 */
export class NativeMenuTestHelper {
  constructor(
    private electronApp: ElectronApplication,
    private page: Page
  ) {}

  async sendIpcToRenderer(channel: string, ...args: unknown[]): Promise<void> {
    const url = this.page.url();
    await this.electronApp.evaluate(
      async ({ BrowserWindow }, { targetUrl, channel, args }) => {
        const allWindows = BrowserWindow.getAllWindows();
        const targetWindow = allWindows.find((win) => {
          try {
            return win.webContents.getURL() === targetUrl;
          } catch {
            return false;
          }
        });

        if (targetWindow && !targetWindow.isDestroyed()) {
          targetWindow.webContents.send(channel, ...args);
        }
      },
      { targetUrl: url, channel, args }
    );
  }

  async simulateLauncherMenu(
    action: LauncherMenuAction,
    item: Record<string, unknown>
  ): Promise<void> {
    await this.sendIpcToRenderer(LAUNCHER_MENU_CHANNELS[action], item);
  }

  async simulateWorkspaceMenu(action: WorkspaceMenuAction, itemId: string): Promise<void> {
    await this.sendIpcToRenderer(WORKSPACE_MENU_CHANNELS[action], itemId);
  }

  async simulateAdminMenu(action: AdminMenuAction): Promise<void> {
    await this.sendIpcToRenderer(ADMIN_MENU_CHANNELS[action]);
  }
}
