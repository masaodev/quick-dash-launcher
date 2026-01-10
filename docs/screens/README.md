# QuickDashLauncher 画面仕様

このフォルダは、**QuickDashLauncherの仕様書の主軸**となる画面仕様を管理します。

## このフォルダの役割

### 📋 仕様書の主軸

画面仕様は、以下の理由で仕様書の**中心的なドキュメント**として位置づけられます：

1. **明確な分割基準** - 画面単位で分割されているため、網羅性が高い
2. **具体的な操作手順** - ユーザーが実際に行う操作をステップごとに記載
3. **UI仕様の詳細** - レイアウト、ボタン配置、入力項目などを明確に記載
4. **完全性** - 全ての画面・モーダル・ダイアログを網羅

### 🔗 他ドキュメントとの関係

```
画面仕様（screens/）← 主軸
    ↓ 必要に応じて参照
横断的機能（features/）
    ↓ 技術詳細が必要な場合に参照
技術実装（architecture/）
```

- **features/** へ参照 - 複数画面にまたがる機能の概念説明が必要な場合
- **architecture/** へ参照 - 技術実装の詳細が必要な場合

## 執筆ガイド

新しい画面仕様書を作成する際は、以下を参照してください：

- **[テンプレート](./TEMPLATE.md)** - 新規作成時のテンプレート（コピーして使用）
- **[執筆ガイドライン](./WRITING-GUIDE.md)** - 記載ルールとベストプラクティス

## 画面構成

```
QuickDashLauncher
├── スプラッシュウィンドウ（起動時のみ）
├── 初回設定画面（初回起動時のみ）
├── メインウィンドウ
├── 管理ウィンドウ
├── ワークスペースウィンドウ
└── モーダル・ダイアログ・コンポーネント
    ├── アイテム登録・編集モーダル
    │   ├── グループアイテム選択モーダル
    │   ├── ウィンドウ選択モーダル
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

## 画面遷移図

全画面の遷移関係については、以下のドキュメントを参照してください：

**[📊 画面遷移図](./screen-transitions.md)** - すべての画面の遷移フローと関係性を視覚的に表示

## 画面仕様書一覧

### ウィンドウ

| 画面名 | 表示条件 | 詳細仕様 |
|--------|----------|----------|
| **スプラッシュウィンドウ** | アプリケーション起動時に自動表示 | （仕様書なし - 起動時のローディング画面） |
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
| **ウィンドウ選択モーダル** | アイテム登録モーダルのウィンドウ設定で「ウィンドウから取得」クリック時 | [register-modal.md](./register-modal.md#ウィンドウ選択モーダルwindowselectormodal) |
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
| **ウィンドウ設定エディター** | ウィンドウ設定（タイトル・位置・サイズ）の編集 | [register-modal.md](./register-modal.md#windowconfigeditor) |
| **カスタムアイコンエディター** | カスタムアイコンの選択・削除 | [register-modal.md](./register-modal.md#customiconeditor) |

## 関連ドキュメント

### 横断的機能
- [横断的機能一覧](../features/README.md) - 複数画面にまたがる機能の説明
- [アイコンシステム](../features/icons.md) - アイコン取得・管理機能
- [キーボードショートカット](../features/keyboard-shortcuts.md) - ショートカット完全リスト
- [グループ起動](../features/group-launch.md) - グループ機能の詳細
- [ワークスペース](../features/workspace.md) - ワークスペース機能全体

### ドキュメント体系
- [ドキュメント体系](../README.md) - 全体的なドキュメント構成の説明
