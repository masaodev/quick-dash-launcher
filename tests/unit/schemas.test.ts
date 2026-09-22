/**
 * 同梱 JSON Schema（assets/schemas/）の検証
 *
 * 1. ドリフト検知: 型定義から生成し直した結果とコミット済みファイルが一致すること
 *    （型を変えたのに `npm run schema:generate` を忘れると落ちる）
 * 2. 既存 JSON の検証: リポジトリ内のデータファイル・設定ファイルがスキーマに通り、
 *    データファイルについては寛容パース（parseJsonDataFileLenient）の判定と一致すること
 *
 * アプリ実行時にはスキーマ検証をしない（検証器を 2 つ持たない）。スキーマは
 * 人と AI がエディタで補完・検証するためのもので、ここでは「寛容パースと食い違わない」ことを保証する。
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';
import { Ajv } from 'ajv';
import { parseJsonDataFileLenient } from '@common/utils/jsonParser';

import { SCHEMA_OUTPUT_DIR, SCHEMA_TARGETS, generateSchemas } from '../../scripts/generate-schemas';

const ROOT_DIR = process.cwd();

/** 存在するものだけ返す（dev-config は本人の実データで gitignore されている） */
function listJsonFiles(dir: string, filter: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json') && filter(name))
    .map((name) => path.join(dir, name));
}

/** 直下のサブフォルダ一覧 */
function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(dir, d.name));
}

/** 検証対象の設定フォルダ（テンプレート・開発用データ・本人の実データ） */
const CONFIG_DIRS = [
  ...listDirs(path.join(ROOT_DIR, 'tests', 'e2e', 'templates')),
  ...listDirs(path.join(ROOT_DIR, 'tests', 'dev')),
  path.join(ROOT_DIR, 'dev-config'),
];

const isDataFile = (name: string) => name.startsWith('data');
const dataFiles = CONFIG_DIRS.flatMap((dir) =>
  listJsonFiles(path.join(dir, 'datafiles'), isDataFile)
);
const settingsFiles = CONFIG_DIRS.flatMap((dir) =>
  listJsonFiles(dir, (name) => name === 'settings.json')
);

function readCommittedSchema(file: string): object {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_OUTPUT_DIR, file), 'utf8'));
}

function createValidator(file: string) {
  const ajv = new Ajv({ allErrors: true, strict: true });
  return ajv.compile(readCommittedSchema(file));
}

describe('同梱 JSON Schema: ドリフト検知', () => {
  const generated = generateSchemas();

  for (const target of SCHEMA_TARGETS) {
    it(`assets/schemas/${target.file} が型定義から生成した結果と一致すること`, () => {
      const committedPath = path.join(SCHEMA_OUTPUT_DIR, target.file);
      expect(fs.existsSync(committedPath), `${committedPath} がありません`).toBe(true);

      const committed = fs.readFileSync(committedPath, 'utf8');
      expect(
        committed,
        `${target.file} が型定義と食い違っています。npm run schema:generate を実行してコミットしてください`
      ).toBe(generated.get(target.file));
    });
  }

  it('$id はアプリの版を含まない安定した URL であること', () => {
    for (const target of SCHEMA_TARGETS) {
      const schema = readCommittedSchema(target.file) as { $id: string };
      expect(schema.$id).toBe(
        `https://raw.githubusercontent.com/masaodev/quick-dash-launcher/main/assets/schemas/${target.file}`
      );
    }
  });
});

describe('同梱 JSON Schema: データファイル（data.schema.json）', () => {
  const validate = createValidator('data.schema.json');

  it('検証対象のデータファイルが 1 つ以上あること', () => {
    expect(dataFiles.length).toBeGreaterThan(0);
  });

  for (const file of dataFiles) {
    it(`${path.relative(ROOT_DIR, file)} がスキーマに通り、寛容パースの判定と一致すること`, () => {
      const content = fs.readFileSync(file, 'utf8');
      const valid = validate(JSON.parse(content));

      const lenient = parseJsonDataFileLenient(content);
      // $schema や version の補完（normalized）はスキーマ上は任意なので不一致にならない
      const rejectedByParser = lenient.issues.some((issue) => issue.kind !== 'normalized');

      expect(valid, JSON.stringify(validate.errors, null, 2)).toBe(!rejectedByParser);
      expect(valid).toBe(true);
    });
  }

  it('アイテムは type で判別され、未知のフィールドと不正な id を拒否すること', () => {
    const base = { $schema: '../schemas/data.schema.json', version: '1.0' };
    const ok = { id: 'abcdefgh', type: 'item', displayName: 'A', path: 'C:\\a.exe' };

    expect(validate({ ...base, items: [ok] })).toBe(true);
    expect(validate({ ...base, items: [{ ...ok, unknownField: 1 }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...ok, id: 'short' }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...ok, type: 'unknown' }] })).toBe(false);
    expect(validate({ ...base, items: [{ id: 'abcdefgh', type: 'dir', path: 'C:\\' }] })).toBe(
      true
    );
    expect(validate({ ...base, items: [{ id: 'abcdefgh', type: 'dir' }] })).toBe(false);
  });

  it('スキーマが拒否するアイテムは寛容パースもスキップ（invalid）すること', () => {
    const cases: Record<string, unknown>[] = [
      { id: 'abcdefgh', type: 'item', displayName: 'no path' },
      { id: 'abcdefgh', type: 'group', displayName: 'g', itemNames: 'not-array' },
      { id: 'abcdefgh', type: 'window', displayName: 'w' },
      { id: 'abcdefgh', type: 'dir', path: 'C:\\', options: { types: 'invalid' } },
    ];
    for (const item of cases) {
      const file = { $schema: '../schemas/data.schema.json', version: '1.0', items: [item] };
      expect(validate(file), JSON.stringify(item)).toBe(false);
      const lenient = parseJsonDataFileLenient(JSON.stringify(file));
      expect(
        lenient.issues.map((i) => i.kind),
        JSON.stringify(item)
      ).toEqual(['invalid']);
    }
  });
});

describe('同梱 JSON Schema: 設定ファイル（settings.schema.json）', () => {
  const validate = createValidator('settings.schema.json');

  it('検証対象の設定ファイルが 1 つ以上あること', () => {
    expect(settingsFiles.length).toBeGreaterThan(0);
  });

  for (const file of settingsFiles) {
    it(`${path.relative(ROOT_DIR, file)} がスキーマに通ること`, () => {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(validate(content), JSON.stringify(validate.errors, null, 2)).toBe(true);
    });
  }

  it('キーの欠落と未知のキーは許容し、型違いは拒否すること', () => {
    expect(validate({ hotkey: 'Alt+Space' })).toBe(true);
    expect(validate({ hotkey: 'Alt+Space', futureKey: true })).toBe(true);
    expect(validate({ hotkey: 123 })).toBe(false);
    expect(validate({ windowPositionMode: 'nowhere' })).toBe(false);
  });
});
