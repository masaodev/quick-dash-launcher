---
description: "GitHub Issueを作成"
allowed-tools: ["Bash", "TodoWrite"]
---

# Create Issue

GitHub Issueを対話的に作成するコマンドです。

## 実行内容

1. **Issue情報の収集**
   - タイトルの入力
   - 説明文の入力
   - ラベルの選択（オプション）
   - 優先度の設定（オプション）

2. **GitHub Issue作成**
   ```bash
   !gh issue create --title "$TITLE" --body "$BODY" $LABELS
   ```

3. **作成されたIssueのURL表示**

## 使用方法

### 基本的な使用
```
/create-issue
```

### 引数付きでの使用
```
/create-issue "バグ修正: ログイン機能が動作しない" "ログイン画面で認証エラーが発生する問題を修正する"
```

### ラベル付きでの使用
```
/create-issue "新機能: ダークモード対応" "アプリケーションにダークモードを追加する" --label="enhancement,ui"
```

## 引数

- `$1` (オプション): Issue タイトル
- `$2` (オプション): Issue 本文
- `--label` (オプション): カンマ区切りのラベル一覧

## 事前要件

- `gh` (GitHub CLI) がインストールされている
- GitHub リポジトリで認証済み
- 現在のディレクトリがGitリポジトリである

## 例

```bash
# 対話形式でIssue作成
/create-issue

# タイトルのみ指定
/create-issue "DIRディレクティブの改善"

# タイトルと本文を指定
/create-issue "バグ修正" "ファイル読み込み時にエラーが発生する"

# ラベル付きで作成
/create-issue "新機能提案" "設定画面の追加" --label="enhancement,feature"
```