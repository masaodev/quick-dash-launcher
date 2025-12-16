# ワークスペースウィンドウ 仕様書

## 関連ドキュメント

- [画面一覧](./README.md) - 全画面構成の概要
- [ワークスペース機能](../features/workspace.md) - 機能の使い方
- [データファイル形式](../architecture/data-format.md) - workspace.json形式
- [IPC通信](../architecture/ipc-channels.md) - ワークスペース関連のIPCチャンネル

## 1. 概要

よく使うアイテムを登録して、画面右端の専用ウィンドウで素早くアクセスできる機能です。グループ化、名前変更、並び替えに対応し、実行履歴も表示します。

**キーボードショートカット**: `Ctrl+Alt+W` (表示/非表示切り替え)

### 主要機能
- **アイテム管理**: メイン画面からアイテムを追加・削除・名前変更
- **クリップボードペースト**: Ctrl+VでURL、ファイルパス、ファイルを直接追加
- **グループ管理**: アイテムをグループに分類して整理
- **ドラッグ&ドロップ**: アイテムの並び替えやグループ間移動
- **実行履歴**: 直近10件の実行履歴を表示・再起動
- **コンテキストメニュー**: 右クリックで各種操作
- **ウィンドウカスタマイズ**: 透過度調整、サイズ変更、ピン留め

## 2. 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/WorkspaceApp.tsx` |
| **コンポーネント名** | `WorkspaceApp` |
| **スタイル** | `src/renderer/styles/components/WorkspaceWindow.css` |
| **表示条件** | `Ctrl+Alt+W`または、システムトレイメニューから「ワークスペースを表示」 |
| **画面タイプ** | ウィンドウ（AlwaysOnTop切り替え可能、フレームレス） |
| **初期サイズ** | 幅380px × 画面の高さに合わせて自動調整 |
| **サイズ変更** | 8方向のハンドルで自由にリサイズ可能（最小: 300x400px） |
| **配置位置** | 画面右端に固定（初期配置）、ドラッグで移動可能 |
| **透過機能** | 0-100%の透過度調整、背景のみ透過モード |

## 2.1. コンポーネント構成

ワークスペースウィンドウはカスタムフックとコンポーネント分離により、保守性と可読性を向上させています。

### 主要コンポーネント

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| **WorkspaceApp** | `WorkspaceApp.tsx` | メインコンポーネント（444行→216行にリファクタリング） |
| **WorkspaceHeader** | `components/WorkspaceHeader.tsx` | ヘッダー（タイトル、展開/折りたたみ、ピン留めボタン） |
| **WorkspaceGroupedList** | `components/WorkspaceGroupedList.tsx` | アイテムリスト（460行→385行にリファクタリング） |
| **WorkspaceGroupHeader** | `components/WorkspaceGroupHeader.tsx` | グループヘッダー |
| **ExecutionHistoryItemCard** | `components/ExecutionHistoryItemCard.tsx` | 実行履歴アイテム |

### カスタムフック

| フック | ファイル | 責務 |
|-------|---------|------|
| **useWorkspaceData** | `hooks/useWorkspaceData.ts` | データ読み込みと状態管理 |
| **useWorkspaceActions** | `hooks/useWorkspaceActions.ts` | アクション処理の統合 |
| **useNativeDragDrop** | `hooks/useNativeDragDrop.ts` | ネイティブドラッグ&ドロップ処理 |
| **useClipboardPaste** | `hooks/useClipboardPaste.ts` | クリップボードペースト処理（Ctrl+V） |
| **useCollapsibleSections** | `hooks/useCollapsibleSections.ts` | 折りたたみ状態管理 |
| **useWorkspaceItemGroups** | `hooks/useWorkspaceItemGroups.ts` | アイテムグループ化ロジック |
| **useWorkspaceContextMenu** | `hooks/useWorkspaceContextMenu.ts` | コンテキストメニュー管理 |
| **useWorkspaceDragDrop** | `hooks/useWorkspaceDragDrop.ts` | 型安全なドラッグ&ドロップヘルパー |

**リファクタリングの効果:**
- WorkspaceApp.tsx: 51%のコード削減（444行→216行）
- WorkspaceGroupedList.tsx: 16%のコード削減（460行→385行）
- 責務の明確化と再利用性の向上
- 型安全性の向上（DragItemData型による型安全なドラッグ&ドロップ）

## 3. スタイル

### 主要なCSSクラス

| クラス名 | 説明 |
|---------|------|
| `.workspace-window` | ウィンドウコンテナ |
| `.workspace-header` | ヘッダーエリア |
| `.workspace-items` | アイテムリストエリア |
| `.workspace-group` | グループセクション |
| `.workspace-group-header` | グループヘッダー |
| `.workspace-item-card` | アイテムカード |
| `.workspace-item-delete-btn` | アイテム削除ボタン（×） |
| `.execution-history` | 実行履歴セクション |
| `.execution-history-item` | 実行履歴アイテムカード |
| `.workspace-resize-handle` | サイズ変更ハンドル（8方向） |
| `.background-transparent` | 背景のみ透過モード |

### アイテム削除ボタン（×）のスタイル

```css
.workspace-item-delete-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-white);
  background-color: var(--color-danger);
  color: var(--color-white);
  border-radius: 50%; /* 丸いボタン */
  cursor: pointer;
  font-size: 18px;
  font-weight: bold; /* 太字で視認性向上 */
  line-height: 1;
  opacity: 0; /* 通常時は非表示 */
  transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.workspace-item-card:hover .workspace-item-delete-btn {
  opacity: 1; /* アイテムカードホバー時に表示 */
}

.workspace-item-delete-btn:hover {
  background-color: var(--color-danger-hover);
  transform: scale(1.1); /* ホバー時に拡大 */
}

.workspace-item-delete-btn:active {
  background-color: var(--color-danger-hover);
  transform: scale(0.95); /* クリック時に縮小 */
}
```

**デザインの特徴:**
- 丸いボタンデザインで他の×ボタンと統一
- 赤色（削除系）で用途を明確化
- アイテムカードホバー時に表示される（`opacity: 0` → `opacity: 1`）
- 白い縁取りと影でコントラスト向上
- ホバー時のスケールアップとクリック時のフィードバック

詳細は **[CSSデザインシステム - 閉じる・削除ボタンクラス](../architecture/css-design.md#閉じる削除ボタンクラス)** を参照してください。

## 3.1. ウィンドウカスタマイズ機能

### 透過機能

ワークスペースウィンドウの透過度を調整できます：

- **透過度**: 0-100%で調整（設定画面のスライダーで変更）
- **背景のみ透過**: チェックボックスで有効化すると、ウィンドウ背景のみが透過され、アイテムやボタンは不透明のまま表示
- **即座反映**: 設定変更は即座にワークスペースウィンドウに反映

**実装:**
- Electronの`setOpacity()`でウィンドウ全体の透過度を設定
- 背景のみ透過モードでは、`.background-transparent`クラスを追加し、アイテムとボタンに`opacity: 1`を設定

### サイズ変更ハンドル

8方向のカスタムハンドルでウィンドウを自由にリサイズ：

| ハンドル位置 | クラス名 | 動作 |
|------------|---------|------|
| 左上 | `.workspace-resize-handle.top-left` | 左辺+上辺を同時に移動 |
| 上 | `.workspace-resize-handle.top` | 上辺を移動 |
| 右上 | `.workspace-resize-handle.top-right` | 右辺+上辺を同時に移動 |
| 右 | `.workspace-resize-handle.right` | 右辺を移動 |
| 右下 | `.workspace-resize-handle.bottom-right` | 右辺+下辺を同時に移動 |
| 下 | `.workspace-resize-handle.bottom` | 下辺を移動 |
| 左下 | `.workspace-resize-handle.bottom-left` | 左辺+下辺を同時に移動 |
| 左 | `.workspace-resize-handle.left` | 左辺を移動 |

**最小サイズ制約:**
- 幅: 300px
- 高さ: 400px

**実装:**
- `onMouseDown`イベントでドラッグ開始
- `mousemove`イベントで座標差分を計算し、`workspace:set-position-and-size` IPCチャンネルでウィンドウサイズを更新
- `mouseup`イベントでドラッグ終了

### ウィンドウ制御ボタン

ヘッダーに配置された制御ボタン：

| ボタン | 機能 | IPCチャンネル |
|-------|------|-------------|
| 📌 | ピン留め（常に最前面）のトグル | `workspace:toggle-always-on-top` |
| × | ウィンドウを非表示 | `workspace:hide-window` |

### クリップボードペースト（Ctrl+V）

`useClipboardPaste`フックでクリップボードからアイテムを追加：

**対応形式:**
1. **テキスト**: URL、ファイルパス、カスタムURIスキーマ（`obsidian://`等）
2. **ファイルオブジェクト**: エクスプローラーからCtrl+Cでコピーしたファイル

**処理フロー:**
1. `keydown`イベント（Ctrl+V）または`paste`イベントを検出
2. テキストの場合: `navigator.clipboard.readText()`で取得 → `detectItemTypeSync()`で判定 → URLならファビコン取得 → `workspace:add-item` IPCで追加
3. ファイルオブジェクトの場合: `window.electronAPI.getPathForFile()`でパス取得 → `workspace:add-items-from-paths` IPCで追加
4. UI更新コールバックを実行

**注意:**
- Input/Textarea要素内でのペーストはスキップ（通常の入力として処理）
- テキストペーストの場合、最初の行のみを使用

## 4. 関連ドキュメント

- [ワークスペース機能](../features/workspace.md) - 機能の詳細な使い方
- [データファイル形式](../architecture/data-format.md) - workspace.json/execution-history.json形式
- [IPC通信](../architecture/ipc-channels.md) - ワークスペース関連のIPCチャンネル
- [キーボードショートカット](../features/keyboard-shortcuts.md) - 全ショートカット一覧
- [CSSデザインシステム](../architecture/css-design.md) - スタイルガイドライン
