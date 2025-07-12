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