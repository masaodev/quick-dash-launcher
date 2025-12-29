---
description: "新機能開発を開始（ブランチ作成）"
allowed-tools: ["Bash", "TodoWrite", "AskUserQuestion"]
---

# Start Branch

新しい機能開発を開始するコマンドです。
現在の状況を確認し、必要に応じて新しい作業用ブランチを作成します。

## 実行内容

### 1. 現在の状況確認
```bash
!git branch --show-current
!git status
```

### 2. 未コミットの変更チェック
- 未コミットの変更がある場合は警告を表示
- コミットまたはスタッシュを促す

### 3. ブランチ作成の判断

#### メインブランチ（main/master）にいる場合
→ 新しいブランチを作成します

#### 作業ブランチにいる場合
→ 現在のブランチで作業を継続することを確認

### 4. 新規ブランチ作成（メインブランチの場合）

#### ステップ1: ブランチ名の決定
- 引数で指定されている場合: そのブランチ名を使用
- 指定されていない場合: 対話式でブランチ名を質問

#### ステップ2: 最新情報の取得
```bash
!git fetch origin
```

#### ステップ3: ブランチ作成
リモートのmainから直接ブランチを作成します（ワークツリー環境でも安全）：
```bash
!git checkout -b $BRANCH_NAME origin/main
```

または、ローカルmainが最新の場合：
```bash
!git pull origin main  # ローカルmainを更新
!git checkout -b $BRANCH_NAME
```

#### ステップ4: 作成確認
```bash
!git branch --show-current
!git log -1 --oneline
```

---

## 使用方法

### ブランチ名を指定
```bash
/start-branch feature/new-settings-page
```

### ブランチ名を対話式で決定
```bash
/start-branch
```
メインブランチにいる場合、新しいブランチ名を質問します。

---

## 引数

- `$1` (オプション): 新しいブランチ名
  - メインブランチにいて、この引数が指定されていない場合は対話式で質問
  - 既に作業ブランチにいる場合は不要

---

## ブランチ命名規則

推奨されるブランチ名のプレフィックス：

### 機能追加
- `feature/` - 新機能追加
- `feat/` - feature の省略形

### バグ修正
- `fix/` - バグ修正
- `bugfix/` - 明示的なバグ修正

### その他
- `refactor/` - リファクタリング
- `docs/` - ドキュメントのみの変更
- `test/` - テスト追加・修正
- `chore/` - ビルド・設定変更

### 日付ベース（推奨）
```
fix/YYYYMMDD-1
fix/YYYYMMDD-2
```

**例:**
```bash
/start-branch feature/add-dark-mode
/start-branch fix/20250115-search-bug
/start-branch refactor/simplify-state-management
```

---

## ワークフロー例

### 例1: メインブランチから新機能開始
```bash
# 現在: main ブランチ
$ /start-branch feature/new-ui

→ origin/main から feature/new-ui を作成
→ feature/new-ui にチェックアウト
→ 開発開始！
```

### 例2: 既に作業ブランチにいる場合
```bash
# 現在: feature/my-work ブランチ
$ /start-branch

→ 既に作業ブランチにいます
→ このまま作業を継続しますか？
```

### 例3: 未コミット変更がある場合
```bash
# 現在: main ブランチ、未コミット変更あり
$ /start-branch feature/new-feature

→ 警告: 未コミットの変更があります
→ 先にコミットまたはスタッシュしてください
```

---

## 環境別の動作

### 通常の環境
- ローカルmainを最新にpullしてからブランチ作成
- 安全で分かりやすい

### ワークツリー環境
- origin/mainから直接ブランチ作成
- ローカルmainが存在しない環境でも動作

このコマンドは**両方の環境に対応**します。

---

## 注意事項

### ブランチ作成前の確認事項
- ✅ 現在の作業がコミット済みか確認
- ✅ 正しいメインブランチ（main/master）にいるか確認
- ✅ ブランチ名が適切か確認（命名規則に従う）

### 作業ブランチにいる場合
- 新しいブランチを作成する必要はありません
- そのまま作業を継続してください
- 別の機能を開始したい場合は、先に現在の作業をコミット・PRしてください

### 未コミット変更がある場合
以下のいずれかを実行してから再度 `/start-branch` を実行：

```bash
# オプション1: コミット
git add .
git commit -m "WIP: 作業中"

# オプション2: スタッシュ
git stash push -m "一時保存"
```

---

## トラブルシューティング

### ブランチ名が既に存在する
```bash
error: A branch named 'feature/xxx' already exists
```
→ 別のブランチ名を使用してください

### リモート接続エラー
```bash
fatal: unable to access 'https://github.com/...': Could not resolve host
```
→ ネットワーク接続を確認してください

### メインブランチがローカルにない（ワークツリー環境）
→ 問題ありません。origin/main から直接作成します

---

## 次のステップ

ブランチ作成後：

1. **コード変更**: 機能を実装
2. **コミット**: 適切なタイミングでコミット
3. **PR作成**: `/commit-pr` でPR作成
4. **レビュー**: PRレビューを受ける
5. **マージ**: 承認後にマージ
