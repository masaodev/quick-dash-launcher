# QuickDashLauncher CLI（qdl）

QuickDashLauncher CLI は、コマンドライン（`qdl` コマンド）から、起動中の QuickDashLauncher（本体）に依頼する仕組みです。人やスクリプト、AI が、画面を操作せずにアイテム・セットの行・ワークスペースのグループを足したり変えたり、ホットキーなどの設定を変えたり、設定ファイルを読み直させたりするのに使います。

## 概要

CLI の実行ファイルは `qdl.exe` です。`qdl.exe` は引数を解釈せず、受け取った引数をそのまま本体に送り、本体が返した標準出力・標準エラー・終了コードをそのまま出します。コマンドの種類・引数の検証・ヘルプ・出力の形は、すべて本体が決めます。そのため、コマンドを増やしても `qdl.exe` は変わりません。

### 主な特徴

- **本体が処理する**: 依頼は起動中の本体が処理するので、設定ファイルの読み直しや検証は画面の操作（F5 など）と同じ処理を通り、結果は開いている画面にも反映されます
- **結果は JSON**: 結果は JSON で標準出力に出します（AI やスクリプトが読む前提）。失敗したときも、理由と候補を JSON で標準出力に出し、人が読む文を標準エラーに出します（[出力](#出力)）
- **本体が起動していなければ起動する**: 本体が動いていないときは、`qdl.exe` が本体を起動してから依頼します（[本体が起動していないとき](#本体が起動していないとき)）

## qdl を使えるようにする

`qdl.exe` は本体に同梱されていますが、そのままではターミナルから `qdl` と打っても見つかりません（ポータブル版は起動のたびに一時フォルダへ展開されて動くので、同梱の場所も毎回変わります）。管理画面の基本設定「QuickDashLauncher CLI を使えるようにする」（設定項目 `cliEnabled`。[設定ファイル形式](../architecture/file-formats/settings-format.md#34-自動起動cli-設定)）をオンにすると、次のことが起きます。

- 同梱の `qdl.exe` を `%LOCALAPPDATA%\quick-dash-launcher\bin` にコピーし、そのフォルダをユーザーの環境変数 PATH に足す。新しく開いたターミナルから `qdl` で呼べる
- 本体を起動するたびに、同梱の `qdl.exe` とコピー済みのものを比べ、違えば入れ替える。本体を更新しても、CLI と本体のやり取りの版はずれない
- オフにすると、PATH からそのフォルダを外し、コピーした `qdl.exe` を消す

PATH は、`%USERPROFILE%` のような書き方を崩さないよう、レジストリ（`HKCU\Environment` の `Path`）の値を展開せずに読み、該当のフォルダだけを足し引きします。パッケージ化されていない起動と、`APP_INSTANCE` を付けた起動では何もしません（PATH とコピー先はインスタンスを区別しない 1 つだけのため）。

## 本体とのやり取り

`qdl.exe` と本体は、Windows の名前付きパイプでやり取りします。

- **パイプ名**: `\\.\pipe\<userData のフォルダ名>-cli-<ユーザー名>`。userData のフォルダ名は既定で `quick-dash-launcher`、開発用のインスタンス（環境変数 `APP_INSTANCE`）では `<APP_INSTANCE>-quick-dash-launcher` です。フォルダ名とユーザー名を入れるので、開発用のインスタンスや、同じ PC の別のユーザーの本体とは混ざりません
- **つなぎ先の選び方**: `qdl.exe` は既定で `quick-dash-launcher` のパイプにつなぎます。環境変数 `QDL_INSTANCE` を指定すると `<QDL_INSTANCE>-quick-dash-launcher` につなぎます（例: `QDL_INSTANCE=dev` で `npm run dev` の本体）
- **1 回の接続で 1 往復**: 依頼も応答も JSON 1 行です。依頼には引数・`qdl.exe` を実行したフォルダ・やり取りの版が入り、応答には終了コード・標準出力・標準エラー・やり取りの版が入ります
- **やり取りの版**: 依頼と応答の形には版があり、`qdl.exe` と本体の版が違うときはコマンドを実行せず、終了コード 4 で終わります。本体に同梱されている `qdl.exe` を使えば版は合います
- **初期化が終わるまで待つ**: 本体が起動した直後に届いた依頼は、本体の初期化が終わってから処理します（最大 60 秒。過ぎると失敗として返します）
- **混んでいるとき**: パイプが塞がっているときは、`qdl.exe` が最大 10 秒待ってつなぎ直します

依頼は 1 件 1 MB までです。超えると本体はコマンドを実行せず、終了コード 4 を返します。

## コマンド一覧

コマンドは「画面 → もの → 操作」の順に書きます（例: `qdl workspace item add`）。同じ `item`・`group` という語でも、メイン画面のアイテムとワークスペースのアイテムのように画面ごとに中身が違い、1 語では区別できないためです。各段で `--help` を付けると、その段の説明を出します（`qdl launcher --help`、`qdl workspace --help`）。値を取るオプションの直後の `-h`・`--help` は、説明の求めではなくその値として読みます（`--args -h` は引数 `-h` を登録する）。

| コマンド | 何が起きるか |
| --- | --- |
| `help`（引数なし、`--help`、`-h` も同じ） | 使い方とコマンドの一覧を出す（JSON ではない） |
| `status` | 本体の版・`qdl.exe` の版・本体のプロセス ID・設定フォルダの場所を返す。何も変えない |
| `reload` | 設定ファイルを読み直す（メイン画面の F5 と同じ再読み込み）。読み込み結果を返す |
| `check` | 読み直さずに、直近の読み込み（起動時・F5・`reload`・CLI の書き込み前）の結果を返す |
| `open <id か表示名>` | メイン画面のアイテムを開く（画面で選んで Enter を押したのと同じ。トーストを出し、起動の記録にも数える）。セット・クリップボードアイテムも開ける。返り値は `{"opened": {"id", "name", "type"}}`。フォルダ取込の行と、そこから並ぶアイテムは開けない（`invalid`）。開くのに失敗したら `unavailable` |
| `show [main\|workspace]` | メイン画面（既定）かワークスペースを出す。返り値は `{"shown": "main"}` など。AutoHotkey・Stream Deck・タスクスケジューラーから呼ぶ用途 |
| `launcher item list` | メイン画面のアイテムの一覧。`--file <data2.json>` か `--tab <タブ名>`、`--grep <語>` で絞る（無いデータファイル・タブは `not_found`）。`--with-text` でクリップボードアイテムの本文も返す |
| `launcher item add` | メイン画面にアイテムを足す |
| `launcher item update <id か表示名>` | メイン画面のアイテムを変える・別のタブ（データファイル）へ移す |
| `launcher item remove <id か表示名>` | メイン画面のアイテムを消す |
| `launcher set row list <セット>` | セットの行の一覧。行番号（0 始まり）と行の名前を付ける |
| `launcher set row add <セット>` | セットに行を足す |
| `launcher set row remove <セット> <行番号>` | セットの行を消す。最後の 1 行は消さない |
| `launcher tab list` | メイン画面のタブとデータファイルの構成。ファイルごとのアイテム数・既定のタブ・どのタブにも入っていないファイルを返す |
| `launcher tab add` | タブを足す。新しいデータファイルを 1 つ作って入れる |
| `launcher tab update <タブ>` | タブの名前・並び順を変える |
| `launcher tab remove <タブ>` | タブを消す。消えることになるデータファイルが空のときだけ |
| `launcher tab file add <タブ>` | 新しいデータファイルを作ってタブに入れる。`--existing` で既存のファイルを入れる |
| `launcher tab file update <データファイル>` | データファイルの名前（ラベル）を変える |
| `launcher tab file remove <タブ> <データファイル>` | データファイルをタブから外す。ほかのタブで使っていなければディスクからも消すので、空のときだけ |
| `settings get [<キー>]` | 本体の設定（`settings.json`）。キーを省くと全項目と、CLI から変えられるキーの一覧（`writable`）を返す |
| `settings set <キー> <値>` | 設定を 1 項目変える。変えられるキーと値の範囲は[設定の変更](#設定の変更) |
| `workspace list` | ワークスペースの一覧（グループ数・アイテム数つき） |
| `workspace add` | ワークスペースを足す |
| `workspace update <id か名前>` | ワークスペースの名前・並び順を変える |
| `workspace remove <id か名前>` | 空のワークスペースを消す |
| `workspace item list` | ワークスペースのアイテムの一覧。`--workspace`・`--group`・`--grep` で絞る。`--with-text` でクリップボードアイテムの本文も返す。参照はメインウィンドウのアイテムの中身で埋めて返す（下の「参照」） |
| `workspace item add` | ワークスペースにアイテムを足す。`--from` ならメインウィンドウのアイテムを参照で足す（`--copy` ならコピー） |
| `workspace item update <id か表示名>` | ワークスペースのアイテムを変える・移す |
| `workspace item remove <id か表示名>` | ワークスペースのアイテムを消す |
| `workspace item convert <id か表示名> --to copy\|ref` | 参照とコピーを行き来する。`--to ref` では `--from` で指す先を選ぶ |
| `workspace item move-to-main <id か表示名>` | コピーをメインウィンドウのデータファイルへ移し、ワークスペース側を参照に変える（`--file`・`--tab` で移す先） |
| `workspace group list` | ワークスペースのグループの一覧。`--workspace`・`--grep` で絞る |
| `workspace group add` | ワークスペースにグループを足す |
| `workspace group update <id か名前>` | グループの名前・色・親を変える |
| `workspace group remove <id か名前>` | 空のグループを消す |
| `workspace group archive <id か名前>` | グループを、子孫のサブグループとアイテムごとアーカイブする |
| `workspace archive list` | アーカイブしたグループの一覧。`--grep` で絞る |
| `workspace archive restore <id か名前>` | アーカイブしたグループを復元する。`--workspace` で復元先を選ぶ |

### 足す・変えるときのオプション

| オプション | 使えるコマンド | 内容 |
| --- | --- | --- |
| `--name` | item add（必須。フォルダ取込と、workspace の `--from` を除く）／update、group add（必須）／update、workspace add（必須）／update | 表示名 |
| `--path` | item add（必須。セットを除く。通常のアイテムは `--set window=…` で対象ウィンドウを渡せば省ける）／update、set row add | ファイル・フォルダ・URL・コマンド。相対パスは `qdl` を実行したフォルダが基準。セットでは行の開くもの。通常のアイテムで省くと、パスの無い単一アイテム（開いているウィンドウに切り替えるだけ）になる |
| `--args` | item add／update、set row add | コマンドライン引数。セットでは `--path` の行にだけ付けられる |
| `--item` | launcher item add（`--type set`）、set row add | 行の開くものにする登録済みのアイテム（id か表示名）。`--path` とはどちらか一方 |
| `--label` | launcher item add（`--type set`）、set row add、launcher tab add、tab file add／update | セットでは行の名前。タブではデータファイルの名前（省略時は「<タブ名>用データファイル」） |
| `--existing` | launcher tab file add | タブに入れる既存のデータファイル（`data5.json` など。`tab list` の `unassignedFiles`） |
| `--memo` | item add／update | メモ |
| `--text` `--text-file` | item add（`--type clipboard`。どちらか必須）／update | クリップボードアイテムの本文。`--text-file` は UTF-8（BOM の有無を問わない）か、BOM 付きの UTF-16 のテキストファイル（Windows PowerShell 5.1 の `>`・`Out-File` の既定は UTF-16。1 MB まで。相対パスは `qdl` を実行したフォルダが基準）。UTF-8 として読めないもの（`Set-Content` の既定の Shift_JIS など）は、化けたまま保存せずに `invalid` で断る。どちらか一方だけ |
| `--with-text` | item list | 中身がテキストだけのクリップボードアイテムに、本文 `text` を付ける |
| `--file` `--tab` | launcher item add／update、workspace item move-to-main | 足す（update・move-to-main では移す）データファイル、またはタブ（その先頭のデータファイル）。add・move-to-main で省略したときは `datafiles/data.json` |
| `--type` | launcher item add、workspace item add | `item`（既定）・`dir`（フォルダ取込）・`set`（セット）・`clipboard`（テキストだけのクリップボードアイテム）。workspace item add は `item` と `clipboard` だけ。廃止した `window`（ウィンドウ操作）を渡すと `usage` で断り、代わりに `--set window='{"processName":"notepad.exe","title":"…"}'` でパスの無い単一アイテムを作るよう案内する |
| `--group` | workspace item add／update | 入れるグループ。グループのあるワークスペースへ足すとき（add）と、update で `--workspace` だけを変えて移す先にグループがあるときは必須（下の「足す先のグループ」）。`""` は使えない（`usage`） |
| `--from` | workspace item add、workspace item convert | 足す元・指す先のメインウィンドウのアイテム（id か表示名）。item add では `--name`・`--group`・`--workspace`・`--position`・`--copy`・`--dry-run` と一緒に使え、中身を決めるオプション（`--path`・`--args`・`--memo`・`--type`・`--text`・`--text-file`・`--set`）とは使えない。決まりは下の「メインウィンドウのアイテムを足す」 |
| `--copy` | workspace item add（`--from` と一緒にだけ） | 参照ではなくコピーで足す。`--from` 無しで渡すと `usage` |
| `--to` | workspace item convert（必須） | `copy`（参照をコピーにする）か `ref`（参照にする・指し直す） |
| `--workspace` | workspace の各コマンド | ワークスペース。グループを指定したときは、そのグループのワークスペースになる。archive restore では復元先（省略時は元のワークスペース） |
| `--position` | workspace item add／update、workspace add／update、set row add、launcher tab add／update | 同じ並びの中の位置（0 始まり）。グループの中はサブグループとアイテムが同じ並び。workspace add／update ではワークスペースの、launcher tab add／update ではタブの並び。set row add では行を差し込む位置（省略時は最後） |
| `--color` | workspace group add／update | `primary` `success` `danger` `warning` `info` `secondary` `purple` `teal` `pink` `indigo` `orange` `cyan`、または `#rrggbb` |
| `--parent` | workspace group add／update | 親グループ（2 段まで）。update で `""` を渡すと最上位へ移す |
| `--set key=value` | item add／update | 専用のオプションが無い項目（例 `--set options='{"depth":1}'`、`--set entries='[{"itemId":"…"}]'`）。値が JSON の配列・オブジェクト・数値・`true`／`false`ならその型になる |
| `--unset key` | item update | 項目を外す |
| `--dry-run` | 書き込む各コマンド（`settings set` を含む） | 書き込まずに、結果だけを返す |

### 決まりごと

- **対象の指定**: id か、表示名の完全一致。表示名が複数に当たったときは何も変えずに終わり、候補（id・表示名・場所）を返す。部分一致では指定しない（探すときは `list --grep`）
- **相対パス**: `.` で始まる、または `\`・`/` を含み、絶対パスでも URL でも `%VAR%` で始まるパスでもないときだけ、実行したフォルダを基準に絶対パスにする。`notepad.exe` や `code` のように PATH から探すコマンドはそのまま
- **種類**: 通常のアイテムの種類（URL・フォルダ・ファイル・アプリ・カスタム URI）は、画面の登録と同じくパスから判定する。結果の `kind` に入る（データファイル上の `type` は `item` のまま）。パスが空なら `windowSwitch`（パスの無い単一アイテム。例 `qdl launcher item add --name "MS To Do" --set window='{"processName":"ApplicationFrameHost.exe"}'`）
- **検証**: 設定ファイルを読み込むときと同じ検証を通す。その種類に無い項目を `--set` すると、黙って捨てずに断る
- **常に管理者として実行**: 通常のアイテムに `--set runAsAdmin=true` を付けると、開くたびに管理者として起動する（外すときは `--unset runAsAdmin`）。付けられるのはパスがアプリ（exe・.lnk・.bat/.cmd など。ストアアプリを除く）のものだけで、ほかは `invalid` で断る。セットには無い項目なので断る（行は指すアイテムの値に従う）。launcher item・workspace item のどちらでも同じ
- **書き込みの前の読み直し**: 書き込むコマンドは、まず設定ファイルを読み直す。QDL の外でファイルが編集されていれば、ここで外部変更として検知し、変更前の内容を残す。ワークスペースは読み直さないと書き込みを断る作りなので、CLI では外部で編集した直後でも書き込める
- **書き込んだ後**: 開いている画面に反映し、「CLI: …を追加しました」のようなトーストで知らせる（失敗・`--dry-run`・一覧では出さない）
- **セットの作り方**: `launcher item add --type set --name <名前>` に、最初の行を `--item <id か表示名>` か `--path <パス>`（`--args`）で渡す（`--label` で行の名前）。`--set entries='[…]'` で行をまとめて渡してもよいが、`--item`・`--path` とは併用できない。2 行目からは `launcher set row add` で足す
- **セットの行にできるもの**: 開くものだけ。`--item` で指せるのは種類 `item`（通常のアイテム。パスの無い単一アイテムを含む）だけで、フォルダ取込・セットなどは断る（フォルダ取込の中身は `--path` で行にする）。対象ウィンドウとウィンドウ位置は CLI からは付けず、画面の「ウィンドウを追加」「ウィンドウ位置を更新」で付ける
- **別のタブへ移す**: `launcher item update <id か表示名> --tab <タブ>`（か `--file`）。id を保ったまま移すので、セットの行は切れない。ほかの項目の変更と同時にもできる。移す先に書いてから元のファイルから消す（途中で失敗しても、消えずに 2 つのファイルに残る）。そのタブのどれかのデータファイルに既にあれば移さず、`"unchanged": true` を返す。自動取込で入ったアイテムは移さない（取込は取り込み先のファイルの中で入れ替えるので、次の取込でまた足される）
- **タブ構成**: アイテム管理画面のタブの操作と同じ計算・同じ順（新しいファイルを作る → `settings.json` の `dataFileTabs`・`dataFileLabels` を保存する → どのタブにも残らないファイルを消す）で確定し、開いている画面に知らせる。`<タブ>` は番号（0 始まり）か名前の完全一致、`<データファイル>` は `data3.json` のようなファイル名か名前（ラベル）。画面と違って確認を挟めないので、アイテムが入ったデータファイルを消すことになる操作（`tab remove`・`tab file remove`）は `conflict` で断る。最後のタブと、メインのデータファイル（`datafiles/data.json`）を消す操作も `conflict`。消したファイルを取り込み先にしていた自動取込ルールは、画面と同じく無効にして結果の `disabledAutoImportRules` で知らせる。タブの表示（基本設定の「データファイルのタブを表示」）がオフのときは、足したタブが画面に出ないので、結果に `"tabsHidden": true` を付ける
- **アーカイブ**: `workspace group archive` は、画面と同じく先に切り離しウィンドウを閉じてから、子孫のサブグループとアイテムごとしまう。`archive list`・`archive restore` で扱うのは、しまった単位（最上位のグループ）だけ。一緒にしまったサブグループは一覧の `subgroups` に名前が出て、親と一緒に戻る。`archive restore` は `--workspace` を省くと元のワークスペースへ戻し、元のワークスペースが無くなっていれば既定（先頭）のワークスペースへ戻す。どちらも画面の「移動先を選んで復元」と同じ処理で、最上位のグループとして戻る
- **クリップボードアイテム**: CLI で足せるのは、中身がテキストだけのもの（画面の「テキストを書く」と同じ）。本文を `--text` か `--text-file` で渡すと、実データを新しいファイルに保存して参照（`dataFileRef`）を差し替える。前の実データのファイルは消さない（画面で書き換えたときと同じ）。本文を書き換えられるのは中身がテキストだけのもので、画像・HTML・RTF を含むものは `conflict` で断る（名前・メモの変更と別のタブへの移動はできる）。参照の項目（`dataFileRef`・`savedAt`・`formats`・`preview`）は `--set`・`--unset` で変えられない。今の本文は `list --with-text` で読める
- **触れないもの**: 画像・HTML・RTF を含むクリップボードアイテムの中身（画面の操作で作るもの。名前・メモは変えられ、消すこともできる）。中身のあるグループ・ワークスペースは消さない。最後の 1 つのワークスペースも消さない。アーカイブからの完全削除と、アーカイブのアイテム 1 件ずつの復元はできない（画面で行う）。セットの最後の 1 行は消さない（セットごと消すときは `launcher item remove`）
- **設定**: `settings set` で変えられるのは[設定の変更](#設定の変更)の項目だけ
- **ワークスペースに足せる種類**: 新しく作れるのは、通常のアイテム（パスの無い単一アイテムを含む）と、テキストだけのクリップボードアイテム。セットと、画像などを含むクリップボードアイテムは、`--from` でメインウィンドウのアイテムを参照で（`--copy` ならコピーで）足す（既にあるコピーは update で変えられる）
- **足す先のグループ**: ワークスペースのアイテムはどれかのグループに入る（未分類という区画は無い。[ワークスペース機能 - 構成](./workspace.md#構成)）。`workspace item add` は、グループのあるワークスペースでは `--group` が要り、無いと `usage`（「ワークスペース「{名前}」にはグループがあるので、--group で入れるグループを指定してください」）。グループが 1 つも無いワークスペースへは `--group` 無しで足せ、そのとき「未分類」という名前のグループを作って入れる。`--group ""`（以前の「未分類へ移す」）は `usage`。`workspace item update` で `--workspace` だけを変えるときも同じで、移す先にグループがあれば `--group` が要る（今いるワークスペースを `--workspace` で書いただけなら、動かさずに更新する）。`workspace group remove` で消せるのは、これまでどおり空のグループだけ（中身があれば `conflict`。画面の削除は中身ごと消す）
- **メインウィンドウのアイテムを足す**: `workspace item add --from <id か表示名>` は、メインウィンドウの右クリックの「⭐ ワークスペースに追加」と同じく、既定で参照を足す（[ワークスペース機能 - 参照とコピー](./workspace.md#参照とコピー)）。`--name` はワークスペースでの表示名になる。`--dry-run` は `type: "ref"`・`refItemId` の形を返す。参照できないアイテム（id が無い・フォルダ取込で展開した・データファイルで重複して一覧に出ないなど）は、画面と同じくコピーで足し、結果に `fellBackToCopy: true` を付ける（`--dry-run` も同じ。`--copy` を付けたときは付けない）。フォルダ取込は参照もコピーもできない（`conflict`。中のファイルは `--path` で足す）。読み込みで不正とされたアイテムは `invalid`。表示名が複数に当たれば、タブつきの候補を返して `ambiguous`
- **コピーで足す**: `--copy` を付けると、右クリックの「📄 ワークスペースにコピーを追加」と同じ中身を写して足す（.lnk はリンク先を読んだ形）。セットの行はメインウィンドウのアイテムを id で指したままにする。クリップボードアイテムは実データを複製し、ワークスペース側に自分のファイルを持たせる（複製できなければ元の参照のまま）。写した後に中身を変えるときは `workspace item update`
- **参照**: `workspace item list` と各コマンドの結果は、参照をメインウィンドウのアイテムの中身で埋めた形（指す先の `type`）で返し、`ref`（指す先の `itemId`・ワークスペースでの表示名 `alias`・`status`（`ok`／`missing`／`unsupported`）・`mainDisplayName`・`tabName` など）を付ける。元のアイテムが見つからない参照は `type: "ref"` のまま返す。`workspace item update` で参照に使えるのは `--name`（ワークスペースでの表示名。`""` でメインウィンドウの表示名に戻す）・`--group`・`--workspace`・`--position` だけで、`--path`・`--args`・`--memo`・`--text`・`--text-file`・`--set`・`--unset` は `conflict`（中身は `qdl launcher item update <指す先の id>` で直すよう案内する）
- **参照とコピーを行き来する**: `workspace item convert <id か表示名> --to copy` は参照をコピーにする（画面の「📄 コピーにする」と同じ）。参照でないもの・元のアイテムが見つからない参照は `conflict`。`--to ref` はコピーを参照にする（参照なら指し直す。画面の「🔁 別のアイテムを指す…」・一括の「🔗 メインウィンドウのアイテムとつなぐ…」と同じく、表示名が違えばワークスペースでの表示名にし、メモはメインウィンドウのアイテムにメモが無ければ移す）。指す先は `--from <id か表示名>`（フォルダ取込は `conflict`）。`--from` を省くと、パスと引数が同じメインウィンドウのアイテムが 1 件のときだけそれを指し、0 件なら `not_found`、2 件以上なら `ambiguous`。`--dry-run` は `before`・`to`（`ref` なら指す先の `refItemId` も）を返す
- **メインウィンドウへ移す**: `workspace item move-to-main <id か表示名>` は、画面の「🚀 メインウィンドウへ移して参照にする」と同じく、コピーを移す先のデータファイルの末尾に足し、ワークスペース側をその参照に変える（[ワークスペース機能 - メインウィンドウへ移す](./workspace.md#メインウィンドウへ移す)）。移す先に、パスと引数・ウィンドウ切り替え・カスタムアイコンが同じ通常アイテムが既にあれば、新しく作らずにそれを指す（結果の `reused: true`）。参照・元のアイテムが見つからない参照は `conflict`。`--dry-run` は `before`・移す先の `file` を返す（既にあるアイテムを指すかは返さない）
- **参照されているアイテムを消す**: `launcher item remove` は、ワークスペースの参照（アーカイブを含む）があっても消し、参照は消さない（「元のアイテムが見つかりません」になる）。結果に参照の件数 `workspaceRefs` を付ける（`--dry-run` でも）

### 設定の変更

`qdl settings set <キー> <値>` で、設定画面の項目を 1 つずつ変えます。キーは `settings.json` と同じ名前（大文字・小文字も同じ）です。保存は設定画面と同じ処理を通るので、言語やワークスペースの不透明度などはその場で効き、開いている画面にも反映します。結果は `{"key", "before", "after"}` で、今と同じ値なら保存せずに `"unchanged": true` を付けます。

| 分類 | キー | 値 |
| --- | --- | --- |
| 表示 | `language` | `auto`・`ja`・`en` |
| 表示 | `showKeyboardHints`・`showDataFileTabs`・`searchMemo`・`searchIgnoreWidth`・`searchIgnoreKana`・`searchSortByUsage` | `true`・`false` |
| 表示 | `defaultFileTab` | 起動したときに開くタブの、データファイル（`data2.json` など）。どれかのタブに入っているものだけ |
| システム | `recordLaunchUsage` | `true`・`false`（起動の記録を残す） |
| システム | `updateCheckEnabled`・`updateCheckIncludeBeta` | `true`・`false`（新しい版が出たら知らせる・ベータ版も知らせる） |
| ホットキー | `hotkey`・`itemSearchHotkey` | `Ctrl+Alt+Q` のような組み合わせ。`itemSearchHotkey` は `""` で無効になる |
| メイン | `windowWidth`・`windowHeight` | 400〜2000・300〜1200 |
| メイン | `windowPositionMode` | `center`・`cursor`・`cursorMonitorCenter`・`fixed` |
| メイン | `windowFixedPosition` | `x,y`（整数 2 つ。`fixed` のときの位置）か `null`（まだ置いていない） |
| メイン | `windowSnapEnabled` | `true`・`false` |
| 管理 | `editModeWidth`・`editModeHeight` | 800〜2000・600〜1200 |
| ワークスペース | `workspaceOpacity` | 0〜100 |
| ワークスペース | `workspacePositionMode` | `displayLeft`・`displayRight`・`fixed` |
| ワークスペース | `workspaceTargetDisplayIndex` | 0 から、接続しているディスプレイの数 − 1 まで。`-1` はメインウィンドウと同じディスプレイ |
| ワークスペース | `detachedPositionMode` | `mainDisplay`・`saved` |
| ワークスペース | `workspaceFixedPosition` | `x,y`（整数 2 つ。`fixed` のときの位置）か `null`（まだ置いていない） |
| ワークスペース | `workspaceBackgroundTransparent`・`workspaceVisibleOnAllDesktops`・`detachedVisibleOnAllDesktops` | `true`・`false` |
| バックアップ | `backupEnabled`・`backupIncludeClipboard` | `true`・`false` |
| バックアップ | `backupRetention` | 3〜50 |

- **範囲の外・形の違う値**: `invalid` で断る。範囲は設定画面と同じ。知らないキーと、どのタブにも入っていない `defaultFileTab` は `not_found`。古い値の `primaryLeft`・`primaryRight` は読めるが、新しくは選べない
- **ホットキー**: 設定画面と同じく、形式を確かめ、他のアプリともう一方のホットキーに使われていないかを確かめてから登録し直す（`--dry-run` でも使われていないかまで確かめる）。形式の誤りは `invalid`、使用中は `conflict`。登録の途中で失敗したときは元のキーに戻す。ランチャーを開く `hotkey` は空にできない
- **読むだけの項目**: `settings get` では読めるが、`set` は `usage` で断る。自動起動（`autoLaunch`。OS のスタートアップを書き換えるうえ、Store 版は Windows 側でしか変えられない状態がある）、ブックマークの自動取込（`bookmarkAutoImport`）、CLI を使えるようにする設定（`cliEnabled`。CLI から自分を外せてしまう）、アプリが書く版（`settingsVersion`・`createdWithVersion`・`updatedWithVersion`）。タブ構成（`dataFileTabs`・`dataFileLabels`）は `launcher tab` で変える

### 出力

成功したら、標準出力に結果の JSON を出します。

- `list`: 配列。各要素に場所を付ける（メイン画面は `file`・`tab`、ワークスペースは `location: ["ワークスペース名", "グループ", "サブグループ"]`）。`--with-text` では、中身がテキストだけのクリップボードアイテムに本文 `text` を付ける
- `add`: 足したもの（採番した `id` を含む）。`--from` では足した元 `from`（`id`・`displayName`・タブの `location`）を付ける
- `update`: `{ "before": 変える前, "item": 変えた後 }`（グループは `group`、ワークスペースは `workspace`）。別のタブへ移したときは `"moved": { "from", "to" }` を付ける
- `remove`: `{ "removed": 消したもの }`（`launcher item remove` は、ワークスペースから参照されていれば `workspaceRefs`（件数）も付ける）
- `item convert`: `{ "before": 変える前, "item": 変えた後 }`
- `item move-to-main`: `{ "before": 移す前, "item": 参照になった後, "file": 移した先のデータファイル, "reused": 既にあるアイテムを指したか }`
- `group archive`: `{ "archived": しまったグループ }`（`itemCount`・`subgroupCount` は子孫まで数える）
- `archive list`: 配列。各要素に `archivedAt`・元のワークスペース `workspace`（無くなっていれば `null`）・子孫までの `itemCount`・一緒にしまったサブグループの名前 `subgroups` を付ける
- `archive restore`: `{ "restored": 戻したグループ }`。`--dry-run` では `{ "dryRun": true, "restoring": 戻すもの, "workspace": 復元先 }`
- `tab list`: `{ "showDataFileTabs", "tabs": [ { index, name, files: [ { file, label, itemCount } ], itemCount, default } ], "unassignedFiles": [ … ] }`
- `tab add`・`tab update`: `{ "tab": 足した・変えた後のタブ }`（update は `before` も）。`tab remove` は `{ "removed", "deletedFiles" }`、`tab file add` は `{ "file": { file, label, itemCount, created }, "tab" }`、`tab file update` は `{ "before", "file" }`、`tab file remove` は `{ "removed", "deleted", "tab" }`
- `set row list`・`set row add`・`set row remove`: `{ "set": { id, displayName, file, tab }, "entries": [ 行 ] }`（変えた後の全部の行）。各行に行番号 `index` と行の名前 `name` を付け、指しているアイテムが見つからない行には `"missing": true` を付ける
- `settings get <キー>`: `{ "key", "value", "writable" }`（キーを省くと `{ "settings", "writable" }`）
- `--dry-run`: 上の形に `"dryRun": true` を付けたもの（足す前なので、足すものの `id` は `null`）

JSON は UTF-8 で出します。どのコマンドにも `--ascii` を付けられ（コマンドの前でも後ろでもよい。値を取るオプションの直後はその値として読む）、付けると JSON の ASCII 以外の文字（日本語・絵文字）を `\uXXXX` で書きます（失敗のときの JSON も。標準エラーの文と `--help` の説明はそのまま）。Windows PowerShell 5.1 は、パイプで受け取る文字を既定で Shift_JIS として読むので、`qdl launcher item list | ConvertFrom-Json` の日本語が化けます。`--ascii` を付けるか、先に `[Console]::OutputEncoding = [Text.Encoding]::UTF8` を実行してください。

失敗したら、標準出力に次の形の JSON、標準エラーに人向けの文を出します。`code` は固定の英単語で、文言を変えても変えません。

`message`・標準エラーの文・`--help` の説明は、本体の表示言語（基本設定の「表示言語」。日本語か英語）で出します。`code` と JSON のキーは言語によりません。qdl.exe 自身が出す文（本体に接続できない・起動できないとき、版が合わないとき）は、本体の言語が分からないので日本語のままです。

```json
{ "error": { "code": "ambiguous", "message": "ワークスペースのアイテム「議事録」が 2 件あります。id で指定してください",
  "candidates": [ { "id": "vZgc24yO", "displayName": "議事録", "location": ["既定", "案件A"] } ] } }
```

| code | 意味 | 終了コード |
| --- | --- | --- |
| `usage` | コマンド・オプションの誤り | 2 |
| `not_found` | 指定したものが無い | 2 |
| `ambiguous` | 表示名が複数に当たった（`candidates` に候補） | 2 |
| `invalid` | 内容が検証を通らない | 1 |
| `conflict` | 今の状態ではできない（中身のあるグループ・ワークスペースや、セットの最後の 1 行を消す、自動取込のアイテムを移すなど） | 1 |
| `unavailable` | 設定ファイルが読めない（破損など） | 1 |
| `internal` | 想定外の失敗 | 1 |

### reload で起きること

メイン画面の F5 と同じ再読み込みをし、終わったら開いている画面に知らせます。

1. `settings.json` を読み直し、ホットキー・自動起動などの設定を当て直す（失敗しても、データの読み直しは続ける）
2. データファイルとワークスペースファイルを読み直し、読み込みレポートを作り直す
3. 開いているすべての画面に、データが変わったことを知らせる（各画面が表示を読み直す）

標準出力の JSON には、読み込んだ日時・件数の集計・外部変更の検知時に作ったスナップショットのフォルダ名と、問題のあったファイル（読めなかった、スキップ・採番・補正があった、QDL の外で変更されていた、書き戻した、新しい版の QDL が保存したので書き込まない）の詳しい結果だけが入ります（形式は [データファイル形式 - 読み込みレポートの形式](../architecture/file-formats/data-format.md#読み込みレポートの形式)）。`check` は読み直さずに、直近の読み込みの同じ結果を返します。

## 終了コード

| コード | 意味 | 主な場面 |
| --- | --- | --- |
| 0 | 成功 | |
| 1 | 失敗 | コマンドは解釈できたが、処理に失敗した（`code` が `invalid`・`conflict`・`unavailable`・`internal`）。本体の初期化が 60 秒以内に終わらなかった |
| 2 | コマンドの誤り・指定の誤り | 知らないコマンドやオプション、指定したものが無い、表示名が複数に当たった（`code` が `usage`・`not_found`・`ambiguous`） |
| 3 | 本体に接続できない | 本体が起動しておらず起動もできない、起動しても 60 秒以内に応答がない、`QDL_NO_LAUNCH=1` で起動しなかった |
| 4 | やり取りの誤り | `qdl.exe` と本体のやり取りの版が合わない、依頼や応答が読めない・送れない、依頼が大きすぎる |

`qdl.exe` が自分で 3 や 4 と判断したときは、標準エラーに `qdl:` で始まる文を出します。

## 本体が起動していないとき

パイプが無い（本体が動いていない）ときは、`qdl.exe` が本体を起動し、パイプが開くのを最大 60 秒待ってから依頼します。待つ間、標準エラーに「QuickDashLauncher を起動しています…」と出します。

- **起動のしかた**: 本体には `--launched-by-cli` を付けて起動します。この印があると、本体はスプラッシュを出しません。本体は `qdl.exe` から切り離して起動し、本体のログが `qdl.exe` の出力に混ざらないよう、標準入出力は引き継ぎません。呼び出し元（AI のシェルなど）のパイプのハンドルも本体に渡さないので、本体が動き続けていても `qdl` の呼び出しはすぐに終わります
- **起動する本体の探し方**: 次の順に探し、最初に見つかったものを起動します
  1. 環境変数 `QDL_APP_EXE` に書かれたパス
  2. userData フォルダの `cli-launcher.json` に記録された本体の場所。パッケージ版の本体が起動のたびに書き出します。ポータブル版は起動のたびに一時フォルダへ展開して動くので、展開先ではなく展開前の exe の場所を記録します
  3. `qdl.exe` の場所から見たインストール先の `QuickDashLauncher.exe`（`qdl.exe` は `<インストール先>\resources\bin\qdl.exe` に同梱されています）
- **起動させたくないとき**: 環境変数 `QDL_NO_LAUNCH=1` を指定すると、本体が動いていなければ起動せずに終了コード 3 で終わります

## 二重起動の防止との関係

本体は、同じ userData フォルダで 2 つ同時には動きません。2 つ目を起動すると、2 つ目はすぐに終了し、動いている側がメインウィンドウを表示します。

- `qdl.exe` が本体を起動しようとしたときに、ちょうど別の経路で本体が起動していた場合も、`qdl.exe` が起動したほうはすぐに終了し、依頼は動いている本体が処理します。`--launched-by-cli` 付きで起動されたときは、動いている側はメインウィンドウを表示しません
- 開発用のインスタンス（`APP_INSTANCE`）は userData が別なので、本番の本体と同時に動かせます。それぞれ別のパイプで待ち受けます
- 環境変数 `QUICK_DASH_CONFIG_DIR` で設定フォルダを指定して起動した本体（E2E テストや `npm run dev:test`）は、二重起動の防止の対象外で、CLI の待ち受けもしません。CLI からは操作できません

## 安全面

- パイプは Windows の既定の権限で作ります。既定の権限で書き込めるのは、パイプを作ったユーザー（本体を動かしているユーザー）・管理者（Administrators）・SYSTEM だけなので、同じ PC の別のユーザーからは依頼できません
- パイプ名にユーザー名を入れているので、別のユーザーがそれぞれ本体を動かしていても、自分の本体にだけつながります
- ネットワークのポートは開きません

## 制限事項

### 現在の制限

1. **扱えるのはアイテム・セットの行・タブ構成・ワークスペースとそのグループ・グループのアーカイブ・設定まで**: 開けるのはメイン画面のアイテムだけ（`open`。ワークスペースのアイテムは開けない）。 設定のうち自動起動・ブックマークの自動取込・CLI の有効化は読むだけです（[設定の変更](#設定の変更)）
2. **アンインストールしても PATH は残る**: アンインストールしても PATH の項目と `%LOCALAPPDATA%\quick-dash-launcher\bin` は残ります。先に管理画面で「QuickDashLauncher CLI を使えるようにする」を外してからアンインストールしてください
3. **Windows のみ**: 名前付きパイプを使うので、本体と同じく Windows でだけ動きます

## 関連ドキュメント

- **[セット](set.md)** - セットの行・開くもの・対象ウィンドウ・ウィンドウ位置
- **[システム概要](../architecture/overview.md)** - プロセス構成とデータの流れ
- **[データファイル形式](../architecture/file-formats/data-format.md)** - 読み込みレポートの形式
- **[ファイル形式一覧](../architecture/file-formats/README.md#qdl-の外での変更)** - 設定フォルダのファイルを手で編集しない理由と、QDL の外で変わったときの備え
- **[開発ガイド - 多重起動](../setup/development.md#多重起動)** - 二重起動の防止と、開発中に CLI を試す方法
- **[ビルドとデプロイ](../setup/build-deploy.md)** - qdl.exe のビルドと同梱
