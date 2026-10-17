# UIコンポーネント

QuickDashLauncherで使う共通UIコンポーネントの規約を書く。実装は `src/renderer/components/ui/` が正である。

## 設計思想

- **一貫性**: 全画面で同じ見た目・操作感のUI部品を使う
- **型安全**: props を TypeScript で定義し、誤用を防ぐ
- **CSS変数連携**: スタイルは `variables.css` のデザイントークンで書く
- **CSSクラスとの共存**: 文字のあるボタンは Buttonコンポーネントで書き、アイコンだけのボタン・タブ・メニューの項目などの特殊なボタンは専用のCSSクラスで書く（[使い分けガイド](#使い分けガイド)）

## Buttonコンポーネント

汎用ボタン。実装は `src/renderer/components/ui/Button.tsx`、スタイルは `src/renderer/styles/components/Button.css`（クラスの対応は同ファイルを参照）。

props はコードを正とし、ここには写さない。決まりとして守るのは `variant` の使い分けだけ。

| variant | 見た目 | 使う場面 |
| --- | --- | --- |
| `primary` | 青の塗り | 確定・保存・登録などの主操作。1 つの領域（ダイアログのフッター、ツールバーの左右など）に 1 個まで |
| `secondary`（既定） | 白地に灰色の枠 | キャンセル・閉じる・変更を破棄と、補助の操作（ファイルを選択・再スキャン・試しに実行など） |
| `danger` | 白地に赤の枠と赤文字 | 削除・リセット・終了など危険な操作。押すと確認ダイアログが出るボタンもこれ |
| `danger-solid` | 赤の塗り | 元に戻せない操作の最終確認（確認ダイアログの確定ボタン）だけ |

- 無効（`disabled`）は種類にかかわらず同じ見た目（薄い灰色の地・灰色の文字・薄い枠）にする。半透明にしない（元の色が薄いと文字が読めなくなるため）
- 青や赤の塗りは目立つので、1 つの画面に何個も並べない。迷ったら `secondary` にする

インポートは `import { Button } from './ui';` にそろえる（`./ui/Button` を直接 import しているファイルが一部に残っている。触るときに直す）。

## 使い分けガイド

### Buttonコンポーネントを使う場合

文字のあるボタンはすべて Buttonコンポーネントを使う。モーダル・ダイアログのアクションボタン（確定・キャンセル・削除）、フォームの送信ボタン、入力欄の横の小さなボタン（ファイルを選択など）も同じ。色はコンポーネントの CSS に書かず、配置（余白・幅・寄せ）だけを `className` で足す（[css-design.md](css-design.md) の推奨と同じ）。

### 従来のCSSクラスを使う場合

以下のような特殊なボタンは、専用のCSSクラスを使う。

| 用途 | 推奨クラス |
| --- | --- |
| ヘッダーの正方形アイコンボタン（メイン・ワークスペース） | `.action-btn` |
| タブ切り替えボタン | `.tab-button`（設定タブのカテゴリ切り替えは `.menu-item`、ウィンドウを選ぶ画面の仮想デスクトップのタブとそれにそろえたタブは `.desktop-tab`） |
| 閉じる・削除の ×（検索クリアを含む） | `.close-btn`（[css-design.md](css-design.md#閉じる削除ボタンクラス)） |
| ドロップダウントリガー | `.dropdown-trigger-btn` |
| 一覧の行の削除アイコンボタン（🗑） | `.delete-button` |

### ダイアログのフッター

- `.modal-actions` は `Modal.css` の右寄せを全ダイアログで共通にする。画面ごとの CSS でグローバルに上書きしない（同じ CSS を読むウィンドウの全ダイアログに効いてしまう）。配置を変えたい画面は `.icon-detail-modal .modal-actions` のようにスコープを付ける
- 左端に置くボタン（登録・編集ウィンドウとワークスペースのアイテム編集の「⚡ 試しに実行」）があるときは、残りを `.modal-actions-right`（`margin-left: auto`）で包んで右に寄せる

## コンポーネント命名規則

Rendererプロセス（`src/renderer/`）のコンポーネント命名規則を定義する。

### プレフィックス体系

| 所属 | プレフィックス |
| --- | --- |
| メインウィンドウ | `Launcher*` |
| 管理ウィンドウ（共通） | `Admin*` |
| 管理 > 設定タブ | `AdminSettings*` |
| 管理 > アイテム管理タブ | `AdminItemManager*` |
| 管理 > ヘルプタブ | `AdminOther*` |
| ワークスペースウィンドウ | `Workspace*` |
| 初回設定 | `Setup*` |
| 共通コンポーネント | なし |

### 共通コンポーネントの定義

以下のいずれかに該当するコンポーネントは「共通」としてプレフィックスなしとする。

1. **2つ以上のウィンドウで使用される**
2. **ビジネスロジックを持たない純粋なUI部品**（ダイアログ、入力部品など）

例：`AlertDialog`, `ConfirmDialog`, `ColorPicker`, `HotkeyInput`, `MemoViewModal`（メモの表示。メインウィンドウとワークスペースウィンドウで使う）, `SetEntriesEditor`（セットの行の編集。登録・編集とワークスペースのアイテム編集の 2 つのウィンドウで使う。そこから開く `SetItemPickerModal`・`SetAddWindowsModal`・`SetUpdatePositionsModal`・`SetEntryDetailModal` も同じ）, `ItemWindowSwitchEditor`（単一アイテムのウィンドウ切り替え。中の 3 つの枠 `WindowMatchFields`・`WindowPlacementFields`・`OpenBehaviorFields`（`WindowSwitchFields.tsx`）は `SetEntryDetailModal` と共用）

### 既知の例外（命名規則未適用）

以下のコンポーネントは 1 つのウィンドウ専用でビジネスロジックを持つが、プレフィックスが付いていない。新規作成時は所属のプレフィックスを使うこと。

| コンポーネント | 使用箇所 | 本来あるべきプレフィックス |
| --- | --- | --- |
| `BookmarkAutoImportSettings` | `AdminSettingsTab` | `Admin*` |
| `BackupSnapshotModal` | `AdminSettingsBackupSection` | `Admin*` |
| `BookmarkAutoImportRuleModal` | `BookmarkAutoImportSettings` | `Admin*` |
| `BookmarkImportModal` | `AdminItemManagerView` | `Admin*` |
| `ImportDestinationBand` | `AppImportModal`、`BookmarkImportModal`、`BookmarkAutoImportRuleModal` | `Admin*` |
| `AppImportModal` | `AdminItemManagerView` | `Admin*` |
| `MissingIconNotice` | `App`（メインウィンドウ） | `Launcher*` |

メインウィンドウの子ウィンドウ（登録・編集、アイコン取得結果）の部品（`RegisterModal`・`RegisterPlacementBar`・`RegisterWindowPage`・`IconProgressDetailModal`・`MainChildPage`）はプレフィックスなしで、子ウィンドウに付けるプレフィックスはまだ決めていない。
