import type { TFunction } from 'i18next';

/** 名前を並べる数（これより多いセットは「ほか N 件」にまとめる） */
const MAX_LISTED = 2;

/**
 * アイテムを消す確認に添える「セット「A」「B」ほか N 件で使っています…」（A3-79 #6）
 *
 * @returns 使っているセットが無ければ null
 */
export function setUsageWarning(setNames: readonly string[], t: TFunction): string | null {
  if (setNames.length === 0) return null;
  const quoted = setNames
    .slice(0, MAX_LISTED)
    .map((name) => t('itemManager.quotedName', { name }))
    .join(t('common.listSeparator'));
  const sets =
    setNames.length > MAX_LISTED
      ? t('register.setUsageMore', { names: quoted, count: setNames.length - MAX_LISTED })
      : quoted;
  return t('register.setUsageWarning', { sets });
}
