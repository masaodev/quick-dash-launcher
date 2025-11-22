# Git管理方針 - テストフィクスチャファイル

このドキュメントでは、`tests/fixtures/` 内のファイルについて、何をGitで管理し、何を除外するかを説明します。

## ✅ Git管理対象ファイル（コミットする）

### 1. テンプレートファイル（必須）

これらのファイルはテストの基礎となるため、**必ず管理対象**とします。

```
tests/fixtures/
├── data-templates/          # データファイルテンプレート
│   ├── README.md           ✅ 管理する
│   ├── base.txt            ✅ 管理する
│   ├── with-group.txt      ✅ 管理する
│   ├── with-folder-import.txt ✅ 管理する
│   └── empty.txt           ✅ 管理する
│
├── settings-templates/      # 設定ファイルテンプレート
│   ├── README.md           ✅ 管理する
│   ├── default.json        ✅ 管理する
│   ├── custom-hotkey.json  ✅ 管理する
│   ├── with-tabs.json      ✅ 管理する
│   └── with-backup.json    ✅ 管理する
```

**理由:**
- テストで使用する標準的なデータセット
- チーム全体で共有すべき再利用可能なテンプレート
- バージョン管理により変更履歴を追跡できる

### 2. 初期データファイル（data.txt）

各設定フォルダの初期状態のdata.txtは管理対象とします。

```
tests/fixtures/
├── e2e-config/
│   ├── data.txt            ✅ 管理する（E2Eテスト用初期データ）
│   └── README.md           ✅ 管理する
├── first-launch-config/
│   └── data.txt            ✅ 管理する（初回起動テスト用初期データ）
├── dev-config/
│   └── data.txt            ✅ 管理する（開発用初期データ）
└── test-config/
    └── data.txt            ✅ 管理する（単体テスト用初期データ）
```

**理由:**
- テスト実行時の初期状態として必要
- どのようなデータでテストしているかを明示
- CI/CD環境でも同じ初期状態を再現できる

### 3. ドキュメント・説明ファイル

```
tests/fixtures/
├── README.md               ✅ 管理する
├── GIT_MANAGEMENT.md       ✅ 管理する（このファイル）
└── .gitignore              ✅ 管理する
```

**理由:**
- テストフィクスチャの使い方を説明
- チームメンバーへの情報共有

---

## ❌ Git管理対象外ファイル（除外する）

### 1. 自動生成ファイル（settings.json）

各設定フォルダのsettings.jsonは**除外**します。

```
tests/fixtures/
├── e2e-config/
│   └── settings.json       ❌ 除外（自動生成）
├── first-launch-config/
│   └── settings.json       ❌ 除外（自動生成）
├── dev-config/
│   └── settings.json       ❌ 除外（自動生成）
└── test-config/
    └── settings.json       ❌ 除外（自動生成）
```

**理由:**
- テスト実行時やアプリ起動時に自動生成される
- 開発者ごとに異なる値（ウィンドウサイズなど）を持つ可能性がある
- 必要な設定は`settings-templates/`で管理

**例外:**
- テストで特定のsettings.jsonが必須の場合は、`settings-templates/`にテンプレートを作成し、テスト内で`loadSettingsTemplate()`を使用する

### 2. アイコン関連フォルダ

自動生成されるアイコンフォルダは**除外**します。

```
tests/fixtures/
└── */
    ├── icons/              ❌ 除外（自動生成）
    ├── favicons/           ❌ 除外（自動生成）
    └── custom-icons/       ❌ 除外（自動生成）
```

**理由:**
- アプリ起動時にアイコン取得機能で自動生成される
- バイナリファイルでサイズが大きい
- 環境依存（ネットワーク状況、実行タイミング）で内容が変わる

### 3. バックアップフォルダ

テスト実行時に作成されるバックアップは**除外**します。

```
tests/fixtures/
└── */
    └── backup/             ❌ 除外（テスト実行時に作成）
```

**理由:**
- テスト実行時の一時ファイル
- テストごとに内容が変わる
- リポジトリに含める必要がない

### 4. テスト実行時の一時ファイル

ConfigFileHelperが作成するバックアップファイルなどは**除外**します。

```
tests/fixtures/
└── */
    ├── .data.txt.backup    ❌ 除外（テスト実行時のバックアップ）
    ├── .settings.json.backup ❌ 除外（テスト実行時のバックアップ）
    └── *.tmp               ❌ 除外（一時ファイル）
```

**理由:**
- テスト実行中のみ使用される一時ファイル
- テスト終了後にクリーンアップされる

---

## 🔧 .gitignoreの設定

### プロジェクトルートの.gitignore

```gitignore
# Test config directories (local working directories at project root)
/test-config/
/dev-config/
/*-config/

# Test results
test-results/
playwright-report/

# Fixture内で自動生成されるファイル
tests/fixtures/*/settings.json
tests/fixtures/*/icons/
tests/fixtures/*/favicons/
tests/fixtures/*/custom-icons/
tests/fixtures/*/backup/
```

### tests/fixtures/.gitignore

```gitignore
# 自動生成ファイル
*/settings.json
*/icons/
*/favicons/
*/custom-icons/
*/backup/

# ConfigFileHelperのバックアップファイル
*/.data.txt.backup
*/.settings.json.backup

# 一時ファイル
*/*.tmp
*/*.temp
```

---

## 📊 管理方針の判断基準

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

## 🚀 ベストプラクティス

### 1. テンプレートファイルの活用

settings.jsonのような設定ファイルは、直接管理せずテンプレートで管理します：

```typescript
// ❌ 悪い例：settings.jsonを直接コミット
// tests/fixtures/e2e-config/settings.json をコミット

// ✅ 良い例：テンプレートを使用
configHelper.loadSettingsTemplate('default');
```

### 2. 初期データの明確化

各設定フォルダのdata.txtには、そのフォルダの用途をコメントで記載します：

```
// E2Eテスト用サンプルデータ
// このファイルはE2Eテスト実行時に使用する既知のテストデータです

GitHub,https://github.com/
Google,https://google.com/
```

### 3. クリーンアップの徹底

テスト後は必ず`configHelper.restoreAll()`で元に戻します：

```typescript
test.beforeEach(() => {
  configHelper.backupAll();
});

test.afterEach(() => {
  configHelper.restoreAll(); // 必須
});
```

---

## 🔍 トラブルシューティング

### Q: settings.jsonが勝手にコミット候補に出てくる

A: `.gitignore`が正しく設定されているか確認してください：

```bash
# .gitignoreが効いているか確認
git check-ignore tests/fixtures/e2e-config/settings.json

# 既にトラッキングされている場合は削除
git rm --cached tests/fixtures/e2e-config/settings.json
```

### Q: テンプレートファイルを誤って除外してしまった

A: テンプレートディレクトリは除外されません。`.gitignore`のパターンを確認してください：

```gitignore
# ❌ これだとテンプレートも除外される
*.json

# ✅ 特定のフォルダのみ除外
*/settings.json
```

### Q: 新しいフィクスチャフォルダを追加したい

A: 以下の手順で追加してください：

1. `tests/fixtures/new-config/`を作成
2. `data.txt`を作成して初期データを記載
3. `.gitignore`で`new-config/settings.json`が除外されることを確認
4. `git add tests/fixtures/new-config/data.txt`でdata.txtのみコミット

---

## 📝 まとめ

### Gitで管理する（コミット）
- ✅ data-templates/ 全体
- ✅ settings-templates/ 全体
- ✅ 各フォルダの data.txt
- ✅ README.md、ドキュメント類

### Gitで管理しない（除外）
- ❌ 各フォルダの settings.json
- ❌ icons/, favicons/, custom-icons/
- ❌ backup/
- ❌ *.backup, *.tmp 等の一時ファイル

この方針により、リポジトリは必要最小限のファイルで構成され、テストの再現性と保守性が向上します。
