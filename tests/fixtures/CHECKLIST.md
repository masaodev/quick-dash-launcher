# Git管理チェックリスト - テストフィクスチャ

新しいテンプレートやフィクスチャを追加する際のチェックリストです。

## ✅ 新しいデータテンプレートを追加する場合

- [ ] `tests/fixtures/data-templates/` に `.txt` ファイルを作成
- [ ] ファイルの先頭にコメントで用途を説明
- [ ] `data-templates/README.md` に説明を追加
- [ ] `git add tests/fixtures/data-templates/your-template.txt` でコミット

**例:**
```bash
# 1. テンプレートファイルを作成
vim tests/fixtures/data-templates/with-custom-icons.txt

# 2. 内容を記述
# カスタムアイコンテスト用テンプレート
# ...

# 3. Gitに追加
git add tests/fixtures/data-templates/with-custom-icons.txt
git commit -m "feat: カスタムアイコンテスト用データテンプレートを追加"
```

---

## ✅ 新しい設定テンプレートを追加する場合

- [ ] `tests/fixtures/settings-templates/` に `.json` ファイルを作成
- [ ] 有効なJSON形式で記述
- [ ] すべての必須項目を含める
- [ ] `settings-templates/README.md` に説明を追加
- [ ] `git add tests/fixtures/settings-templates/your-template.json` でコミット

**例:**
```bash
# 1. テンプレートファイルを作成
vim tests/fixtures/settings-templates/large-window.json

# 2. JSON形式で記述
{
  "hotkey": "Alt+Space",
  "windowWidth": 1000,
  "windowHeight": 800,
  ...
}

# 3. Gitに追加
git add tests/fixtures/settings-templates/large-window.json
git commit -m "feat: 大きいウィンドウサイズの設定テンプレートを追加"
```

---

## ✅ 新しいフィクスチャフォルダを追加する場合

- [ ] `tests/fixtures/your-config/` フォルダを作成
- [ ] `data.txt` を作成して初期データを記載
- [ ] 必要に応じて `README.md` を作成
- [ ] `settings.json` は**コミットしない**（自動生成される）
- [ ] `.gitignore` で除外されることを確認
- [ ] `git add tests/fixtures/your-config/data.txt` で data.txt のみコミット

**例:**
```bash
# 1. フォルダとdata.txtを作成
mkdir tests/fixtures/integration-test-config
vim tests/fixtures/integration-test-config/data.txt

# 2. 除外されることを確認
git check-ignore tests/fixtures/integration-test-config/settings.json
# 出力: tests/fixtures/.gitignore:8:*/settings.json	tests/fixtures/integration-test-config/settings.json

# 3. data.txtのみ追加
git add tests/fixtures/integration-test-config/data.txt
git commit -m "feat: 統合テスト用フィクスチャフォルダを追加"
```

---

## ❌ コミットしてはいけないファイル

以下のファイルは絶対にコミットしないでください：

```
❌ tests/fixtures/*/settings.json      # 自動生成ファイル
❌ tests/fixtures/*/icons/              # アイコンキャッシュ
❌ tests/fixtures/*/favicons/           # ファビコンキャッシュ
❌ tests/fixtures/*/custom-icons/       # カスタムアイコン
❌ tests/fixtures/*/backup/             # バックアップフォルダ
❌ tests/fixtures/*/.*.backup           # バックアップファイル
❌ tests/fixtures/*/*.tmp               # 一時ファイル
```

**確認方法:**
```bash
# これらのファイルが除外されているか確認
git status --ignored tests/fixtures/

# 誤ってトラッキングされている場合は削除
git rm --cached tests/fixtures/e2e-config/settings.json
```

---

## 🔍 コミット前の確認

コミット前に以下を確認してください：

```bash
# 1. ステージングされたファイルを確認
git status

# 2. 除外すべきファイルが含まれていないか確認
git diff --cached --name-only | grep -E '(settings\.json|/icons/|/favicons/|/backup/)'

# 3. テンプレートファイルが含まれているか確認
git diff --cached --name-only | grep -E '(data-templates|settings-templates)'

# 4. 問題なければコミット
git commit -m "feat: 新しいテストテンプレートを追加"
```

---

## 📋 よくある間違い

### ❌ 間違い 1: settings.jsonをコミットしてしまう

```bash
# ❌ 間違い
git add tests/fixtures/e2e-config/settings.json

# ✅ 正しい対処
# 設定が必要な場合はテンプレートを作成
git add tests/fixtures/settings-templates/e2e-default.json
```

### ❌ 間違い 2: アイコンフォルダをコミットしてしまう

```bash
# ❌ 間違い
git add tests/fixtures/e2e-config/icons/

# ✅ 正しい対処
# アイコンは自動生成されるため不要
# .gitignoreで除外されているか確認
git check-ignore tests/fixtures/e2e-config/icons/
```

### ❌ 間違い 3: data.txtを除外してしまう

```bash
# ❌ 間違い：.gitignoreに追加
tests/fixtures/*/data.txt

# ✅ 正しい：data.txtは管理対象
git add tests/fixtures/e2e-config/data.txt
```

---

## 🚀 推奨ワークフロー

### 新しいテストケースを追加する場合

1. **必要なテンプレートを確認**
   ```bash
   ls tests/fixtures/data-templates/
   ls tests/fixtures/settings-templates/
   ```

2. **既存テンプレートで足りない場合は作成**
   ```bash
   # データテンプレート
   vim tests/fixtures/data-templates/new-template.txt
   git add tests/fixtures/data-templates/new-template.txt

   # 設定テンプレート
   vim tests/fixtures/settings-templates/new-settings.json
   git add tests/fixtures/settings-templates/new-settings.json
   ```

3. **テストスペックを作成**
   ```bash
   vim tests/e2e/specs/new-feature.spec.ts
   git add tests/e2e/specs/new-feature.spec.ts
   ```

4. **コミット**
   ```bash
   git commit -m "feat: 新機能のE2Eテストを追加"
   ```

---

## 📚 参考資料

- [GIT_MANAGEMENT.md](./GIT_MANAGEMENT.md) - Git管理方針の詳細
- [data-templates/README.md](./data-templates/README.md) - データテンプレートの使い方
- [settings-templates/README.md](./settings-templates/README.md) - 設定テンプレートの使い方
- [tests/e2e/helpers/config-file-helper.ts](../e2e/helpers/config-file-helper.ts) - ConfigFileHelperの実装
