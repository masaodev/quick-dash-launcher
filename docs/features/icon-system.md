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

`FaviconService`クラスが複数のソースから高品質なファビコンを取得します。

#### 取得順序

1. **HTMLメタタグの解析**
   - `<link rel="icon" href="...">`
   - `<link rel="shortcut icon" href="...">`
   - `<link rel="apple-touch-icon" href="...">`
   - `<meta property="og:image" content="...">`

2. **標準的な場所の確認**
   - `/favicon.ico`
   - `/favicon.png`
   - `/apple-touch-icon.png` (180px)
   - `/apple-touch-icon-precomposed.png` (180px)
   - `/icon.png`
   - `/logo.png`

#### 技術的な特徴

- **高解像度対応**: デフォルト64px（従来の32pxキャッシュとの互換性も維持）
- **効率的なHTML解析**: 最初の5KBのみ読み込み
- **堅牢なエラーハンドリング**: 各ソースで失敗しても次のソースを試行
- **キャッシュ命名**: `{domain}_favicon_{size}.png`形式

### アプリケーション

`extract-file-icon`ライブラリを使用してEXEファイルからアイコンを抽出します。

### カスタムURI

カスタムURIスキーマ（例: `obsidian://`、`ms-excel://`）のアイコンは、Windowsレジストリから関連付けられたアプリケーションを検索して取得します。

#### 取得優先順位

1. **レジストリベースの取得**: Windowsレジストリからスキーマハンドラーアプリケーションを検索し、そのアイコンを抽出
2. **拡張子ベースの取得**: URIに対応する拡張子のアイコン（例: `ms-excel://` → `.xlsx`）
3. **デフォルトアイコン**: 🔗絵文字

#### レジストリクエリプロセス

1. **スキーマ検出**: URIから`://`前のスキーマを抽出（例: `obsidian://` → `obsidian`）
2. **レジストリ検索**: 
   ```cmd
   reg query "HKEY_CLASSES_ROOT\[スキーマ]" /ve
   reg query "HKEY_CLASSES_ROOT\[スキーマ]\shell\open\command" /ve
   ```
3. **実行ファイルパス抽出**: コマンドから実行ファイルパスを抽出
4. **環境変数展開**: `%PROGRAMFILES%`等を実際のパスに変換
5. **アイコン抽出**: `extract-file-icon`で32pxアイコンを抽出

#### 対応例

| URIスキーマ | ハンドラーアプリ | アイコン |
|------------|--------------|--------|
| `obsidian://` | Obsidian.exe | Obsidianアプリアイコン |
| `ms-excel://` | EXCEL.EXE | Microsoft Excelアイコン |
| `vscode://` | Code.exe | Visual Studio Codeアイコン |
| `steam://` | steam.exe | Steamアイコン |

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

アイコン取得処理の進行状況をリアルタイムで確認できる進捗表示機能を提供します。

### 機能概要

- **非モーダル表示**: メイン画面下部に表示され、他の操作を継続可能
- **リアルタイム更新**: 各アイテム処理完了時に即座に進捗を更新
- **自動非表示**: 処理完了後3秒で自動的に非表示

### 表示内容

#### 基本情報
- **処理種別**: 「ファビコン取得中」または「アイコン抽出中」
- **進捗数値**: `現在処理済み数/総処理数` (例: `12/35`)
- **進捗率**: パーセンテージとプログレスバー

#### 詳細情報
- **現在処理中のアイテム**: 処理中のURLまたはファイルパス
- **エラー件数**: 失敗したアイテムの数
- **経過時間**: 処理開始からの経過時間
- **推定残り時間**: 処理速度に基づく残り時間の推定

### 対象アイテムの選択

#### ファビコン取得時
```typescript
// メインタブ・テンポラリタブから以下の条件でフィルタリング
const targetUrls = items.filter(item => 
  item.type === 'url' && !item.icon
).map(item => item.path);
```

#### アイコン抽出時
```typescript
// メインタブ・テンポラリタブから以下の条件でフィルタリング
const targetItems = items.filter(item => 
  !item.icon && item.type !== 'url'
);
```

### 処理方式

- **逐次処理**: メモリ効率とエラー耐性を向上させるため、並列処理から逐次処理に変更
- **進捗通知**: 各アイテム処理前後にIPCでレンダラープロセスに進捗状況を送信
- **エラーハンドリング**: 個別アイテムの失敗では処理を継続し、エラー数をカウント

### UI仕様

#### 表示例
```
[▓▓▓▓▓░░░░░] 12/35 ファビコン取得中...
 エラー: 2件   経過: 45秒   残り: 約1分15秒
 処理中: https://github.com/masaodev/quick-dash-launcher
```

#### 完了時表示
```
ファビコン取得完了 (2件のエラー)
```

### 技術実装

#### コンポーネント構成
- **IconProgressBar**: 進捗表示UIコンポーネント
- **useIconProgress**: 進捗状態管理カスタムフック

#### IPC通信
- **icon-progress-start**: 進捗開始通知
- **icon-progress-update**: 進捗更新通知
- **icon-progress-complete**: 進捗完了通知

#### 新しいAPI
- **fetchFaviconsWithProgress**: 進捗付きファビコン一括取得
- **extractIconsWithProgress**: 進捗付きアイコン一括抽出

## FaviconServiceクラスの主要メソッド

```typescript
class FaviconService {
  // メインのファビコン取得メソッド
  async fetchFavicon(url: string): Promise<string | null>
  
  // 複数のソースを順番に試行
  private async tryMultipleSources(url: string): Promise<Buffer | null>
  
  // ファビコンソースのリストを生成（HTMLメタタグ解析＋標準パス）
  private async getFaviconSources(url: string): Promise<FaviconSource[]>
  
  // HTMLを解析してファビコンURLを抽出
  private async parseHtmlForFavicons(url: string): Promise<FaviconSource[]>
  
  // HTMLコンテンツを取得（最初の5KBのみ）
  private async fetchHtml(url: string): Promise<string>
  
  // ファビコンをダウンロード
  private async downloadFavicon(url: string): Promise<Buffer | null>
  
  // 相対URLを絶対URLに変換
  private resolveUrl(url: string, base: string): string | null
}
```

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