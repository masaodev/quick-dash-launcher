---
description: "変更のコミット、プッシュ、PR作成を一括実行"
allowed-tools: ["Bash", "TodoWrite", "AskUserQuestion"]
---

# Commit and PR

現在の変更をコミット、プッシュし、mainブランチへのプルリクエストを作成するコマンドです。

## 実行内容

1. **現在の状態確認**
   ```bash
   !git branch --show-current
   !git status
   !git diff
   ```

2. **変更内容の分析**
   - git statusとgit diffの結果を確認
   - コミットメッセージとPR概要を自動生成
   - ユーザーに確認を求める

3. **コミット実行**
   ```bash
   !git add .
   !git commit -m "$COMMIT_MESSAGE"
   ```

4. **プッシュ実行**
   ```bash
   !git push -u origin $CURRENT_BRANCH
   ```

5. **PR作成**
   ```bash
   !gh pr create --title "$PR_TITLE" --body "$PR_BODY"
   ```

## 使用方法

### 基本的な使用
```
/commit-and-pr
```

現在の変更を自動的に分析し、適切なコミットメッセージとPR概要を生成して、ユーザーに確認を求めます。

## コミットメッセージの自動生成

以下の規則に従ってコミットメッセージを生成します：

### プレフィックス
- `feat:` - 新機能追加
- `fix:` - バグ修正
- `refactor:` - リファクタリング
- `docs:` - ドキュメント更新
- `test:` - テスト追加・修正
- `chore:` - その他の作業

### フォーマット
```
<type>: <subject>

<body>

- <変更点1>
- <変更点2>
- <変更点3>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## PR概要の自動生成

以下の形式でPR概要を生成します：

```markdown
## Summary
- <変更の概要>

## 詳細
- <詳細な変更内容1>
- <詳細な変更内容2>

## Test plan
- [ ] <テスト項目1>
- [ ] <テスト項目2>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## 動作フロー

```
現在のブランチとステータス確認
    ↓
変更内容を確認（git diff）
    ↓
コミットメッセージとPR概要を自動生成
    ↓
ユーザーに確認を求める
    ↓
承認された？
    ↓YES → コミット → プッシュ → PR作成 → 完了
    ↓NO  → 処理中断
```

## 確認事項

このコマンドは実行前に以下を確認します：

1. **現在のブランチ**
   - mainブランチでないことを確認
   - 作業ブランチであることを確認

2. **変更内容**
   - git statusで変更ファイルを確認
   - git diffで変更内容を確認

3. **コミットメッセージとPR内容**
   - 生成されたコミットメッセージを表示
   - 生成されたPR概要を表示
   - ユーザーに承認を求める

## 安全性チェック

- mainブランチでは実行しない（警告を表示）
- 変更がない場合は実行しない
- コミット・プッシュ前に必ずユーザーに確認
- PR作成後にURLを表示

## 事前要件

- 現在のディレクトリがGitリポジトリである
- リモートリポジトリ `origin` が設定されている
- GitHub CLI (`gh`) がインストール・認証済みである
- mainブランチ以外の作業ブランチにいる
- コミットしていない変更がある

## 例

### パターン1: 通常の使用
```bash
# feature/new-feature ブランチで作業中
$ git status
On branch feature/new-feature
Changes not staged for commit:
  modified:   src/components/Button.tsx

$ /commit-and-pr
# → 変更を分析
# → コミットメッセージとPR概要を生成
# → ユーザーに確認を求める
# → 承認後、コミット・プッシュ・PR作成を実行
```

### パターン2: mainブランチでの実行（エラー）
```bash
$ git branch --show-current
main

$ /commit-and-pr
# → エラー: mainブランチでは実行できません
```

## 注意事項

### コミット前の確認
- **必ずユーザーに確認を取る** - 勝手にコミット・プッシュしない
- コミットメッセージの内容を事前に提示
- PR概要の内容を事前に提示

### コミットメッセージ
- 変更内容を適切に分析してプレフィックスを選択
- 簡潔で分かりやすいサブジェクトを生成
- 詳細な変更内容をボディに記載

### PR概要
- 変更の概要を明確に記載
- テスト計画を含める
- 必要に応じてスクリーンショットや追加情報を含める

### ブランチ命名
- PR作成時、ブランチ名から変更内容を推測
- 適切なラベルやマイルストーンを提案（可能な場合）

## トラブルシューティング

### エラー: "nothing to commit, working tree clean"
変更がない状態です。ファイルを編集してから実行してください。

### エラー: "failed to push some refs"
リモートブランチとの同期が必要です：
```bash
git pull origin $(git branch --show-current)
```

### エラー: "gh: command not found"
GitHub CLIがインストールされていません：
```bash
# Windows (winget)
winget install GitHub.cli

# または、https://cli.github.com/ からダウンロード
```

### PRが作成されない
GitHub CLIの認証が必要です：
```bash
gh auth login
```

## カスタマイズ

コミットメッセージやPR概要のフォーマットをカスタマイズしたい場合は、このファイルを編集してください。

### コミットメッセージのカスタマイズ
- プレフィックスルールの変更
- ボディのフォーマット変更
- フッター情報の追加・削除

### PR概要のカスタマイズ
- セクションの追加・削除
- テンプレートの変更
- ラベルやレビュアーの自動設定
