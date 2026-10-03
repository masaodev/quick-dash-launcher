# UIコンポーネント

QuickDashLauncherで使う共通UIコンポーネントの規約を書く。実装は `src/renderer/components/ui/` が正である。

## 設計思想

- **一貫性**: 全画面で同じ見た目・操作感のUI部品を使う
- **型安全**: props を TypeScript で定義し、誤用を防ぐ
- **CSS変数連携**: スタイルは `variables.css` のデザイントークンで書く
- **段階的移行**: 既存のCSSクラスによる実装と共存させ、触る箇所から順次置き換える

## Buttonコンポーネント

汎用ボタン。実装は `src/renderer/components/ui/Button.tsx`、スタイルは `src/renderer/styles/components/Button.css`（クラスの対応は同ファイルを参照）。

- `variant`: `primary`（主要アクション：確定・保存・登録）／`danger`（削除・リセットなど危険な操作）／`info`（補助アクション）／`cancel`（キャンセル）。既定は `info`
- `size`: `sm`／`md`／`lg`。既定は `md`
- `fullWidth`: 幅いっぱいに広げる。既定は `false`
- 標準の `<button>` 属性（`type`、`disabled`、`aria-*` など）はそのまま渡せる

インポートは `import { Button } from './ui';`。

```tsx
<div className="modal-actions">
  <Button variant="cancel" onClick={onClose}>
    キャンセル
  </Button>
  <Button variant="primary" onClick={onConfirm}>
    確定
  </Button>
</div>
```

## 使い分けガイド

### Buttonコンポーネントを使う場合

- モーダルのアクションボタン（確定、キャンセル、削除）
- フォームの送信ボタン
- ダイアログのOK/キャンセル

### 従来のCSSクラスを使う場合

以下のような特殊なボタンは、専用のCSSクラスを使う。

| 用途                           | 推奨クラス                   |
| ------------------------------ | ---------------------------- |
| ヘッダーの正方形アイコンボタン | `.action-btn`                |
| タブ切り替えボタン             | `.menu-item`, `.desktop-tab` |
| 検索クリアボタン               | `.search-clear-button`       |
| ドロップダウントリガー         | `.dropdown-trigger-btn`      |

## コンポーネント命名規則

Rendererプロセス（`src/renderer/`）のコンポーネント命名規則を定義する。

### プレフィックス体系

| 所属                     | プレフィックス      |
| ------------------------ | ------------------- |
| メインウィンドウ         | `Launcher*`         |
| 管理ウィンドウ（共通）   | `Admin*`            |
| 管理 > 基本設定タブ      | `AdminSettings*`    |
| 管理 > アイテム管理タブ  | `AdminItemManager*` |
| 管理 > ヘルプタブ        | `AdminOther*`       |
| ワークスペースウィンドウ | `Workspace*`        |
| 初回設定                 | `Setup*`            |
| 共通コンポーネント       | なし                |

### 共通コンポーネントの定義

以下のいずれかに該当するコンポーネントは「共通」としてプレフィックスなしとする。

1. **2つ以上のウィンドウで使用される**
2. **ビジネスロジックを持たない純粋なUI部品**（ダイアログ、入力部品など）

例：`AlertDialog`, `ConfirmDialog`, `ColorPicker`, `HotkeyInput`, `RegisterModal`

### 既知の例外（命名規則未適用）

以下のコンポーネントは管理ウィンドウ専用かつビジネスロジックを持つが、プレフィックスが付いていない。新規作成時は `Admin*` プレフィックスを使用すること。

| コンポーネント                | 使用箇所                                                           | 本来あるべきプレフィックス |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------- |
| `BookmarkAutoImportSettings`  | `AdminSettingsTab`                                                 | `Admin*`                   |
| `BackupSnapshotModal`         | `AdminSettingsBackupSection`                                       | `Admin*`                   |
| `BookmarkAutoImportRuleModal` | `BookmarkAutoImportSettings`、`AdminItemManagerView`（取込モード） | `Admin*`                   |
| `AppImportModal`              | `AdminItemManagerView`                                             | `Admin*`                   |
