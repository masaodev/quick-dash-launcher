/**
 * 配列操作の共通ユーティリティクラス
 * プロジェクト全体で重複している配列操作を統一する
 */
export class ArrayUtils {
  /**
   * 配列の要素を指定されたプロパティの値でグループ化する
   * @param items グループ化する配列
   * @param keyProperty グループ化のキーとなるプロパティ名
   * @returns プロパティ値をキーとした要素配列のMap
   *
   * @example
   * const items = [
   *   { file: 'a.txt', data: 1 },
   *   { file: 'b.txt', data: 2 },
   *   { file: 'a.txt', data: 3 }
   * ];
   * const grouped = ArrayUtils.groupByProperty(items, 'file');
   * // Map { 'a.txt' => [{file: 'a.txt', data: 1}, {file: 'a.txt', data: 3}], 'b.txt' => [...] }
   */
  static groupByProperty<T>(items: T[], keyProperty: keyof T): Map<string | number, T[]> {
    const groups = new Map<string | number, T[]>();

    items.forEach((item) => {
      const key = item[keyProperty] as string | number;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    return groups;
  }
}
