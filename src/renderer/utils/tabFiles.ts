import type { DataFileTab } from '@common/types';

/**
 * 今のタブに出すデータファイル（1 つのタブに複数のファイルをまとめていれば、そのすべて）
 *
 * 「タブを表示する」がオフでも同じ（オフにすると最初のタブに戻るので、最初のタブの中身を出す）。
 * 一覧・アイコンの取得・「ほかのタブにあります」の案内で、出す範囲を食い違わせないために 1 か所で決める
 */
export function getActiveTabFiles(dataFileTabs: DataFileTab[], activeTab: string): string[] {
  const config = dataFileTabs.find((tab) => tab.files.includes(activeTab));
  return config ? config.files : [activeTab];
}
