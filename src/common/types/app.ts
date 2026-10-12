/** 配布形式（Store 版・ポータブル版・インストーラー版・開発中） */
export type AppDistribution = 'store' | 'portable' | 'installer' | 'dev';

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
  /** 配布形式 */
  distribution: AppDistribution;
}
