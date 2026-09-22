import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ajv } from 'ajv';
import { parseJsonDataFileLenient } from '@common/utils/jsonParser';

const tempRoot = vi.hoisted(() => ({ dir: '' }));
const ASSETS_DIR = path.join(process.cwd(), 'assets');

vi.mock('../config/pathManager.js', () => {
  const pm = {
    getConfigFolder: () => tempRoot.dir,
    getSchemasFolder: () => path.join(tempRoot.dir, 'schemas'),
    getConfigReadmePath: () => path.join(tempRoot.dir, 'README.md'),
    getAssetsFolder: () => path.join(process.cwd(), 'assets'),
  };
  return { PathManager: pm, default: pm };
});

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  dataLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  CONFIG_README_TEMPLATE_NAME,
  SCHEMA_FILE_NAMES,
  installConfigFolderDocs,
  renderConfigReadme,
  syncBundledSchemas,
  writeConfigReadme,
} from './configFolderDocsService';

describe('configFolderDocsService', () => {
  beforeEach(() => {
    tempRoot.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qdl-config-docs-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot.dir, { recursive: true, force: true });
  });

  describe('syncBundledSchemas', () => {
    it('同梱スキーマを config/schemas/ にコピーし、2 回目は何も書かないこと', () => {
      const schemasFolder = path.join(tempRoot.dir, 'schemas');

      const first = syncBundledSchemas(ASSETS_DIR, schemasFolder);
      expect(first.sort()).toEqual([...SCHEMA_FILE_NAMES].sort());
      for (const name of SCHEMA_FILE_NAMES) {
        expect(fs.readFileSync(path.join(schemasFolder, name), 'utf8')).toBe(
          fs.readFileSync(path.join(ASSETS_DIR, 'schemas', name), 'utf8')
        );
      }

      expect(syncBundledSchemas(ASSETS_DIR, schemasFolder)).toEqual([]);
    });

    it('内容が違えば（古い版が残っていれば）上書きすること', () => {
      const schemasFolder = path.join(tempRoot.dir, 'schemas');
      fs.mkdirSync(schemasFolder, { recursive: true });
      fs.writeFileSync(path.join(schemasFolder, 'data.schema.json'), '{"old":true}', 'utf8');

      const written = syncBundledSchemas(ASSETS_DIR, schemasFolder);
      expect(written).toContain('data.schema.json');
      expect(fs.readFileSync(path.join(schemasFolder, 'data.schema.json'), 'utf8')).not.toContain(
        '"old"'
      );
    });

    it('同梱スキーマが無い場合はスキップして落ちないこと', () => {
      const written = syncBundledSchemas(
        path.join(tempRoot.dir, 'no-assets'),
        path.join(tempRoot.dir, 'schemas')
      );
      expect(written).toEqual([]);
    });
  });

  describe('renderConfigReadme', () => {
    it('プレースホルダをすべて埋めること', () => {
      const rendered = renderConfigReadme(
        'v{{APP_VERSION}} at {{CONFIG_DIR}} ({{CONFIG_DIR}}, {{APP_VERSION}})',
        { configDir: 'C:\\cfg', appVersion: '1.2.3' }
      );
      expect(rendered).toBe('v1.2.3 at C:\\cfg (C:\\cfg, 1.2.3)');
    });
  });

  describe('assets/config-readme.md（雛形）', () => {
    const templatePath = path.join(ASSETS_DIR, CONFIG_README_TEMPLATE_NAME);
    const template = fs.readFileSync(templatePath, 'utf8');
    const rendered = renderConfigReadme(template, {
      configDir: 'C:\\Users\\me\\AppData\\Roaming\\quick-dash-launcher\\config',
      appVersion: '9.9.9',
    });

    it('150 行以内であること（要約ではなく作業指示に留める）', () => {
      expect(template.split('\n').length).toBeLessThanOrEqual(150);
    });

    it('生成の断り書きに版と設定フォルダが入り、プレースホルダが残らないこと', () => {
      expect(rendered).toContain('v9.9.9');
      expect(rendered).toContain('C:\\Users\\me\\AppData\\Roaming\\quick-dash-launcher\\config');
      expect(rendered).not.toMatch(/\{\{[A-Z_]+\}\}/);
    });

    it('AI への作業指示として必要な節が揃っていること', () => {
      for (const heading of [
        '## まず守ること',
        '## ファイル',
        '## アイテムの書き方',
        '## 反映',
        '## 結果の確認',
        '## 壊したとき',
      ]) {
        expect(rendered).toContain(heading);
      }
      expect(rendered).toContain('last-load-report.json');
      expect(rendered).toContain('_pre-external');
      expect(rendered).toContain('F5');
    });

    it('JSON の例が同梱スキーマに通り、寛容パースでも問題なしになること', () => {
      const match = rendered.match(/```json\n([\s\S]*?)\n```/);
      expect(match, 'README に ```json ブロックがありません').not.toBeNull();
      const example = match![1];

      const schema = JSON.parse(
        fs.readFileSync(path.join(ASSETS_DIR, 'schemas', 'data.schema.json'), 'utf8')
      );
      const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
      expect(validate(JSON.parse(example)), JSON.stringify(validate.errors, null, 2)).toBe(true);

      const lenient = parseJsonDataFileLenient(example);
      expect(lenient.issues).toEqual([]);
      expect(lenient.modified).toBe(false);
      expect(lenient.validItems.map((i) => i.type)).toEqual([
        'item',
        'item',
        'dir',
        'group',
        'window',
      ]);
    });
  });

  describe('writeConfigReadme / installConfigFolderDocs', () => {
    it('README.md を生成し、内容が同じなら 2 回目は書かないこと', () => {
      const readmePath = path.join(tempRoot.dir, 'README.md');
      const vars = { configDir: tempRoot.dir, appVersion: '0.0.1' };

      expect(writeConfigReadme(ASSETS_DIR, readmePath, vars)).toBe(true);
      expect(fs.readFileSync(readmePath, 'utf8')).toContain('v0.0.1');
      expect(writeConfigReadme(ASSETS_DIR, readmePath, vars)).toBe(false);

      // 版が変わればアプリの版に合わせて書き直す
      expect(writeConfigReadme(ASSETS_DIR, readmePath, { ...vars, appVersion: '0.0.2' })).toBe(
        true
      );
      expect(fs.readFileSync(readmePath, 'utf8')).toContain('v0.0.2');
    });

    it('installConfigFolderDocs は schemas/ と README.md をまとめて配置すること', () => {
      installConfigFolderDocs('1.0.0');

      for (const name of SCHEMA_FILE_NAMES) {
        expect(fs.existsSync(path.join(tempRoot.dir, 'schemas', name))).toBe(true);
      }
      const readme = fs.readFileSync(path.join(tempRoot.dir, 'README.md'), 'utf8');
      expect(readme).toContain('v1.0.0');
      expect(readme).toContain(tempRoot.dir);
    });
  });
});
