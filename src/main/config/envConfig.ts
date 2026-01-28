/**
 * 環境変数の一元管理
 *
 * process.envの直接参照を集約し、型安全なアクセスを提供します。
 * メインプロセス専用の設定クラスです。
 */

/**
 * ウィンドウ固定モードの型定義
 */
export type WindowPinMode = 'none' | 'auto';

/**
 * 環境変数設定クラス
 */
export class EnvConfig {
  // ===== 開発モード関連 =====

  /**
   * 開発モードかどうか
   */
  static get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';
  }

  /**
   * Vite開発サーバーのポート番号
   * @returns ポート番号（デフォルト: '9000'）
   */
  static get vitePort(): string {
    return process.env.VITE_PORT || '9000';
  }

  /**
   * 開発サーバーのURL
   */
  static get devServerUrl(): string {
    return `http://localhost:${this.vitePort}`;
  }

  // ===== アプリインスタンス関連 =====

  /**
   * アプリインスタンス名（多重起動用）
   * 未設定の場合はundefined
   */
  static get appInstance(): string | undefined {
    return process.env.APP_INSTANCE || undefined;
  }

  /**
   * アプリインスタンス名が設定されているか
   */
  static get hasAppInstance(): boolean {
    return !!process.env.APP_INSTANCE;
  }

  // ===== カスタム設定ディレクトリ =====

  /**
   * カスタム設定ディレクトリパス
   * 未設定の場合はundefined
   */
  static get customConfigDir(): string | undefined {
    return process.env.QUICK_DASH_CONFIG_DIR || undefined;
  }

  // ===== ウィンドウ設定 =====

  /**
   * ウィンドウ固定モード
   * @returns 'none' | 'auto' | undefined
   */
  static get windowPinMode(): WindowPinMode | undefined {
    const mode = process.env.WINDOW_PIN_MODE;
    if (mode === 'none' || mode === 'auto') {
      return mode;
    }
    return undefined;
  }

  /**
   * ウィンドウ固定モードが設定されているか
   */
  static get hasWindowPinMode(): boolean {
    return !!process.env.WINDOW_PIN_MODE;
  }

  // ===== 起動時設定 =====

  /**
   * スプラッシュウィンドウをスキップするか
   */
  static get skipSplashWindow(): boolean {
    return process.env.SKIP_SPLASH_WINDOW === '1';
  }

  /**
   * 起動時にメインウィンドウを表示するか
   */
  static get showWindowOnStartup(): boolean {
    return process.env.SHOW_WINDOW_ON_STARTUP === '1';
  }

  /**
   * グローバルホットキーを無効化するか
   */
  static get disableGlobalHotkey(): boolean {
    return process.env.DISABLE_GLOBAL_HOTKEY === '1';
  }

  /**
   * カスタムホットキー設定
   * 未設定の場合はundefined
   */
  static get customHotkey(): string | undefined {
    return process.env.HOTKEY || undefined;
  }

  // ===== Windowsシステムパス =====

  /**
   * LOCALAPPDATA パス
   * 例: C:\Users\username\AppData\Local
   */
  static get localAppData(): string | undefined {
    return process.env.LOCALAPPDATA || undefined;
  }

  /**
   * APPDATA パス
   * 例: C:\Users\username\AppData\Roaming
   */
  static get appData(): string | undefined {
    return process.env.APPDATA || undefined;
  }
}
