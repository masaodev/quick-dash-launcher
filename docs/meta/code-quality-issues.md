# コード品質の課題と改善案

## 1. アーキテクチャとコード品質の課題

### 1.1 TypeScript型安全性の問題

**現状の問題点：**
- `extract-file-icon`モジュールがrequireで読み込まれており、型定義が存在しない
- エラーハンドリングのcatchブロックでerror型が暗黙的にanyになっている
- 外部ライブラリの型定義が不足している

**影響：**
- 実行時エラーの可能性が高まる
- IDEの補完機能が十分に活用できない
- リファクタリング時のミスが発生しやすい

**改善案：**
```typescript
// 型定義ファイルの作成
declare module 'extract-file-icon' {
  export function extractFileIcon(path: string, size: number): Buffer;
}

// エラー型の明示的な定義
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
}
```

### 1.2 エラーハンドリングの不統一

**現状の問題点：**
- エラー処理方法が統一されていない（console.error、console.warn、throw、無視など）
- ユーザーへのエラー通知メカニズムが不足
- エラーの握りつぶしが発生している箇所がある

**改善案：**
```typescript
// カスタムエラークラスの導入
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public severity: 'error' | 'warning' | 'info' = 'error'
  ) {
    super(message);
  }
}

// 統一されたエラーハンドラー
function handleError(error: unknown): void {
  if (error instanceof AppError) {
    // ユーザーへの通知
    showNotification(error.userMessage, error.severity);
    // ログ記録
    logger.log(error.severity, error.message, { code: error.code });
  } else {
    // 予期しないエラー
    logger.error('Unexpected error', error);
  }
}
```

### 1.3 コードの重複と複雑性

**現状の問題点：**
- フォルダ取込オプション処理が2箇所で重複（src/main/ipc/dataHandlers.ts）
- 関数が長すぎる（scanDirectory: 113行、registerItems: 131行）
- マジックナンバーがハードコーディングされている

**改善案：**
```typescript
// 定数の外部化
const ICON_SIZES = {
  SMALL: 32,
  LARGE: 64
} as const;

const LIMITS = {
  HTML_PARSE_BYTES: 5000,
  MAX_ITEMS_PER_PAGE: 100
} as const;

// 関数の分割
class DirectoryScanner {
  async scan(path: string, options: ScanOptions): Promise<Item[]> {
    const entries = await this.getEntries(path);
    const filtered = this.applyFilters(entries, options);
    const items = await this.createItems(filtered, options);
    return this.sortItems(items, options);
  }

  private async getEntries(path: string): Promise<DirEntry[]> {
    // エントリー取得ロジック
  }

  private applyFilters(entries: DirEntry[], options: ScanOptions): DirEntry[] {
    // フィルタリングロジック
  }
}
```

## 2. パフォーマンスの課題

### 2.1 メモリ管理の問題

**現状の問題点：**
- イベントリスナーの解放漏れの可能性
- 大量のHTMLデータを文字列として保持
- アイコンキャッシュのメモリ管理が不明確

**改善案：**
```typescript
// イベントリスナーの適切な管理
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 処理
  };
  
  window.addEventListener('keydown', handleKeyDown);
  
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}, [dependencies]); // 適切な依存配列

// ストリーミング処理の導入
async function parseFaviconStream(url: string): Promise<string | null> {
  const stream = await fetch(url);
  const reader = stream.body?.getReader();
  // ストリーミング処理
}
```

### 2.2 非効率な処理

**現状の問題点：**
- 同期的なファイルI/O操作（readFileSync、writeFileSync）
- 検索時の非効率なフィルタリング（毎回全件処理）
- React.memo、useMemo、useCallbackの未使用

**改善案：**
```typescript
// 非同期ファイル操作への移行
import { promises as fs } from 'fs';

async function loadDataFiles(): Promise<Item[]> {
  const files = await Promise.all([
    fs.readFile(path1, 'utf-8'),
    fs.readFile(path2, 'utf-8'),
    fs.readFile(path3, 'utf-8')
  ]);
  // 処理
}

// メモ化の活用
const FilteredItems = React.memo(({ items, query }: Props) => {
  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);
  
  return <ItemList items={filtered} />;
});
```

## 3. 開発体験とメンテナンス性

### 3.1 テストの完全な欠如

**現状の問題点：**
- ユニットテスト、統合テスト、E2Eテストが存在しない
- テスト環境が構築されていない
- CI/CDパイプラインがない

**改善案：**
```json
// package.jsonに追加
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jest": "^29.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

### 3.2 ドキュメントの不足

**現状の問題点：**
- JSDocコメントがない
- 複雑な関数の説明が不足
- APIドキュメントがない

**改善案：**
```typescript
/**
 * ディレクトリをスキャンして、指定されたオプションに基づいてアイテムを生成する
 * 
 * @param dirPath - スキャンするディレクトリのパス
 * @param options - スキャンオプション
 * @param options.filter - ファイル名のフィルタパターン（glob形式）
 * @param options.depth - スキャンする深さ（0は無制限）
 * @param options.prefix - 各アイテム名に付加するプレフィックス
 * @returns スキャンされたアイテムの配列
 * @throws {AppError} ディレクトリが存在しない場合
 * 
 * @example
 * const items = await scanDirectory('/home/user/documents', {
 *   filter: '*.pdf',
 *   depth: 2,
 *   prefix: 'Doc: '
 * });
 */
async function scanDirectory(
  dirPath: string, 
  options: ScanOptions
): Promise<Item[]> {
  // 実装
}
```

## 関連ドキュメント

- [コードレビュー要約](code-review-summary.md) - レビュー全体の要約
- [セキュリティの課題と対策](security-issues.md) - セキュリティ脆弱性の詳細
- [開発ガイド](../guides/development.md) - 実装詳細とコード品質ガイドライン