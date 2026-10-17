<p align="center">
  <img src="assets/icon.svg" width="96" alt="" />
</p>

<h1 align="center">QuickDashLauncher</h1>

<p align="center"><a href="README.md">English</a> | <b>日本語</b></p>

**使うものだけを。タブで整理できる登録型ランチャー**

候補に出るのは、自分で登録したフォルダ・ファイル・URL・アプリだけ。「仕事」「個人」「A社」のように自由にタブで分けて、名前の一部で開く

<p align="center">
  <a href="https://github.com/masaodev/quick-dash-launcher/releases"><img src="https://img.shields.io/github/release/masaodev/quick-dash-launcher.svg" alt="GitHub Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://github.com/masaodev/quick-dash-launcher/releases"><img src="https://img.shields.io/github/downloads/masaodev/quick-dash-launcher/total.svg" alt="Downloads" /></a>
</p>

<p align="center">
  <a href="#インストール">インストール</a> ·
  <a href="#画面">画面</a> ·
  <a href="docs/README.md">ドキュメント</a> ·
  <a href="https://github.com/masaodev/quick-dash-launcher/releases">リリース</a>
</p>

<p align="center">
  <img src="docs/images/demo-main.gif" alt="QuickDashLauncher のメインデモ" />
</p>

<!-- 日本語版が正本。英語版（README.md）は訳で、同じ PR で両方を直す。メインデモ GIF は `npm run docs:demo-gif` で撮り直す（英語版は docs:demo-gif:en。デモデータ＝tests/demo-gif/demo-content-ja.ts と tests/e2e/templates/demo/） -->

## 特徴

- **全部ここから開ける**
  - アプリ、フォルダ、ファイル、Web ページに加えて、Teams のチャットのようなリンクも同じ画面から開けます。
  - 保存しておいた定型文や画像も、ここから呼び出してクリップボードに戻せます。
- **登録して、タブで整理できる**
  - ドラッグ＆ドロップで 1 件ずつ登録するほか、スタートメニューのアプリやブラウザのブックマークもまとめて取り込めます。
  - タブは「仕事」「個人」「A社」のように自由に分けられます。
  - 候補に出るのは登録したものだけなので、一覧が散らかりません。
  - 名前は自由に付けられるので、長いパスや URL も「勤怠（kintai）」「経費精算（keihi）」のような普段の呼び方で開けます。
    - 💡 ローマ字を添えておくと、かなを変換せずに「kin」と打つだけで開けます。
- **フォルダを丸ごと取り込める**
  - フォルダを指定すると、中のファイルがまとめて候補に並びます。サブフォルダの中まで取り込むかどうかも選べます。
  - 「Excel だけ（`*.xlsx`）」「旧版フォルダは除く（`旧*`）」のように、入れるものと入れないものをワイルドカードで決められます。
  - 後からファイルが増えても、登録し直す必要はありません。
- **打ちかけで候補が出て、すぐ開ける**
  - 名前の一部を打つと、1 文字ごとに候補が絞り込まれます。先頭から打たなくても当たり、「基本設計 画面」のようにスペースで区切ればさらに絞れます。
  - 目当てを選んで Enter で開きます。
  - 今のタブに無いものも、一致した件数がほかのタブに出るので、Tab キーで移れます。

無料のオープンソース（MIT）です。winget ですぐに試せます（ほかの入れ方は[インストール](#インストール)）。

```powershell
winget install masaodev.quick-dash-launcher
```

---

## なぜ登録型なのか

PowerToys Run のような多くのランチャーは、インストール済みのアプリやファイルを自動で全部読み込みます。そのため、使わないものまで候補に並び、目当てを探す手間が残ります。QuickDashLauncher は、作者がこのノイズを嫌って作り始めたランチャーで、使うものを自分で選んで登録する「登録型」をとっています。登録したものだけが候補に出るので、数文字で目当てにたどり着けます。

とはいえ、1 件ずつ登録するのは手間です。そのため、まとめて登録する手段も用意しています。フォルダを指定すれば中のファイルがまとめて候補に並び（フォルダ取込）、スタートメニューのアプリやブラウザのブックマークも一覧から選んで取り込めます。

登録したものは、[専用の管理ウィンドウ](#画面)に一覧で並び、まとめて直せます。

| 観点 | 検索型（PowerToys Run など） | QuickDashLauncher |
| --- | --- | --- |
| 候補に出るもの | インストール済みのもの全部 | 自分で登録したものだけ |
| 登録の手間 | なし（自動で入る） | フォルダ・アプリ・ブックマークはまとめて取り込める |
| 整理のしかた | なし | タブで自由に分ける |
| 名前 | アプリ名やファイル名のまま | 自分で付ける |
| フォルダの中身 | 出ない | 取り込めば候補に出る |

### こんな人におすすめ

- いくつもの仕事を並行して進めていて、フォルダ・資料・Web の管理画面を開くたびに探している
- 共有フォルダの深い階層を毎回たどっている
- Teams のチャットやよく使う Web ページを、アプリやブックマークを開いて探している
- 使わないアプリやファイルが候補に出てくるのを避けたい

---

## 画面

### アイテム管理

登録したものをタブごとに一覧で直せます。メインウィンドウの ⚙ →「アイテム管理」で開きます。

<p align="center">
  <img src="docs/images/readme-admin.png" alt="管理ウィンドウのアイテム管理。プロジェクトのタブに、フォルダ取込・Web ページ・Teams のチャットなどが表で並んでいる" />
</p>

### アイテム登録画面

1 件ずつ登録します。メインウィンドウの ➕ →「アイテムを追加…」か、ドラッグ＆ドロップで開きます。

<p align="center">
  <img src="docs/images/readme-register-item.png" alt="登録画面。名前「勤怠（kintai）」で URL を登録するところ" />
</p>

### アイテム登録画面（フォルダ取込）

種別を「フォルダ取込」にすると、フォルダの中のファイルをまとめて候補に並べられます。

<p align="center">
  <img src="docs/images/readme-register-dir.png" alt="登録画面。種別をフォルダ取込にして、Excel だけを取り込み、旧版を除く設定にしたところ" />
</p>

<!-- 画面イメージは `npm run docs:readme-images` で撮り直す（英語版は docs:readme-images:en。デモデータ＝tests/demo-gif/demo-content-ja.ts） -->

---

## ほかにできること

登録画面の種別を変えると、ファイルや URL を開く以外の使い方もできます。種別ごとの説明は[アイテムの種別](docs/features/item-categories.md)にまとめています。

| 機能 | できること |
| --- | --- |
| [セット](docs/features/set.md) | 登録済みのアイテムやパスをまとめて一度に開き、必要ならウィンドウを記録した位置に並べる |
| クリップボード | テキストや画像を保存しておき、選ぶとクリップボードに戻す |
| [ブックマークの取り込み](docs/features/bookmark-import.md) | ブラウザのブックマークを取り込む。自動で取り込み直す設定もできる |

---

## インストール

Windows 10 以降で動きます。表示言語は Windows に合わせて日本語か英語になり、「設定」で変えられます。

### winget

```powershell
winget install masaodev.quick-dash-launcher
```

更新は `winget upgrade masaodev.quick-dash-launcher`。winget には正式版だけを公開しています（ベータ版は Releases のプレリリースから入手できます）。

### インストーラー版・ポータブル版

[Releases](https://github.com/masaodev/quick-dash-launcher/releases) からダウンロードします。

- インストーラー版: `QuickDashLauncher.Setup.x.x.x.exe` を実行します。インストールが終わると起動します。
- ポータブル版: `QuickDashLauncher.x.x.x.exe` を好きなフォルダに置いて実行します（インストール不要）。

インストーラー版・ポータブル版は署名していないため、初回の実行時に Windows SmartScreen の警告が出ることがあります。そのときは「詳細情報」→「実行」で起動できます。

初回起動の画面で、ランチャーを呼び出すホットキー（初期値は Alt+Space）を決めます。キー操作は[キーボードショートカット](docs/features/keyboard-shortcuts.md)を参照してください。

うまく動かないときは[困ったとき](docs/features/troubleshooting.md)を参照してください。

---

## バグ報告・開発への参加

バグ報告と機能の要望は [GitHub Issues](https://github.com/masaodev/quick-dash-launcher/issues) へお願いします。プルリクエストも歓迎します。

ソースからビルドするには、Node.js に加えて、ネイティブモジュールのコンパイルに Visual Studio Build Tools（C++）と Python が必要です。詳しくは[開発ガイド](docs/setup/development.md)を、設計やテストは [docs](docs/README.md) を参照してください。

```bash
git clone https://github.com/masaodev/quick-dash-launcher.git
cd quick-dash-launcher
npm install
npm run dev          # 開発モード起動
npm run test:unit    # 単体テスト
```

---

## ライセンス

[MIT ライセンス](./LICENSE)で公開しています。
