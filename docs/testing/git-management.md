# Git管理方針 - テストフィクスチャ

テストフィクスチャファイルのGit管理方針について説明します。

## 管理方針の概要

テストフィクスチャは、何をGitで管理し、何を除外するかを明確に区別することで、リポジトリを必要最小限のファイルで構成し、テストの再現性と保守性を向上させます。

## Git管理対象ファイル（コミットする）

### 1. テンプレートファイル（必須）

これらのファイルはテストの基礎となるため、**必ず管理対象**とします。

```
tests/e2e/
└── templates/                  # E2Eテスト用テンプレート（目的別）
    ├── base/                  # 基本テンプレート
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する
    ├── with-tabs/            # タブ機能テスト用
    │   ├── data.txt          ✅ 管理する
    │   ├── data2.txt         ✅ 管理する
    │   └── settings.json     ✅ 管理する
    ├── empty/                # 空データテスト用
    │   └── data.txt          ✅ 管理する
    ├── with-groups/          # グループ機能テスト用
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する
    ├── with-backup/          # バックアップ機能テスト用
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する
    ├── custom-hotkey/        # カスタムホットキーテスト用
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する
    ├── with-folder-import/   # フォルダ取込テスト用
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する
    └── first-launch/         # 初回起動テスト用
        └── data.txt          ✅ 管理する
```

**理由:**
- テストで使用する標準的なデータセット
- 目的別に完全な設定セットとして管理
- チーム全体で共有すべき再利用可能なテンプレート
- バージョン管理により変更履歴を追跡できる

### 2. 開発用テンプレート

各テンプレートフォルダの初期ファイルは管理対象とします。

```
tests/fixtures/
└── dev/                       # 開発用テンプレート
    ├── README.md             ✅ 管理する
    ├── minimal/
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する（テンプレート）
    ├── full-featured/
    │   ├── data.txt          ✅ 管理する
    │   └── settings.json     ✅ 管理する（テンプレート）
    └── （他のテンプレートも同様）
```

**理由:**
- 開発時の初期状態として必要
- どのようなデータで開発・テストしているかを明示
- チーム全体で同じテンプレートを共有できる

### 3. Git管理用プレースホルダーファイル

空ディレクトリをGitで管理するためのファイルです。

```
tests/e2e/
└── configs/                  # E2Eテスト実行時の一時ディレクトリ
    ├── .gitignore           ✅ 管理する
    └── .gitkeep             ✅ 管理する
```

**理由:**
- configs/ディレクトリ自体は必要（.gitkeep）
- 自動生成ファイルを除外する設定（.gitignore）
- テスト実行時に一時ディレクトリとして利用

### 4. ドキュメント・説明ファイル

```
tests/fixtures/
├── README.md                 ✅ 管理する
└── .gitignore                ✅ 管理する
```

**理由:**
- テストフィクスチャの使い方を説明
- チームメンバーへの情報共有

---

## Git管理対象外ファイル（除外する）

### 1. E2Eテスト用の一時ディレクトリ

E2Eテスト実行時に自動生成される一時ディレクトリは**除外**します。

```
tests/e2e/
└── configs/
    └── .temp/               ❌ 除外（テスト実行時に自動生成）
        ├── <testId>/        # テストごとに作成される一時ディレクトリ
        │   ├── data.txt
        │   ├── data2.txt
        │   └── settings.json
        └── ...
```

**理由:**
- テスト実行時にフィクスチャが自動的に作成
- テスト成功時は自動削除、失敗時のみデバッグ用に残る
- 各テストが独立した一時ディレクトリを使用
- テンプレートから設定ファイルがコピーされるため、Git管理不要

### 2. アイコン関連フォルダ（開発用テンプレート）

開発用テンプレートで自動生成されるアイコンフォルダは**除外**します。

```
tests/dev/
└── */
    ├── icons/                ❌ 除外（自動生成）
    ├── favicons/             ❌ 除外（自動生成）
    └── custom-icons/         ❌ 除外（自動生成）
```

**理由:**
- アプリ起動時にアイコン取得機能で自動生成される
- バイナリファイルでサイズが大きい
- 環境依存（ネットワーク状況、実行タイミング）で内容が変わる

### 3. バックアップフォルダ（開発用テンプレート）

開発用テンプレートで作成されるバックアップは**除外**します。

```
tests/dev/
└── */
    └── backup/               ❌ 除外（アプリ実行時に作成）
```

**理由:**
- アプリ実行時の一時ファイル
- 実行ごとに内容が変わる
- リポジトリに含める必要がない

---

## .gitignoreの設定

### プロジェクトルートの.gitignore

```gitignore
# Test results
test-results/
playwright-report/

# E2Eテスト実行時の一時ディレクトリ
tests/e2e/configs/.temp/

# 開発用テンプレートで自動生成されるファイル
tests/dev/*/icons/
tests/dev/*/favicons/
tests/dev/*/custom-icons/
tests/dev/*/backup/
```

### tests/e2e/configs/.gitignore

```gitignore
# E2Eテスト用configs/ - 一時ディレクトリとして扱う
# テスト実行時に一時ディレクトリ内に設定ファイルが自動生成されます

# configs/配下のすべてのファイルとディレクトリを除外
*

# ただし、.gitkeepとこの.gitignore自体は追跡する
!.gitignore
!.gitkeep

# .temp/ 配下のすべて（失敗したテストの一時ディレクトリ）を除外
.temp/
```

**注意**:
- E2Eテスト用の一時ファイルは`configs/.temp/`で管理され、自動的に除外されます
- 開発用テンプレート（`tests/dev/`）の`settings.json`は管理対象（テンプレートとして）です

---

## 管理方針の判断基準

ファイルをGitで管理するかどうかは、以下の基準で判断してください：

| 基準 | 管理する ✅ | 除外する ❌ |
|------|-----------|-----------|
| **生成方法** | 手動で作成・編集 | 自動生成 |
| **再現性** | 常に同じ内容 | 実行ごとに変わる |
| **必要性** | テスト実行に必須 | 実行時に自動作成可能 |
| **共有** | チーム全体で共有すべき | 開発者ごとに異なる |
| **ファイルサイズ** | 小さい（テキスト） | 大きい（バイナリ） |
| **バージョン管理** | 変更履歴を追跡したい | 追跡不要 |

---

## ベストプラクティス

### 1. テンプレートの活用

設定ファイルは目的別テンプレートとして管理します：

```typescript
// ✅ 良い例：目的別テンプレートを使用
test.beforeEach(async ({ configHelper }) => {
  configHelper.loadTemplate('with-tabs');
});
```

### 2. 一時ディレクトリの自動管理

E2Eテストはフィクスチャが一時ディレクトリを自動管理します：

```typescript
// フィクスチャが自動的に処理
// - テスト開始時: 一時ディレクトリ作成 + テンプレート読み込み
// - テスト成功時: 自動クリーンアップ
// - テスト失敗時: デバッグ用に残す

test('テスト', async ({ mainWindow, configHelper }) => {
  // テストコード
  // クリーンアップは不要（フィクスチャが自動処理）
});
```

### 3. 新しいテンプレートの作成

新しいテストシナリオ用のテンプレートは目的別フォルダとして作成：

```bash
# 新しいテンプレートフォルダを作成
mkdir tests/e2e/templates/my-scenario

# 必要なファイルを作成
echo "Test Item,https://example.com" > tests/e2e/templates/my-scenario/data.txt
echo '{"showDataFileTabs": false}' > tests/e2e/templates/my-scenario/settings.json

# テストで使用
# configHelper.loadTemplate('my-scenario');
```

---

## チェックリスト

### 新しいE2Eテンプレートを追加する場合

- [ ] `tests/e2e/templates/your-scenario/` フォルダを作成
- [ ] `data.txt` を作成して初期データを記載
- [ ] `settings.json` を作成（必要に応じて）
- [ ] `data2.txt` など追加ファイルを作成（必要に応じて）
- [ ] テストで `configHelper.loadTemplate('your-scenario')` を使用
- [ ] `git add tests/e2e/templates/your-scenario/` でコミット

### 新しい開発用テンプレートを追加する場合

- [ ] `tests/dev/your-template/` フォルダを作成
- [ ] `data.txt` を作成して初期データを記載
- [ ] `settings.json` を作成（必要に応じて）
- [ ] `git add tests/dev/your-template/` でコミット

### コミット前の確認

```bash
# 1. ステージングされたファイルを確認
git status

# 2. 除外すべきファイルが含まれていないか確認
git diff --cached --name-only | grep -E '(configs/.temp/|/icons/|/favicons/|/backup/)'

# 3. テンプレートファイルが含まれているか確認
git diff --cached --name-only | grep -E '(e2e/templates/|dev/)'

# 4. 問題なければコミット
git commit -m "feat: 新しいテストテンプレートを追加"
```

---

## トラブルシューティング

### Q: configs/.temp/内のファイルがコミット候補に出てくる

A: `.gitignore`が正しく設定されているか確認してください：

```bash
# .gitignoreが効いているか確認
git check-ignore tests/e2e/configs/.temp/test-id/data.txt

# 既にトラッキングされている場合は削除
git rm --cached -r tests/e2e/configs/.temp/
```

### Q: テンプレートファイルを誤って除外してしまった

A: テンプレートディレクトリは除外されません。`.gitignore`のパターンを確認してください：

```gitignore
# ❌ これだとテンプレートも除外される
tests/e2e/**/*.json

# ✅ 一時ディレクトリのみ除外
tests/e2e/configs/.temp/
```

### Q: 開発用テンプレートのsettings.jsonを管理したい

A: `tests/dev/` フォルダの `settings.json` は管理対象（テンプレートとして）です。`.gitignore` では開発用テンプレートのsettings.jsonは除外していません：

```gitignore
# 開発用テンプレートは除外しない
# tests/dev/*/settings.json は管理対象

# 一時ディレクトリのみ除外
tests/e2e/configs/.temp/
```

---

## まとめ

### Gitで管理する（コミット）

- ✅ tests/e2e/templates/ 全体（目的別テンプレートフォルダ）
  - data.txt, data2.txt, settings.json など
- ✅ tests/dev/ フォルダのすべてのファイル（data.txt, settings.json）
- ✅ tests/e2e/configs/.gitignore と .gitkeep
- ✅ README.md、ドキュメント類

### Gitで管理しない（除外）

- ❌ tests/e2e/configs/.temp/ 配下のすべて（テスト実行時の一時ディレクトリ）
- ❌ tests/dev/*/icons/, favicons/, custom-icons/（開発用テンプレートの自動生成アイコン）
- ❌ tests/dev/*/backup/（開発用テンプレートのバックアップ）

この方針により、リポジトリは必要最小限のファイルで構成され、テストの再現性と保守性が向上します。

## 関連ドキュメント

- [フィクスチャガイド](./fixtures-guide.md) - テストフィクスチャの使い方
- [E2Eテストガイド](./e2e-guide.md) - E2Eテストの実行方法
- [tests/fixtures/README.md](../../tests/fixtures/README.md) - フィクスチャの基本概要
