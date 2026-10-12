# 用語集（画面の言葉と英訳）

画面・README・Store の掲載文に出る QuickDashLauncher の言葉と、その英訳の正本です。日本語の辞書（`src/common/i18n/locales/ja.ts`）・英語の辞書（`en.ts`）・docs は、この表の言葉にそろえます。

## この表に載せる言葉

- 画面・README・Store の掲載文に出てくる言葉のうち、QuickDashLauncher 特有のもの、または表記がゆれやすいもの
- 「保存」「キャンセル」のような一般的な言葉は載せない
- 型・フィールド・ファイルの説明は載せない（正本は型定義のコメントと各仕様書。「コード上の名前」の列は探すときの手がかりとして名前だけ書く）

## 書き方の決まり

### 日本語

- 「日本語」の列の表記を使い、「使わない表記」は使わない
- 送り仮名を省いた形（取込・再読込）を使う

### 英語

[Microsoft Writing Style Guide](https://learn.microsoft.com/style-guide/welcome/) に合わせる。

- ボタン・メニュー・見出し・ラベルは、文の最初だけ大文字（sentence case。例 "Add item"）。この表の英語は文の途中で使う形で書く。画面の名前として固有名詞のように扱うもの（Item Manager）だけ大文字で始める
- マウスでもキーボードでも使える操作は "select" と書く（"click" と書かない）
- 呼びかけは "you"。短く、能動態で書く
- 省略形（don't・can't）は使ってよい

## 用語一覧

「使わない表記」は「、」で区切る。日本語の表記は `ja.ts` に、英語の表記は `en.ts` に出てきたら単体テスト（`src/common/i18n/glossary.test.ts`）が失敗する。

### アイテムと登録

| 日本語 | English | 使わない表記 | 意味 | コード上の名前 |
| --- | --- | --- | --- | --- |
| アイテム | item | ランチャーアイテム、項目、entry | 登録して起動するものの総称 | `LauncherItem`・`AppItem` |
| 表示名 | display name | アイテム名、アイテム表示名、item name | 一覧に出るアイテムの名前 | `displayName` |
| パス | path | 起動パス | アイテムが開くファイル・フォルダ・URL・アプリ | `path` |
| 引数 | arguments | パラメーター | アプリに渡す引数 | `args` |
| メモ | note | 備考、comment | アイテムに付けるメモ | `memo` |
| 種別 | type | 登録種別、カテゴリ | 登録するアイテムの種類（アイテム・フォルダ取込・グループなど） | `itemCategory` |
| フォルダ取込 | folder import | フォルダ取り込み、フォルダインポート、dir | フォルダの中身をまとめてアイテムにする種別 | `JsonDirItem` |
| グループ | group | — | 複数のアイテムをまとめて起動する種別 | `GroupItem` |
| ウィンドウ操作 | window action | ウィンドウアイテム、window item | 既にあるウィンドウを探して前に出す・動かす種別 | `WindowItem` |
| ウィンドウ配置 | window layout | レイアウト | 複数のウィンドウの位置と大きさをまとめて戻す種別 | `LayoutItem` |
| クリップボードアイテム | clipboard item | — | 保存したクリップボードの中身を戻す種別 | `ClipboardItem` |
| 登録 | add | 追加登録 | アイテムを新しく作ること | `RegisterModal` |
| 起動 | open | 実行（アイテムを開く意味で） | アイテムを開くこと。グループ・ウィンドウ操作も「起動」と呼ぶ | — |
| 親フォルダを開く | open containing folder | 親フォルダーを開く、フォルダを開く（親の意味で） | アイテムのあるフォルダを開くこと | — |
| アイコン | icon | — | アイテムの横に出る絵 | — |
| フォルダ | folder | フォルダー、ディレクトリ、directory | Windows のフォルダ | — |

### メインウィンドウと検索

| 日本語 | English | 使わない表記 | 意味 | コード上の名前 |
| --- | --- | --- | --- | --- |
| メインウィンドウ | launcher | メイン画面、ランチャー画面、main window | 起動ホットキーで出る、検索とアイテムの一覧の画面 | `App.tsx` |
| タブ | tab | — | メインウィンドウでデータファイルを切り替える見出し | `DataFileTab` |
| データファイル | data file | — | アイテムを保存する `datafiles/data*.json` | `JsonDataFile` |
| 通常検索 | normal search | アイテム検索 | 登録したアイテムを名前で絞り込む検索 | `SearchMode` の `normal` |
| ウィンドウ検索 | window search | ウィンドウ一覧 | 開いているウィンドウを探す検索 | `SearchMode` の `window` |
| 検索履歴 | search history | — | 以前に検索した言葉の履歴 | `SearchHistoryEntry` |
| ピン留め | pin | ピン止め、固定（ピンの意味で） | メインウィンドウを隠さずに残すこと | `WindowPinMode` |
| 再読込 | reload | 再読み込み、リロード、refresh（データの意味で） | 設定フォルダのファイルを読み直すこと（F5） | — |
| 操作のヒント | keyboard hints | キーヒント | メインウィンドウの下に出るキー操作の案内 | `showKeyboardHints` |

### ワークスペース

| 日本語 | English | 使わない表記 | 意味 | コード上の名前 |
| --- | --- | --- | --- | --- |
| ワークスペース | workspace | — | アイテムをグループに分けて並べておく、メインウィンドウとは別の画面とその中身 | `Workspace` |
| 切り離し | detach | 分離、ポップアウト、pop out | ワークスペースのグループを別のウィンドウに出すこと | `detachedGroup…` |
| 切り離しウィンドウ | detached window | 分離ウィンドウ | 切り離したグループのウィンドウ | `DetachedPinMode` |
| アーカイブ | archive | 保管 | ワークスペースのグループをしまっておき、あとで戻せるようにすること | `ArchivedWorkspaceGroup` |
| 仮想デスクトップ | virtual desktop | デスクトップ（仮想デスクトップの意味で） | Windows の仮想デスクトップ | — |

### 設定と管理

| 日本語 | English | 使わない表記 | 意味 | コード上の名前 |
| --- | --- | --- | --- | --- |
| 管理ウィンドウ | settings window | 管理画面、設定画面、admin window | 基本設定・アイテム管理・ヘルプのタブを持つウィンドウ | `AdminApp.tsx` |
| 基本設定 | Settings | 設定タブ | 管理ウィンドウの設定のタブ | `AdminSettingsTab` |
| アイテム管理 | Item Manager | 編集画面、編集モード、アイテム編集 | 管理ウィンドウでアイテムとタブを編集するタブ（Ctrl+E） | `AdminItemManagerView` |
| 起動ホットキー | launch hotkey | ショートカットキー、hot key | メインウィンドウを出すキーの組み合わせ | `hotkey` |
| 表示言語 | display language | — | 画面に使う言語（自動・日本語・English） | `language` |
| 自動起動 | start with Windows | スタートアップ起動 | Windows の起動時に QuickDashLauncher を起動すること | `autoLaunch` |
| ブックマーク取込 | bookmark import | ブックマークインポート、ブックマーク取り込み | ブラウザのブックマークをアイテムにすること | — |
| アプリ取込 | app import | アプリインポート、アプリ取り込み | インストール済みのアプリをアイテムにすること | — |
| バックアップ | backup | — | 設定フォルダのファイルを残しておく機能 | `BackupService` |
| スナップショット | snapshot | — | バックアップで残した、ある時点のファイル一式 | — |
| 設定フォルダ | settings folder | 設定ディレクトリ、config folder | 設定とデータを保存するフォルダ | `PathManager.getConfigFolder()` |
| トースト | notification | トースト通知、toast | 画面の下に少しの間だけ出る知らせ | `showToastWindow` |
| QuickDashLauncher CLI | QuickDashLauncher CLI | コマンドライン（qdl を指す意味で） | ターミナルや AI から使う `qdl` コマンド | `qdl.exe` |

## 直すとき

- 画面に出す言葉を足す・変えるときは、辞書と同じ PR でこの表も直す
- 「使わない表記」は、辞書の中のどこにも出てこない言葉だけにする（一般的な言葉の一部になっていないか確かめる）
