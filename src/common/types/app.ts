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
  name: string;
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

/** 更新の知らせで見つけた、今の版より新しい版 */
export interface AvailableUpdate {
  /** 先頭の v を外した版（0.8.1・0.8.1-beta.1） */
  version: string;
  /** リリースのページ */
  url: string;
}

/** 更新の知らせの状態（ヘルプタブに出す） */
export interface UpdateCheckStatus {
  /** この配布形式で確かめるか（Store 版・開発版は false） */
  supported: boolean;
  /** 設定「新しい版を確かめる」 */
  enabled: boolean;
  /** 最後に確かめた日時（Unix ミリ秒） */
  lastCheckedAt: number | null;
  /** 今の版より新しい版（無ければ null） */
  available: AvailableUpdate | null;
  /** 直近の確認に失敗した */
  failed: boolean;
}
