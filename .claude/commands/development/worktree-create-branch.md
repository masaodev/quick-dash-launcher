---
description: "ワークツリー環境でリモートのmainから新しいブランチを作成"
allowed-tools: ["Bash", "TodoWrite", "AskUserQuestion"]
---

# Worktree Create Branch

ワークツリー環境で、リモートのmainブランチから新しい作業用ブランチを作成するコマンドです。

## 実行内容

1. **現在のブランチとステータス確認**
   ```bash
   !git branch --show-current
   !git status --short
   ```

2. **未コミットの変更がある場合**
   - 警告を表示して処理を中断
   - ユーザーにコミットまたはスタッシュを促す

3. **リモートの最新情報取得**
   ```bash
   !git fetch origin
   ```

4. **新しいブランチ作成**
   ```bash
   !git checkout -b $BRANCH_NAME origin/main
   ```

5. **ブランチ作成確認**
   ```bash
   !git branch --show-current
   !git log -1 --oneline
   ```

## 使用方法

### ブランチ名を指定して使用
```
/worktree-create-branch feature/new-settings-page
```

### ブランチ名を指定せずに使用
```
/worktree-create-branch
```
ブランチ名を対話式で質問します。

## 引数

- `$1` (オプション): 新しいブランチ名
  - 指定されていない場合は対話式で質問

## ブランチ命名規則

推奨されるブランチ名のプレフィックス：
- `feature/` - 新機能追加
- `fix/` - バグ修正
- `refactor/` - リファクタリング
- `docs/` - ドキュメント更新
- `test/` - テスト追加・修正
- `chore/` - その他の作業

## 動作フロー

```
現在のステータス確認
    ↓
未コミットの変更あり？
    ↓YES → 警告表示 → 処理中断
    ↓NO
リモート情報取得（git fetch origin）
    ↓
ブランチ名取得（引数 or 質問）
    ↓
新ブランチ作成（origin/mainから）
    ↓
確認表示
```

## 例

### パターン1: ブランチ名指定
```bash
$ /worktree-create-branch feature/user-preferences
# → リモートのmainからfeature/user-preferencesブランチを作成
```

### パターン2: 対話式でブランチ名を決定
```bash
$ /worktree-create-branch
# → ブランチ名を質問
# → 入力されたブランチ名でリモートmainからブランチ作成
```

## ワークツリー環境での利点

このコマンドは以下の理由でワークツリー環境に最適化されています：

1. **ローカルmainへの切り替え不要**
   - `git checkout main` を実行しない（他のワークツリーでmainが使用中でもOK）
   - `origin/main` を直接参照してブランチ作成

2. **リモート最新状態の保証**
   - 常にリモートの最新mainから作成
   - ローカルmainの同期状態に依存しない

3. **安全性チェック**
   - 未コミットの変更がある場合は処理を中断
   - ブランチ作成後の確認表示

## 通常のGitリポジトリでの使用

ワークツリー環境でなくても使用可能です。常にリモートのmainから新しいブランチを作成したい場合に便利です。

## 安全性チェック

このコマンドは以下の安全性チェックを実行します：
- 作業ツリーがクリーンかどうかの確認（未コミット変更のチェック）
- リモート情報の最新化（git fetch）
- ブランチ作成後の確認表示
- ブランチ名の重複チェック（既存の場合はgitコマンドがエラー）

## 事前要件

- 現在のディレクトリがGitリポジトリである
- リモートリポジトリ `origin` が設定されている
- 作業ツリーがクリーンであること（未コミット変更がないこと）

## 注意事項

- 未コミットの変更がある場合は、事前にコミットまたはスタッシュしてください
- ブランチ名に日本語や特殊文字は使用しないでください
- ワークツリー環境では、同じブランチ名を複数のワークツリーでチェックアウトできません

## トラブルシューティング

### エラー: "fatal: A branch named 'XXX' already exists"
既にそのブランチ名が存在しています。別のブランチ名を使用してください。

### エラー: "error: Your local changes to the following files would be overwritten"
未コミットの変更があります。以下のいずれかを実行してください：
```bash
# 変更をコミット
git add .
git commit -m "作業中の変更"

# または、変更を一時退避
git stash
```

### 他のワークツリーでブランチが使用中の場合
```bash
# ワークツリー一覧を確認
git worktree list

# 不要なワークツリーを削除
git worktree remove /path/to/worktree
```
