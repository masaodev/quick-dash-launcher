import { BrowserWindow, screen } from 'electron';
import type { AppSettings, DisplayInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import logger from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import { HotkeyService } from '../services/hotkeyService.js';
import { setHotkeyRecording } from '../services/hotkeyRecording.js';
import { AutoLaunchService } from '../services/autoLaunchService.js';
import { applyCliSetting } from '../services/cli/cliInstallService.js';
import {
  getWorkspaceWindow,
  setWorkspacePosition,
  applyVisibilityOnAllDesktops,
  setWindowSnapEnabled,
} from '../workspaceWindowManager.js';
import {
  setDetachedWindowSnapEnabled,
  applyDetachedVisibilityOnAllDesktops,
} from '../detachedGroupWindowManager.js';
import { EnvConfig } from '../config/envConfig.js';
import { showToastWindow } from '../services/overlayWindowService.js';
import { applyLanguageSetting, mainI18n } from '../services/i18nService.js';
import { LaunchUsageService } from '../services/launchUsageService.js';
import { UpdateCheckService } from '../services/updateCheckService.js';
import { handleIpc } from '../utils/ipcWrapper';

export function notifySettingsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.EVENT_SETTINGS_CHANGED);
  }
}

const OPACITY_KEYS: ReadonlyArray<keyof AppSettings> = [
  'workspaceOpacity',
  'workspaceBackgroundTransparent',
];

const POSITION_KEYS: ReadonlyArray<keyof AppSettings> = [
  'workspacePositionMode',
  'workspaceTargetDisplayIndex',
  'workspaceFixedPosition',
];

/** 副作用（OS 登録・ウィンドウ状態）を持つ設定キー。ファイル再読込時に全部適用し直す */
const EFFECT_KEYS: ReadonlyArray<keyof AppSettings> = [
  'language',
  'autoLaunch',
  'cliEnabled',
  ...OPACITY_KEYS,
  ...POSITION_KEYS,
  'workspaceVisibleOnAllDesktops',
  'detachedVisibleOnAllDesktops',
  'windowSnapEnabled',
  'recordLaunchUsage',
  'updateCheckEnabled',
  'updateCheckIncludeBeta',
];

async function applySettingsEffects(
  changedKeys: ReadonlyArray<keyof AppSettings>,
  settingsService: SettingsService
): Promise<void> {
  // 言語は main の文言を切り替える。renderer は設定の変更通知で言語を取り直す
  if (changedKeys.includes('language')) {
    await applyLanguageSetting();
  }
  if (changedKeys.includes('autoLaunch')) {
    const autoLaunch = await settingsService.get('autoLaunch');
    await AutoLaunchService.getInstance().setAutoLaunch(autoLaunch);
  }

  if (changedKeys.includes('cliEnabled')) {
    const cliEnabled = await settingsService.get('cliEnabled');
    if (await applyCliSetting(cliEnabled)) {
      showToastWindow({
        message: cliEnabled ? mainI18n.t('cli.enabled') : mainI18n.t('cli.disabled'),
        type: 'success',
      }).catch((error) => logger.error({ error }, 'CLI の設定のトーストの表示に失敗'));
    }
  }

  if (changedKeys.some((key) => OPACITY_KEYS.includes(key))) {
    const workspace = getWorkspaceWindow();
    if (workspace && !workspace.isDestroyed()) {
      const [backgroundTransparent, opacity] = await Promise.all([
        settingsService.get('workspaceBackgroundTransparent'),
        settingsService.get('workspaceOpacity'),
      ]);
      workspace.setOpacity(backgroundTransparent ? 1.0 : opacity / 100);
    }
  }

  if (changedKeys.some((key) => POSITION_KEYS.includes(key))) {
    const workspace = getWorkspaceWindow();
    if (workspace && !workspace.isDestroyed() && workspace.isVisible()) {
      await setWorkspacePosition();
    }
  }

  if (changedKeys.includes('workspaceVisibleOnAllDesktops')) {
    await applyVisibilityOnAllDesktops();
  }

  if (changedKeys.includes('detachedVisibleOnAllDesktops')) {
    await applyDetachedVisibilityOnAllDesktops();
  }

  if (changedKeys.includes('windowSnapEnabled')) {
    const enabled = await settingsService.get('windowSnapEnabled');
    setWindowSnapEnabled(enabled);
    setDetachedWindowSnapEnabled(enabled);
  }

  if (
    changedKeys.includes('updateCheckEnabled') ||
    changedKeys.includes('updateCheckIncludeBeta')
  ) {
    void UpdateCheckService.getInstance()?.onSettingsChanged();
  }

  if (changedKeys.includes('recordLaunchUsage')) {
    LaunchUsageService.getInstance()?.setRecording(
      (await settingsService.get('recordLaunchUsage')) !== false
    );
  }
}

/**
 * 登録に失敗したホットキー値（type 別）。同じ値で失敗し続ける間はトーストを繰り返さない
 * （F5 のたびにエラーが出続けるのを防ぐ。値が変われば改めて知らせる）
 */
const lastFailedHotkey: Record<'main' | 'itemSearch', string | null> = {
  main: null,
  itemSearch: null,
};

/**
 * 起動ホットキーを無効化している間（E2E）は HotkeyService を作らないので、登録せずに設定だけ保存する
 */
async function saveHotkeyWithoutRegistering(
  key: 'hotkey' | 'itemSearchHotkey',
  newHotkey: string
): Promise<boolean> {
  const settingsService = await SettingsService.getInstance();
  const isEmpty = !newHotkey?.trim();
  if (isEmpty ? key === 'hotkey' : !settingsService.validateHotkey(newHotkey).isValid) return false;
  await settingsService.set(key, isEmpty ? '' : newHotkey);
  logger.info(`${key} saved without registering (global hotkey disabled): ${newHotkey}`);
  return true;
}

/**
 * ホットキー設定をディスクの値に合わせて登録し直す
 *
 * 値が現在の登録と同じなら何もしない。登録に失敗した場合は設定を書き戻さず、
 * 現在の登録を維持してトーストで知らせる（外部で書かれた値を勝手に消さない）。
 */
async function reapplyHotkey(
  type: 'main' | 'itemSearch',
  settingsService: SettingsService
): Promise<void> {
  const hotkeyService = HotkeyService.getInstance();
  const isMain = type === 'main';

  // 環境変数で上書きされている間は settings.json の値を使わない
  if (isMain && EnvConfig.customHotkey) return;

  const desired = (await settingsService.get(isMain ? 'hotkey' : 'itemSearchHotkey')) ?? '';
  const current =
    (isMain ? hotkeyService.getCurrentHotkey() : hotkeyService.getCurrentItemSearchHotkey()) ?? '';
  if (desired === current) return;

  // ログには設定のキー名を出す（画面のトーストは表示言語の文言）
  const label = isMain ? 'hotkey' : 'itemSearchHotkey';
  const toastLabel = mainI18n.t(isMain ? 'hotkey.launchLabel' : 'hotkey.windowSearchLabel');

  if (desired.trim() === '') {
    if (isMain) {
      logger.warn('settings.json のホットキーが空のため、現在の登録を維持します');
      return;
    }
    hotkeyService.unregisterItemSearchHotkey();
    logger.info(`${label} を解除しました（settings.json で空）`);
    return;
  }

  const validation = settingsService.validateHotkey(desired);
  const success =
    validation.isValid &&
    (isMain ? hotkeyService.setHotkey(desired) : hotkeyService.setItemSearchHotkey(desired));

  if (success) {
    lastFailedHotkey[type] = null;
    logger.info(`${label} を settings.json の値に合わせて登録し直しました: ${desired}`);
    return;
  }

  // 失敗時は元の登録に戻す
  if (current) {
    if (isMain) hotkeyService.setHotkey(current);
    else hotkeyService.setItemSearchHotkey(current);
  }
  const reason = validation.isValid ? mainI18n.t('hotkey.mayBeInUse') : validation.reason;
  logger.warn({ desired, current, reason }, `${label} の登録し直しに失敗しました`);

  if (lastFailedHotkey[type] === desired) return;
  lastFailedHotkey[type] = desired;
  showToastWindow({
    message: mainI18n.t('hotkey.registerFailed', {
      label: toastLabel,
      desired,
      reason: reason ?? '',
      current: current || mainI18n.t('hotkey.notSet'),
    }),
    type: 'error',
  }).catch((error) => logger.error({ error }, 'ホットキー再登録トーストの表示に失敗'));
}

/**
 * 起動ホットキーとウィンドウ検索ホットキーを settings.json の値に合わせて登録し直す
 *
 * ホットキーを無効にして起動しているとき（DISABLE_GLOBAL_HOTKEY=1。E2E など）は
 * HotkeyService を作っていないので何もしない（作っていないまま呼ぶと例外になり、既定値に戻すが失敗扱いになる）
 */
async function reapplyHotkeys(settingsService: SettingsService): Promise<void> {
  if (EnvConfig.disableGlobalHotkey) return;
  await reapplyHotkey('main', settingsService);
  await reapplyHotkey('itemSearch', settingsService);
}

/**
 * settings.json をディスクから読み直し、副作用のある設定を適用し直す
 *
 * 設定値そのものは electron-store が毎回ディスクを読むので常に最新だが、
 * ホットキー登録・自動起動・ウィンドウ状態は set() 時にしか適用されない。
 * QDL 外（人・AI）で settings.json を編集したときに、F5 でそれらを効かせる入口。
 */
export async function reapplySettingsFromDisk(): Promise<void> {
  const settingsService = await SettingsService.getInstance();

  await applySettingsEffects(EFFECT_KEYS, settingsService);
  try {
    await reapplyHotkeys(settingsService);
  } finally {
    // ホットキーを登録し直せなくても、他の設定（言語など）の変更は各ウィンドウに伝える
    notifySettingsChanged();
  }
  logger.info('設定をディスクから再適用しました');
}

/**
 * 設定をまとめて保存し、副作用のある設定を適用して、各ウィンドウに変更を知らせる
 * （設定画面・アイテム管理画面の保存と、CLI の launcher tab が使う）
 */
export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const settingsService = await SettingsService.getInstance();
  await settingsService.setMultiple(settings);
  logger.info({ settings }, 'Settings set multiple request');

  const changedKeys = Object.keys(settings) as Array<keyof AppSettings>;
  await applySettingsEffects(changedKeys, settingsService);
  notifySettingsChanged();
}

export function setupSettingsHandlers(setFirstLaunchMode?: (isFirstLaunch: boolean) => void): void {
  handleIpc(IPC_CHANNELS.SETTINGS_IS_FIRST_LAUNCH, async () => {
    const settingsService = await SettingsService.getInstance();
    const hotkey = await settingsService.get('hotkey');
    const isFirstLaunch = !hotkey || hotkey.trim() === '';
    logger.info(`Is first launch request: ${isFirstLaunch}`);
    return isFirstLaunch;
  });

  handleIpc(IPC_CHANNELS.SETTINGS_GET, async () => {
    const settingsService = await SettingsService.getInstance();
    const allSettings = await settingsService.getAll();
    logger.info('Settings get all request');
    return allSettings;
  });

  handleIpc(IPC_CHANNELS.SETTINGS_GET_DEFAULTS, () => SettingsService.getDefaults());

  handleIpc(IPC_CHANNELS.SETTINGS_SET_MULTIPLE, async (_event, settings: Partial<AppSettings>) => {
    await saveSettings(settings);

    if (settings.hotkey && settings.hotkey.trim() !== '' && setFirstLaunchMode) {
      setFirstLaunchMode(false);
      logger.info('初回起動モードを解除しました（ホットキーが設定されたため）');
    }
  });

  handleIpc(IPC_CHANNELS.SETTINGS_REAPPLY, () => reapplySettingsFromDisk());

  handleIpc(
    IPC_CHANNELS.SETTINGS_RESET,
    async (_event, keys?: Array<keyof AppSettings>): Promise<AppSettings> => {
      const settingsService = await SettingsService.getInstance();

      if (keys && keys.length > 0) {
        // 一部だけ戻す（設定画面のカテゴリ単位）。ホットキーは含めない前提だが、
        // 含まれていても reapplyHotkey が空値を無視するので登録は消えない
        await settingsService.resetKeys(keys);
        logger.info({ keys }, 'Settings reset request (partial)');
        await applySettingsEffects(keys, settingsService);
      } else {
        // 全項目を戻す。副作用も再適用しないと、ホットキー登録やウィンドウ状態が
        // ディスクの値と食い違ったままになる
        await settingsService.reset();
        logger.info('Settings reset request (all)');
        await applySettingsEffects(EFFECT_KEYS, settingsService);
      }

      await reapplyHotkeys(settingsService);
      notifySettingsChanged();
      return settingsService.getAll();
    }
  );

  handleIpc(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, async (_event, hotkey: string) => {
    const settingsService = await SettingsService.getInstance();
    const result = settingsService.validateHotkey(hotkey);
    logger.info(`Hotkey validation request: ${hotkey} = ${result.isValid}`);
    return result;
  });

  handleIpc(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, async (_event, newHotkey: string) => {
    if (EnvConfig.disableGlobalHotkey) return saveHotkeyWithoutRegistering('hotkey', newHotkey);
    const success = await HotkeyService.getInstance().changeHotkey(newHotkey);
    logger.info(`Hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`);
    return success;
  });

  handleIpc(IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY, async (_event, newHotkey: string) => {
    if (EnvConfig.disableGlobalHotkey) {
      return saveHotkeyWithoutRegistering('itemSearchHotkey', newHotkey);
    }
    const success = await HotkeyService.getInstance().changeItemSearchHotkey(newHotkey);
    logger.info(
      `Item search hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`
    );
    return success;
  });

  // 初回設定のホットキーの「次へ」で使う（初回設定を終えるまではウィンドウ検索のホットキーを登録しないため）
  handleIpc(
    IPC_CHANNELS.SETTINGS_IS_ITEM_SEARCH_HOTKEY_AVAILABLE,
    (_event, hotkey: string): boolean => {
      if (EnvConfig.disableGlobalHotkey) return true;
      return HotkeyService.getInstance().isHotkeyAvailable(hotkey, true);
    }
  );

  handleIpc(IPC_CHANNELS.SETTINGS_SET_HOTKEY_RECORDING, (event, recording: boolean) => {
    setHotkeyRecording(event.sender, recording);
  });

  handleIpc(IPC_CHANNELS.SETTINGS_GET_AUTO_LAUNCH_STATUS, () =>
    AutoLaunchService.getInstance().getAutoLaunchStatus()
  );

  handleIpc(IPC_CHANNELS.SETTINGS_GET_DISPLAYS, () => {
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;

    const displayInfos: DisplayInfo[] = displays.map((display, index) => {
      const isPrimary = display.id === primaryId;
      return {
        index,
        label: mainI18n.t(isPrimary ? 'display.primary' : 'display.label', { number: index + 1 }),
        isPrimary,
        width: display.workArea.width,
        height: display.workArea.height,
        x: display.workArea.x,
        y: display.workArea.y,
      };
    });

    logger.info({ displayCount: displayInfos.length }, 'ディスプレイ一覧を取得');
    return displayInfos;
  });

  // ウィンドウの座標（GetWindowRect）は物理ピクセルなので、画面の範囲も物理ピクセルに直して返す
  handleIpc(IPC_CHANNELS.GET_SCREEN_AREAS, (): ScreenArea[] =>
    screen.getAllDisplays().map((display) => ({
      bounds: screen.dipToScreenRect(null, display.bounds),
      workArea: screen.dipToScreenRect(null, display.workArea),
    }))
  );

  logger.info('Settings IPC handlers registered');
}
