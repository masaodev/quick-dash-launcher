# ドキュメント

QuickDashLauncherプロジェクトのドキュメント一覧です。

## ドキュメント体系

このプロジェクトのドキュメントは以下の構造で整理されています：

```
docs/
├── setup/          # セットアップ・開発
├── screens/        # 画面仕様（主軸：具体的な操作・UI仕様）
├── features/       # 横断的機能（補助：複数画面にまたがる機能・概念）
├── architecture/   # システム設計（技術実装の詳細）
│                   #   設計（overview 等）・規約（css-design・ui-components）・辞書（glossary）
└── testing/        # テスト関連
```

### ドキュメントの役割分担

- **screens/** - 画面単位の具体的な操作とUI仕様（仕様書の主軸）
- **features/** - 複数画面にまたがる横断的な機能や概念の説明
- **architecture/** - 開発者向けの技術実装・内部仕様
- **参照方向** - screens → features → architecture の順に参照（一方向。features から screens、architecture から features・screens へのリンクは逆向きになるので張らない。setup・testing からはどこを参照してもよい）

画面の細部を features・architecture から指したくなったら、その細部は screens 側にまとめ、features・architecture には概念や仕組みだけを書く（逆向きの参照は `/docs-check` の G で見つかる）。

### 書き方の決まり

- 画面仕様（screens/）は [画面仕様書 執筆ガイドライン](screens/WRITING-GUIDE.md) に従う（コード上の名前を本文に書かない、コードの写しを書かない、テンプレート）
- どの文書も、推測で書かずコードで確かめる、表を部分的に直す、見出しを変えたらアンカーも直す、個人の環境を書かない。詳細は `.claude/skills/docs-check/references/verify.md` の「直すときの決まり」

### 変更したときに直す文書

コードを変えたら、同じ PR で次の文書も直す（パスは `docs/` からの相対）。

| 変更の種類                                                   | 直す文書                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 画面・モーダル・ダイアログの UI や操作の変更                 | screens/<該当画面>.md                                                                                                                                                         |
| 画面の見た目の変更（画面イメージのある画面）                 | `npm run docs:screenshots` で撮り直す（[画面イメージ](screens/WRITING-GUIDE.md#画面イメージ)）                                                                                |
| 画面・モーダルの追加・削除                                   | screens/ の仕様書を追加・削除し、screens/README.md の一覧と screens/screen-transitions.md を直す（[新しい画面を足したとき](screens/WRITING-GUIDE.md#新しい画面を足したとき)） |
| 複数画面にまたがる機能の追加・変更                           | features/<該当機能>.md、features/README.md                                                                                                                                    |
| キーボードショートカットの変更                               | features/keyboard-shortcuts.md                                                                                                                                                |
| アイコン処理の変更                                           | features/icons.md                                                                                                                                                             |
| ワークスペース機能の変更                                     | features/workspace.md、screens/workspace-window.md                                                                                                                            |
| 設定項目の追加・変更                                         | architecture/file-formats/settings-format.md、screens/admin-window.md                                                                                                         |
| データファイル（data.json）の形式変更                        | architecture/file-formats/data-format.md                                                                                                                                      |
| workspace.json の形式変更                                    | architecture/file-formats/workspace-format.md                                                                                                                                 |
| IPC の設計（使い分け・命名規則）や主要チャンネルの挙動の変更 | architecture/ipc-channels.md（全チャンネルは網羅しない。一覧は `src/common/ipcChannels.ts`）                                                                                  |
| ウィンドウ制御の変更                                         | architecture/window-control.md                                                                                                                                                |
| 共通UIコンポーネント・CSS の変更                             | architecture/ui-components.md、architecture/css-design.md                                                                                                                     |
| プロセス構成・データフローの変更                             | architecture/overview.md                                                                                                                                                      |
| 用語の追加・変更                                             | architecture/glossary.md                                                                                                                                                      |
| npm scripts・環境変数・開発手順の変更                        | setup/development.md                                                                                                                                                          |
| ビルド・配布の変更                                           | setup/build-deploy.md                                                                                                                                                         |
| テスト構成・テストコマンドの変更                             | testing/README.md（リポジトリ直下の tests/README.md・tests/e2e/README.md も）                                                                                                 |

直し漏れは、リリース前の `/docs-check`（前回の点検以降に変わったコードに触れている文書の照合）でも拾う。

## クイックリンク

- **[セットアップ・開発](setup/README.md)** - 環境構築・開発フロー・ビルド方法
- **[画面仕様](screens/README.md)** - 画面単位の操作とUI仕様（仕様書の主軸）
- **[横断的機能](features/README.md)** - 複数画面にまたがる機能・概念
- **[アーキテクチャ](architecture/README.md)** - 技術実装の詳細（設計・規約・辞書）
  - **[ファイル形式](architecture/file-formats/README.md)** - settings.json・データファイル・workspace.json などの形式と置き場所
- **[テスト](testing/README.md)** - テスト関連
- **[ドメイン用語集](architecture/glossary.md)** - プロジェクトで使用される用語の定義

## docs の外にある文書

| 文書                                                              | 役割                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| [README.md](../README.md)                                         | 利用者向けの紹介・インストール方法                                   |
| [CLAUDE.md](../CLAUDE.md)                                         | Claude Code 向けの作業指示                                           |
| [tests/README.md](../tests/README.md) ほか tests/ 配下の各 README | そのフォルダの案内（テストの正本は [テスト](testing/README.md)）     |
| [scripts/README.md](../scripts/README.md)                         | 開発用スクリプトの説明                                               |
| [src/test/manual/README.md](../src/test/manual/README.md)         | 手動確認用スクリプトの説明                                           |
| [assets/config-readme.md](../assets/config-readme.md)             | アプリが実行時に設定フォルダへ `config/README.md` として書き出す雛形 |

---

詳細なプロジェクト情報は [CLAUDE.md](../CLAUDE.md) を参照してください。
