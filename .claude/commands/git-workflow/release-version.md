---
description: '新バージョンのリリース（ベータ版・正式版のタグ作成とプッシュ）'
argument-hint: '[beta|stable] [--yes]'
allowed-tools: ['Bash', 'Read', 'Edit', 'TodoWrite', 'AskUserQuestion']
---

# Release Version

新バージョンのリリースを行うコマンドです。バージョン番号の更新、コミット、タグ作成、プッシュを自動化します。

**指定されたモード**: `$ARGUMENTS`

## リリースの種類

細かい変更はベータ版として出し、ある程度まとまったところで正式版を出す（仕組み＝[ビルドとデプロイ](../../../docs/setup/build-deploy.md)「正式版とベータ版」）。

| モード                   | 例                          | 内容                                                           |
| ------------------------ | --------------------------- | -------------------------------------------------------------- |
| `beta`（引数なしも同じ） | 0.8.0-beta.1 → 0.8.0-beta.2 | 次のベータ版。GitHub ではプレリリースになり、winget には出ない |
| `stable`                 | 0.8.0-beta.2 → 0.8.0        | ベータ版を正式版にする。winget は自動更新ボットが反映する      |

### 次のバージョン番号の決め方

- **今がベータ版（`X.Y.Z-beta.N`）で `beta`**: `X.Y.Z-beta.(N+1)`
- **今が正式版（`X.Y.Z`）で `beta`**: 次の正式版の番号を決めて `-beta.1` を付ける。既定は次のマイナー（`X.(Y+1).0-beta.1`）。バグ修正だけの見込みならパッチ（`X.Y.(Z+1)-beta.1`）、破壊的変更ならメジャー。`--yes` でなければユーザーに確認する
- **今がベータ版で `stable`**: `-beta.N` を外した `X.Y.Z`
- **今が正式版で `stable`**: ベータ版を挟まずに正式版を出すことになるので、ユーザーに確認する（番号の決め方は上と同じ）

### オプション

- `--yes`: すべての確認をスキップして自動実行（CI/CD向け）

## 実行内容

1. **現在のバージョン確認**
   - `package.json` から現在のバージョンを取得
   - 既存のGitタグと、直前の正式版のタグ（`-` を含まない最新の `v*`）を確認

2. **バージョン番号の決定**
   - 上の「次のバージョン番号の決め方」に従う

3. **リリースノートの作成**
   - ベータ版: 前のタグ（ベータ版でも正式版でも）からのコミット（`git log v{prev}..HEAD --oneline`）を元に書く
   - 正式版: **前の正式版から**のコミット（`git log v{prevStable}..HEAD --oneline`）を元に、ベータ版の分も含めてまとめて書く
   - どちらも「## 更新内容」の下に、変更点を機能単位でまとめる（コミットの羅列にしない。ファイル形式の変更・自動移行・注意事項があれば必ず書く）
   - `--yes` でなければユーザーに本文を確認してもらう（`--yes` のときは書いた本文をそのまま使う）
   - 本文は注釈付きタグのメッセージになり、GitHub Release の本文に使われる
     （`release.yml` がタグ本文を取り出し、インストール方法・ライセンス節を末尾に付ける）

4. **バージョン更新**
   - `npm version {version} --no-git-tag-version` で `package.json` と `package-lock.json` を更新
   - 変更をコミット

5. **タグ作成とプッシュ**
   - `v{version}` 形式の**注釈付き**Gitタグを作成（1 行目 `v{version}`、空行、本文）
   - `--cleanup=verbatim` を必ず付ける（無いと `#` で始まる見出し行がコメントとして削られる）
   - メインブランチとタグをリモートにプッシュ

6. **GitHub Actionsによる自動ビルド**
   - タグのプッシュによりGitHub Actionsが自動実行される
   - ビルドとリリースが自動的に作成される（本文はタグのメッセージから。タグに `-` があればプレリリース）

7. **正式版にするかの確認（ベータ版のとき）**
   - 直前の正式版から何本のベータ版が出ているかと、その間の主な変更を短く示し、そろそろ正式版にするかをユーザーに尋ねる（毎回でなくてよい。テーマが一区切りついたとき・ベータ版が何本かたまったときに）

## 事前要件

- 現在のブランチが `main` である
- すべての変更がコミット済みである（クリーンな状態）
- リモートリポジトリへのプッシュ権限がある
- GitHub Actionsが正しく設定されている

## 処理フロー

```bash
# 1. 現在のバージョンと直前の正式版を確認
node -p "require('./package.json').version"
git tag --list 'v*' --sort=-v:refname | head
git tag --list 'v*' --sort=-v:refname | grep -v -- '-' | head -1   # 直前の正式版

# 2. リリースノート本文を書く（作業用の一時ファイル。リポジトリには入れない）
git log v{prev}..HEAD --oneline          # ベータ版
git log v{prevStable}..HEAD --oneline    # 正式版
#   → 1 行目 v{version}、空行、本文（## 更新内容 …）の順で notes.md に書く

# 3. バージョン更新
npm version {version} --no-git-tag-version

# 4. コミット
git add package.json package-lock.json
git commit -m "chore: v{version}リリース準備 - バージョン更新"

# 5. 注釈付きタグ作成とプッシュ（--cleanup=verbatim で # 見出し行を保つ）
git tag -a v{version} --cleanup=verbatim -F notes.md
git push origin main
git push origin v{version}

# 確認: 本文がタグに入っているか
git tag -l --format='%(contents:body)' v{version}
```

## リリース後の確認

1. **GitHub Actionsの確認**
   - リポジトリの「Actions」タブでビルド状況を確認
   - ビルドが成功していることを確認

2. **リリースの確認**
   - リポジトリの「Releases」ページで新しいリリースを確認
   - インストーラーファイルが添付されていること、ベータ版ならプレリリース・正式版なら Latest になっていることを確認

3. **winget の確認（正式版のとき）**
   - 半日〜1 日後に `winget show masaodev.quick-dash-launcher` で版が上がっているか確認（すぐには反映されない）

## トラブルシューティング

### タグが既に存在する

**エラー**: `tag 'v0.2.7' already exists`
**原因**: 同じバージョンのタグが既に作成されている
**解決策**:

- バージョン番号を確認し、次のバージョンを使用する
- または既存のタグを削除する（推奨しない）

### プッシュが失敗する

**エラー**: プッシュ時の認証エラー
**原因**: リモートリポジトリへの権限不足
**解決策**:

- GitHubの認証情報を確認
- プッシュ権限があることを確認

### GitHub Actionsが実行されない

**原因**: ワークフロー設定の問題
**解決策**:

- `.github/workflows/` 配下のワークフローファイルを確認
- タグプッシュをトリガーとする設定があるか確認

## 関連ドキュメント

- [ビルドとデプロイ](../../../docs/setup/build-deploy.md) - ビルドシステム・リリースノート・正式版とベータ版・winget
- [開発ガイド](../../../docs/setup/development.md) - 開発プロセス全般

## 例

```bash
# 次のベータ版（0.8.0-beta.1 → 0.8.0-beta.2）
/release-version beta

# 正式版のあとの最初のベータ版（0.8.0 → 0.9.0-beta.1。番号は確認される）
/release-version beta

# ベータ版を正式版にする（0.8.0-beta.2 → 0.8.0）
/release-version stable

# 確認なしで次のベータ版（CI/CD向け）
/release-version beta --yes
```
