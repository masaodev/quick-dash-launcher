# フォルダ取込アイテム仕様

フォルダ取込アイテムは、指定したディレクトリ内のファイルやフォルダを動的にインポートする機能です。

## 基本構文

```
dir,<ディレクトリパス>[,オプション1=値1][,オプション2=値2]...
```

## デフォルト動作

オプションを指定しない場合、以下のデフォルト動作となります：
- **depth**: 0（指定ディレクトリ直下のみ）
- **types**: both（ファイルとフォルダの両方）
- **filter**: なし（全てのアイテムを対象）
- **exclude**: なし（除外なし）
- **prefix**: なし（プレフィックスなし）
- **suffix**: なし（サフィックスなし）

## オプション

### depth
サブディレクトリをスキャンする深さを指定します。
- `0`: 指定ディレクトリ直下のみ（デフォルト）
- `1`: 1階層下のサブディレクトリまで
- `-1`: 無制限（全てのサブディレクトリ）

```
dir,C:\Users\Documents,depth=1
```

### types
インポートするアイテムのタイプを指定します。
- `file`: ファイルのみ
- `folder`: フォルダのみ
- `both`: ファイルとフォルダの両方（デフォルト）

```
dir,C:\Programs,types=file
```

### filter
インポートするアイテムをフィルタリングするglobパターンを指定します。

```
dir,C:\Scripts,filter=*.ps1
dir,C:\Documents,filter=*.{doc,docx,pdf}
```

### exclude
除外するアイテムのglobパターンを指定します。

```
dir,C:\Projects,exclude=node_modules
dir,C:\Source,exclude=*.tmp
```

### prefix
インポートされるアイテムの表示名に付けるプレフィックスを指定します。

```
dir,C:\DevTools,prefix=Dev
# 結果: "Dev: ToolName"
```

### suffix
インポートされるアイテムの表示名に付けるサフィックスを指定します。

```
dir,C:\Projects,suffix=Dev
# 結果: "ProjectName (Dev)"

dir,C:\Tools,prefix=Work,suffix=Tool
# 結果: "Work: ToolName (Tool)"
```

## 使用例

### 基本的な使用
```
// Documents フォルダ直下の全てのファイルとフォルダをインポート
dir,C:\Users\Username\Documents
```

### 拡張子でフィルタリング
```
// PowerShellスクリプトのみをインポート
dir,C:\Scripts,filter=*.ps1

// 複数の拡張子を指定
dir,C:\Documents,filter=*.{doc,docx,pdf}
```

### サブディレクトリを含める
```
// 2階層下までの全てのファイルをインポート
dir,C:\Projects,depth=2,types=file

// 全てのサブディレクトリを再帰的にスキャン
dir,C:\Source,depth=-1
```

### 除外パターンの使用
```
// node_modulesフォルダを除外
dir,C:\Projects,exclude=node_modules,depth=2

// 一時ファイルを除外
dir,C:\Work,exclude=*.{tmp,temp,bak}
```

### プレフィックスの追加
```
// "Work: " プレフィックスを追加
dir,C:\WorkProjects,prefix=Work

// フィルターと組み合わせ
dir,C:\Tools,filter=*.exe,prefix=Tool
```

### サフィックスの追加
```
// " (Dev)" サフィックスを追加
dir,C:\Projects,suffix=Dev

// プレフィックスとサフィックスの組み合わせ
dir,C:\Tools,prefix=Work,suffix=Tool
# 結果: "Work: ToolName (Tool)"
```

### 複雑な組み合わせ
```
// Projectsフォルダから、node_modulesを除外し、
// .jsと.tsファイルのみを2階層下まで検索し、
// "Src: "プレフィックスと" (Dev)"サフィックスを追加
dir,C:\Projects,depth=2,types=file,filter=*.{js,ts},exclude=node_modules,prefix=Src,suffix=Dev
# 結果: "Src: filename.js (Dev)"
```

## 特殊な処理

### ショートカットファイル（.lnk）
`.lnk`ファイルは自動的に解析され、ターゲットのパスと引数が抽出されます。

### 実行可能ファイル
`.exe`、`.bat`、`.cmd`ファイルは`app`タイプとして認識されます。

## 注意事項

1. **パフォーマンス**: 深い階層や大量のファイルを含むディレクトリをスキャンする場合、処理時間が長くなる可能性があります。
2. **アクセス権限**: アクセス権限のないディレクトリやファイルはスキップされます。
3. **重複**: 複数のフォルダ取込ディレクティブで同じファイルがインポートされた場合、パスベースで重複が除去されます。