import { describe, it, expect } from 'vitest';

import { parseCSVLine } from '../../src/common/utils/csvParser';

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
});
