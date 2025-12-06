# アプリケーション設定

QuickDashLauncherの動作をカスタマイズするための設定機能を説明します。

## 設定ファイルの場所

| 項目 | 値 |
|------|-----|
| パス | `%APPDATA%/quick-dash-launcher/config/settings.json` |
| 形式 | JSON (UTF-8) |

設定変更は即座に反映されます（v1.0.0以降）。再起動は不要です。

---

## 初回設定

アプリケーション初回起動時、または`hotkey`が未設定の場合、初回設定画面が自動表示されます。

### 設定手順
1. 入力欄をクリックして、希望するキー組み合わせを押下（例: `Ctrl+Alt+Q`）
2. リアルタイムでバリデーションが実行されます
3. 「設定を完了」ボタンをクリック

**動作詳細:**
- ESCキーやフォーカス喪失では閉じません
- 後から設定画面で変更可能

**開発者向け:** 初回設定をスキップするには、`settings.json`の`hotkey`に任意の値を設定してください。

---

## 設定画面へのアクセス

1. **基本設定タブ**: ⚙ボタン → 「⚙️ 基本設定」
2. **アイテム管理タブ**: ⚙ボタン → 「✏️ アイテム管理」
3. **その他タブ**: ⚙ボタン → 「📊 その他」

---

## 設定項目一覧

### クイックリファレンス

| キー | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `createdWithVersion` | `string?` | `undefined` | 設定ファイルを作成したアプリバージョン（新規作成時のみ自動記録） |
| `updatedWithVersion` | `string?` | `undefined` | 設定ファイルを最後に更新したアプリバージョン（更新時に自動記録） |
| `hotkey` | `string` | `''` | グローバルホットキー |
| `windowWidth` | `number` | `600` | 通常時のウィンドウ幅 |
| `windowHeight` | `number` | `400` | 通常時のウィンドウ高さ |
| `editModeWidth` | `number` | `1200` | アイテム管理時の幅 |
| `editModeHeight` | `number` | `700` | アイテム管理時の高さ |
| `autoLaunch` | `boolean` | `false` | Windows起動時に自動起動 |
| `windowPositionMode` | `string` | `'center'` | 表示位置モード |
| `showDataFileTabs` | `boolean` | `false` | タブ表示の有効/無効 |
| `backupEnabled` | `boolean` | `false` | バックアップ機能 |

---

### グローバルホットキー

アプリケーションを呼び出すためのキー組み合わせ（デフォルト: `Alt+Space`）。

**設定方法:**
1. 入力欄をクリック
2. 希望するキー組み合わせを押下
3. バリデーション後、自動保存

**設定例:**
```
Alt+Space
Ctrl+Alt+Q
Ctrl+Shift+L
Alt+F1
```

**対応キー:**
- 修飾キー: `Ctrl`, `Alt`, `Shift`, `CmdOrCtrl`
- 通常キー: `A-Z`, `0-9`, `F1-F12`

**バリデーション:**
- 最低1つの修飾キーが必要
- システム予約キー（`Ctrl+Alt+Del`等）は不可
- 他アプリと競合するキーは登録不可

---

### ウィンドウサイズ

| 設定 | 幅範囲 | 高さ範囲 | デフォルト |
|------|-------|---------|-----------|
| 通常時 | 400-2000px | 300-1200px | 600x400 |
| アイテム管理時 | 800-2000px | 600-1200px | 1200x700 |

---

### ウィンドウピン留めモード

📌ボタンをクリックして切り替え。

| モード | 最上面 | 自動非表示 | 用途 |
|-------|-------|----------|------|
| 通常（デフォルト） | × | ○ | ホットキーで素早く呼び出す |
| 常に最上面 | ○ | × | 常にアクセス可能にしたい |
| 表示固定 | × | × | 他ウィンドウと並べて使う |

---

### ウィンドウ表示位置

| モード | 説明 |
|-------|------|
| `center`（画面中央） | 常に画面中央に表示（デフォルト） |
| `cursor`（マウス位置） | マウスカーソルの位置が検索入力欄付近に来るように表示。マルチモニター対応 |
| `fixed`（固定位置） | 手動で移動した位置を記憶 |

**固定位置のリセット:** システムトレイメニュー →「画面中央に表示」

---

### 自動起動

Windowsログイン時にアプリを自動起動（デフォルト: 無効）。

**実装:**
- レジストリ `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` に登録
- 開発環境では設定変更しても実際の登録は行われません

---

### バックアップ設定

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| `backupEnabled` | `false` | バックアップ機能のON/OFF |
| `backupOnStart` | `false` | アプリ起動時にバックアップ |
| `backupOnEdit` | `false` | データ編集時にバックアップ |
| `backupInterval` | `5` | 最小バックアップ間隔（1-60分） |
| `backupRetention` | `20` | 保存件数上限（1-100件） |

**保存場所:** `%APPDATA%/quick-dash-launcher/config/backup/`

**ファイル名:** `data_2024-01-01T12-00-00.txt`

---

### タブ表示設定

複数のデータファイル（data.txt, data2.txt...）をタブで切り替え。

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| `showDataFileTabs` | `false` | タブ表示のON/OFF |
| `defaultFileTab` | `'data.txt'` | 起動時の表示タブ |
| `dataFileTabs` | `[{files:['data.txt'],name:'メイン'}]` | タブ設定 |

**タブ管理機能:**
- ➕行追加: 新しいタブを作成
- タブ名のカスタマイズ: 任意の名前を設定（空欄時はデフォルト名）
- 複数ファイル統合: 1つのタブに複数ファイルを関連付け
- ▲▼ボタン: 表示順序の変更
- 🗑️ボタン: タブの削除（データファイルは保持）

**デフォルトタブ名:**
- data.txt → 「メイン」
- data2.txt → 「サブ1」
- data3.txt → 「サブ2」

---

## システムトレイメニュー

タスクバー右下の通知領域にアイコンが常駐します。

### メニュー項目

| 項目 | 説明 |
|------|------|
| バージョン情報 | 現在のバージョンを表示（選択不可） |
| 表示 (Alt+Space) | メインウィンドウを表示 |
| 画面中央に表示 | 強制的に画面中央に表示 |
| 設定... | 設定画面を開く |
| データフォルダを開く | 設定フォルダをエクスプローラーで開く |
| ヘルプ | GitHubリポジトリを開く |
| 終了 | アプリケーションを終了 |

**ダブルクリック:** メインウィンドウを表示

---

## 詳細設定（設定フォルダのカスタマイズ）

環境変数 `QUICK_DASH_CONFIG_DIR` で設定フォルダの場所を変更できます。

### 設定方法

**一時的（PowerShell）:**
```powershell
$env:QUICK_DASH_CONFIG_DIR = "D:\MyApps\quick-dash-config"
```

**永続的:**
1. Windowsの「環境変数」を検索
2. ユーザー環境変数に `QUICK_DASH_CONFIG_DIR` を追加

### ユースケース

| 用途 | 設定例 |
|------|--------|
| ポータブル版 | `E:\PortableApps\QuickDash\config` |
| クラウド同期 | `$env:USERPROFILE\Dropbox\QuickDash\config` |
| 複数プロファイル | 仕事用/プライベート用で別パス |

### 注意事項

- セキュリティ制限: `C:\Windows`, `C:\Program Files` 等は使用不可
- 既存データは自動移行されません（手動コピーが必要）

---

## 設定ファイルのサンプル

```json
{
  "createdWithVersion": "0.4.3",
  "updatedWithVersion": "0.4.3",
  "hotkey": "Alt+Space",
  "windowWidth": 600,
  "windowHeight": 400,
  "editModeWidth": 1200,
  "editModeHeight": 700,
  "autoLaunch": false,
  "backupEnabled": false,
  "backupOnStart": false,
  "backupOnEdit": false,
  "backupInterval": 5,
  "backupRetention": 20,
  "showDataFileTabs": false,
  "defaultFileTab": "data.txt",
  "dataFileTabs": [
    { "files": ["data.txt"], "name": "仕事用" },
    { "files": ["data2.txt", "data3.txt"], "name": "プライベート" }
  ],
  "windowPositionMode": "center",
  "windowPositionX": 0,
  "windowPositionY": 0
}
```

---

## トラブルシューティング

### ホットキーが動作しない

1. **他アプリとの競合** → 別のキー組み合わせに変更
2. **管理者権限** → 管理者として実行
3. **設定破損** → リセットボタンでデフォルトに戻す

### 自動起動が動作しない

- タスクマネージャー → スタートアップタブで確認
- 複数起動する場合: 一度無効化→再度有効化

### 設定が保存されない

- 設定フォルダへの書き込み権限を確認
- ディスク容量を確認

### 設定パスが認識されない

- 環境変数が正しく設定されているか確認
- アプリケーションを再起動
- パスの書き込み権限を確認
