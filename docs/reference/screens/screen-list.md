# QuickDashLauncher 画面一覧

このドキュメントは、QuickDashLauncherアプリケーションの画面構成の概要を示すインデックスです。

## 画面構成

```
QuickDashLauncher
├── 初回設定画面
├── メインウィンドウ
├── 管理ウィンドウ
└── モーダル・ダイアログ
    ├── アイテム登録・編集モーダル
    ├── ブックマークインポートモーダル
    ├── AlertDialog（通知ダイアログ）
    ├── ConfirmDialog（確認ダイアログ）
    └── FilePickerDialog（ファイル選択ダイアログ）
```

## 画面一覧

| 画面名 | 表示条件 | 詳細仕様 |
|--------|----------|----------|
| **初回設定画面** | 初回起動時（`hotkey`が空文字列または未設定の場合） | 📋 [詳細仕様書](./first-launch-setup.md) |
| **メインウィンドウ** | 起動時デフォルト表示<br>Alt+Spaceで表示/非表示（デフォルト） | 📋 [詳細仕様書](./main-window.md) |
| **管理ウィンドウ** | Ctrl+E または設定メニューから | 📋 [詳細仕様書](./admin-window.md) |
| **アイテム登録・編集モーダル** | ファイルドラッグ&ドロップ時<br>メインウィンドウのアイテム登録ボタン（➕）クリック時<br>メインウィンドウでアイテム右クリック→「編集」選択時<br>アイテム管理で詳細編集時 | - |
| **ブックマークインポートモーダル** | 管理ウィンドウでインポートボタンクリック時 | 📋 [詳細仕様書](./bookmark-import-modal.md) |
| **AlertDialog** | エラー・警告・成功メッセージ表示時 | 4タイプ（info/error/warning/success）、ESC/Enterキー対応 |
| **ConfirmDialog** | ユーザー確認が必要な操作時<br>（アイテム削除、設定変更など） | キャンセル/確認ボタン、ESC/Enterキー対応、dangerモード対応 |
| **FilePickerDialog** | ファイル選択が必要な操作時<br>（ブックマークインポート、カスタムアイコン選択） | ファイルタイプフィルター（HTML/Image）、ESCキー対応 |

## 関連ドキュメント

- [初回設定画面仕様書](./first-launch-setup.md) - 初回起動時の設定画面
- [メインウィンドウ仕様書](./main-window.md) - メイン画面の詳細な仕様
- [管理ウィンドウ仕様書](./admin-window.md) - 設定・管理画面の詳細な仕様
- [ブックマークインポートモーダル仕様書](./bookmark-import-modal.md) - インポート機能の詳細
- [アイテム管理](../../manual/item-management.md) - 編集機能の詳細
- [キーボードショートカット](../keyboard-shortcuts.md) - ショートカット完全リスト
- [画面仕様書テンプレート](../../templates/screen-specification-template.md) - 新規画面仕様書作成時のテンプレート
