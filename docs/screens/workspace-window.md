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
- **グループ管理**: アイテムをグループに分類して整理
- **ドラッグ&ドロップ**: アイテムの並び替えやグループ間移動
- **実行履歴**: 直近10件の実行履歴を表示・再起動
- **コンテキストメニュー**: 右クリックで各種操作
- **アーカイブ**: グループ単位でアーカイブ・復元

## 2. 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/WorkspaceApp.tsx` |
| **コンポーネント名** | `WorkspaceApp` |
| **スタイル** | `src/renderer/styles/components/WorkspaceWindow.css` |
| **表示条件** | `Ctrl+Alt+W`または、システムトレイメニューから「ワークスペースを表示」 |
| **画面タイプ** | ウィンドウ（AlwaysOnTop、フレームレス） |
| **ウィンドウサイズ** | 幅380px × 画面の高さに合わせて自動調整 |
| **配置位置** | 画面右端に固定 |

## 2.1. コンポーネント構成

ワークスペースウィンドウはカスタムフックとコンポーネント分離により、保守性と可読性を向上させています。

### 主要コンポーネント

| コンポーネント | ファイル | 役割 |
|--------------|---------|------|
| **WorkspaceApp** | `WorkspaceApp.tsx` | メインコンポーネント（444行→216行にリファクタリング） |
| **WorkspaceHeader** | `components/WorkspaceHeader.tsx` | ヘッダー（タイトル、展開/折りたたみ、ピン留め、アーカイブボタン） |
| **WorkspaceGroupedList** | `components/WorkspaceGroupedList.tsx` | アイテムリスト（460行→385行にリファクタリング） |
| **WorkspaceGroupHeader** | `components/WorkspaceGroupHeader.tsx` | グループヘッダー（編集、色変更、アーカイブ、削除ボタン） |
| **ExecutionHistoryItemCard** | `components/ExecutionHistoryItemCard.tsx` | 実行履歴アイテム |

### カスタムフック

| フック | ファイル | 責務 |
|-------|---------|------|
| **useWorkspaceData** | `hooks/useWorkspaceData.ts` | データ読み込みと状態管理 |
| **useWorkspaceActions** | `hooks/useWorkspaceActions.ts` | アクション処理の統合 |
| **useNativeDragDrop** | `hooks/useNativeDragDrop.ts` | ネイティブドラッグ&ドロップ処理 |
| **useClipboardPaste** | `hooks/useClipboardPaste.ts` | クリップボードからのペースト処理 |
| **useCollapsibleSections** | `hooks/useCollapsibleSections.ts` | 折りたたみ状態管理 |
| **useWorkspaceItemGroups** | `hooks/useWorkspaceItemGroups.ts` | アイテムグループ化ロジック |
| **useWorkspaceContextMenu** | `hooks/useWorkspaceContextMenu.ts` | コンテキストメニュー管理（6つのパス操作を1つの関数に統合） |
| **useWorkspaceDragDrop** | `hooks/useWorkspaceDragDrop.ts` | 型安全なドラッグ&ドロップヘルパー |
| **useWorkspaceResize** | `hooks/useWorkspaceResize.ts` | ウィンドウのサイズ変更処理（70行の複雑なロジックを分離） |
| **useFileOperations** | `hooks/useFileOperations.ts` | ファイルとURL操作の共通ユーティリティ（重複コード削減） |

**リファクタリングの効果:**
- **WorkspaceApp.tsx**: 51%のコード削減（444行→216行）- 複雑なロジックをカスタムフックに分離
- **WorkspaceGroupedList.tsx**: 16%のコード削減（460行→385行）- Props構造を改善（24個→3つのオブジェクト）
- **useWorkspaceContextMenu**: 6つのパス操作ハンドラーを1つのジェネリック関数`handlePathOperation`に統合
- **重複コード削減**: useNativeDragDropとuseClipboardPasteの共通ロジックをuseFileOperationsに抽出
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
| `.workspace-group-header-btn` | グループヘッダーのアクションボタン（編集、色、アーカイブ、削除） |
| `.workspace-item-card` | アイテムカード |
| `.workspace-item-delete-btn` | アイテム削除ボタン（×） |
| `.execution-history` | 実行履歴セクション |
| `.execution-history-item` | 実行履歴アイテムカード |

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

## 4. 関連ドキュメント

- [ワークスペース機能](../features/workspace.md) - 機能の詳細な使い方
- [データファイル形式](../architecture/data-format.md) - workspace.json/execution-history.json形式
- [IPC通信](../architecture/ipc-channels.md) - ワークスペース関連のIPCチャンネル
- [キーボードショートカット](../features/keyboard-shortcuts.md) - 全ショートカット一覧
- [CSSデザインシステム](../architecture/css-design.md) - スタイルガイドライン
