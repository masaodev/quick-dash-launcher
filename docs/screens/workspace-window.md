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
| **useCollapsibleSections** | `hooks/useCollapsibleSections.ts` | 折りたたみ状態管理 |
| **useWorkspaceItemGroups** | `hooks/useWorkspaceItemGroups.ts` | アイテムグループ化ロジック |
| **useWorkspaceContextMenu** | `hooks/useWorkspaceContextMenu.ts` | コンテキストメニュー管理 |
| **useWorkspaceDragDrop** | `hooks/useWorkspaceDragDrop.ts` | 型安全なドラッグ&ドロップヘルパー |

**リファクタリングの効果:**
- WorkspaceApp.tsx: 51%のコード削減（444行→216行）
- WorkspaceGroupedList.tsx: 16%のコード削減（460行→385行）
- 責務の明確化と再利用性の向上
- 型安全性の向上（DragItemData型による型安全なドラッグ&ドロップ）

## 3. 関連ドキュメント

- [ワークスペース機能](../features/workspace.md) - 機能の詳細な使い方
- [データファイル形式](../architecture/data-format.md) - workspace.json/execution-history.json形式
- [IPC通信](../architecture/ipc-channels.md) - ワークスペース関連のIPCチャンネル
- [キーボードショートカット](../features/keyboard-shortcuts.md) - 全ショートカット一覧
