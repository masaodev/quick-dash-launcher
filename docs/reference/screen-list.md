# QuickDashLauncher 画面一覧

このドキュメントは、QuickDashLauncherアプリケーションの全画面構成を記載します。

詳細な画面仕様については以下を参照してください：
- [メインウィンドウ](main-window.md) - メイン画面の詳細仕様
- [ブックマークインポートモーダル](bookmark-import-modal.md) - インポート機能の詳細

## 画面構成図

```
QuickDashLauncher
├── メインウィンドウ (App.tsx)
│   ├── SearchBox（検索ボックス）
│   ├── ActionButtons（アクションボタン群・設定メニュー統合）
│   ├── TabControl（タブ切り替え）
│   ├── ItemList（アイテム一覧）
│   ├── IconProgressBar（アイコン取得進捗表示）※条件付き
│   ├── RegisterModal（登録モーダル）※条件付き
│   └── ドラッグオーバーレイ ※条件付き
│
├── 管理ウィンドウ (AdminApp.tsx) ※別ウィンドウ
│   └── AdminTabContainer（タブコンテナ）
│       ├── アイテム管理タブ
│       │   └── EditModeView
│       │       ├── ヘッダー（ファイル名、検索、アクションボタン）
│       │       ├── EditableRawItemList（編集可能リスト）
│       │       ├── BookmarkImportModal（ブックマークインポート）※条件付き
│       │       └── ステータスバー（選択数、行数、保存状態）
│       │
│       ├── 設定タブ
│       │   └── SettingsTab
│       │       ├── ホットキー設定（HotkeyInput）
│       │       ├── ウィンドウサイズ設定
│       │       └── その他アプリケーション設定
│       │
│       └── その他タブ
│           └── AdminOtherTab
│               └── 追加機能・管理ツール
│
├── システムダイアログ（Electron）
│   └── ファイル選択ダイアログ（showOpenDialog）
│
└── ブラウザダイアログ（JavaScript）
    ├── 確認ダイアログ（window.confirm）
    └── その他のネイティブダイアログ
```

## 画面一覧

| 画面名 | ファイル | 種類 | 表示条件 | 主要機能 |
|--------|----------|------|----------|----------|
| **メインウィンドウ** | `src/renderer/App.tsx` | ウィンドウ | 起動時のデフォルト状態 | 検索ボックス、アイテム一覧、アクションボタン、タブ切り替え<br>📋 [詳細仕様書](../screens/main-window.md) |
| **管理ウィンドウ** | `src/renderer/AdminApp.tsx` | ウィンドウ | Ctrl+E または設定メニューから | 生データ編集、アプリケーション設定、サイズ1000x700px、独立ウィンドウ |
| **アイテム登録・編集モーダル** | `src/renderer/components/RegisterModal.tsx` | モーダル | ファイルドラッグ&ドロップ時<br>アイテム管理で詳細編集時 | アイテム登録・編集、DIRオプション設定、保存先選択 |
| **ブックマークインポートモーダル** | `src/renderer/components/BookmarkImportModal.tsx` | モーダル | 管理ウィンドウでインポートボタンクリック時 | ブックマークHTMLファイルのインポート、検索・選択<br>📋 [詳細仕様書](../screens/bookmark-import-modal.md) |

## コンポーネント一覧

### メインウィンドウコンポーネント

| コンポーネント名 | ファイル | 親画面 | 表示条件 | 主要機能 |
|------------------|----------|--------|----------|----------|
| **SearchBox** | `src/renderer/components/SearchBox.tsx` | メインウィンドウ | 常時表示 | リアルタイム検索、キーボードショートカット |
| **ActionButtons** | `src/renderer/components/ActionButtons.tsx` | メインウィンドウ | 常時表示 | ファビコン取得、アイコン抽出、リロード、固定、設定メニュー統合 |
| **TabControl** | `src/renderer/components/TabControl.tsx` | メインウィンドウ | 常時表示 | メインタブ・一時タブの切り替え |
| **ItemList** | `src/renderer/components/ItemList.tsx` | メインウィンドウ | 常時表示 | アイテム一覧表示、選択・実行 |
| **IconProgressBar** | `src/renderer/components/IconProgressBar.tsx` | メインウィンドウ | アイコン取得処理中 | 進捗状況リアルタイム表示、完了後3秒で自動非表示 |
| **ドラッグオーバーレイ** | `src/renderer/App.tsx` | メインウィンドウ | ファイルドラッグ中 | 「ドロップして追加」メッセージ表示 |

### 管理ウィンドウコンポーネント

| コンポーネント名 | ファイル | 親画面 | 表示条件 | 主要機能 |
|------------------|----------|--------|----------|----------|
| **AdminTabContainer** | `src/renderer/components/AdminTabContainer.tsx` | 管理ウィンドウ | 管理ウィンドウ表示時 | タブ管理、画面切り替え |
| **EditModeView** | `src/renderer/components/EditModeView.tsx` | AdminTabContainer | アイテム管理タブ選択時 | アイテム管理のメインビュー、ヘッダー・ステータスバー |
| **EditableRawItemList** | `src/renderer/components/EditableRawItemList.tsx` | EditModeView | アイテム管理タブ選択時 | 編集可能リスト、セル編集、整列・削除 |
| **SettingsTab** | `src/renderer/components/SettingsTab.tsx` | AdminTabContainer | 設定タブ選択時 | アプリケーション設定、ホットキー・ウィンドウサイズ設定 |
| **HotkeyInput** | `src/renderer/components/HotkeyInput.tsx` | SettingsTab | 設定タブ選択時 | ホットキー入力・変更コンポーネント |
| **AdminOtherTab** | `src/renderer/components/AdminOtherTab.tsx` | AdminTabContainer | その他タブ選択時 | 追加機能・管理ツール |

### 共通コンポーネント

| コンポーネント名 | ファイル | 使用箇所 | 表示条件 | 主要機能 |
|------------------|----------|----------|----------|----------|
| **RegisterModal** | `src/renderer/components/RegisterModal.tsx` | メインウィンドウ<br>管理ウィンドウ | モーダル表示時 | アイテム登録・編集、DIRオプション設定、保存先選択 |
| **BookmarkImportModal** | `src/renderer/components/BookmarkImportModal.tsx` | 管理ウィンドウ | インポートボタンクリック時 | ブックマークHTMLファイルのインポート、検索・選択 |

## 画面遷移

### メインウィンドウでの画面遷移

1. **起動** → メインウィンドウ表示
2. **Ctrl+Alt+W** → アプリ表示/非表示切り替え
3. **ドラッグ&ドロップ** → RegisterModal表示
4. **ActionButtons内の設定メニュー** → 各種機能実行
5. **Ctrl+E または 設定メニューから管理** → 管理ウィンドウ表示

### 管理ウィンドウでの画面遷移

1. **管理ウィンドウ表示** → AdminTabContainer表示（デフォルト：アイテム管理タブ）
2. **編集モードタブ** → EditModeView表示
3. **設定タブ** → SettingsTab表示
4. **その他タブ** → AdminOtherTab表示
5. **✏️ボタン** → RegisterModal表示
6. **ブックマークインポート** → BookmarkImportModal表示
7. **Ctrl+E または ウィンドウを閉じる** → 管理ウィンドウ非表示

## キーボードショートカット

| ショートカット | 機能 | 対象画面 |
|----------------|------|----------|
| Ctrl+Alt+W | アプリ表示/非表示 | グローバル |
| Ctrl+E | 管理ウィンドウ表示/非表示 | メインウィンドウ/管理ウィンドウ |
| Enter | 選択アイテム実行 | メインウィンドウ（SearchBox） |
| ↑↓ | アイテム選択移動 | メインウィンドウ（SearchBox） |
| Escape | アプリを隠す<br>管理ウィンドウを隠す | メインウィンドウ（非固定時）<br>管理ウィンドウ |

## 特殊な表示条件

### IconProgressBar（アイコン取得進捗表示）
- **表示条件**: ファビコン取得ボタンまたはアイコン抽出ボタンの処理中
- **表示位置**: メインウィンドウ下部（ItemListの下）
- **表示内容**: 
  - プログレスバーと進捗率
  - 処理種別（「ファビコン取得中」/「アイコン抽出中」）
  - 進捗数値（例：12/35）
  - 現在処理中のアイテム
  - エラー件数、経過時間、推定残り時間
- **非表示条件**: 処理完了後3秒で自動非表示

### ドラッグオーバーレイ
- **表示条件**: ファイル/フォルダをメインウィンドウ上にドラッグ中
- **内容**: 「ファイルをドロップして登録」のメッセージ表示

### ウィンドウ固定状態（メインウィンドウのみ）
- **📌ボタン**: ウィンドウ固定ON/OFF
- **固定時**: フォーカスアウトしても非表示にならない
- **管理ウィンドウ**: 独立ウィンドウのため固定機能は不要

## モーダル・ダイアログ一覧

| 名前 | 種類 | 実装場所 | 表示条件 | 設定・メッセージ |
|------|------|----------|----------|------------------|
| **ファイル選択ダイアログ** | Electronダイアログ | `src/main/ipc/dataHandlers.ts` | 管理ウィンドウでブックマークインポート時 | タイトル：「ブックマークファイルを選択」<br>フィルター：HTML Files (*.html, *.htm) |
| **管理ウィンドウ終了確認** | window.confirm | `src/renderer/components/EditModeView.tsx` | 管理ウィンドウ終了時（未保存変更あり） | 「未保存の変更があります。編集モードを終了しますか？」 |
| **重複行削除確認** | window.confirm | `src/renderer/components/EditableRawItemList.tsx` | 整列処理で重複行検出時 | 「整列処理が完了しました。\n\n{n}件の重複行が見つかりました。\n重複行を削除しますか？」 |
| **一括削除確認** | window.confirm | `src/renderer/components/EditableRawItemList.tsx` | 選択行の一括削除実行時 | 「{n}行を削除しますか？」 |
| **個別削除確認** | window.confirm | `src/renderer/components/EditableRawItemList.tsx` | 個別行の削除実行時 | 「行 {行番号} を削除しますか？」 |
| **window.alert** | JavaScriptダイアログ | - | 現在未使用 | 将来のエラー表示等で使用可能 |
| **window.prompt** | JavaScriptダイアログ | - | 現在未使用 | 将来のテキスト入力等で使用可能 |

## モーダル表示の優先順位

1. **最高優先度**: Electronシステムダイアログ
   - ファイル選択ダイアログ
   
2. **高優先度**: 確認ダイアログ（window.confirm）
   - 削除確認、終了確認など

3. **中優先度**: 機能モーダル
   - RegisterModal（登録・編集）
   - BookmarkImportModal（ブックマークインポート）
   - SettingsModal（アプリケーション設定）
   
4. **低優先度**: UI要素
   - SettingsDropdown（設定メニュー）
   - ドラッグオーバーレイ

## モーダル間の関係

### メインウィンドウ
- **ドラッグ&ドロップ** → **RegisterModal**

### 管理ウィンドウ
- **BookmarkImportModal** → **ファイル選択ダイアログ** → **確認ダイアログ**
- **EditableRawItemList** → **RegisterModal** → **確認ダイアログ**（削除時）
- **EditModeView** → **確認ダイアログ**（終了時）
- **SettingsTab** → **設定変更の即時適用**

### ウィンドウ間の関係
- **メインウィンドウ** ↔ **管理ウィンドウ**：独立して動作、同時表示可能