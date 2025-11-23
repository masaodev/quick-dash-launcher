# 🚀 クイックスタートガイド - 開発用テンプレート

開発時に汎用的なデータや設定を手動で読み込んで実行する方法を説明します。

## 📋 利用可能なテンプレート

| コマンド | テンプレート | 説明 | 用途 |
|---------|------------|------|------|
| `npm run dev:minimal` | minimal | 最小限のアイテム（5個） | 基本動作確認 |
| `npm run dev:full` | full-featured | 全機能を含む（30個+グループ） | デモ・機能確認 |
| `npm run dev:tabs` | multi-tab | 3タブ構成 | タブ機能の確認 |
| `npm run dev:groups` | with-groups | グループ起動特化 | グループ機能の確認 |
| `npm run dev:large` | large-dataset | 大量データ（100個以上） | パフォーマンステスト |
| `npm run dev:empty` | empty | 空データ | 初期状態の確認 |

## 🎯 使い方

### 1️⃣ 最も簡単な方法（推奨）

```bash
# 最小限のセットで起動
npm run dev:minimal

# 全機能を試す
npm run dev:full

# タブ機能を確認
npm run dev:tabs
```

これだけです！アプリが起動し、選択したテンプレートのデータが読み込まれます。

### 2️⃣ 使用シーン別の選び方

#### 🐛 バグ修正の動作確認
```bash
npm run dev:minimal
```
- シンプルなデータセットで問題を切り分けやすい
- 素早く起動してテストできる

#### 🎨 クライアントへのデモ
```bash
npm run dev:full
```
- すべての機能を網羅
- グループ起動などの高度な機能も含む
- 見栄えの良いデモができる

#### 📊 タブ機能の開発
```bash
npm run dev:tabs
```
- 3つのタブで構成
- タブごとに異なるカテゴリのアイテム
- タブ切り替えの動作確認に最適

#### 🚀 グループ起動機能の開発
```bash
npm run dev:groups
```
- 複数のグループアイテムを含む
- グループ起動の挙動を確認しやすい

#### ⚡ パフォーマンステスト
```bash
npm run dev:large
```
- 100個以上のアイテム
- 検索・スクロールの性能確認
- 大量データでの安定性テスト

#### 🆕 初期状態のテスト
```bash
npm run dev:empty
```
- アイテムが0個の状態
- 空状態のUIを確認
- エラーハンドリングのテスト

## 💡 便利なTips

### データをカスタマイズしたい場合

テンプレートファイルを直接編集できます：

```bash
# 1. テンプレートファイルを編集
notepad tests/fixtures/dev-templates/minimal/data.txt

# 2. 起動
npm run dev:minimal
```

変更はGitでコミット可能なので、チーム全体で共有できます！

### 設定だけ変更したい場合

```bash
# settings.jsonだけを編集
notepad tests/fixtures/dev-templates/minimal/settings.json

# 起動
npm run dev:minimal
```

### 複数のテンプレートを切り替えて使いたい場合

開発中に複数のテンプレートを試したい場合、ターミナルを複数開いて同時に起動できます：

```bash
# ターミナル1
npm run dev:minimal

# ターミナル2（別ウィンドウ）
npm run dev:full
```

ただし、同じホットキーを使用するため、実際には1つずつ起動してください。

### 本番環境の設定に影響させたくない場合

これらのテンプレートは `tests/fixtures/` 内にあるため、**本番環境の設定には一切影響しません**。

本番環境の設定は `%APPDATA%/QuickDashLauncher/` にあります。

## 🔧 高度な使い方

### 環境変数で直接指定

カスタムパスを指定して起動したい場合：

**PowerShell:**
```powershell
$env:QUICK_DASH_CONFIG_DIR="./tests/fixtures/dev-templates/minimal"; npm run dev
```

**コマンドプロンプト:**
```cmd
set QUICK_DASH_CONFIG_DIR=./tests/fixtures/dev-templates/minimal && npm run dev
```

### 新しいテンプレートを作成

```bash
# 1. 新しいフォルダを作成
mkdir tests/fixtures/dev-templates/my-custom

# 2. data.txtとsettings.jsonをコピー
cp tests/fixtures/dev-templates/minimal/* tests/fixtures/dev-templates/my-custom/

# 3. ファイルを編集
notepad tests/fixtures/dev-templates/my-custom/data.txt

# 4. package.jsonに追加（オプション）
# "dev:custom": "cross-env QUICK_DASH_CONFIG_DIR=./tests/fixtures/dev-templates/my-custom NODE_ENV=development ELECTRON_IS_DEV=1 vite",

# 5. 起動
npm run dev:custom
```

### テンプレートのリセット

データや設定を変更した後、元に戻したい場合：

```bash
# Gitで管理されているため、簡単にリセット可能
git checkout tests/fixtures/dev-templates/minimal/
```

## 📚 各テンプレートの詳細

### minimal
- **アイテム数**: 5個
- **特徴**: Google, GitHub, メモ帳, 電卓, デスクトップ
- **用途**: 基本動作の確認、バグの切り分け

### full-featured
- **アイテム数**: 30個以上
- **特徴**: Webサイト、アプリ、フォルダ、グループ起動を全て含む
- **用途**: デモ、全機能の統合テスト、スクリーンショット撮影

### multi-tab
- **アイテム数**: 各タブ5-7個
- **特徴**: 仕事/プライベート/学習の3タブ構成
- **用途**: タブ切り替え機能の開発・テスト

### with-groups
- **アイテム数**: 15個の個別アイテム + 5個のグループ
- **特徴**: グループ起動機能に特化
- **用途**: グループ起動機能の動作確認

### large-dataset
- **アイテム数**: 100個以上
- **特徴**: Webサイト50個、アプリ20個、フォルダ15個、グループ10個
- **用途**: パフォーマンステスト、大量データでの安定性確認

### empty
- **アイテム数**: 0個
- **特徴**: コメント行のみ
- **用途**: 空状態のUI確認、エラーハンドリングのテスト

## ❓ トラブルシューティング

### Q: テンプレートを変更したのに反映されない

A: アプリをリロードしてください（開発者ツールで `Ctrl+R`）、または再起動してください。

### Q: 設定が保存されてしまう

A: `settings.json` は `.gitignore` で除外されていますが、テンプレートフォルダ内の `settings.json` は管理対象です。変更したくない場合は、別のフォルダにコピーして使用してください。

### Q: 本番環境の設定を壊したくない

A: 心配無用です。これらのテンプレートは `tests/fixtures/` 内にあり、本番環境（`%APPDATA%/QuickDashLauncher/`）とは完全に分離されています。

### Q: 複数のテンプレートを同時に使いたい

A: 同じホットキーを使用するため、複数のインスタンスを同時に起動することは推奨しません。テンプレートを切り替えながら使用してください。

## 🎓 まとめ

開発用テンプレートを使えば：

- ✅ 素早く特定のシナリオをテストできる
- ✅ 本番環境に影響を与えずに開発できる
- ✅ チーム全体で共通のテストデータを使える
- ✅ デモやスクリーンショットの準備が簡単

まずは `npm run dev:minimal` から試してみてください！
