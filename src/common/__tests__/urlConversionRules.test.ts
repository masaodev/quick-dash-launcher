import { describe, it, expect } from 'vitest';
import {
  findMatchingRule,
  applyConversionPrefix,
  conversionRules,
} from '../urlConversionRules';

describe('urlConversionRules', () => {
  describe('findMatchingRule', () => {
    it('SharePoint Excelファイルにマッチする', () => {
      const url = 'https://company.sharepoint.com/sites/team/Documents/file.xlsx';
      const rule = findMatchingRule(url);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('SharePoint/OneDrive Excel');
    });

    it('SharePoint Wordファイルにマッチする', () => {
      const url = 'https://company.sharepoint.com/sites/team/Documents/file.docx';
      const rule = findMatchingRule(url);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('SharePoint/OneDrive Word');
    });

    it('SharePoint PowerPointファイルにマッチする', () => {
      const url = 'https://company.sharepoint.com/sites/team/Documents/file.pptx';
      const rule = findMatchingRule(url);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('SharePoint/OneDrive PowerPoint');
    });

    it('OneDrive Excelファイルにマッチする', () => {
      const url = 'https://docs.live.net/12345/Documents/file.xlsx';
      const rule = findMatchingRule(url);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('SharePoint/OneDrive Excel');
    });

    it('既にプレフィックスが付いたURLでもマッチする', () => {
      const url = 'ms-excel:ofe|ofc|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx';
      const rule = findMatchingRule(url);
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('SharePoint/OneDrive Excel');
    });

    it('非対応のURLではundefinedを返す', () => {
      const url = 'https://example.com/file.txt';
      const rule = findMatchingRule(url);
      expect(rule).toBeUndefined();
    });
  });

  describe('applyConversionPrefix', () => {
    const testUrl = 'https://company.sharepoint.com/sites/team/Documents/file.xlsx';

    it('通常のURLにプレフィックスを追加できる', () => {
      const result = applyConversionPrefix(testUrl, 'ms-excel:ofe|u|');
      expect(result).toBe('ms-excel:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');
    });

    it('既にプレフィックスが付いたURLを変換すると、古いプレフィックスが削除される', () => {
      const urlWithPrefix = 'ms-excel:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx';
      const result = applyConversionPrefix(urlWithPrefix, 'ms-excel:ofv|u|');
      expect(result).toBe('ms-excel:ofv|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');
    });

    it('複数パイプのプレフィックスも正しく削除される', () => {
      const urlWithMultiplePrefix = 'ms-excel:ofe|ofc|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx';
      const result = applyConversionPrefix(urlWithMultiplePrefix, 'ms-excel:ofv|u|');
      expect(result).toBe('ms-excel:ofv|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');
    });

    it('二回連続で変換しても重複しない', () => {
      // 1回目の変換
      const firstConversion = applyConversionPrefix(testUrl, 'ms-excel:ofe|ofc|u|');
      expect(firstConversion).toBe('ms-excel:ofe|ofc|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');

      // 2回目の変換（同じプレフィックス）
      const secondConversion = applyConversionPrefix(firstConversion, 'ms-excel:ofe|ofc|u|');
      expect(secondConversion).toBe('ms-excel:ofe|ofc|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');
      // 重複していないことを確認
      expect(secondConversion).not.toContain('ofc|u|ofc|u|');
    });

    it('二回連続で異なるプレフィックスに変換しても重複しない', () => {
      // 1回目の変換
      const firstConversion = applyConversionPrefix(testUrl, 'ms-excel:ofe|ofc|u|');
      expect(firstConversion).toBe('ms-excel:ofe|ofc|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');

      // 2回目の変換（異なるプレフィックス）
      const secondConversion = applyConversionPrefix(firstConversion, 'ms-excel:ofv|u|');
      expect(secondConversion).toBe('ms-excel:ofv|u|https://company.sharepoint.com/sites/team/Documents/file.xlsx');
      // 古いプレフィックスが残っていないことを確認
      expect(secondConversion).not.toContain('ofc');
    });

    it('Wordプレフィックスも正しく処理される', () => {
      const wordUrl = 'https://company.sharepoint.com/sites/team/Documents/file.docx';
      const result = applyConversionPrefix(wordUrl, 'ms-word:ofe|u|');
      expect(result).toBe('ms-word:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.docx');
    });

    it('PowerPointプレフィックスも正しく処理される', () => {
      const pptUrl = 'https://company.sharepoint.com/sites/team/Documents/file.pptx';
      const result = applyConversionPrefix(pptUrl, 'ms-powerpoint:ofe|u|');
      expect(result).toBe('ms-powerpoint:ofe|u|https://company.sharepoint.com/sites/team/Documents/file.pptx');
    });

    it('http（sなし）のURLも正しく処理される', () => {
      const httpUrl = 'http://company.sharepoint.com/sites/team/Documents/file.xlsx';
      const result = applyConversionPrefix(httpUrl, 'ms-excel:ofe|u|');
      expect(result).toBe('ms-excel:ofe|u|http://company.sharepoint.com/sites/team/Documents/file.xlsx');
    });
  });

  describe('conversionRules', () => {
    it('3つのルールが定義されている', () => {
      expect(conversionRules).toHaveLength(3);
    });

    it('Excelルールには3つのオプションがある', () => {
      const excelRule = conversionRules[0];
      expect(excelRule.name).toBe('SharePoint/OneDrive Excel');
      expect(excelRule.options).toHaveLength(3);
    });

    it('WordとPowerPointルールには2つのオプションがある', () => {
      const wordRule = conversionRules[1];
      const pptRule = conversionRules[2];
      expect(wordRule.options).toHaveLength(2);
      expect(pptRule.options).toHaveLength(2);
    });
  });
});
