import * as os from 'os';
import * as path from 'path';
import type { Server } from 'net';

import { app, globalShortcut, session } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { setupIPCHandlers } from './ipc';
import {
  createDefaultDataFile,
  createFirstLaunchTabs,
  createSampleWorkspaceFile,
} from './utils/appHelpers';
import PathManager from './config/pathManager.js';
import { EnvConfig } from './config/envConfig.js';
import { BackupService } from './services/backupService.js';
import { SettingsService } from './services/settingsService.js';
import { AutoLaunchService } from './services/autoLaunchService.js';
import {
  createWindow,
  createTray,
  getMainWindow,
  getWindowPinMode,
  setWindowPinMode,
  setFirstLaunchMode,
  registerGlobalShortcut,
  showMainWindow,
  syncCompanionWindowsWithMain,
} from './windowManager';
import { getCliPipeName } from './services/cli/cliProtocol.js';
import { runCliCommand } from './services/cli/cliCommands.js';
import { createCliContext } from './services/cli/cliStores.js';
import { startCliServer } from './services/cli/cliServer.js';
import { resolveAppExePath, writeCliLauncherInfo } from './services/cli/cliLauncherInfo.js';
import { applyCliSetting } from './services/cli/cliInstallService.js';
import { closeAdminWindow } from './adminWindowManager';
import {
  createSplashWindow,
  closeSplashWindow,
  notifySplashInitComplete,
} from './splashWindowManager';
import {
  createWorkspaceWindow,
  closeWorkspaceWindow,
  restoreWindowsOnStartup,
} from './workspaceWindowManager';
import { migrateRemovedWindowSettings } from './services/removedWindowSettings.js';
import { closeAllDetachedGroupWindows } from './detachedGroupWindowManager';
import { markAppQuitting } from './utils/managedWindow.js';
import { destroyOverlayWindow, showToastWindow } from './services/overlayWindowService.js';
import { cancelAllChildWindowCreations } from './services/childWindowService.js';
import { closeAllMainChildWindows } from './mainChildWindowManager.js';
import { closeAllWorkspaceItemEditors } from './workspaceItemEditorWindowManager.js';
import { closeAllWorkspaceItemPickers } from './workspaceItemPickerWindowManager.js';
import { closeAllWorkspaceLinkWindows } from './workspaceLinkWindowManager.js';
import { closeAllWorkspaceConfirms } from './workspaceConfirmWindowManager.js';
import { BookmarkAutoImportService } from './services/bookmarkAutoImportService.js';
import { applyLanguageSetting, registerLanguageHandler } from './services/i18nService.js';
import { mainI18n } from './services/mainI18n.js';
import { installNavigationGuard } from './utils/navigationGuard.js';
import { startFileLogging } from './services/fileLogging.js';
import { LaunchUsageService } from './services/launchUsageService.js';
import { handleIpc } from './utils/ipcWrapper';

// 多重起動時に完全に独立したuserDataを使用
if (EnvConfig.hasAppInstance) {
  const appName = `${EnvConfig.appInstance}-quick-dash-launcher`;
  const userDataPath = path.join(app.getPath('appData'), appName);
  app.setPath('userData', userDataPath);
}

// CLI（qdl.exe）が本体を起動したときの印。スプラッシュを出さず、二重起動時もウィンドウを出さない
const CLI_LAUNCH_ARG = '--launched-by-cli';
const launchedByCli = process.argv.includes(CLI_LAUNCH_ARG);

// 二重起動の防止（userData ごと）。E2E と dev:test は userData を変えずに設定フォルダだけを
// 差し替えて起動するため、本番の QDL と同時に動かせるよう対象外にする
const useSingleInstance = !EnvConfig.customConfigDir;
if (useSingleInstance && !app.requestSingleInstanceLock()) {
  // 黙って終わると原因が分からないので、理由と回避のしかたを出しておく
  console.error(
    `QuickDashLauncher は同じ userData（${app.getPath('userData')}）で既に起動しているため終了します。` +
      '同時に動かすには APP_INSTANCE を変えて起動してください'
  );
  app.exit(0);
} else {
  // ログをファイルにも残す（1MB で回し、古いものは 2 世代まで）。起動直後のログも残るよう、
  // 準備完了を待たずに始める。二重起動で終わる側では始めない（動いている側とファイルを取り合うため）
  startFileLogging(PathManager.getLogsFolder());

  if (useSingleInstance) {
    app.on('second-instance', (_event, argv) => {
      if (argv.includes(CLI_LAUNCH_ARG)) return;
      showMainWindow().catch((error) =>
        console.error('二重起動時のウィンドウ表示でエラー:', error)
      );
    });
  }
}

let cliServer: Server | null = null;
let resolveAppReady: () => void = () => {};
const appReady = new Promise<void>((resolve) => {
  resolveAppReady = resolve;
});

// 開発モード時にリモートデバッグポートを有効化（Playwright MCP用）
if (EnvConfig.isDevelopment) {
  // APP_INSTANCEごとに異なるポートを使用してポート競合を回避
  // dev:testはPlaywright MCP用に固定ポート9222を使用、それ以外は動的割り当て
  const isTestMode = EnvConfig.customConfigDir?.includes('tests/dev/full');
  const debugPort = isTestMode ? '9222' : '0'; // 0 = 自動的に空いているポートを割り当て
  app.commandLine.appendSwitch('--remote-debugging-port', debugPort);
}

app.whenReady().then(async () => {
  // 画面がページ側から別の URL へ移らないようにする（ウィンドウを作る前に付ける）
  installNavigationGuard();

  // 設定フォルダを先に作成（スプラッシュのアイコンパス解決に必要）
  PathManager.ensureDirectories();

  // 表示言語の問い合わせはスプラッシュから来るので、ウィンドウを開く前に受け付ける
  registerLanguageHandler();

  // CLI の待ち受けは早めに始める（qdl.exe は本体を起動した後、パイプが開くのを待つ）。
  // 依頼の処理は初期化が終わるまで待たせる。dev:test・E2E では待ち受けない
  if (useSingleInstance) {
    const configFolder = PathManager.getConfigFolder();
    const userName = process.env.USERNAME || os.userInfo().username;
    const cliContext = createCliContext(configFolder, {
      appVersion: app.getVersion(),
      pid: process.pid,
    });
    cliServer = await startCliServer(
      getCliPipeName(path.basename(app.getPath('userData')), userName),
      async (req) => {
        await Promise.race([
          appReady,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('本体の初期化が終わりません')), 60_000)
          ),
        ]);
        return runCliCommand(req, cliContext);
      }
    );
    if (app.isPackaged) {
      try {
        writeCliLauncherInfo(
          app.getPath('userData'),
          resolveAppExePath(process.execPath, process.env, os.tmpdir()),
          app.getVersion()
        );
      } catch (error) {
        console.error('CLI 用の起動情報の書き出しでエラー:', error);
      }
    }
  }

  // preload はセッション単位で登録し、全ウィンドウ（レンダラーから window.open で
  // 開く子ウィンドウを含む）に共通適用する。webPreferences.preload は window.open の
  // 子ウィンドウに引き継がれないため、各 BrowserWindow では個別指定しない
  session.defaultSession.registerPreloadScript({
    type: 'frame',
    id: 'app-preload',
    filePath: path.join(__dirname, 'preload.js'),
  });

  // スプラッシュウィンドウを最速で表示（E2Eテスト環境ではスキップ）
  if (!EnvConfig.skipSplashWindow && !launchedByCli) {
    await createSplashWindow();
  }

  // 以下はスプラッシュ表示後にバックグラウンドで初期化
  const settingsService = await SettingsService.getInstance();
  await applyLanguageSetting();

  // 初回起動判定: ホットキーが未設定なら初回起動
  const hotkey = await settingsService.get('hotkey');
  const isFirstLaunch = !hotkey?.trim();

  // アプリケーションのApp User Model IDを設定（Windows用）
  // 開発モード時は異なるIDを使用してアイコンキャッシュの問題を回避
  const appUserModelId = EnvConfig.isDevelopment
    ? 'net.masaodev.quick-dash-launcher.dev'
    : 'net.masaodev.quick-dash-launcher';
  app.setAppUserModelId(appUserModelId);

  // 自動起動設定を適用（設定ファイルの値をシステムに反映。fire-and-forget: Store 版の WinRT 呼び出しを待たない）
  // 初回起動の間は適用しない。既定値はオンなので、初回設定画面で選ぶ前に OS へ登録してしまうため
  //（初回設定画面で選んだ値は、保存したときに反映する）
  if (!isFirstLaunch) {
    const autoLaunchEnabled = await settingsService.get('autoLaunch');
    AutoLaunchService.getInstance()
      .applyOnStartup(autoLaunchEnabled)
      .catch((error) => {
        console.error('起動時の自動起動設定の適用でエラー:', error);
      });
  }

  // CLI を使えるようにしているなら、同梱の qdl.exe と置いてあるものを比べて入れ替える
  //（本体の更新に追従させる。PowerShell を起動することがあるので待たない）
  settingsService
    .get('cliEnabled')
    .then((enabled) => (enabled ? applyCliSetting(true) : false))
    .catch((error) => console.error('CLI の設定の反映でエラー:', error));

  // 初回起動モードを設定（初回起動時はフォーカス喪失やEscapeで閉じないようにする）
  setFirstLaunchMode(isFirstLaunch);

  // データファイルが無ければお試し用のアイテム入りで作る。初回起動では Web のアイテムを 2 つ目のタブに分け、
  // タブを表示言語の名前で決める（ウィンドウを作る前に決めて、最初の読み込みから 2 つのタブで出す）。
  // タブを決めるのはデータファイルを作ったときだけ（初回設定の途中で終了して起動し直したときに、
  // 「メイン」だけのタブで上書きして「Web」タブを消さないように）
  // ワークスペースにも、メインウィンドウのお試しを指す参照などを入れる（初回起動で、ワークスペースのファイルがまだ無いときだけ。
  // 最初にワークスペースを読む前に書く）
  const defaultDataFile = createDefaultDataFile(isFirstLaunch);
  if (isFirstLaunch && defaultDataFile.created) {
    await settingsService.setMultiple(createFirstLaunchTabs(defaultDataFile.splitWebTab));
    createSampleWorkspaceFile(defaultDataFile.refTargets);
  }

  // 起動時スナップショットバックアップ（fire-and-forget: メインフローをブロックしない）
  BackupService.getInstance()
    .then((s) => s.createSnapshot())
    .catch((error) => {
      console.error('起動時バックアップでエラー:', error);
    });

  // レンダラーの準備完了を待つPromise
  const rendererReadyPromise = new Promise<void>((resolve) => {
    handleIpc(IPC_CHANNELS.RENDERER_READY, () => resolve());
  });

  // レンダラープロセスとの通信用IPCハンドラーを設定（ハンドラー登録のみなのでウィンドウ作成前に実行可能）
  setupIPCHandlers(
    PathManager.getConfigFolder(),
    PathManager.getFaviconsFolder(),
    PathManager.getAppsFolder(),
    PathManager.getExtensionsFolder(),
    getMainWindow,
    getWindowPinMode,
    setWindowPinMode,
    setFirstLaunchMode
  );

  // 設定から外した「ワークスペースの自動表示」「切り離しウィンドウも一緒に隠す」を、ワークスペースの状態と 📌 に読み替える。
  // 固定位置の座標の古いキー（X・Y）も新しいキーに移す（ウィンドウを作る前に済ませる）
  await migrateRemovedWindowSettings();

  // メインウィンドウ・トレイ・ワークスペースを並列作成（互いに独立）
  await Promise.all([createWindow(), createTray(), createWorkspaceWindow()]);

  // 再起動しても直前と同じ見え方に戻す（📌 ありのワークスペース・切り離しウィンドウを出す）。
  // 待たずにホットキーを登録するので、復元の途中でメインウィンドウが出ていたら、終わった後に合わせる
  void restoreWindowsOnStartup().then(syncCompanionWindowsWithMain);

  // ホットキー登録（スプラッシュから分離、スキップ環境でも確実に実行）
  if (!EnvConfig.disableGlobalHotkey) {
    await registerGlobalShortcut();
  }

  // レンダラーの準備完了を待ってからスプラッシュに初期化完了を通知
  await rendererReadyPromise;
  notifySplashInitComplete();
  resolveAppReady();

  // settings.json が壊れていて退避したときは、既定の設定で起動したことを知らせる
  //（初回設定の画面が出る理由と、元の設定の残り場所が分かるように）
  const recoveredSettingsFile = settingsService.getRecoveredBrokenFile();
  if (recoveredSettingsFile) {
    showToastWindow({
      message: mainI18n.t('dataErrors.settingsRecovered', {
        file: path.basename(recoveredSettingsFile),
      }),
      type: 'warning',
      long: true,
    }).catch((error) => {
      console.error('設定の退避を知らせるトーストの表示でエラー:', error);
    });
  }

  // settings.json が新しい版の QDL で保存されていれば、設定を保存しないことを知らせる
  if (settingsService.isNewerFormat()) {
    showToastWindow({
      message: mainI18n.t('dataErrors.settingsNewerFormat'),
      type: 'warning',
      long: true,
    }).catch((error) => {
      console.error('設定を保存しないことを知らせるトーストの表示でエラー:', error);
    });
  }

  // テスト環境の場合、ウィンドウを自動表示（createWindow完了後に実行）
  if (EnvConfig.showWindowOnStartup) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // ブックマーク自動取込の起動時実行
  const bookmarkAutoImportService = new BookmarkAutoImportService();
  bookmarkAutoImportService.executeOnStartup().catch((error) => {
    console.error('ブックマーク自動取込の起動時実行でエラー:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  markAppQuitting();
});

app.on('will-quit', () => {
  LaunchUsageService.getInstance()?.flush();
  cliServer?.close();
  globalShortcut.unregisterAll();
  cancelAllChildWindowCreations();
  closeAllMainChildWindows();
  closeAllWorkspaceItemEditors();
  closeAllWorkspaceItemPickers();
  closeAllWorkspaceLinkWindows();
  closeAllWorkspaceConfirms();
  closeAdminWindow();
  closeWorkspaceWindow();
  closeAllDetachedGroupWindows();
  closeSplashWindow();
  destroyOverlayWindow();
});
