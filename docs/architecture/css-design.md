# CSSデザインシステム

QuickDashLauncherのスタイルは、CSS変数（カスタムプロパティ）を土台にしている。このドキュメントは、コードを読んでも分からない規約を書く。変数やクラスの定義そのものはソースファイルが正である。

## 設計原則

- **統一性**: 全てのUIコンポーネントで一貫したスタイルを使う
- **保守性**: 色やサイズは一箇所（`variables.css`）で管理する
- **拡張性**: 新しいコンポーネントも同じ変数・共通クラスの上に作る
- **再利用性**: 繰り返し現れるスタイルは共通クラスにする

## ファイル構成

正は `src/renderer/styles/` 以下。構成の考え方は次の 3 層である。

| ファイル | 役割 |
| --- | --- |
| `index.css` | グローバルリセット・ベーススタイル。`variables.css`・`common.css`（と一部のコンポーネント CSS）をここで `@import` する |
| `variables.css` | CSS変数（デザイントークン）の定義 |
| `common.css` | 複数画面で使う共通クラス |
| `components/{名前}.css` | コンポーネント単位のスタイル。対応するコンポーネント（`.tsx`）でインポートする（一部は `index.css` でまとめて読み込む） |
| `splash.css` | スプラッシュ画面専用。`index.css` を経由せず `src/renderer/splash/index.tsx` で読み込む |

新しいコンポーネントのスタイルは `components/` に1ファイル作り、変数と共通クラスを使って書く。

## CSS変数システム

正は `src/renderer/styles/variables.css`。カテゴリと命名の型は次のとおり。具体的な値は同ファイルを参照する。

| カテゴリ | 命名の型 |
| --- | --- |
| 色 | `--color-{primary\|success\|danger\|warning\|info\|secondary}`、派生は `-hover` / `-dark` / `-light` / `-alt` など |
| グレースケール | `--color-white`、`--color-gray-{50〜900}`（数字が大きいほど濃い） |
| 背景 | `--bg-{用途}`（例 `--bg-app`、`--bg-selected`、`--bg-hover`、`--bg-danger-light`） |
| 文字色 | `--text-{用途}`（例 `--text-primary`、`--text-muted`、`--text-error`） |
| 余白 | `--spacing-{xxs\|xs\|sm\|md\|lg\|xl\|2xl\|3xl}` |
| タイポグラフィ | `--font-family`、`--font-family-mono`、`--font-size-{xxs〜3xl\|base}`、`--line-height-{tight\|normal\|relaxed}` |
| 枠と角丸 | `--border-{light\|normal\|dark\|primary\|danger}`、`--border-radius`、`--border-radius-{sm\|lg\|xl}` |
| 影・フォーカス・トランジション | `--shadow`、`--shadow-{sm\|lg\|xl}`、`--focus-ring*`、`--transition-{fast\|normal\|slow\|width}` |
| z-index と寸法 | `--z-{dropdown\|modal}`、`--input-height*`、`--button-height`、`--icon-size*`、`--modal-*`、`--menu-*` |
| ワークスペースのグループ色トークン | `--group-color-{トークン}` |

- ワークスペースのグループ色トークンは、`workspace.json` の `groups[].color` に保存される値に対応する。`primary`/`success`/`danger`/`warning`/`info`/`secondary` はテーマ色（`--color-*`）を参照し、それ以外（`purple` など）は固有色を持つ。トークンから CSS 変数への解決は `src/common/groupColors.ts` の `resolveGroupColorCss()` が行う。
- 必要な値が変数にないときは、直書きせず `variables.css` に既存の命名の型に沿って変数を足す。

## 共通ユーティリティクラス

正は `src/renderer/styles/common.css` と `src/renderer/styles/components/Button.css`。

### ボタンクラス

> **推奨**: モーダルのアクションボタンやフォームの送信ボタンには、[Buttonコンポーネント](ui-components.md#buttonコンポーネント)を使用する。以下のクラスは特殊なケース（ツールバー、タブ等）向けである。

| クラス | 定義 | 用途 |
| --- | --- | --- |
| `.btn` | `Button.css` | Buttonコンポーネントのベース |
| `.btn-primary` / `.btn-danger` / `.btn-info` / `.btn-cancel` | `Button.css` | 状態別の色（Buttonコンポーネントの `variant`） |
| `.btn-sm` / `.btn-lg` | `Button.css` | サイズ（`md` はクラスなし） |
| `.btn-full-width` | `Button.css` | 幅いっぱいに広げる |
| `.btn-base` | `common.css` | Buttonコンポーネントを使わないボタン向けのベース（レガシー） |
| `.action-btn` | `common.css` | 32x32 の正方形アイコンボタン（メインウィンドウのヘッダー：登録・設定・更新・ピン留めなど） |

### その他の共通クラス

| 区分 | クラス | 用途 |
| --- | --- | --- |
| タブバー | `.tab-bar`、`.tab-button`、`.tab-count`、`.tab-name-input` | タブ切り替えとアイテム数表示、タブ名の編集 |
| フォーム | `.input-base`、`.select-base`、`.form-group`、`.validation-error` | 入力欄・セレクト・ラベル付きの行・エラー表示 |
| レイアウト | `.flex-center`、`.flex-between`、`.flex-start`、`.flex-end`、`.flex-col`、`.flex-wrap`、`.flex-1`、`.gap-{xs〜xl}` | フレックスボックスの配置と間隔 |
| テーブル | `.table-base` | 一覧表（行の `selected`/`readonly`/`edited` 状態つき） |
| モーダル | `.modal-overlay-base`、`.modal-content-base`、`.modal-header-base`、`.modal-footer-base` | モーダルの骨格 |
| ユーティリティ | `.loading-overlay`、`.text-*`、`.font-*`、`.mb-*`、`.cursor-*`、`.overflow-*`、`.no-drag`/`.drag` | 単一目的の小さな指定 |
| 透過度スライダー | `.opacity-control`、`.opacity-slider`、`.opacity-value` | 設定画面のワークスペース透過度 |

### 閉じる・削除ボタンクラス

`.close-btn`（`common.css`）はモーダルを閉じるボタンの共通クラスである。背景・枠なしで、ホバー時に背景色と文字色が変わる。

画面ごとの×ボタン（`.search-clear-button`、`.modal-close-btn`、`.progress-close-btn`、`.workspace-item-delete-btn`、`.remove-group-item-btn` など）は各コンポーネントの CSS で定義している。これらは次の規約でそろえる。

- 丸いボタンにする（`border-radius: 50%`）
- ×は太字にする（`font-weight: bold`）
- ホバー時は背景色を変えて拡大し（`scale(1.1)`）、クリック時は縮小する（`scale(0.95)`）
- 削除系は赤、それ以外（閉じる・クリア）はグレーにする
- カードの上に重ねる削除ボタンは、白背景・枠線・影で背景から浮かせる（例 `.workspace-item-delete-btn`）

## 命名規則

- **変数名**: `--category-property-variant` 形式（例 `--color-primary-hover`、`--spacing-lg`、`--border-radius-xl`）
- **クラス名**: ハイフン区切りのケバブケース（例 `.btn-primary`、`.modal-overlay`、`.form-group`）
- **サイズのサフィックス**: `-sm` / `-lg` に統一する。`-small` / `-large` は使わない
  - 正: `.btn-sm`、`.btn-danger-sm`、`.btn-secondary-sm`
  - 誤: `.btn-danger-small`、`.btn-primary-large`
- **ボタン**: 基本形は `.btn-{variant}`。コンポーネント固有のサイズ違いは `.btn-{variant}-sm` / `.btn-{variant}-lg`
- **アクションボタン**: 32x32 の正方形アイコンボタンは `.action-btn` に一本化する。`.action-button` のような紛らわしい別名は作らない
- **コンポーネント要素**: `.{component}-{element}`（例 `.modal-overlay`、`.item-icon`）
- **状態クラス**: `.{component}.{state}`（例 `.item.selected`、`.tab-button.active`）

## 値の使用優先順位

1. **CSS変数を最優先**: 色・サイズ・余白などは `variables.css` の変数を使う
2. **共通クラスを活用**: 書く前に `common.css` に既存のクラスがないか確認する
3. **値の直書きは禁止**: 新しく書くスタイルでは、色やサイズを直接書かない。必要な値は変数として追加する。既存の CSS には px などの直書きが数百か所残っているが、まとめては直さず、触る箇所から変数に置き換える

## レスポンシブ対応

メディアクエリの条件部分では CSS 変数が使えないため、ブレークポイントは px を直接書く。ブロック内のプロパティ値には通常どおり変数を使う。

```css
@media (max-width: 600px) {
  .responsive-element {
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm);
  }
}
```
