import { app } from 'electron';
import logger from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { resolveLanguage, type AppLanguage } from '@common/i18n';

import { handleIpc } from '../utils/ipcWrapper';

import { SettingsService } from './settingsService.js';
import { mainI18n } from './mainI18n.js';

export { mainI18n };

/*
 * main プロセスの言語は設定（language）と OS の表示言語から決める。起動直後は正本の言語
 * （mainI18n.ts）で、設定を読んだら applyLanguageSetting() で切り替える。renderer は
 * IPC（SETTINGS_GET_LANGUAGE）で今の言語を取り、設定の変更通知で取り直す。
 */

/** 設定と OS の表示言語から、今使うべき言語を求める */
async function resolveFromSettings(): Promise<AppLanguage> {
  const settingsService = await SettingsService.getInstance();
  const setting = await settingsService.get('language');
  return resolveLanguage(setting, app.getPreferredSystemLanguages());
}

/**
 * 設定に合わせて言語を切り替える（起動時と、設定の language が変わったとき）
 *
 * @returns 切り替えた後の言語
 */
export async function applyLanguageSetting(): Promise<AppLanguage> {
  const language = await resolveFromSettings();
  if (mainI18n.language !== language) {
    await mainI18n.changeLanguage(language);
    logger.info({ language }, '表示言語を切り替えました');
  }
  return language;
}

/**
 * renderer が今の言語を取る IPC を登録する
 *
 * スプラッシュは設定の読み込みより先に開くので、起動の最初に登録し、
 * 応答では設定を読んで（まだ適用前でも）正しい言語を返す。
 */
export function registerLanguageHandler(): void {
  handleIpc(IPC_CHANNELS.SETTINGS_GET_LANGUAGE, () => applyLanguageSetting());
}
