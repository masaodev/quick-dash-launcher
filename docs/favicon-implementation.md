# ファビコン取得システムの実装仕様

最終更新日: 2025-01-05

## 概要

QuickDashLauncherのファビコン取得システムを改善し、より確実に高品質なアイコンを取得できるようにしました。

## 主な改善点

### 1. 複数ソースからの取得

新しい `FaviconService` クラス（`src/main/services/faviconService.ts`）は以下の順序でファビコンを探します：

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

### 2. 高解像度アイコンのサポート

- デフォルトサイズを32pxから64pxに変更
- Apple Touch Icon（180px）も取得可能
- キャッシュファイル名に解像度を含める: `{domain}_favicon_{size}.png`

### 3. 堅牢なエラーハンドリング

- 各ソースで失敗しても次のソースを試行
- ネットワークエラーや404エラーを適切に処理
- コンソールログで詳細な情報を出力

### 4. 効率的なHTML解析

- Electronの`net.request`を使用してHTMLを取得
- 最初の5KBのみ読み込み（ヘッダー部分にファビコン情報があるため）
- 正規表現で複数パターンのメタタグを解析

## 実装の詳細

### FaviconServiceクラスの主要メソッド

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

### 後方互換性

既存の32pxキャッシュも引き続き使用可能にするため、`loadCachedIcons`関数で両方のサイズをチェック：

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

## 使用方法

ファビコン取得は従来通りIPCハンドラー経由で実行：

```typescript
// レンダラープロセスから
const favicon = await window.electron.fetchFavicon('https://example.com');
```

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