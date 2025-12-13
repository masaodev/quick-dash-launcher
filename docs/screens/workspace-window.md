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

## 3. 関連ドキュメント

- [ワークスペース機能](../features/workspace.md) - 機能の詳細な使い方
- [データファイル形式](../architecture/data-format.md) - workspace.json/execution-history.json形式
- [IPC通信](../architecture/ipc-channels.md) - ワークスペース関連のIPCチャンネル
- [キーボードショートカット](../features/keyboard-shortcuts.md) - 全ショートカット一覧
