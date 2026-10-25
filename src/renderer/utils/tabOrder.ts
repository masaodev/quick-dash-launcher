/**
 * アイテムを選ぶ画面のタブを、設定のタブの順に並べる
 *
 * 選ぶ画面はタブを「先に出てきた順」に作る。読み込んだ一覧は名前順なので、そのままだと
 * 先頭のアイテムのタブが最初になってしまう（例: ブックマークのタブがメインより前に来る）
 */
import type { DataFileTab } from '@common/types';

/**
 * 設定のタブの順に並べ替える（同じタブの中は今の並びのまま。どのタブにも無いファイルは最後）
 *
 * @param fileOf アイテムのデータファイル（sourceFile）
 */
export function sortByTabOrder<T>(
  items: readonly T[],
  dataFileTabs: readonly DataFileTab[],
  fileOf: (item: T) => string | undefined
): T[] {
  const indexOf = (file: string | undefined) => {
    const index =
      file === undefined ? -1 : dataFileTabs.findIndex((tab) => tab.files.includes(file));
    return index === -1 ? dataFileTabs.length : index;
  };
  return items
    .map((item, position) => ({ item, position, tab: indexOf(fileOf(item)) }))
    .sort((a, b) => a.tab - b.tab || a.position - b.position)
    .map(({ item }) => item);
}
