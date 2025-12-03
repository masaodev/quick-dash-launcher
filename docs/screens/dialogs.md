# 共通ダイアログ仕様書

## 関連ドキュメント

- [画面一覧](./README.md) - 全画面構成の概要
- [メインウィンドウ](./main-window.md) - メイン画面の詳細仕様
- [管理ウィンドウ](./admin-window.md) - 管理画面の詳細仕様

## 1. 概要

本ドキュメントでは、アプリケーション全体で使用される共通ダイアログコンポーネントの仕様を定義します。

### 対象コンポーネント

| コンポーネント | 用途 | 主な使用シーン |
|---------------|------|---------------|
| AlertDialog | 通知・警告の表示 | エラー通知、成功メッセージ、警告表示 |
| ConfirmDialog | ユーザーへの確認 | 削除確認、操作確認、破棄確認 |
| FilePickerDialog | ファイル選択 | アイコン選択、ブックマークインポート |

### 共通仕様

**キーボードショートカット:**
- Escapeキー: ダイアログを閉じる（全ダイアログ共通）
- Enterキー: 確定操作（AlertDialog: OK、ConfirmDialog: 確認）

**オーバーレイ動作:**
- オーバーレイ領域クリックでダイアログを閉じる
- ダイアログ本体のクリックは伝播しない（閉じない）

---

## 2. AlertDialog

### 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/components/AlertDialog.tsx` |
| **コンポーネント名** | `AlertDialog` |
| **スタイル** | `src/renderer/styles/components/AlertDialog.css` |
| **用途** | ユーザーへの通知、警告、エラー、成功メッセージの表示 |

### Props

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|:----:|-----------|------|
| `isOpen` | `boolean` | ○ | - | ダイアログの表示状態 |
| `onClose` | `() => void` | ○ | - | 閉じる時のコールバック |
| `title` | `string` | - | タイプにより変動 | ダイアログのタイトル |
| `message` | `string` | ○ | - | 表示するメッセージ |
| `type` | `'info' \| 'error' \| 'warning' \| 'success'` | - | `'info'` | ダイアログのタイプ |

### タイプ別の表示

| タイプ | アイコン | デフォルトタイトル | 用途 |
|--------|---------|------------------|------|
| `info` | ℹ️ | 「お知らせ」 | 一般的な情報通知 |
| `error` | ❌ | 「エラー」 | エラー発生時の通知 |
| `warning` | ⚠️ | 「警告」 | 注意が必要な操作の警告 |
| `success` | ✅ | 「成功」 | 操作成功時の通知 |

### 画面項目一覧

| エリア | 項目名 | 内容・説明 | 表示条件 |
|--------|--------|------------|----------|
| **ヘッダー** | アイコン | タイプに応じたアイコン | 常時表示 |
| **ヘッダー** | タイトル | カスタムタイトルまたはデフォルトタイトル | 常時表示 |
| **本文** | メッセージ | 通知内容のテキスト | 常時表示 |
| **フッター** | OKボタン | ダイアログを閉じる | 常時表示 |

### キーボード操作

| キー | 動作 |
|------|------|
| Escape | ダイアログを閉じる |
| Enter | OKボタンを押す（ダイアログを閉じる） |

### 使用例

```tsx
<AlertDialog
  isOpen={showAlert}
  onClose={() => setShowAlert(false)}
  type="error"
  title="保存エラー"
  message="ファイルの保存に失敗しました。"
/>
```

### テスト用データ属性

| 属性 | 対象要素 |
|------|---------|
| `data-testid="alert-dialog-overlay"` | オーバーレイ |
| `data-testid="alert-dialog"` | ダイアログ本体 |
| `data-testid="alert-dialog-ok-button"` | OKボタン |

---

## 3. ConfirmDialog

### 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/components/ConfirmDialog.tsx` |
| **コンポーネント名** | `ConfirmDialog` |
| **スタイル** | `src/renderer/styles/components/ConfirmDialog.css` |
| **用途** | 重要な操作の前にユーザーへの確認を求める |

### Props

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|:----:|-----------|------|
| `isOpen` | `boolean` | ○ | - | ダイアログの表示状態 |
| `onClose` | `() => void` | ○ | - | キャンセル時のコールバック |
| `onConfirm` | `() => void` | ○ | - | 確認時のコールバック |
| `title` | `string` | - | `'確認'` | ダイアログのタイトル |
| `message` | `string` | ○ | - | 確認メッセージ |
| `confirmText` | `string` | - | `'OK'` | 確認ボタンのテキスト |
| `cancelText` | `string` | - | `'キャンセル'` | キャンセルボタンのテキスト |
| `danger` | `boolean` | - | `false` | 危険な操作として強調表示するか |

### 画面項目一覧

| エリア | 項目名 | 内容・説明 | 表示条件 |
|--------|--------|------------|----------|
| **ヘッダー** | タイトル | 確認ダイアログのタイトル | 常時表示 |
| **本文** | メッセージ | 確認内容のテキスト | 常時表示 |
| **フッター** | キャンセルボタン | ダイアログを閉じて操作をキャンセル | 常時表示 |
| **フッター** | 確認ボタン | 操作を確定して実行 | 常時表示 |

### dangerモード

`danger={true}`を指定すると、以下の変更が適用されます：

- ダイアログに`confirm-danger`クラスが追加
- 確認ボタンに`danger-button`クラスが適用（赤色系の強調表示）
- 削除操作など、元に戻せない操作の確認に使用

### キーボード操作

| キー | 動作 |
|------|------|
| Escape | キャンセル（onCloseを実行） |
| Enter | 確認（onConfirmを実行） |

### 使用例

```tsx
// 通常の確認ダイアログ
<ConfirmDialog
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleSave}
  title="変更の保存"
  message="変更を保存しますか？"
/>

// 危険な操作の確認ダイアログ
<ConfirmDialog
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={handleDelete}
  title="削除の確認"
  message="選択したアイテムを削除しますか？この操作は元に戻せません。"
  confirmText="削除"
  cancelText="キャンセル"
  danger={true}
/>
```

### テスト用データ属性

| 属性 | 対象要素 |
|------|---------|
| `data-testid="confirm-dialog-overlay"` | オーバーレイ |
| `data-testid="confirm-dialog"` | ダイアログ本体 |
| `data-testid="confirm-dialog-cancel-button"` | キャンセルボタン |
| `data-testid="confirm-dialog-confirm-button"` | 確認ボタン |

---

## 4. FilePickerDialog

### 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/components/FilePickerDialog.tsx` |
| **コンポーネント名** | `FilePickerDialog` |
| **スタイル** | `src/renderer/styles/components/FilePickerDialog.css` |
| **用途** | ファイル選択ダイアログの表示（Electron APIを利用） |

### Props

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|:----:|-----------|------|
| `isOpen` | `boolean` | ○ | - | ダイアログの表示状態 |
| `onClose` | `() => void` | ○ | - | 閉じる時のコールバック |
| `onFileSelect` | `(filePath: string) => void` | ○ | - | ファイル選択時のコールバック |
| `title` | `string` | - | `'ファイルを選択'` | ダイアログのタイトル |
| `fileTypes` | `'html' \| 'image' \| 'all'` | - | `'all'` | ファイルタイプフィルター |
| `description` | `string` | - | - | 説明テキスト |

### ファイルタイプ別の動作

| タイプ | 対象ファイル |
|--------|-------------|
| `html` | HTMLファイル (*.html, *.htm) |
| `image` | 画像ファイル (*.png, *.jpg, *.ico等) |
| `all` | 現在未実装 |

### 画面項目一覧

| エリア | 項目名 | 内容・説明 | 表示条件 |
|--------|--------|------------|----------|
| **ヘッダー** | タイトル | ダイアログのタイトル | 常時表示 |
| **本文** | 説明テキスト | ファイル選択の説明 | descriptionが指定された場合 |
| **本文** | ファイルを参照ボタン | OSのファイル選択ダイアログを開く | 常時表示 |
| **フッター** | キャンセルボタン | ダイアログを閉じる | 常時表示 |

### 処理フロー

1. 「ファイルを参照...」ボタンをクリック
2. ファイルタイプに応じたOSネイティブのファイル選択ダイアログが表示
3. ユーザーがファイルを選択
4. 選択されたファイルのパスを返す
5. ダイアログを閉じる

### キーボード操作

| キー | 動作 |
|------|------|
| Escape | ダイアログを閉じる |

### 使用例

```tsx
// カスタムアイコン選択
<FilePickerDialog
  isOpen={showFilePicker}
  onClose={() => setShowFilePicker(false)}
  onFileSelect={handleIconSelected}
  title="カスタムアイコンを選択"
  fileTypes="image"
  description="アイコンとして使用する画像ファイルを選択してください。"
/>

// ブックマークファイル選択
<FilePickerDialog
  isOpen={showBookmarkPicker}
  onClose={() => setShowBookmarkPicker(false)}
  onFileSelect={handleBookmarkFileSelected}
  title="ブックマークファイルを選択"
  fileTypes="html"
  description="HTMLブックマークファイルを選択してください。"
/>
```

### テスト用データ属性

| 属性 | 対象要素 |
|------|---------|
| `data-testid="file-picker-dialog-overlay"` | オーバーレイ |
| `data-testid="file-picker-dialog"` | ダイアログ本体 |
| `data-testid="file-picker-browse-button"` | ファイルを参照ボタン |
| `data-testid="file-picker-cancel-button"` | キャンセルボタン |

---

## 5. スタイル共通仕様

### モーダルオーバーレイ

すべてのダイアログは`Modal.css`で定義された共通のオーバーレイスタイルを使用します。

```css
.modal-overlay {
  /* 画面全体を覆う半透明の背景 */
  position: fixed;
  inset: 0;
  background-color: var(--overlay-background);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.modal-content {
  /* ダイアログ本体のベーススタイル */
  background-color: var(--modal-background);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-large);
  padding: var(--spacing-md);
}
```

### アクションボタン配置

すべてのダイアログのフッターボタンは右寄せで配置されます。

```css
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}
```

---

## 6. エラーハンドリング

### FilePickerDialog

- ファイル選択でエラーが発生した場合、コンソールにエラーを出力
- ダイアログは閉じずに維持（ユーザーが再試行可能）

### AlertDialog / ConfirmDialog

- 表示時のエラーは発生しない設計
- コールバック内でのエラーは呼び出し元で処理

---

## 7. アクセシビリティ

### フォーカス管理

- ダイアログ表示時、フォーカスはダイアログ内に移動
- Tab/Shift+Tabでダイアログ内を循環（親コンポーネントで実装）

### キーボード操作のサポート

- すべてのダイアログでEscapeキーによるキャンセルをサポート
- AlertDialogとConfirmDialogでEnterキーによる確定をサポート

### スクリーンリーダー対応

- 適切なHTML構造（h2タグでタイトル、pタグでメッセージ）
- ボタンには明確なテキストラベルを使用
