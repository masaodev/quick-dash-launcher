# QuickDashLauncher 画面一覧

このドキュメントは、QuickDashLauncherアプリケーションの全画面構成を記載します。

## 画面構成図

```
QuickDashLauncher
├── メインウィンドウ (App.tsx)
│   ├── 通常モード
│   │   ├── SearchBox（検索ボックス）
│   │   ├── ActionButtons（アクションボタン群）
│   │   │   └── SettingsDropdown（設定メニュー）※条件付き
│   │   ├── TabControl（タブ切り替え）
│   │   ├── ItemList（アイテム一覧）
│   │   ├── RegisterModal（登録モーダル）※条件付き
│   │   └── ドラッグオーバーレイ ※条件付き
│   │
│   └── 編集モード
│       └── EditModeView
│           ├── ヘッダー（ファイル名、検索、アクションボタン）
│           ├── EditableRawItemList（編集可能リスト）
│           ├── BookmarkImportModal（ブックマークインポート）※条件付き
│           └── ステータスバー（選択数、行数、保存状態）
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
| **メインウィンドウ（通常モード）** | `src/renderer/App.tsx` | ウィンドウ | 起動時のデフォルト状態 | 検索ボックス、アイテム一覧、アクションボタン、タブ切り替え |
| **メインウィンドウ（編集モード）** | `src/renderer/App.tsx` | ウィンドウ | Ctrl+E または設定メニューから | 生データ編集、ウィンドウサイズ拡大（1000x700px）、固定表示 |
| **アイテム登録・編集モーダル** | `src/renderer/components/RegisterModal.tsx` | モーダル | ファイルドラッグ&ドロップ時<br>編集モードで詳細編集時 | アイテム登録・編集、DIRオプション設定、保存先選択 |
| **ブックマークインポートモーダル** | `src/renderer/components/BookmarkImportModal.tsx` | モーダル | 編集モードでインポートボタンクリック時 | ブックマークHTMLファイルのインポート、検索・選択 |
| **設定ドロップダウン** | `src/renderer/components/SettingsDropdown.tsx` | ドロップダウン | ⚙ボタンクリック時 | 設定メニュー（フォルダ開く、編集モード切り替えなど） |

## コンポーネント一覧

| コンポーネント名 | ファイル | 親画面 | 表示条件 | 主要機能 |
|------------------|----------|--------|----------|----------|
| **SearchBox** | `src/renderer/components/SearchBox.tsx` | メインウィンドウ（通常モード） | 通常モード時 | リアルタイム検索、キーボードショートカット |
| **ActionButtons** | `src/renderer/components/ActionButtons.tsx` | メインウィンドウ（通常モード） | 通常モード時 | ファビコン取得、アイコン抽出、リロード、固定など |
| **TabControl** | `src/renderer/components/TabControl.tsx` | メインウィンドウ（通常モード） | 通常モード時 | メインタブ・一時タブの切り替え |
| **ItemList** | `src/renderer/components/ItemList.tsx` | メインウィンドウ（通常モード） | 通常モード時 | アイテム一覧表示、選択・実行 |
| **EditModeView** | `src/renderer/components/EditModeView.tsx` | メインウィンドウ（編集モード） | 編集モード時 | 編集モードのメインビュー、ヘッダー・ステータスバー |
| **EditableRawItemList** | `src/renderer/components/EditableRawItemList.tsx` | EditModeView | 編集モード時 | 編集可能リスト、セル編集、整列・削除 |
| **ドラッグオーバーレイ** | `src/renderer/App.tsx` | メインウィンドウ | ファイルドラッグ中 | 「ドロップして追加」メッセージ表示 |

## 画面遷移

### 通常時の画面遷移

1. **起動** → 通常モード表示
2. **Ctrl+Alt+W** → アプリ表示/非表示切り替え
3. **ドラッグ&ドロップ** → RegisterModal表示
4. **⚙ボタン** → SettingsDropdown表示
5. **Ctrl+E または 編集モード選択** → 編集モード切り替え

### 編集モード時の画面遷移

1. **編集モード開始** → EditModeView表示（ウィンドウ拡大）
2. **✏️ボタン** → RegisterModal表示
3. **ブックマークインポート** → BookmarkImportModal表示
4. **Ctrl+E または 通常モード選択** → 通常モード復帰

## キーボードショートカット

| ショートカット | 機能 | 対象画面 |
|----------------|------|----------|
| Ctrl+Alt+W | アプリ表示/非表示 | グローバル |
| Ctrl+E | 編集モード切り替え | 通常モード/編集モード |
| Enter | 選択アイテム実行 | 通常モード（SearchBox） |
| ↑↓ | アイテム選択移動 | 通常モード（SearchBox） |
| Escape | アプリを隠す | 通常モード（非固定時） |

## 特殊な表示条件

### ドラッグオーバーレイ
- **表示条件**: ファイル/フォルダをアプリ上にドラッグ中
- **内容**: 「ドロップして追加」のメッセージ表示

### ウィンドウ固定状態
- **📌ボタン**: ウィンドウ固定ON/OFF
- **固定時**: フォーカスアウトしても非表示にならない
- **編集モード**: 自動的に固定状態になる

## モーダル・ダイアログ一覧

| 名前 | 種類 | 実装場所 | 表示条件 | 設定・メッセージ |
|------|------|----------|----------|------------------|
| **ファイル選択ダイアログ** | Electronダイアログ | `src/main/ipc/dataHandlers.ts` | BookmarkImportModalでファイル選択時 | タイトル：「ブックマークファイルを選択」<br>フィルター：HTML Files (*.html, *.htm) |
| **編集モード終了確認** | window.confirm | `src/renderer/components/EditModeView.tsx` | 編集モード終了時（未保存変更あり） | 「未保存の変更があります。編集モードを終了しますか？」 |
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
   
4. **低優先度**: UI要素
   - SettingsDropdown（設定メニュー）
   - ドラッグオーバーレイ

## モーダル間の関係

- **BookmarkImportModal** → **ファイル選択ダイアログ** → **確認ダイアログ**
- **EditableRawItemList** → **RegisterModal** → **確認ダイアログ**（削除時）
- **EditModeView** → **確認ダイアログ**（終了時）