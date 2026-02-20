# コンポーネント命名規則

Rendererプロセス（`src/renderer/`）のコンポーネント命名規則を定義します。

## プレフィックス体系

| 所属 | プレフィックス |
|------|---------------|
| メインウィンドウ | `Launcher*` |
| 管理ウィンドウ（共通） | `Admin*` |
| 管理 > 基本設定タブ | `AdminSettings*` |
| 管理 > アイテム管理タブ | `AdminItemManager*` |
| 管理 > アーカイブタブ | `AdminArchive*` |
| 管理 > その他タブ | `AdminOther*` |
| ワークスペースウィンドウ | `Workspace*` |
| 初回設定 | `Setup*` |
| 共通コンポーネント | なし |

## 共通コンポーネントの定義

以下のいずれかに該当するコンポーネントは「共通」としてプレフィックスなしとする：

1. **2つ以上のウィンドウで使用される**
2. **ビジネスロジックを持たない純粋なUI部品**（ダイアログ、入力部品など）

例：`AlertDialog`, `ConfirmDialog`, `ColorPicker`, `HotkeyInput`, `RegisterModal`

## 既知の例外（命名規則未適用）

以下のコンポーネントは管理ウィンドウ専用かつビジネスロジックを持つが、プレフィックスが付いていない。新規作成時は `Admin*` プレフィックスを使用すること。

| コンポーネント | 使用箇所 | 本来あるべきプレフィックス |
|---------------|---------|--------------------------|
| `BookmarkAutoImportSettings` | `AdminSettingsTab` | `Admin*` |
| `BackupSnapshotModal` | `AdminSettingsTab` | `Admin*` |
| `BookmarkAutoImportRuleModal` | `BookmarkAutoImportSettings` | `Admin*` |
| `BookmarkImportModal` | `AdminItemManagerView` | `Admin*` |
| `AppImportModal` | `AdminItemManagerView` | `Admin*` |
