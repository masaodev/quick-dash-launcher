# QuickDashLauncher 画面一覧

このドキュメントは、QuickDashLauncherアプリケーションの画面構成の概要を示すインデックスです。

## 執筆ガイド

新しい画面仕様書を作成する際は、以下を参照してください：

- **[テンプレート](./TEMPLATE.md)** - 新規作成時のテンプレート（コピーして使用）
- **[執筆ガイドライン](./WRITING-GUIDE.md)** - 記載ルールとベストプラクティス

## 画面構成

```
QuickDashLauncher
├── 初回設定画面
├── メインウィンドウ
├── 管理ウィンドウ
└── モーダル・ダイアログ・コンポーネント
    ├── アイテム登録・編集モーダル
    │   ├── グループアイテム選択モーダル
    │   ├── フォルダ取込オプションエディタ
    │   └── FilePickerDialog
    ├── ブックマークインポートモーダル
    ├── アイコン取得進捗詳細モーダル
    ├── 右クリックメニュー
    ├── 共通ダイアログ
    │   ├── AlertDialog
    │   ├── ConfirmDialog
    │   └── FilePickerDialog
    └── 入力コンポーネント
        └── ホットキー入力
```

## 画面一覧

### ウィンドウ

| 画面名 | 表示条件 | 詳細仕様 |
|--------|----------|----------|
| **初回設定画面** | 初回起動時（`hotkey`が空文字列または未設定の場合） | [first-launch-setup.md](./first-launch-setup.md) |
| **メインウィンドウ** | 起動時デフォルト表示<br>Alt+Spaceで表示/非表示（デフォルト） | [main-window.md](./main-window.md) |
| **管理ウィンドウ** | Ctrl+E または設定メニューから | [admin-window.md](./admin-window.md) |
| **ワークスペースウィンドウ** | Ctrl+Alt+W またはシステムトレイメニューから | [workspace-window.md](./workspace-window.md) |

### モーダル

| 画面名 | 表示条件 | 詳細仕様 |
|--------|----------|----------|
| **アイテム登録・編集モーダル** | ファイルドラッグ&ドロップ時<br>➕ボタンクリック時<br>右クリック→「編集」選択時<br>管理画面で✏️ボタンクリック時 | [register-modal.md](./register-modal.md) |
| **ブックマークインポートモーダル** | 管理ウィンドウでインポートボタンクリック時 | [bookmark-import-modal.md](./bookmark-import-modal.md) |
| **グループアイテム選択モーダル** | アイテム登録モーダルでグループの「+ アイテムを追加」クリック時 | [group-item-selector-modal.md](./group-item-selector-modal.md) |
| **アイコン取得進捗詳細モーダル** | アイコン一括取得完了後、詳細ボタンクリック時 | [icon-progress-detail-modal.md](./icon-progress-detail-modal.md) |

### 共通ダイアログ

| コンポーネント名 | 用途 | 詳細仕様 |
|-----------------|------|----------|
| **AlertDialog** | エラー・警告・成功・情報メッセージの表示 | [dialogs.md](./dialogs.md#2-alertdialog) |
| **ConfirmDialog** | ユーザー確認が必要な操作<br>（削除、変更破棄など） | [dialogs.md](./dialogs.md#3-confirmdialog) |
| **FilePickerDialog** | ファイル選択<br>（ブックマークインポート、カスタムアイコン選択） | [dialogs.md](./dialogs.md#4-filepickerdialog) |

### 共通コンポーネント

| コンポーネント名 | 用途 | 詳細仕様 |
|-----------------|------|----------|
| **右クリックメニュー** | アイテムの右クリック操作<br>（パスコピー、フォルダーを開く、編集） | [context-menu.md](./context-menu.md) |
| **フォルダ取込オプションエディタ** | フォルダ取込アイテムのオプション設定 | [dir-options-editor.md](./dir-options-editor.md) |
| **ホットキー入力** | グローバルホットキーの設定入力 | [hotkey-input.md](./hotkey-input.md) |

## 仕様書一覧

### ウィンドウ仕様書

- [初回設定画面仕様書](./first-launch-setup.md) - 初回起動時の設定画面
- [メインウィンドウ仕様書](./main-window.md) - メイン画面の詳細な仕様
- [管理ウィンドウ仕様書](./admin-window.md) - 設定・管理画面の詳細な仕様
- [ワークスペースウィンドウ仕様書](./workspace-window.md) - ワークスペース画面の詳細な仕様

### モーダル仕様書

- [アイテム登録・編集モーダル仕様書](./register-modal.md) - アイテム登録・編集機能
- [ブックマークインポートモーダル仕様書](./bookmark-import-modal.md) - ブラウザブックマークのインポート機能
- [グループアイテム選択モーダル仕様書](./group-item-selector-modal.md) - グループアイテムの選択機能
- [アイコン取得進捗詳細モーダル仕様書](./icon-progress-detail-modal.md) - アイコン一括取得の結果表示

### ダイアログ・コンポーネント仕様書

- [共通ダイアログ仕様書](./dialogs.md) - AlertDialog/ConfirmDialog/FilePickerDialog
- [右クリックメニュー仕様書](./context-menu.md) - コンテキストメニュー機能
- [フォルダ取込オプションエディタ仕様書](./dir-options-editor.md) - フォルダ取込オプションの設定
- [ホットキー入力仕様書](./hotkey-input.md) - ホットキー入力コンポーネント

## 関連ドキュメント

- [アイテム管理](../features/item-management.md) - 編集機能の詳細
- [キーボードショートカット](../features/keyboard-shortcuts.md) - ショートカット完全リスト
- [アイコンシステム](../features/icons.md) - アイコン取得・管理機能
- [グループ起動](../features/group-launch.md) - グループ機能の詳細
- [フォルダ取込](../features/folder-import.md) - フォルダ取込機能の詳細
