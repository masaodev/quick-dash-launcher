# ビルドとデプロイ

## ビルドコマンド

```bash
npm install              # 依存関係のインストール
npm run dev             # 開発モード（Viteデベロップメントサーバー、ホットリロード付き）
npm run build           # 全コンポーネントのビルド（Vite使用）
npm run preview         # ビルド済みアプリケーションのプレビュー
npm run start           # ビルドして実行
npm run dist            # Windowsインストーラーの作成
```

## WSL2環境でのビルド

WSL2環境からビルドするときは、Windows上でビルドさせるために、PowerShellを使ってください：

```bash
powershell.exe -Command "npm run build"
powershell.exe -Command "npm run dist"
```

## ビルドシステム

Viteベースのビルドシステムを使用:
- **メインプロセス**: CommonJS形式で`dist/main/`に出力
- **プリロードスクリプト**: CommonJS形式で`dist/preload/`に出力
- **レンダラープロセス**: 標準的なViteビルドで`dist/renderer/`に出力
- **開発サーバー**: ポート9000で実行

## パッケージング

- **パッケージングツール**: electron-builder
- **出力先**: `release/`ディレクトリ
- **Windows専用**: クロスプラットフォーム非対応

## 重要な制約事項

1. **Windows専用アプリケーション** - クロスプラットフォーム非対応
2. **WSL2環境でのビルド時**: PowerShellコマンドを使用する必要がある
3. **テストフレームワーク未導入** - 手動テストのみ実施

## トラブルシューティング

### よくあるビルドの問題
- TypeScript設定の`@common`パスエイリアスがVite設定と一致しているか確認
- ビルド出力が正しいディレクトリ構造になっているか確認
- Electronのファイルパスがビルド/開発モードで適切に処理されているか確認

### 白い/空白のウィンドウ
- DevToolsコンソールでエラーを確認（自動的に開く）
- Viteデベロップメントサーバーが起動しているか確認（開発モード時）
- プロダクションモードでindex.htmlパスが正しいか確認

## 関連ドキュメント

- [開発ガイド](development.md) - 基本的な開発情報
- [テストチェックリスト](testing.md) - ビルド後のテスト手順