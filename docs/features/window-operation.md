# ウィンドウ操作アイテム

ウィンドウ操作アイテムは、指定したウィンドウを特定の位置・サイズに配置し、仮想デスクトップを切り替える機能を提供します。

## 概要

ウィンドウ操作アイテムを実行すると、以下の操作が可能です：

- ウィンドウタイトルでウィンドウを検索
- 指定した座標・サイズにウィンドウを配置
- 指定した仮想デスクトップに移動
- ウィンドウをアクティブ化（フォーカス）

## data.txtでの記述形式

ウィンドウ操作アイテムは、`data.txt`に以下の形式で記述します：

```
window,"{""name"":""表示名"",""windowTitle"":""ウィンドウタイトル"",""x"":100,""y"":200,...}"
```

### 重要な注意点

- **JSON形式のみサポート**：CSV形式（旧形式）は廃止されました
- **CSV形式でのエスケープが必要**：JSON文字列全体をダブルクォートで囲み、JSON内のダブルクォートを二重化（`""`）します

## JSON形式の仕様

### フィールド一覧

#### 必須フィールド

| フィールド名 | 型 | 説明 |
|------------|------|------|
| `name` | string | Quick Dash Launcherで表示される名前 |
| `windowTitle` | string | 操作対象のウィンドウタイトル（部分一致または完全一致） |

#### オプションフィールド

| フィールド名 | 型 | 説明 | デフォルト |
|------------|------|------|-----------|
| `exactMatch` | boolean | ウィンドウタイトルの完全一致で検索するか | `false`（部分一致） |
| `processName` | string | プロセス名で検索（部分一致、例: "chrome"） | 指定なし |
| `x` | number | ウィンドウのX座標（左端） | 現在位置を維持 |
| `y` | number | ウィンドウのY座標（上端） | 現在位置を維持 |
| `width` | number | ウィンドウの幅（ピクセル） | 現在サイズを維持 |
| `height` | number | ウィンドウの高さ（ピクセル） | 現在サイズを維持 |
| `virtualDesktopNumber` | number | 仮想デスクトップ番号（1始まり） | 現在のデスクトップ |
| `activateWindow` | boolean | ウィンドウをアクティブ化するか | `true` |

### 記述例

#### 基本的な例（必須フィールドのみ）

```
window,"{""name"":""Chrome"",""windowTitle"":""Google Chrome""}"
```

**表示名**: `Chrome`
**動作**: 「Google Chrome」を含むウィンドウを検索してアクティブ化

#### すべてのフィールドを含む例

```
window,"{""name"":""TODOキャンパス"",""windowTitle"":""Obsidian"",""x"":2565,""y"":0,""width"":1990,""height"":1392,""virtualDesktopNumber"":2,""activateWindow"":false}"
```

**表示名**: `TODOキャンパス`
**動作**:
- 「Obsidian」を含むウィンドウを検索
- 座標 (2565, 0) に移動
- サイズを 1990x1392 に変更
- 仮想デスクトップ2に移動
- ウィンドウをアクティブ化しない（`activateWindow: false`）

#### 位置のみ指定（サイズは変更しない）

```
window,"{""name"":""MS To DO"",""windowTitle"":""Microsoft To Do"",""x"":1273,""y"":1,""virtualDesktopNumber"":2,""activateWindow"":false}"
```

**動作**: ウィンドウを指定位置に移動するが、サイズは現在のまま維持

#### 完全一致で検索

```
window,"{""name"":""Google Chrome"",""windowTitle"":""Google Chrome"",""exactMatch"":true}"
```

**動作**: ウィンドウタイトルが正確に「Google Chrome」であるウィンドウのみを検索（部分一致では「Google Chrome - タブ名」などもマッチするが、完全一致では除外される）

#### プロセス名で検索

```
window,"{""name"":""Chromeプロセス"",""windowTitle"":"""",""processName"":""chrome""}"
```

**動作**: プロセス名に「chrome」を含むウィンドウ（例: chrome.exe）を検索してアクティブ化

#### ウィンドウタイトルとプロセス名の複合条件

```
window,"{""name"":""Chrome開発者ツール"",""windowTitle"":""DevTools"",""processName"":""chrome""}"
```

**動作**: ウィンドウタイトルに「DevTools」を含み、かつプロセス名に「chrome」を含むウィンドウを検索（AND条件）

## 別の仮想デスクトップのウィンドウ操作（v0.5.12以降）

### 概要

v0.5.12以降、ウィンドウが別の仮想デスクトップにある場合でも、**デスクトップを切り替えることなく**位置・サイズを設定できます。これにより、現在の作業を中断することなく、他のデスクトップのウィンドウを整理できます。

### 主な機能

- **全仮想デスクトップからウィンドウを自動検索**
  - 現在のデスクトップだけでなく、すべての仮想デスクトップからウィンドウを検索
  - cloaked window（別デスクトップの非表示ウィンドウ）も検索対象

- **デスクトップ切り替えなしで設定**
  - 別デスクトップのウィンドウに対して、デスクトップを切り替えずに位置・サイズを直接設定
  - ユーザーの現在の作業を中断しない

- **確実な設定反映**
  - リトライロジック（最大3回、100ms間隔）で確実に設定を反映

### 使用例

#### デスクトップ2のObsidianウィンドウを設定（デスクトップ1から実行）

```
window,"{""name"":""TODOキャンパス"",""windowTitle"":""Obsidian"",""x"":2565,""y"":0,""width"":1990,""height"":1392,""virtualDesktopNumber"":2}"
```

**動作**:
1. 現在デスクトップ1にいる状態で実行
2. すべての仮想デスクトップから「Obsidian」を検索
3. デスクトップ2で見つかったObsidianウィンドウの位置・サイズを設定
4. **デスクトップ1のまま処理完了**（デスクトップ2には切り替わらない）

### 技術詳細

- **実装場所**:
  - `src/main/utils/windowActivator.ts`
  - `src/main/utils/virtualDesktopControl.ts`

- **検索パラメータ**: `includeAllVirtualDesktops: true`で全デスクトップ検索

- **設定方法**: `SetWindowPos()` Win32 APIで直接位置・サイズを設定

- **リトライ**: 最大3回（100ms間隔）で確実に設定を反映

### 従来の動作との違い

| 項目 | v0.5.11以前 | v0.5.12以降 |
|-----|-----------|-----------|
| **検索範囲** | 現在のデスクトップのみ | すべての仮想デスクトップ |
| **デスクトップ切り替え** | ウィンドウのデスクトップに切り替え | 切り替えなし（現在のデスクトップを維持） |
| **位置・サイズ設定** | デスクトップ移動後に設定 | 直接設定（移動不要） |
| **ユーザー体験** | 画面が一瞬切り替わる | 作業を中断しない |

### 注意事項

- ウィンドウのアクティブ化（フォーカス）は、現在のデスクトップにあるウィンドウのみ可能です
- 別デスクトップのウィンドウに対して`activateWindow: true`を指定しても、フォーカスは移りません（位置・サイズのみ設定されます）
- この機能はWindows 10 version 1803以降で動作します

## CSV形式でのエスケープ方法

`data.txt`はCSV形式のため、JSON文字列を以下のようにエスケープします：

### エスケープ前（通常のJSON）

```json
{"name":"表示名","windowTitle":"Chrome","x":100}
```

### エスケープ後（data.txtに保存する形式）

```
window,"{""name"":""表示名"",""windowTitle"":""Chrome"",""x"":100}"
```

### エスケープのルール

1. JSON文字列全体をダブルクォート（`"`）で囲む
2. JSON内のダブルクォートを二重化（`"` → `""`）

**誤った例**：
```
window,{"name":"表示名","windowTitle":"Chrome"}  ❌ 外側のクォートがない
window,{""name"":""表示名"",""windowTitle"":""Chrome""}  ❌ 外側のクォートがない
```

**正しい例**：
```
window,"{""name"":""表示名"",""windowTitle"":""Chrome""}"  ✅
```

## アイテムの登録・編集方法

### 新規登録

1. メイン画面で「登録」タブを開く
2. 「ウィンドウ操作」を選択
3. 各フィールドに値を入力
   - **表示名**: Quick Dash Launcherで表示される名前
   - **ウィンドウタイトル**: 操作対象のウィンドウタイトル（部分一致）
   - **X座標、Y座標、幅、高さ**: オプション（未入力の場合は現在値を維持）
   - **仮想デスクトップ番号**: オプション（未入力の場合は現在のデスクトップ）
   - **ウィンドウをアクティブ化**: チェックを外すとフォーカスを移さない

### 編集方法

#### 方法1: 詳細編集モーダル（推奨）

1. メイン画面でアイテムを右クリック → 「編集」
2. または、管理画面で✏️ボタンをクリック
3. 各フィールドを編集して「更新」

#### 方法2: 管理画面での直接編集（名前のみ）

- 管理画面の「名前」列をダブルクリックして編集可能
- **注意**: 「パス・引数」列は編集不可（詳細編集モーダルを使用してください）

### data.txtを直接編集する場合

**推奨しません**が、直接編集する場合は以下に注意してください：

1. JSON形式を厳密に守る（カンマ、クォートの位置）
2. CSV形式でエスケープする（上記「エスケープ方法」参照）
3. 編集後、アプリを再起動して変更を反映

## よくあるエラーと対処法

### エラー1: 「ウィンドウ操作アイテムはJSON形式で記述する必要があります」

**原因**: JSON形式でない、または外側のクォートがない

**対処法**:
```
❌ window,Chrome,100,100,1920,1080  （旧CSV形式は非サポート）
✅ window,"{""name"":""Chrome"",""windowTitle"":""Google Chrome""}"
```

### エラー2: 「ウィンドウ操作アイテムのJSON形式が不正です」

**原因**: JSON構文エラー（閉じ括弧忘れ、カンマの位置ミス等）

**対処法**:
```
❌ window,"{""name"":""表示名""  （閉じ括弧なし）
❌ window,"{""name"":""表示名"",""windowTitle"":""Chrome"",}"  （末尾カンマ）
✅ window,"{""name"":""表示名"",""windowTitle"":""Chrome""}"
```

### エラー3: 編集後にアイテムが表示されない

**原因**: data.txtの該当行が破損している

**対処法**:
1. data.txtをテキストエディタで開く
2. 該当行のJSON形式を確認
3. 上記「CSV形式でのエスケープ方法」に従って修正
4. アプリを再起動

### エラー4: ウィンドウが見つからない

**原因**: `windowTitle`がウィンドウの実際のタイトルと一致していない

**対処法**:
1. PowerShellで以下のコマンドを実行し、正確なウィンドウタイトルを確認:
   ```powershell
   Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object MainWindowTitle
   ```
2. `windowTitle`フィールドに部分一致する文字列を設定

## 実装上の注意点

### コード内での処理

ウィンドウ操作アイテムは以下のように処理されます：

1. **パース**: `directiveUtils.ts`の`parseWindowOperationConfig()`でJSON形式を解析
2. **検証**: 必須フィールド（`name`, `windowTitle`）の存在を確認
3. **実行**: Mainプロセスで`WindowManager`クラスがウィンドウ操作を実行

### エスケープ関数の使用

data.txtへの保存時は必ず`escapeCSV()`関数を使用してください：

```typescript
import { escapeCSV } from '@common/utils/csvParser';

const config = {
  name: '表示名',
  windowTitle: 'Chrome',
  x: 100,
  y: 100,
};

const content = `window,${escapeCSV(JSON.stringify(config))}`;
// 結果: window,"{""name"":""表示名"",""windowTitle"":""Chrome"",""x"":100,""y"":100}"
```

**誤った例**：
```typescript
// ❌ 手動でエスケープ（不完全になりやすい）
const content = `window,${JSON.stringify(config).replace(/"/g, '""')}`;

// ✅ escapeCSV()を使用
const content = `window,${escapeCSV(JSON.stringify(config))}`;
```

### パース時のエラーハンドリング

`parseWindowOperationConfig()`はエラー時にthrowするため、必ずtry-catchで囲んでください：

```typescript
import { parseWindowOperationConfig } from '@common/utils/directiveUtils';

try {
  const config = parseWindowOperationConfig(jsonString);
  // 処理を続行
} catch (error) {
  console.error('JSON形式が不正です:', error);
  // ユーザーにエラーメッセージを表示
  alert(error instanceof Error ? error.message : 'JSON形式が不正です');
}
```

## 関連ドキュメント

- **[データ形式仕様](../architecture/data-format.md)** - data.txtの全体的な形式仕様
- **[アイテム管理](item-management.md)** - 管理画面での操作方法
- **[ウィンドウ制御](../architecture/window-control.md)** - ウィンドウ操作の内部実装

## 変更履歴

- **v0.6.0以降**: JSON形式のみをサポート（CSV形式廃止）
- **v0.5.x以前**: CSV形式とJSON形式の両方をサポート（現在は廃止）
