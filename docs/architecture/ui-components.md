# UIコンポーネント

QuickDashLauncherで使用する共通UIコンポーネントのドキュメントです。

## 概要

### 設計思想

- **一貫性**: 全画面で統一されたUI体験を提供
- **型安全**: TypeScriptによるprops定義で誤用を防止
- **CSS変数連携**: `variables.css`のデザイントークンを使用
- **段階的移行**: 既存コードと共存しながら順次適用

### ファイル構成

```
src/renderer/
├── components/
│   └── ui/
│       ├── Button.tsx      # ボタンコンポーネント
│       └── index.ts        # エクスポート
└── styles/
    └── components/
        └── Button.css      # ボタンスタイル
```

---

## Buttonコンポーネント

汎用ボタンコンポーネント。モーダルのアクションボタン、フォームの送信ボタンなどに使用します。

### インポート

```tsx
import { Button } from './ui';
```

### インターフェース

```tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'light' | 'cancel';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;  // デフォルト: 'light'
  size?: ButtonSize;        // デフォルト: 'md'
  fullWidth?: boolean;      // デフォルト: false
}
```

### バリエーション

| variant | 用途 | 背景色 |
|---------|------|--------|
| `primary` | 主要アクション（確定、保存、登録） | 青 (`--color-primary`) |
| `secondary` | 副次アクション | グレー (`--color-secondary`) |
| `danger` | 危険な操作（削除） | 赤 (`--color-danger`) |
| `success` | 成功・完了 | 緑 (`--color-success`) |
| `info` | 情報・補助 | 水色 (`--color-info`) |
| `light` | 軽微なアクション（デフォルト） | 薄グレー (`--color-gray-100`) |
| `cancel` | キャンセル | グレー (`--color-gray-400`) |

### サイズ

| size | padding | font-size | 用途 |
|------|---------|-----------|------|
| `sm` | `4px 12px` | 12px | コンパクトなUI |
| `md` | `8px 16px` | 14px | 標準（デフォルト） |
| `lg` | `12px 20px` | 15px | 強調したいボタン |

### 使用例

#### 基本

```tsx
<Button variant="primary" onClick={handleSave}>
  保存
</Button>
```

#### モーダルのアクションボタン

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

#### 削除確認ダイアログ

```tsx
<div className="modal-actions">
  <Button variant="cancel" onClick={onClose}>
    キャンセル
  </Button>
  <Button variant="danger" onClick={onDelete}>
    削除
  </Button>
</div>
```

#### disabled状態

```tsx
<Button variant="primary" onClick={onSubmit} disabled={!isValid}>
  送信
</Button>
```

#### フル幅ボタン

```tsx
<Button variant="primary" fullWidth onClick={onAction}>
  アクションを実行
</Button>
```

#### サイズ指定

```tsx
<Button variant="primary" size="sm">小さいボタン</Button>
<Button variant="primary" size="md">標準ボタン</Button>
<Button variant="primary" size="lg">大きいボタン</Button>
```

#### 追加属性

`ButtonProps`は`React.ButtonHTMLAttributes<HTMLButtonElement>`を継承しているため、標準のbutton属性をすべて使用できます。

```tsx
<Button
  variant="primary"
  type="submit"
  data-testid="submit-button"
  aria-label="フォームを送信"
>
  送信
</Button>
```

### 生成されるHTML

```tsx
<Button variant="primary" size="sm" fullWidth>テスト</Button>
```

↓

```html
<button class="btn btn-primary btn-sm btn-full-width">テスト</button>
```

### CSSクラス

| クラス | 説明 |
|--------|------|
| `.btn` | ベーススタイル |
| `.btn-{variant}` | バリエーション（例: `.btn-primary`） |
| `.btn-sm` / `.btn-lg` | サイズ（mdはクラスなし） |
| `.btn-full-width` | フル幅 |

---

## 使い分けガイド

### Buttonコンポーネントを使う場合

- モーダルのアクションボタン（確定、キャンセル、削除）
- フォームの送信ボタン
- ダイアログのOK/キャンセル

### 従来のCSSクラスを使う場合

以下のような特殊なボタンは、専用のCSSクラスを使用してください：

| 用途 | 推奨クラス |
|------|-----------|
| ヘッダーの正方形アイコンボタン | `.action-btn` |
| ツールバーボタン | `.toolbar-button` |
| タブ切り替えボタン | `.menu-item`, `.desktop-tab` |
| 検索クリアボタン | `.search-clear-button` |
| ドロップダウントリガー | `.dropdown-trigger-btn` |
