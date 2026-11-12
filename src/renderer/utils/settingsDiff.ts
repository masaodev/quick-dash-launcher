import type { AppSettings } from '@common/types';

/** 保存済みの設定と比べて、値が変わった項目だけを返す（配列・オブジェクトは中身で比べる） */
export function pickChangedSettings(
  saved: AppSettings,
  edited: Partial<AppSettings>
): Partial<AppSettings> {
  const changed: Partial<AppSettings> = {};
  for (const key of Object.keys(edited) as Array<keyof AppSettings>) {
    if (JSON.stringify(edited[key]) !== JSON.stringify(saved[key])) {
      (changed as Record<string, unknown>)[key] = edited[key];
    }
  }
  return changed;
}
