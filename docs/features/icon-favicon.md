# ファビコン取得システム

`FaviconService`クラスが複数のソースから高品質なファビコンを取得します。

## 取得順序

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

## 技術的な特徴

- **高解像度対応**: デフォルト64px（従来の32pxキャッシュとの互換性も維持）
- **効率的なHTML解析**: 最初の5KBのみ読み込み
- **堅牢なエラーハンドリング**: 各ソースで失敗しても次のソースを試行
- **キャッシュ命名**: `{domain}_favicon_{size}.png`形式

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

## 関連ドキュメント

- [アイコンシステム](icon-system.md) - アイコンシステム全体の概要
- [アイコン進捗表示](icon-progress.md) - 進捗表示機能の詳細