---
description: "ブランチ確認と新規ブランチ作成"
allowed-tools: ["Bash", "TodoWrite"]
---

# Prepare Branch

現在のブランチ状況を確認し、新しい作業用ブランチを安全に作成するコマンドです。

## 実行内容

1. **現在のブランチ状況確認**
   ```bash
   !git branch --show-current
   !git status
   ```

2. **最新情報の取得**
   ```bash
   !git fetch origin
   !git pull origin main
   ```

3. **新規ブランチ作成**
   ```bash
   !git checkout -b $BRANCH_NAME
   ```

4. **ブランチ作成確認**
   ```bash
   !git branch --show-current
   ```

## 使用方法

### 基本的な使用
```
/prepare-branch feature/new-feature
```

### プレフィックス付きでの使用
```
/prepare-branch fix/bug-description
/prepare-branch refactor/code-cleanup
```

## 引数

- `$1` (必須): 新しいブランチ名

## ブランチ命名規則

推奨されるブランチ名のプレフィックス：
- `feature/` - 新機能追加
- `fix/` - バグ修正
- `refactor/` - リファクタリング
- `docs/` - ドキュメント更新
- `test/` - テスト追加・修正
- `chore/` - その他の作業

## 事前要件

- 現在のディレクトリがGitリポジトリである
- リモートリポジトリ `origin` が設定されている
- 作業ツリーがクリーンである（未コミットの変更がない）

## 例

```bash
# 新機能開発用ブランチ
/prepare-branch feature/display-settings-removal

# バグ修正用ブランチ
/prepare-branch fix/settings-modal-error

# リファクタリング用ブランチ
/prepare-branch refactor/settings-component
```

## 安全性チェック

このコマンドは以下の安全性チェックを自動実行します：
- 現在がmainブランチかどうかの確認
- 作業ツリーがクリーンかどうかの確認
- リモートとの同期状況の確認
- ブランチ名の重複チェック