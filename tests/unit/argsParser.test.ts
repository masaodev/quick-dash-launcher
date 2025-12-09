import { describe, it, expect } from 'vitest';

import { parseArgs } from '../../src/common/utils/argsParser';

describe('parseArgs', () => {
  describe('基本的な引数のパース', () => {
    it('スペース区切りの引数を正しくパースできる', () => {
      const result = parseArgs('--flag value1 value2');
      expect(result).toEqual(['--flag', 'value1', 'value2']);
    });

    it('単一の引数を正しくパースできる', () => {
      const result = parseArgs('--flag');
      expect(result).toEqual(['--flag']);
    });

    it('空文字列は空配列を返す', () => {
      const result = parseArgs('');
      expect(result).toEqual([]);
    });

    it('前後の空白をトリムする', () => {
      const result = parseArgs('  --flag value  ');
      expect(result).toEqual(['--flag', 'value']);
    });

    it('連続するスペースを正しく処理する', () => {
      const result = parseArgs('--flag    value');
      expect(result).toEqual(['--flag', 'value']);
    });
  });

  describe('ダブルクォートで囲まれた引数', () => {
    it('ダブルクォートで囲まれた引数を正しくパースできる', () => {
      const result = parseArgs('-p "Git Bash"');
      expect(result).toEqual(['-p', 'Git Bash']);
    });

    it('複数のダブルクォート引数を正しくパースできる', () => {
      const result = parseArgs('-p "Git Bash" -d "C:\\test"');
      expect(result).toEqual(['-p', 'Git Bash', '-d', 'C:\\test']);
    });

    it('ダブルクォート内のスペースを保持する', () => {
      const result = parseArgs('--title "My Window Title"');
      expect(result).toEqual(['--title', 'My Window Title']);
    });

    it('空のダブルクォートを正しく処理する', () => {
      const result = parseArgs('--title ""');
      expect(result).toEqual(['--title', '']);
    });

    it('ダブルクォートなしとダブルクォートありの混在', () => {
      const result = parseArgs('--flag "quoted value" plain');
      expect(result).toEqual(['--flag', 'quoted value', 'plain']);
    });
  });

  describe('Windows Terminal の実際の引数パターン', () => {
    it('Windows Terminal の標準的な引数をパースできる', () => {
      const result = parseArgs('-p "Git Bash" -d "C:\\Users\\test" --title "test"');
      expect(result).toEqual(['-p', 'Git Bash', '-d', 'C:\\Users\\test', '--title', 'test']);
    });

    it('Windows Terminal のプロファイル指定をパースできる', () => {
      const result = parseArgs('-p "PowerShell"');
      expect(result).toEqual(['-p', 'PowerShell']);
    });

    it('Windows Terminal のディレクトリ指定をパースできる', () => {
      const result = parseArgs('-d "C:\\Users\\test\\My Documents"');
      expect(result).toEqual(['-d', 'C:\\Users\\test\\My Documents']);
    });

    it('実際に失敗していたケースをパースできる', () => {
      const result = parseArgs(
        '-p "Git Bash" -d "C:\\Users\\daido\\git\\masao\\github\\obsidian-pri"'
      );
      expect(result).toEqual([
        '-p',
        'Git Bash',
        '-d',
        'C:\\Users\\daido\\git\\masao\\github\\obsidian-pri',
      ]);
    });
  });

  describe('パスを含む引数', () => {
    it('Windowsパスを正しくパースできる', () => {
      const result = parseArgs('"C:\\Program Files\\test.exe"');
      expect(result).toEqual(['C:\\Program Files\\test.exe']);
    });

    it('UNCパスを正しくパースできる', () => {
      const result = parseArgs('"\\\\server\\share\\file.txt"');
      expect(result).toEqual(['\\\\server\\share\\file.txt']);
    });

    it('相対パスを正しくパースできる', () => {
      const result = parseArgs('"..\\test\\file.txt"');
      expect(result).toEqual(['..\\test\\file.txt']);
    });
  });

  describe('特殊文字を含む引数', () => {
    it('カンマを含む引数を正しくパースできる', () => {
      const result = parseArgs('--list "item1,item2,item3"');
      expect(result).toEqual(['--list', 'item1,item2,item3']);
    });

    it('セミコロンを含む引数を正しくパースできる', () => {
      const result = parseArgs('--cmd "echo test;ls"');
      expect(result).toEqual(['--cmd', 'echo test;ls']);
    });

    it('イコールを含む引数を正しくパースできる', () => {
      const result = parseArgs('--env "KEY=VALUE"');
      expect(result).toEqual(['--env', 'KEY=VALUE']);
    });

    it('ハイフンを含む引数を正しくパースできる', () => {
      const result = parseArgs('--name "my-app-name"');
      expect(result).toEqual(['--name', 'my-app-name']);
    });
  });

  describe('日本語を含む引数', () => {
    it('日本語のディレクトリ名をパースできる', () => {
      const result = parseArgs('-d "C:\\ユーザー\\テスト"');
      expect(result).toEqual(['-d', 'C:\\ユーザー\\テスト']);
    });

    it('日本語のファイル名をパースできる', () => {
      const result = parseArgs('"C:\\マイドキュメント\\テスト.txt"');
      expect(result).toEqual(['C:\\マイドキュメント\\テスト.txt']);
    });

    it('日本語のタイトルをパースできる', () => {
      const result = parseArgs('--title "私のウィンドウ"');
      expect(result).toEqual(['--title', '私のウィンドウ']);
    });
  });

  describe('エッジケース', () => {
    it('閉じられていないダブルクォートは最後まで続く', () => {
      const result = parseArgs('--flag "unclosed quote');
      expect(result).toEqual(['--flag', 'unclosed quote']);
    });

    it('連続するダブルクォートを正しく処理する', () => {
      const result = parseArgs('"" ""');
      expect(result).toEqual(['', '']);
    });

    it('ダブルクォートのみは空配列を返す', () => {
      const result = parseArgs('""');
      expect(result).toEqual(['']);
    });

    it('スペースのみは空配列を返す', () => {
      const result = parseArgs('   ');
      expect(result).toEqual([]);
    });

    it('非常に長い引数を正しくパースできる', () => {
      const longPath = 'C:\\' + 'a'.repeat(200);
      const result = parseArgs(`-d "${longPath}"`);
      expect(result).toEqual(['-d', longPath]);
    });
  });

  describe('実際のユースケース', () => {
    it('Visual Studio Code の引数をパースできる', () => {
      const result = parseArgs('--goto "file.ts:10:5"');
      expect(result).toEqual(['--goto', 'file.ts:10:5']);
    });

    it('Git の引数をパースできる', () => {
      const result = parseArgs('commit -m "Initial commit"');
      expect(result).toEqual(['commit', '-m', 'Initial commit']);
    });

    it('Node.js の引数をパースできる', () => {
      const result = parseArgs('--inspect-brk "script.js"');
      expect(result).toEqual(['--inspect-brk', 'script.js']);
    });

    it('複雑な引数の組み合わせをパースできる', () => {
      const result = parseArgs(
        '--port 3000 --host "localhost" --ssl-cert "C:\\certs\\cert.pem" --ssl-key "C:\\certs\\key.pem"'
      );
      expect(result).toEqual([
        '--port',
        '3000',
        '--host',
        'localhost',
        '--ssl-cert',
        'C:\\certs\\cert.pem',
        '--ssl-key',
        'C:\\certs\\key.pem',
      ]);
    });
  });
});
