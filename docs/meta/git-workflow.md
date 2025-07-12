# Git ワークフローとリモートリポジトリ連携

このドキュメントは、Git操作のベストプラクティス、ブランチ戦略、PR/MRテンプレート、CI/CD設定等を記録します。

## Git操作のベストプラクティス

### コミットメッセージ
- 日本語での記述を推奨（プロジェクトの性質上）
- 変更内容を簡潔に記述
- 例: 
  - `アイコン抽出機能を改善`
  - `WSL2環境でのビルド手順を追加`
  - `依存関係からwindows-shortcutsを削除`

### ブランチ戦略
- `main`: 安定版（本番リリース用）
- `feature/*`: 新機能開発
- `fix/*`: バグ修正
- `docs/*`: ドキュメント更新

### コミット前のチェック
```bash
# TypeScriptの型チェック
npm run typecheck

# Lintチェック（設定されている場合）
npm run lint

# ビルドの確認
npm run build
```

## プルリクエスト（PR）テンプレート

```markdown
## 概要
[変更内容の簡潔な説明]

## 変更内容
- [ ] 機能追加/修正の詳細
- [ ] 影響を受けるファイル

## テスト
- [ ] ローカルでビルド確認
- [ ] 主要機能の動作確認
- [ ] 新機能のテスト

## チェックリスト
- [ ] コードはプロジェクトのスタイルに従っている
- [ ] 必要なドキュメントを更新した
- [ ] 破壊的変更がない（ある場合は説明を追加）
```

## GitHub Actions（将来的な実装案）

### 自動ビルドワークフロー
```yaml
name: Build and Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - run: npm ci
    - run: npm run build
    - run: npm test  # テストが追加されたら
```

### リリースワークフロー
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    
    - run: npm ci
    - run: npm run dist
    
    - name: Create Release
      uses: actions/create-release@v1
      # ... リリース設定
```

## 開発フロー

1. **Issue作成**: 実装する機能やバグの詳細を記載
2. **ブランチ作成**: `feature/issue-番号-機能名`
3. **開発**: コミットはこまめに、意味のある単位で
4. **PR作成**: テンプレートに従って記載
5. **レビュー**: フィードバックに基づいて修正
6. **マージ**: mainブランチへマージ

## セキュリティ考慮事項

### 機密情報の取り扱い
- APIキー、トークンをコミットしない
- 設定ファイルは`.gitignore`に追加
- 環境変数で管理

### 依存関係の管理
- 定期的に`npm audit`を実行
- 脆弱性が見つかったら速やかに更新

## 関連ドキュメント

- [開発ガイド](../guides/development.md) - 基本的な開発プロセス
- [ビルドとデプロイ](../guides/build-and-deploy.md) - ビルドシステムと配布方法