# ブックマークインポートモーダル仕様書

## 概要

ブックマークインポートモーダルは、HTMLブックマークファイルからブックマークアイテムを選択的にインポートするための機能です。編集モード時にブックマークインポートボタンをクリックすることで表示されます。

## 基本情報

| 項目 | 内容 |
|------|------|
| **ファイル名** | `src/renderer/components/BookmarkImportModal.tsx` |
| **コンポーネント名** | `BookmarkImportModal` |
| **表示条件** | 編集モードでブックマークインポートボタンクリック時 |
| **モーダルタイプ** | オーバーレイ型モーダル |
| **親画面** | EditModeView |

## 機能概要

- **HTMLブックマークファイルの読み込み**: ファイル選択ダイアログで.html/.htmファイルを選択
- **ブックマーク一覧表示**: パースされたブックマークをテーブル形式で表示
- **検索・フィルタリング**: 名前またはURLでのリアルタイム検索
- **選択機能**: 個別選択、一括選択、表示中の項目のみ選択
- **インポート実行**: 選択されたブックマークを一時タブデータにインポート

## UI構成

### ヘッダー部
- **タイトル**: 「ブックマークをインポート」
- **閉じるボタン**: ✕ボタンでモーダルを閉じる

### コントロール部
#### ファイル選択セクション
- **ファイル選択ボタン**: 「ファイルを選択」（読み込み中は「読み込み中...」に変更）
- **ファイル名表示**: 選択されたファイル名を表示

#### 検索セクション（ブックマーク読み込み後のみ表示）
- **検索入力欄**: プレースホルダー「名前またはURLで検索...」

#### 一括操作ボタン（ブックマーク読み込み後のみ表示）
- **表示中を選択**: フィルタリングされた項目を全て選択
- **表示中を解除**: フィルタリングされた項目の選択を全て解除  
- **全て選択**: 全ブックマークを選択
- **全て解除**: 全ブックマークの選択を解除

### ブックマークリスト部（ブックマーク読み込み後のみ表示）
#### テーブル構造
| 列名 | 幅指定 | 内容 |
|------|--------|------|
| 選択 | `checkbox-column` | チェックボックス |
| 名前 | `name-column` | ブックマーク名 |
| URL | `url-column` | ブックマークURL |

#### 行の状態
- **通常行**: デフォルトスタイル
- **選択行**: `selected` クラス付加

### フッター部
#### ステータス情報（ブックマーク読み込み後のみ表示）
- **基本表示**: 「{フィルタ後件数}件中{選択件数}件を選択中」
- **検索時追加情報**: 「(全体: {全体件数}件中{全選択件数}件)」

#### アクション部
- **キャンセルボタン**: モーダルを閉じる
- **インポートボタン**: 「インポート ({選択件数}件)」、選択件数0の場合は無効化

## 機能詳細

### ファイル処理

#### ファイル選択機能
- **IPCメソッド**: `window.electronAPI.selectBookmarkFile()`
- **ダイアログ設定**:
  - タイトル: 「ブックマークファイルを選択」
  - フィルター: HTML Files (*.html, *.htm), All Files (*.*)
  - プロパティ: openFile
- **戻り値**: 選択されたファイルパス または null

#### ブックマーク解析機能
- **IPCメソッド**: `window.electronAPI.parseBookmarkFile(filePath)`
- **解析対象**: HTMLファイル内の`<A>`タグ
- **正規表現**: `/<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi`
- **戻り値**: `SimpleBookmarkItem[]`配列

### 状態管理

#### 主要State
```typescript
const [bookmarks, setBookmarks] = useState<SimpleBookmarkItem[]>([]);      // 読み込まれた全ブックマーク
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());   // 選択されたブックマークID
const [searchQuery, setSearchQuery] = useState('');                       // 検索クエリ
const [loading, setLoading] = useState(false);                           // ファイル読み込み状態
const [fileName, setFileName] = useState<string | null>(null);            // 選択されたファイル名
```

#### 派生データ
- **filteredBookmarks**: 検索クエリでフィルタリングされたブックマーク
- **selectedCount**: 選択されたアイテム総数
- **filteredSelectedCount**: フィルタリングされたアイテムのうち選択されている数

### 検索・フィルタリング

#### 検索条件
- **対象フィールド**: `name`（ブックマーク名）、`url`（ブックマークURL）
- **検索方式**: 部分一致（大文字小文字区別なし）
- **リアルタイム更新**: 入力と同時にフィルタリング実行

#### フィルタリングロジック
```typescript
const filteredBookmarks = bookmarks.filter((bookmark) => {
  if (!searchQuery) return true;
  const searchLower = searchQuery.toLowerCase();
  return (
    bookmark.name.toLowerCase().includes(searchLower) ||
    bookmark.url.toLowerCase().includes(searchLower)
  );
});
```

### 選択機能

#### 個別選択
- **操作**: チェックボックスクリック
- **処理**: `selectedIds`のSetに対してID追加/削除

#### 一括選択操作
| 操作 | 対象 | 処理内容 |
|------|------|----------|
| 表示中を選択 | フィルタリング後のアイテム | フィルタ後のIDを`selectedIds`に追加 |
| 表示中を解除 | フィルタリング後のアイテム | フィルタ後のIDを`selectedIds`から削除 |
| 全て選択 | 全ブックマーク | 全IDで`selectedIds`を置き換え |
| 全て解除 | 全ブックマーク | `selectedIds`をクリア |

### インポート処理

#### インポート実行条件
- 選択されたブックマークが1件以上存在すること
- 0件の場合は「インポートするブックマークを選択してください」アラート表示

#### インポート処理フロー
1. `selectedIds`に含まれるブックマークを抽出
2. `onImport(selectedBookmarks)`コールバックを実行
3. モーダルを閉じる（`handleClose()`実行）

## キーボードショートカット

| キー | 機能 | 条件 |
|------|------|------|
| Escape | モーダルを閉じる | モーダルが開いている時 |

## エラーハンドリング

### ファイル選択時エラー
- **エラー発生時**: コンソールエラー出力 + 「ブックマークファイルの読み込みに失敗しました」アラート表示
- **ローディング状態**: 必ず`finally`ブロックで解除

### インポート時エラー
- **選択件数0**: 「インポートするブックマークを選択してください」アラート表示

## データ型定義

### SimpleBookmarkItem
```typescript
interface SimpleBookmarkItem {
  id: string;     // 一意識別子
  name: string;   // ブックマーク名
  url: string;    // ブックマークURL
}
```

### Props
```typescript
interface BookmarkImportModalProps {
  isOpen: boolean;                                    // モーダル表示状態
  onClose: () => void;                               // 閉じる時のコールバック
  onImport: (bookmarks: SimpleBookmarkItem[]) => void; // インポート実行時のコールバック
}
```

## IPC通信仕様

### selectBookmarkFile
- **呼び出し**: `window.electronAPI.selectBookmarkFile()`
- **戻り値**: `Promise<string | null>`
- **処理**: Electronのファイル選択ダイアログを表示し、選択されたファイルパスを返す

### parseBookmarkFile
- **呼び出し**: `window.electronAPI.parseBookmarkFile(filePath: string)`
- **引数**: ファイルパス
- **戻り値**: `Promise<SimpleBookmarkItem[]>`
- **処理**: HTMLファイルを解析してブックマーク情報を抽出

## スタイリング

### 主要CSSクラス
- `.modal-overlay`: モーダルオーバーレイ
- `.modal-content.bookmark-import-modal`: モーダル本体
- `.bookmark-import-controls`: コントロール部分
- `.bookmark-list-container`: ブックマークリストコンテナ
- `.bookmark-table`: ブックマークテーブル
- `.selected`: 選択行スタイル

### 列幅クラス
- `.checkbox-column`: チェックボックス列
- `.name-column`: 名前列  
- `.url-column`: URL列

## 制約事項

### 対応ファイル形式
- HTMLブックマークファイル（.html, .htm）のみ
- 他の形式（JSONなど）は非対応

### ブックマーク解析の制限
- 簡易的な正規表現ベースのパーサー
- 複雑なHTML構造には対応していない可能性
- ネストしたフォルダ構造は平坦化される

### パフォーマンス制限
- 大量のブックマーク（数千件以上）での動作は保証されていない
- 全件をメモリ上に展開するため、メモリ使用量に注意

## 使用シーン

### 典型的な使用フロー
1. 編集モードでブックマークインポートボタンクリック
2. モーダル表示
3. 「ファイルを選択」ボタンクリック
4. ブラウザのエクスポートしたHTMLファイルを選択
5. 読み込まれたブックマーク一覧を確認
6. 必要に応じて検索で絞り込み
7. インポートしたいブックマークを選択
8. 「インポート」ボタンクリック
9. 一時タブデータに追加される

### 主要ユースケース
- **ブラウザからの移行**: ChromeやFirefoxなどからエクスポートしたブックマークの取り込み
- **一括登録**: 手動登録では手間のかかる大量のブックマークの一括追加
- **選択的インポート**: 全ブックマークではなく必要な分のみを選択してインポート