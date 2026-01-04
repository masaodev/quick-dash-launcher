import { describe, it, expect } from 'vitest';
import { parseCSVLine, escapeCSV } from '@common/utils/csvParser';

describe('parseCSVLine', () => {
  describe('基本的なCSV解析', () => {
    it('シンプルなカンマ区切りの行を解析できる', () => {
      const result = parseCSVLine('name,path,type');
      expect(result).toEqual(['name', 'path', 'type']);
    });

    it('空のフィールドを正しく処理できる', () => {
      const result = parseCSVLine('name,,type');
      expect(result).toEqual(['name', '', 'type']);
    });

    it('前後の空白をトリムする', () => {
      const result = parseCSVLine(' name , path , type ');
      expect(result).toEqual(['name', 'path', 'type']);
    });
  });

  describe('ダブルクォートで囲まれていないフィールド', () => {
    it('フィールドの途中にあるダブルクォートをそのまま保持する', () => {
      const result = parseCSVLine('Company "X",path,exe');
      expect(result).toEqual(['Company "X"', 'path', 'exe']);
    });

    it('URL内のダブルクォートを保持する', () => {
      const result = parseCSVLine('Name,https://example.com?q="test",url');
      expect(result).toEqual(['Name', 'https://example.com?q="test"', 'url']);
    });
  });

  describe('実際のデータファイル形式', () => {
    it('標準的なランチャーアイテムを解析できる', () => {
      const result = parseCSVLine('Google,https://google.com,url');
      expect(result).toEqual(['Google', 'https://google.com', 'url']);
    });

    it('実行ファイルアイテムを解析できる', () => {
      const result = parseCSVLine('Notepad,C:\\Windows\\notepad.exe,exe');
      expect(result).toEqual(['Notepad', 'C:\\Windows\\notepad.exe', 'exe']);
    });

    it('引数付きアイテムを解析できる', () => {
      const result = parseCSVLine('Open File,C:\\app.exe,exe,--file test.txt');
      expect(result).toEqual(['Open File', 'C:\\app.exe', 'exe', '--file test.txt']);
    });

    it('フォルダアイテムを解析できる', () => {
      const result = parseCSVLine('Documents,C:\\Users\\Documents,folder');
      expect(result).toEqual(['Documents', 'C:\\Users\\Documents', 'folder']);
    });

    it('グループアイテムを解析できる', () => {
      // 現在の実装では、グループアイテムはカンマ区切りのリストとして保存される
      // ダブルクォートは使用していない
      const result = parseCSVLine('My Group,item1 item2 item3,group');
      expect(result).toEqual(['My Group', 'item1 item2 item3', 'group']);
    });

    it('フォルダ取込アイテムを解析できる', () => {
      const result = parseCSVLine('Folder Import,C:\\MyFolder,dir,depth:1|types:file');
      expect(result).toEqual(['Folder Import', 'C:\\MyFolder', 'dir', 'depth:1|types:file']);
    });
  });

  describe('エッジケース', () => {
    it('空文字列を処理できる', () => {
      const result = parseCSVLine('');
      // 空文字列の場合、空配列を返す（元の実装の動作）
      expect(result).toEqual([]);
    });

    it('単一フィールドを処理できる', () => {
      const result = parseCSVLine('single');
      expect(result).toEqual(['single']);
    });

    it('末尾のカンマを処理できる', () => {
      const result = parseCSVLine('name,path,');
      // 末尾のカンマの後に空白のみの場合、最後のフィールドは含まれない
      expect(result).toEqual(['name', 'path']);
    });

    it('連続するカンマを処理できる', () => {
      const result = parseCSVLine('name,,,type');
      expect(result).toEqual(['name', '', '', 'type']);
    });

    it('タブを含むフィールドを処理できる', () => {
      const result = parseCSVLine('name\tvalue,path,type');
      expect(result).toEqual(['name\tvalue', 'path', 'type']);
    });
  });

  describe('日本語を含むデータ', () => {
    it('日本語の名前を正しく処理できる', () => {
      const result = parseCSVLine('グーグル,https://google.com,url');
      expect(result).toEqual(['グーグル', 'https://google.com', 'url']);
    });

    it('日本語を含むパスを正しく処理できる', () => {
      const result = parseCSVLine('マイフォルダ,C:\\ユーザー\\ドキュメント,folder');
      expect(result).toEqual(['マイフォルダ', 'C:\\ユーザー\\ドキュメント', 'folder']);
    });

    it('日本語を含むフィールドを処理できる', () => {
      // カンマを含む日本語名は使用しない（代わりにスペースや_を使用）
      const result = parseCSVLine('私のファイル,C:\\path,exe');
      expect(result).toEqual(['私のファイル', 'C:\\path', 'exe']);
    });
  });

  describe('CSVエスケープされたフィールド（ダブルクォートで囲まれた）', () => {
    it('カンマを含むフィールドを正しく解析できる', () => {
      const result = parseCSVLine('Name,"path,with,comma",type');
      expect(result).toEqual(['Name', 'path,with,comma', 'type']);
    });

    it('エスケープされたダブルクォートを正しく解析できる', () => {
      const result = parseCSVLine('Name,"path ""quoted"" value",type');
      expect(result).toEqual(['Name', 'path "quoted" value', 'type']);
    });

    it('カンマとダブルクォートの両方を含むフィールドを解析できる', () => {
      const result = parseCSVLine('Name,"path, ""value1"", ""value2""",type');
      expect(result).toEqual(['Name', 'path, "value1", "value2"', 'type']);
    });

    it('Windows Terminalの引数（ダブルクォート付き）を解析できる', () => {
      const result = parseCSVLine(
        'Git Bash,wt.exe,-p "Git Bash" -d "C:\\Users\\test" --title "test"'
      );
      expect(result).toEqual([
        'Git Bash',
        'wt.exe',
        '-p "Git Bash" -d "C:\\Users\\test" --title "test"',
      ]);
    });

    it('Windows Terminalの引数（カンマ含む、CSVエスケープ）を解析できる', () => {
      const result = parseCSVLine('Custom App,app.exe,"-p ""value1,value2"" --flag"');
      expect(result).toEqual(['Custom App', 'app.exe', '-p "value1,value2" --flag']);
    });
  });
});

describe('escapeCSV', () => {
  describe('基本的なエスケープ処理', () => {
    it('カンマを含まない値はそのまま返す', () => {
      expect(escapeCSV('hello')).toBe('hello');
      expect(escapeCSV('hello world')).toBe('hello world');
      expect(escapeCSV('C:\\Users\\test')).toBe('C:\\Users\\test');
    });

    it('カンマを含む値はダブルクォートで囲む', () => {
      expect(escapeCSV('a,b')).toBe('"a,b"');
      expect(escapeCSV('value1,value2,value3')).toBe('"value1,value2,value3"');
    });

    it('ダブルクォートのみを含む値もエスケープする', () => {
      expect(escapeCSV('a "test" b')).toBe('"a ""test"" b"');
      expect(escapeCSV('"quoted"')).toBe('"""quoted"""');
    });

    it('カンマとダブルクォートの両方を含む値は正しくエスケープする', () => {
      expect(escapeCSV('a "test", b')).toBe('"a ""test"", b"');
      expect(escapeCSV('path, "value1", "value2"')).toBe('"path, ""value1"", ""value2"""');
    });

    it('空文字列はそのまま返す', () => {
      expect(escapeCSV('')).toBe('');
    });
  });

  describe('実際のユースケース', () => {
    it('Windows Terminalの引数（カンマなし、ダブルクォートあり）はエスケープする', () => {
      const args = '-p "Git Bash" -d "C:\\Users\\test" --title "test"';
      expect(escapeCSV(args)).toBe('"-p ""Git Bash"" -d ""C:\\Users\\test"" --title ""test"""');
    });

    it('Windows Terminalの引数（カンマあり）は正しくエスケープする', () => {
      const args = '-p "value1,value2" --flag';
      expect(escapeCSV(args)).toBe('"-p ""value1,value2"" --flag"');
    });

    it('カスタムアイコンのファイル名（カンマなし）はエスケープしない', () => {
      expect(escapeCSV('icon.png')).toBe('icon.png');
      expect(escapeCSV('my-icon.ico')).toBe('my-icon.ico');
    });

    it('カスタムアイコンのファイル名（カンマあり）は正しくエスケープする', () => {
      expect(escapeCSV('icon,old.png')).toBe('"icon,old.png"');
    });

    it('外側にダブルクォートがある場合も保持される', () => {
      expect(escapeCSV('"test"')).toBe('"""test"""');
      expect(escapeCSV('"-p "Git Bash""')).toBe('"""-p ""Git Bash"""""');
    });

    it('途中にダブルクォートがある場合もエスケープする', () => {
      expect(escapeCSV('a"b')).toBe('"a""b"');
      expect(escapeCSV('test"value"end')).toBe('"test""value""end"');
    });
  });
});

describe('parseCSVLine と escapeCSV の往復テスト', () => {
  it('カンマもダブルクォートも含まない値は往復しても同じ', () => {
    const original = 'Name,wt.exe,--flag value';
    const parts = parseCSVLine(original);
    const reconstructed = parts.map(escapeCSV).join(',');
    expect(reconstructed).toBe(original);
  });

  it('ダブルクォートを含む値は往復でエスケープされる', () => {
    const original = 'Name,wt.exe,-p "Git Bash" -d "C:\\test"';
    const parts = parseCSVLine(original);
    const reconstructed = parts.map(escapeCSV).join(',');
    expect(reconstructed).toBe('Name,wt.exe,"-p ""Git Bash"" -d ""C:\\test"""');
  });

  it('カンマを含む値は往復しても正しく復元される', () => {
    const name = 'Test Name';
    const path = 'app.exe';
    const args = '-p "value1,value2" --flag';

    // エスケープして保存
    const saved = `${escapeCSV(name)},${escapeCSV(path)},${escapeCSV(args)}`;
    expect(saved).toBe('Test Name,app.exe,"-p ""value1,value2"" --flag"');

    // 読み込んで復元
    const loaded = parseCSVLine(saved);
    expect(loaded).toEqual([name, path, args]);
  });

  it('複雑なケースでも往復可能', () => {
    const name = 'App, Name';
    const path = 'C:\\path';
    const args = '-p "Git Bash" -d "C:\\test, folder"';
    const customIcon = 'icon,v2.png';

    // エスケープして保存
    const saved = `${escapeCSV(name)},${escapeCSV(path)},${escapeCSV(args)},${escapeCSV(customIcon)}`;

    // 読み込んで復元
    const loaded = parseCSVLine(saved);
    expect(loaded).toEqual([name, path, args, customIcon]);
  });
});
