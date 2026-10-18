import type { AppSettings } from './types';

/** 数値の設定の範囲（設定画面と CLI で同じものを使う） */
export const SETTING_NUMBER_RANGES = {
  windowWidth: { min: 400, max: 2000 },
  windowHeight: { min: 300, max: 1200 },
  editModeWidth: { min: 800, max: 2000 },
  editModeHeight: { min: 600, max: 1200 },
  workspaceOpacity: { min: 0, max: 100 },
  backupRetention: { min: 3, max: 50 },
} as const satisfies Partial<Record<keyof AppSettings, { min: number; max: number }>>;

export type RangedSettingKey = keyof typeof SETTING_NUMBER_RANGES;

/** 範囲の外にある数値の設定を、範囲の端に寄せた設定を返す（範囲の中なら同じオブジェクトを返す） */
export function clampSettingNumbers(settings: AppSettings): AppSettings {
  let clamped: AppSettings | null = null;
  for (const key of Object.keys(SETTING_NUMBER_RANGES) as RangedSettingKey[]) {
    const { min, max } = SETTING_NUMBER_RANGES[key];
    const value = settings[key];
    const next = Math.min(max, Math.max(min, value));
    if (next !== value) {
      clamped ??= { ...settings };
      clamped[key] = next;
    }
  }
  return clamped ?? settings;
}
