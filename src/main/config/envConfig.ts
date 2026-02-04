/**
 * 環境変数の一元管理（メインプロセス専用）
 */

export type WindowPinMode = 'none' | 'auto';

export class EnvConfig {
  // 開発モード
  static get isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';
  }

  static get devServerUrl(): string {
    const port = process.env.VITE_PORT || '9000';
    return `http://localhost:${port}`;
  }

  // アプリインスタンス（多重起動用）
  static get appInstance(): string | undefined {
    return process.env.APP_INSTANCE;
  }

  static get hasAppInstance(): boolean {
    return !!process.env.APP_INSTANCE;
  }

  // カスタム設定ディレクトリ
  static get customConfigDir(): string | undefined {
    return process.env.QUICK_DASH_CONFIG_DIR;
  }

  // ウィンドウ設定
  static get windowPinMode(): WindowPinMode | undefined {
    const mode = process.env.WINDOW_PIN_MODE;
    if (mode === 'none' || mode === 'auto') {
      return mode;
    }
    return undefined;
  }

  static get hasWindowPinMode(): boolean {
    return !!process.env.WINDOW_PIN_MODE;
  }

  // 起動時設定
  static get skipSplashWindow(): boolean {
    return process.env.SKIP_SPLASH_WINDOW === '1';
  }

  static get showWindowOnStartup(): boolean {
    return process.env.SHOW_WINDOW_ON_STARTUP === '1';
  }

  static get disableGlobalHotkey(): boolean {
    return process.env.DISABLE_GLOBAL_HOTKEY === '1';
  }

  static get customHotkey(): string | undefined {
    return process.env.HOTKEY;
  }

  // Windowsシステムパス
  static get localAppData(): string | undefined {
    return process.env.LOCALAPPDATA;
  }

  static get appData(): string | undefined {
    return process.env.APPDATA;
  }
}
