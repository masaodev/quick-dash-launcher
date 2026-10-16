import { logError } from './debug';

/**
 * カスタムアイコンのファイル名から表示用のデータ URL を引く
 *
 * path を持たない種別（クリップボード・セット）は loadCachedIcons（path がキー）で
 * 解決できないので、ファイル名で直接読む。同じファイルは 1 回だけ読み、
 * 読めなかったものは結果に入れない（呼び出し側は種別の既定の絵文字にする）。
 *
 * @returns ファイル名 → base64 データ URL
 */
export async function loadCustomIcons(
  fileNames: ReadonlyArray<string | undefined>
): Promise<Record<string, string>> {
  const unique = [...new Set(fileNames.filter((name): name is string => !!name))];
  const icons: Record<string, string> = {};

  await Promise.all(
    unique.map(async (fileName) => {
      try {
        const iconData = await window.electronAPI.getCustomIcon(fileName);
        if (iconData) icons[fileName] = iconData;
      } catch (error) {
        logError('カスタムアイコンの読み込みに失敗しました:', { fileName, error });
      }
    })
  );

  return icons;
}
