# はじめに

QuickDashLauncherへようこそ！このガイドでは、プロジェクトの基本的な情報とセットアップ方法を説明します。

## プロジェクト概要

QuickDashLauncherは、起動ホットキー（Alt+Space）でWebサイト、アプリケーション、フォルダ、ファイルに素早くアクセスできるWindows用ランチャーアプリケーション（Electron + React + TypeScript）です。

## 主要機能

### ランチャー機能
- **起動ホットキー**: Alt+Spaceで即座にランチャーを呼び出し（カスタマイズ可能）
- **リアルタイム検索**: 入力に応じてアイテムをリアルタイムフィルタリング
- **ウィンドウ検索**: 検索欄に`<`を入力してウィンドウ検索モードに切り替え、開いているウィンドウを検索・アクティブ化
- **コマンドヒストリー**: Ctrl+上下矢印キーで検索履歴をナビゲート（最大100件）

### ウィンドウ管理
- **ウィンドウ固定化**: 📌ボタンで3段階のピン留めモード
- **システムトレイメニュー**: タスクトレイから設定・データフォルダへアクセス
- **マルチモニター対応**: カーソル位置やモニター別の表示

### アイテム管理
- **アイコン表示**: アプリ、ファイル、URLのアイコンを自動取得
- **タブ切り替え**: 複数データファイルをタブで管理
- **ドラッグ&ドロップ登録**: ファイルやフォルダを簡単登録
- **アイテム管理モード**: Ctrl+Eで編集モード、直接編集と詳細編集を提供
- **フォルダ取込**: フォルダ内容を動的にインポート

### その他
- **コンテキストメニュー**: 右クリックでパスコピー等
- **バックアップ機能**: データファイルの自動バックアップ

## 技術スタック

| 項目 | 技術 |
|------|------|
| フロントエンド | React + TypeScript + Vite |
| バックエンド | Electron (メインプロセス) |
| スタイリング | CSS変数ベースのデザインシステム |
| パッケージング | electron-builder |
| テスト | Playwright (E2E) + Vitest (単体) |

---

## セットアップ

### 前提条件

- Node.js (>=22.12.0)
- npm
- Windows環境

### インストール

```bash
git clone [repository-url]
cd quick-dash-launcher
npm install
```

### 開発開始

```bash
npm run dev
```

Viteデベロップメントサーバーが起動し、ホットリロード付きで開発できます。

**利用可能な開発コマンド:**
- `npm run dev` - メイン開発環境（ポート9001、ホットキー: Ctrl+Alt+A）
- `npm run dev2` - 第2インスタンス（ポート9002、ホットキー: Ctrl+Alt+S）
- `npm run dev:test` - テストデータで起動（全機能を含む）

複数のインスタンスを同時に起動して、並行開発や比較検証が可能です。詳細は[開発ガイド - 多重起動](development.md#多重起動)を参照してください。

---

## 初回起動

アプリケーション初回起動時、起動ホットキーの設定画面が自動表示されます。

1. 入力欄をクリックして希望するキー組み合わせを押下（例: `Alt+Space`）
2. 「設定を完了」ボタンをクリック

詳細は[アプリケーション設定](../screens/admin-window.md#7-設定機能の詳細)を参照してください。

---

## データファイルの記述方法

データファイル（data.json、data2.json）はJSON形式で記述します。各アイテムは`items`配列内にオブジェクトとして定義します。

### 基本構造

```json
{
  "version": "1.0",
  "items": [
    // アイテムの配列
  ]
}
```

### 1. 通常アイテム（type: "item"）

個別に定義される静的なランチャーアイテム。

**形式:**
```json
{
  "id": "ランダムなID（8文字）",
  "type": "item",
  "displayName": "表示名",
  "path": "実行先パスまたはURL",
  "args": "引数（オプション）",
  "customIcon": "カスタムアイコンファイル名（オプション）"
}
```

**例:**
```json
{
  "version": "1.0",
  "items": [
    {
      "id": "a1B2c3D4",
      "type": "item",
      "displayName": "Notepad++",
      "path": "C:\\Program Files\\Notepad++\\notepad++.exe"
    },
    {
      "id": "e5F6g7H8",
      "type": "item",
      "displayName": "GitHub",
      "path": "https://github.com"
    },
    {
      "id": "i9J0k1L2",
      "type": "item",
      "displayName": "プロジェクトフォルダ",
      "path": "C:\\Users\\Documents\\Projects"
    },
    {
      "id": "m3N4o5P6",
      "type": "item",
      "displayName": "Visual Studio",
      "path": "devenv.exe",
      "args": "/rootsuffix Exp"
    },
    {
      "id": "q7R8s9T0",
      "type": "item",
      "displayName": "Netflix",
      "path": "https://www.netflix.com/browse",
      "customIcon": "7439edeb.png"
    }
  ]
}
```

- `id`: 8文字のランダムなID（自動生成、重複なし）
- `type`: アイテムタイプ（通常アイテムは"item"）
- `displayName`: アイテムリストに表示される名前
- `path`: URL、実行ファイル、フォルダ等のパス（システムが自動判定）
- `args`: コマンドライン引数（オプション）
- `customIcon`: カスタムアイコンファイル名（オプション）

### 2. フォルダ取込アイテム（type: "dir"）

フォルダ内容を動的にインポート。

**形式:**
```json
{
  "id": "ランダムなID（8文字）",
  "type": "dir",
  "path": "フォルダパス",
  "options": {
    "depth": 0,
    "types": "both",
    "filter": "*.{js,ts}",
    "exclude": "node_modules",
    "prefix": "プレフィックス",
    "suffix": "サフィックス"
  }
}
```

**例:**
```json
{
  "version": "1.0",
  "items": [
    {
      "id": "u1V2w3X4",
      "type": "dir",
      "path": "C:\\Tools"
    },
    {
      "id": "y5Z6a7B8",
      "type": "dir",
      "path": "C:\\Projects",
      "options": {
        "depth": 1,
        "types": "file"
      }
    },
    {
      "id": "c9D0e1F2",
      "type": "dir",
      "path": "C:\\Scripts",
      "options": {
        "filter": "*.ps1",
        "prefix": "Script"
      }
    }
  ]
}
```

詳細は[フォルダ取込](../screens/register-modal.md#6-フォルダ取込アイテムの詳細)を参照。

### アイテムタイプ

| タイプ | 説明 |
|--------|------|
| `item` | 通常のランチャーアイテム（URL、ファイル、フォルダ等） |
| `dir` | フォルダ取込アイテム（フォルダ内容を動的にインポート） |
| `group` | グループアイテム（複数アイテムを一括起動） |
| `window` | ウィンドウ操作アイテム（既存ウィンドウを制御） |
| `clipboard` | クリップボードアイテム（クリップボードの内容を保存・復元） |

---

## 制約事項

1. **Windows専用** - クロスプラットフォーム非対応
2. **Node.js必須** - 開発には>=22.12.0が必要

---

## 次のステップ

- [開発ガイド](development.md) - 詳細な開発情報
- [ビルドとデプロイ](build-deploy.md) - ビルドシステムとデプロイ方法
- [ファイル形式一覧](../architecture/file-formats/README.md) - data.json、workspace.json、config.jsonの詳細
- [アイテム管理](../screens/admin-window.md#6-アイテム管理の詳細) - 編集モードの使い方
- [アイコンシステム](../features/icons.md) - アイコン機能の詳細
- [アプリケーション設定](../screens/admin-window.md#7-設定機能の詳細) - ホットキーや表示設定
