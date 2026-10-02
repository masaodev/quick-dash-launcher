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
- **参照方向** - screens → features → architecture の順に参照

> 注意: 参照方向のルールとして、features/ から screens/ への逆方向参照は避けてください。features/ のドキュメントが特定の画面の詳細を参照する必要がある場合は、screens/ 側に情報をまとめ、features/ からはその概念や仕組みのみを説明してください。

## クイックリンク

- **[セットアップ・開発](setup/README.md)** - 環境構築・開発フロー・ビルド方法
- **[画面仕様](screens/)** - 画面単位の操作とUI仕様（仕様書の主軸）
- **[横断的機能](features/)** - 複数画面にまたがる機能・概念
- **[アーキテクチャ](architecture/README.md)** - 技術実装の詳細（設計・規約・辞書）
  - **[ファイル形式](architecture/file-formats/)** - data.json、workspace.json、settings.jsonの仕様
- **[テスト](testing/)** - テスト関連
- **[ドメイン用語集](architecture/glossary.md)** - プロジェクトで使用される用語の定義

## docs の外にある文書

| 文書 | 役割 |
|------|------|
| [README.md](../README.md) | 利用者向けの紹介・インストール方法 |
| [CLAUDE.md](../CLAUDE.md) | Claude Code 向けの作業指示 |
| [tests/README.md](../tests/README.md) ほか tests/ 配下の各 README | そのフォルダの案内（テストの正本は [テスト](testing/README.md)） |
| [scripts/README.md](../scripts/README.md) | 開発用スクリプトの説明 |
| [src/test/manual/README.md](../src/test/manual/README.md) | 手動確認用スクリプトの説明 |
| [assets/config-readme.md](../assets/config-readme.md) | アプリが実行時に設定フォルダへ `config/README.md` として書き出す雛形 |

---

詳細なプロジェクト情報は [CLAUDE.md](../CLAUDE.md) を参照してください。
