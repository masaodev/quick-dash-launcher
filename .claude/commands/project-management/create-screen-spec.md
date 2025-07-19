# /create-screen-spec

指定されたコンポーネントの画面仕様書を作成するスラッシュコマンドです。

## 使用方法

```
/create-screen-spec [画面名]
```

### 使用例
```
/create-screen-spec 編集モード画面
/create-screen-spec 登録モーダル
/create-screen-spec 管理その他タブ
```

## 実行内容

1. **対象コンポーネントファイルの特定と読み込み**
   - 画面名から対応するコンポーネントファイルを特定
   - `src/renderer/components/[コンポーネント名].tsx`を解析
   
2. **テンプレートとサンプルを参考に新しい仕様書を作成**
   - `docs/templates/screen-specification-template.md`をテンプレートとして使用
   - `docs/screens/bookmark-import-modal.md`をサンプルとして参照
   - 同じ4章構成（概要・基本情報・画面項目一覧・機能詳細）で作成
   - 画面項目一覧は5列構成（エリア・項目名・内容・説明・表示条件・機能詳細）を使用

3. **仕様書ファイルの出力**
   - `docs/screens/[kebab-case-名前].md`として保存

4. **画面一覧の更新**
   - `docs/reference/screen-list.md`の該当箇所に仕様書へのリンクを追加

## 参考ファイル

- **テンプレート**: `docs/templates/screen-specification-template.md` - 基本構造とプレースホルダー
- **サンプル**: `docs/screens/bookmark-import-modal.md` - 完成例として参照

作成される仕様書はテンプレートを基にして、ブックマークインポートモーダル仕様書と同じ形式になります。