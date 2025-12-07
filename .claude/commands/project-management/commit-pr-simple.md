---
description: "シンプルなコミット・プッシュ・PR作成"
allowed-tools: ["Bash", "TodoWrite"]
---

# Commit PR Simple

変更をコミット、プッシュし、プルリクエストを作成するシンプルなコマンドです。
品質チェックやドキュメント更新は行わず、素早くPRを作成したい場合に使用します。

**重要**: このコマンドは**ユーザー承認なし**で自動的にコミット・プッシュ・PR作成を実行します。
慎重な確認が必要な場合は、`/commit-pr-full` を使用してください。

## 実行内容

1. **現在の状態確認**
   - git status で変更ファイルを確認
   - git diff で変更内容を確認
   - 最近のコミットメッセージを確認（スタイル参考用）

2. **コミットメッセージとPR内容の作成**
   - 変更内容を分析
   - 適切なコミットメッセージを自動生成
   - PR概要を自動生成

3. **コミット実行（承認不要）**
   - 変更ファイルを git add
   - コミットを作成

4. **プッシュ実行**
   - 現在のブランチをリモートにプッシュ
   - upstream設定も同時に行う

5. **PR作成**
   - GitHub CLIを使用してPRを作成
   - PR URLを表示

## 使用方法

```bash
/commit-pr-simple
```

## コミットメッセージフォーマット

プロジェクトの規則に従って以下の形式で生成します：

```
<type>(<scope>): <subject>

<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### プレフィックス
- `feat`: 新機能追加
- `fix`: バグ修正
- `refactor`: リファクタリング
- `docs`: ドキュメント更新
- `test`: テスト追加・修正
- `style`: コードスタイル修正
- `chore`: その他の作業

### スコープ例
- `ui`: UI関連
- `e2e`: E2Eテスト
- `data`: データ処理
- `ipc`: IPC通信
- `window`: ウィンドウ管理

## PR概要フォーマット

```markdown
## Summary
- 変更の概要（箇条書き）

## 変更内容
### カテゴリ1
- 詳細な変更内容

### カテゴリ2
- 詳細な変更内容

## Test plan
- [x] テスト項目1
- [x] テスト項目2

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 処理フロー

```
git status/diff確認
    ↓
最近のコミット確認
    ↓
コミットメッセージとPR内容を生成
    ↓
git add → git commit → git push → gh pr create
    ↓
PR URL表示
```

**注意**: ユーザー承認なしで自動実行されます。

## 注意事項

### 承認不要モード
- **このコマンドはユーザー承認なしで自動実行されます**
- コミット・プッシュ・PR作成が即座に行われます
- 慎重な確認が必要な場合は `/commit-pr-full` を使用してください

### 安全性チェック
- mainブランチでは実行しない（警告を表示して中断）
- 変更がない場合は実行しない
- 基本的な妥当性チェックのみ実行

### コミットメッセージの品質
- 変更内容を適切に分析してプレフィックスを選択
- 簡潔で分かりやすいサブジェクトを生成
- 詳細な変更内容をボディに記載
- HEREDOCを使用して正しくフォーマット

## 事前要件

- Gitリポジトリである
- リモートリポジトリ `origin` が設定されている
- GitHub CLI (`gh`) がインストール・認証済み
- コミットしていない変更がある
- mainブランチ以外の作業ブランチにいる

## フル版との違い

このシンプル版は以下を**実行しません**：
- TypeScript型チェック
- ESLintチェック
- 品質チェック（quality-checker）
- ドキュメント更新（documentation-updater）
- E2Eテスト実行（e2e-test-runner）

品質チェックやテストを含めたい場合は、`/commit-pr-full` を使用してください。

## トラブルシューティング

### エラー: "nothing to commit"
変更がない状態です。ファイルを編集してから実行してください。

### エラー: "failed to push"
リモートブランチとの同期が必要です：
```bash
git pull origin $(git branch --show-current)
```

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

## 例

```bash
# fix/ui-improvement ブランチで作業中
$ git status
On branch fix/ui-improvement
Changes not staged for commit:
  modified:   src/renderer/styles/components/ItemList.css

$ /commit-pr-simple
# → 変更を分析
# → コミットメッセージとPR概要を生成
# → 即座にコミット・プッシュ・PR作成を実行（承認不要）
# → PR URL表示
```
