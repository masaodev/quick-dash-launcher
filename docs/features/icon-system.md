# アイコンシステム

QuickDashLauncherのアイコン処理システムは、様々な種類のアイテム（ウェブサイト、アプリケーション、ファイル、カスタムURI）に対して適切なアイコンを取得・管理します。

## アイコンの保存先

アイコンは種類ごとに整理された専用のディレクトリに保存されます：

- **ファビコン**: `%APPDATA%/quickdashlauncher/config/favicons/`
- **EXEアイコン**: `%APPDATA%/quickdashlauncher/config/icons/`
- **カスタムURIアイコン**: `%APPDATA%/quickdashlauncher/config/icons/` (uri_[スキーマ]_icon.png形式)
- **拡張子アイコン**: `%APPDATA%/quickdashlauncher/config/icons/extensions/`

## アイコン取得方法

### ウェブサイト（ファビコン）

`FaviconService`クラスが複数のソースから高品質なファビコンを取得します。詳細は[ファビコン取得システム](icon-favicon.md)を参照してください。

### アプリケーション

`extract-file-icon`ライブラリを使用してEXEファイルからアイコンを抽出します。

### カスタムURI

カスタムURIスキーマ（例: `obsidian://`、`ms-excel://`）のアイコンは、Windowsレジストリから関連付けられたアプリケーションを検索して取得します。詳細は[カスタムURIアイコン](icon-custom-uri.md)を参照してください。

### ファイル

ファイル拡張子に基づいてシステムから関連付けられたアイコンを取得します。

### デフォルトアイコン

アイコンが取得できない場合は、アイテムの種類に応じた絵文字を使用：
- 📄 ファイル
- 📁 フォルダ
- 🌐 ウェブ
- ⚙️ アプリケーション
- 🔗 カスタムURI

## 一括取得機能

### 🌐 ファビコン取得ボタン
すべてのURLアイテムのファビコンを一括で取得します。

### 🎨 全アイコンを抽出ボタン
EXE、ファイル、カスタムURIアイテムのアイコンを一括で取得します（URLを除く）。カスタムURIはレジストリベースのアイコン取得を優先的に実行します。

## 進捗表示機能

アイコン取得処理の進行状況をリアルタイムで確認できる進捗表示機能を提供します。詳細は[アイコン進捗表示](icon-progress.md)を参照してください。

## 後方互換性

既存の32pxキャッシュも引き続き使用可能にするため、両方のサイズをチェック：

```typescript
// 新しい64pxファイルを優先的にチェック
const faviconPath64 = path.join(faviconsFolder, `${domain}_favicon_64.png`);
const faviconPath32 = path.join(faviconsFolder, `${domain}_favicon_32.png`);

if (fs.existsSync(faviconPath64)) {
  iconPath = faviconPath64;
} else if (fs.existsSync(faviconPath32)) {
  iconPath = faviconPath32;
}
```

## 関連ドキュメント

- [ファビコン取得システム](icon-favicon.md) - ファビコン取得の詳細仕様
- [カスタムURIアイコン](icon-custom-uri.md) - カスタムURIスキーマのアイコン取得
- [アイコン進捗表示](icon-progress.md) - 進捗表示機能の詳細

## トラブルシューティング

### ファビコンが取得できない場合

1. **ネットワーク接続を確認**
   - プロキシ設定
   - ファイアウォール

2. **サイトの設定を確認**
   - robots.txtによるブロック
   - CORSポリシー

3. **キャッシュをクリア**
   - `%APPDATA%/quickdashlauncher/config/favicons/`のファイルを削除

### デバッグ方法

コンソールログで以下の情報を確認：
- 試行したファビコンソース
- 各ソースの成功/失敗
- エラーの詳細

## 今後の改善案

1. **画像フォーマットの変換**
   - SVGファビコンのサポート
   - WebPからPNGへの変換

2. **キャッシュ管理**
   - 古いキャッシュの自動削除
   - キャッシュの有効期限設定

3. **パフォーマンス最適化**
   - 並列ダウンロード
   - プログレッシブエンハンスメント