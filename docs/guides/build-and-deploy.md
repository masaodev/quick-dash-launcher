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

### WSL2環境での問題

#### ビルドエラー
**問題**: WSL2でnpm run buildが失敗する
**原因**: WindowsネイティブのモジュールがLinux環境で動作しない
**解決策**: PowerShell経由でコマンドを実行
```bash
powershell.exe -Command "npm run build"
powershell.exe -Command "npm run dist"
```

#### Rollupモジュールエラー（WSL2環境）
**問題**: `Cannot find module @rollup/rollup-linux-x64-gnu`エラーが発生
**原因**: WSL2でnpmの依存関係が正しくインストールされない
**解決策**: 
1. PowerShell経由でビルドを実行:
   ```bash
   powershell.exe -Command "npm run build"
   ```
2. または、node_modulesとpackage-lock.jsonを削除して再インストール:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### ビルド関連の問題

#### TypeScriptパスエイリアスエラー
**問題**: `@common`パスが解決されない
**原因**: TypeScript設定とVite設定の不一致
**解決策**: 
- `tsconfig.json`と`vite.config.ts`でパスエイリアスが一致していることを確認
- 両方に`@common: src/common`が設定されているか確認

#### 白い/空白のウィンドウ
**問題**: アプリケーション起動時に白い画面が表示される
**原因**: 
1. Viteデベロップメントサーバーが起動していない（開発モード）
2. index.htmlパスが正しくない（本番モード）
**解決策**:
- DevToolsコンソールでエラーを確認
- 開発モード: `npm run dev`が実行中か確認
- 本番モード: ビルド出力のパスを確認

### 実行時の問題

#### グローバルホットキーが動作しない
**問題**: Ctrl+Alt+Wでウィンドウが表示されない
**原因**: 他のアプリケーションとの競合
**解決策**: 
- タスクマネージャーで複数のインスタンスが起動していないか確認
- 他のアプリケーションが同じホットキーを使用していないか確認

#### アイコンが表示されない
**問題**: アプリケーションアイコンやファビコンが表示されない
**原因**: 
1. アイコン抽出の失敗
2. キャッシュディレクトリへのアクセス権限
**解決策**:
- `%APPDATA%/quickdashlauncher/config/favicons/`ディレクトリの権限を確認
- コンソールログでアイコン抽出エラーを確認

### 依存関係の問題

#### extract-file-iconモジュールエラー
**問題**: アイコン抽出時にモジュールが見つからない
**原因**: ネイティブモジュールの再ビルドが必要
**解決策**:
```bash
npm rebuild extract-file-icon
```

## 関連ドキュメント

- [開発ガイド](development.md) - 基本的な開発情報
- [テストチェックリスト](testing.md) - ビルド後のテスト手順