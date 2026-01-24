/**
 * アプリケーション情報を表すインターフェース
 * package.jsonから取得される基本情報
 */
export interface AppInfo {
  /** アプリケーションのバージョン番号 */
  version: string;
  /** アプリケーション名 */
  displayName: string;
  /** アプリケーションの説明 */
  description: string;
  /** 作者名 */
  author: string;
  /** ライセンス種別 */
  license: string;
  /** GitHubリポジトリURL */
  repository: string;
}
