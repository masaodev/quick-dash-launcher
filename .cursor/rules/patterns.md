# 実装パターンとベストプラクティス

このドキュメントは、QuickDashLauncherプロジェクトで発見・確立された効率的な実装パターンを記録します。

## Electronアプリケーション パターン

### IPCハンドラーの構造化
- 機能ごとにハンドラーを分離（`src/main/ipc/`）
- 各ハンドラーは単一責任の原則に従う
- 型安全性のため`src/common/types.ts`で共有型を定義

### プロセス間通信のベストプラクティス
```typescript
// メインプロセス側
ipcMain.handle('channel-name', async (event, args) => {
  try {
    // 処理
    return { success: true, data: result };
  } catch (error) {
    console.error('Error in channel-name:', error);
    return { success: false, error: error.message };
  }
});

// レンダラー側（preload経由）
const result = await window.api.channelName(args);
```

### ファイルパスの処理
- 開発/本番環境の違いを考慮
- `app.isPackaged`を使用して環境を判定
- パスは常に絶対パスで処理

## React + TypeScript パターン

### 状態管理
- 小規模な状態は`useState`で管理
- グローバル状態は必要に応じてContextを使用

### 型定義
- インターフェースは`I`プレフィックスを使用
- 型は`src/common/types.ts`で一元管理

## パフォーマンス最適化

### アイコンのキャッシュ
- ファビコンは`%APPDATA%/quickdashlauncher/config/favicons/`にキャッシュ
- ダウンロード前にキャッシュの存在を確認

### 検索の最適化
- 大文字小文字を区別しないインクリメンタルサーチ
- フィルタリングはレンダラー側でリアルタイム実行

## 更新履歴
- 2025-07-04: 初版作成