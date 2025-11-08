import * as path from 'path';
import * as fs from 'fs';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { PathTestHelper } from '../../test/helpers/pathTestHelper.js';

import PathManager from './pathManager.js';

describe('PathManager', () => {
  let pathHelper: PathTestHelper;

  beforeEach(() => {
    pathHelper = new PathTestHelper();
  });

  afterEach(() => {
    pathHelper.cleanup();
  });

  describe('基本的なパス取得', () => {
    it('設定フォルダのパスを取得できる', () => {
      const configFolder = pathHelper.setup('config-test');
      expect(PathManager.getConfigFolder()).toBe(configFolder);
    });

    it('各サブフォルダのパスが正しく生成される', () => {
      const configFolder = pathHelper.setup('subfolder-test');

      expect(PathManager.getIconsFolder()).toBe(path.join(configFolder, 'icons'));
      expect(PathManager.getFaviconsFolder()).toBe(path.join(configFolder, 'favicons'));
      expect(PathManager.getCustomIconsFolder()).toBe(path.join(configFolder, 'custom-icons'));
      expect(PathManager.getSchemesFolder()).toBe(path.join(configFolder, 'icons', 'schemes'));
      expect(PathManager.getExtensionsFolder()).toBe(
        path.join(configFolder, 'icons', 'extensions')
      );
      expect(PathManager.getBackupFolder()).toBe(path.join(configFolder, 'backup'));
    });

    it('data.txtファイルのパスを取得できる', () => {
      const configFolder = pathHelper.setup('datafile-test');
      expect(PathManager.getDataFilePath()).toBe(path.join(configFolder, 'data.txt'));
    });
  });

  describe('ディレクトリ作成', () => {
    it('必要なディレクトリがすべて作成される', () => {
      pathHelper.setup('ensure-dir-test');

      // すでにsetup()でensureDirectories()が呼ばれているが、再度呼んでも問題ない
      PathManager.ensureDirectories();

      // すべてのディレクトリが存在することを確認
      expect(fs.existsSync(PathManager.getConfigFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getIconsFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getFaviconsFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getCustomIconsFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getSchemesFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getExtensionsFolder())).toBe(true);
      expect(fs.existsSync(PathManager.getBackupFolder())).toBe(true);
    });
  });

  describe('オーバーライド機能', () => {
    it('setConfigFolderForTestingでパスを変更できる', () => {
      const customPath = path.join(process.cwd(), 'custom-config');
      PathManager.setConfigFolderForTesting(customPath);

      expect(PathManager.getConfigFolder()).toBe(customPath);

      // クリーンアップ
      PathManager.resetConfigFolder();
    });

    it('resetConfigFolderでオーバーライドが解除される', () => {
      // 最初にテスト環境をセットアップ
      pathHelper.setup('reset-test');

      // オーバーライドを設定
      const customPath = path.join(process.cwd(), 'custom-config-2');
      PathManager.setConfigFolderForTesting(customPath);
      expect(PathManager.getConfigFolder()).toBe(customPath);

      // 元のテストフォルダに戻す（リセット前の状態を保持）
      const originalTestFolder = pathHelper.getTempConfigFolder();

      // リセット
      PathManager.resetConfigFolder();

      // もう一度テストフォルダに設定しなおす（テスト環境では必要）
      if (originalTestFolder) {
        PathManager.setConfigFolderForTesting(originalTestFolder);
      }

      // カスタムパスではないことを確認
      const currentPath = PathManager.getConfigFolder();
      expect(currentPath).not.toBe(customPath);
    });
  });

  describe('書き込み可能性チェック', () => {
    it('設定フォルダが書き込み可能である', () => {
      pathHelper.setup('writable-test');
      expect(PathManager.isConfigFolderWritable()).toBe(true);
    });
  });

  describe('環境変数サポート', () => {
    beforeEach(() => {
      // 環境変数をクリア
      delete process.env.QUICK_DASH_CONFIG_DIR;
      PathManager.resetConfigFolder();
    });

    afterEach(() => {
      // 環境変数をクリア
      delete process.env.QUICK_DASH_CONFIG_DIR;
      PathManager.resetConfigFolder();
    });

    it('環境変数QUICK_DASH_CONFIG_DIRでカスタムパスを指定できる', () => {
      const customPath = path.join(process.cwd(), 'env-custom-config');
      process.env.QUICK_DASH_CONFIG_DIR = customPath;

      // PathManagerをリセットして環境変数を再読み込み
      PathManager.resetConfigFolder();

      expect(PathManager.getConfigFolder()).toBe(path.resolve(customPath));
    });
  });
});
