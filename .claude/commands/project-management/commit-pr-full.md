---
description: "品質チェック・テスト付きコミット・プッシュ・PR作成"
allowed-tools: ["Bash", "TodoWrite", "Task"]
---

# Commit PR Full

変更をコミット・プッシュし、プルリクエストを作成する包括的なコマンドです。
品質チェック、ドキュメント更新、E2Eテストを含む完全なワークフローを実行します。

## 実行内容

### 1. 品質チェック（quality-checker）

**実行内容**：
- TypeScript型チェック（`npm run type-check`）
- ESLintチェック（`npm run lint`）
- コード複雑度の確認
- 命名規則のチェック
- 重複コードの検出
- セキュリティリスクの確認

**結果**：
- 優先度付きレポート生成（Critical/High/Medium/Low）
- 問題が検出された場合、修正を推奨
- Criticalな問題がある場合、コミット前に修正を促す

### 2. ドキュメント更新（documentation-updater）

**実行内容**：
- 変更内容の分析
- 関連ドキュメントの特定
- 複数ドキュメントの一括更新
- ドキュメント間の整合性確認

**対象ドキュメント**：
- 機能追加 → `docs/features/`
- UI変更 → `docs/screens/`
- アーキテクチャ変更 → `docs/architecture/`
- 設定変更 → `docs/setup/`, `docs/features/settings.md`

### 3. E2Eテスト実行（e2e-test-runner）

**実行内容**：
- Playwright E2Eテストの実行（`npm run test:e2e`）
- テスト失敗時の詳細分析
- スクリーンショット・トレース解析
- 失敗原因の特定と修正案の提示

**テスト対象**：
- 基本UI
- アイテム登録・編集
- マルチタブ機能
- 設定機能
- コンテキストメニュー
- ダイアログ機能

### 4. 変更内容の確認

- git status で変更ファイルを確認
- git diff で変更内容を確認
- 最近のコミットメッセージを確認（スタイル参考用）

### 5. コミットメッセージとPR内容の作成

- 変更内容を分析
- 品質チェック結果を考慮
- ドキュメント更新を含める
- テスト結果を反映
- 適切なコミットメッセージを自動生成
- 包括的なPR概要を自動生成

### 6. ユーザー確認

- コミットメッセージを表示
- PR内容を表示
- 品質チェック結果のサマリーを表示
- 実行の承認を求める

### 7. コミット・プッシュ・PR作成

- 変更ファイルを git add
- コミットを作成
- リモートにプッシュ
- PRを作成
- PR URLを表示

## 使用方法

```bash
/commit-pr-full
```

## 処理フロー

```
品質チェック実行（quality-checker）
    ↓
Criticalな問題あり？
    ↓YES → 修正を促して中断
    ↓NO
ドキュメント更新（documentation-updater）
    ↓
E2Eテスト実行（e2e-test-runner）
    ↓
テスト失敗？
    ↓YES → 失敗原因を分析・報告、修正を促す
    ↓NO
git status/diff確認
    ↓
最近のコミット確認
    ↓
コミットメッセージとPR内容を生成
    ↓
ユーザーに確認
    ↓
承認された？
    ↓YES
git add → git commit → git push → gh pr create
    ↓
PR URL表示
```

## コミットメッセージフォーマット

プロジェクトの規則に従って以下の形式で生成します：

```
<type>(<scope>): <subject>

<body>

- 変更点1
- 変更点2
- 変更点3

品質チェック: 合格
ドキュメント: 更新済み
E2Eテスト: 合格

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## PR概要フォーマット

```markdown
## Summary
- 変更の概要（箇条書き）

## 変更内容
### カテゴリ1
- 詳細な変更内容

### カテゴリ2
- 詳細な変更内容

## ドキュメント更新
- 更新されたドキュメント一覧

## 品質チェック結果
- TypeScript型チェック: ✅ 合格
- ESLintチェック: ✅ 合格
- コード品質: ✅ 良好

## テスト結果
- E2Eテスト: ✅ すべて合格（XX件）

## Test plan
- [x] TypeScript型チェック
- [x] ESLint
- [x] E2Eテスト実行
- [x] 動作確認

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## CLAUDE.mdの規則に準拠

### Git操作のルール
- **必ずユーザーに確認を取る** - 勝手にコミット・プッシュしない
- コミットメッセージの内容を事前に提示
- PR概要の内容を事前に提示

### 品質チェック
- コミット・プッシュ前に `quality-checker` を実行
- TypeScript型チェック・ESLint実行
- コード品質の確認

### ドキュメント更新
- 機能追加・変更時に `documentation-updater` を使用
- 関連ドキュメントの自動更新

### E2Eテスト実行
- `e2e-test-runner` でテストを実行
- 失敗時は詳細分析と修正案を提示

## 事前要件

- Gitリポジトリである
- リモートリポジトリ `origin` が設定されている
- GitHub CLI (`gh`) がインストール・認証済み
- Node.js依存関係がインストール済み（`npm install`）
- コミットしていない変更がある
- mainブランチ以外の作業ブランチにいる

## シンプル版との違い

このフル版は以下を**追加で実行します**：
- ✅ TypeScript型チェック
- ✅ ESLintチェック
- ✅ 品質チェック（quality-checker）
- ✅ ドキュメント更新（documentation-updater）
- ✅ E2Eテスト実行（e2e-test-runner）

素早くPRを作成したい場合は、`/commit-pr-simple` を使用してください。

## 実行時間の目安

- **品質チェック**: 約30秒〜1分
- **ドキュメント更新**: 約10〜30秒
- **E2Eテスト**: 約2〜5分（テストケース数による）
- **合計**: 約3〜7分

## 品質チェックで問題が検出された場合

### Criticalな問題
- **処理中断** - コミット前に修正が必要
- 修正後、再度コマンドを実行

### High/Mediumな問題
- **警告表示** - 修正推奨だが、コミット可能
- ユーザーに判断を委ねる

### Lowな問題
- **情報表示** - 将来的な改善点として記録
- コミットは問題なく実行可能

## E2Eテストが失敗した場合

### テスト失敗時の対応
1. **失敗原因の分析**
   - スクリーンショットの確認
   - トレースログの解析
   - エラーメッセージの詳細

2. **修正案の提示**
   - 考えられる原因
   - 推奨される修正方法
   - デバッグ手順

3. **ユーザーの判断**
   - 修正してから再実行
   - または、テスト失敗を承知でコミット（非推奨）

## トラブルシューティング

### エラー: "nothing to commit"
変更がない状態です。ファイルを編集してから実行してください。

### エラー: "npm run type-check failed"
TypeScriptの型エラーがあります。型エラーを修正してから再実行してください。

### エラー: "npm run test:e2e failed"
E2Eテストが失敗しています。テストログを確認して修正してください。

### エラー: "gh: command not found"
GitHub CLIをインストールしてください：
```bash
winget install GitHub.cli
```

### PRが作成されない
GitHub CLIの認証が必要です：
```bash
gh auth login
```

## カスタマイズ

### 品質チェックのスキップ
品質チェックをスキップしたい場合は、`/commit-pr-simple` を使用してください。

### E2Eテストのスキップ
E2Eテストのみをスキップしたい場合は、このファイルを編集してE2Eテストのセクションをコメントアウトしてください。

### ドキュメント更新のスキップ
ドキュメント更新をスキップしたい場合は、このファイルを編集してドキュメント更新のセクションをコメントアウトしてください。

## 例

```bash
# feature/new-feature ブランチで作業中
$ git status
On branch feature/new-feature
Changes not staged for commit:
  modified:   src/renderer/components/ItemList.tsx
  modified:   src/renderer/styles/components/ItemList.css

$ /commit-pr-full
# → 品質チェック実行
# → TypeScript型チェック: ✅ 合格
# → ESLint: ✅ 合格
# → ドキュメント更新実行
# → docs/screens/main-window.md を更新
# → E2Eテスト実行
# → すべてのテスト合格（25件）
# → コミットメッセージとPR概要を生成
# → ユーザーに確認を求める
# → 承認後、コミット・プッシュ・PR作成を実行
# → PR URL表示
```

## 関連コマンド

- `/commit-pr-simple` - シンプル版（品質チェックなし）
- `/commit-and-pr` - 既存のコミット・PR作成コマンド
- `/code-quality:check-typescript` - TypeScript型チェックのみ
- `/code-quality:check-eslint` - ESLintチェックのみ
- `/test:e2e` - E2Eテストのみ
