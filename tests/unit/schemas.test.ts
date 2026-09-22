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
import {
  createWorkspaceParseContext,
  parseWorkspaceArchiveFileLenient,
  parseWorkspaceFileLenient,
} from '@common/utils/workspaceParser';

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
/** 旧形式（version なし）は移行対象なのでスキーマ検証の対象外 */
const isCurrentWorkspaceFile = (file: string) =>
  typeof JSON.parse(fs.readFileSync(file, 'utf8')).version === 'string';
const workspaceFiles = CONFIG_DIRS.flatMap((dir) =>
  listJsonFiles(dir, (name) => name === 'workspace.json')
).filter(isCurrentWorkspaceFile);
const workspaceArchiveFiles = CONFIG_DIRS.flatMap((dir) =>
  listJsonFiles(dir, (name) => name === 'workspace-archive.json')
).filter(isCurrentWorkspaceFile);

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

describe('同梱 JSON Schema: ワークスペースファイル（workspace.schema.json）', () => {
  const validate = createValidator('workspace.schema.json');
  const validateArchive = createValidator('workspace-archive.schema.json');

  const ws = { id: 'wsAAAAA1', displayName: 'メイン', order: 0, createdAt: 1 };
  const group = {
    id: 'grAAAAA1',
    displayName: '開発',
    color: 'primary',
    order: 0,
    createdAt: 1,
    workspaceId: 'wsAAAAA1',
  };
  const item = {
    id: 'itAAAAA1',
    type: 'item',
    displayName: 'GitHub',
    path: 'https://github.com/',
    workspaceId: 'wsAAAAA1',
    groupId: 'grAAAAA1',
    order: 0,
    addedAt: 1,
  };
  const base = {
    $schema: './schemas/workspace.schema.json',
    version: '2.0',
    workspaces: [ws],
    groups: [group],
  };

  for (const file of workspaceFiles) {
    it(`${path.relative(ROOT_DIR, file)} がスキーマに通り、寛容パースでも問題なしになること`, () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(validate(JSON.parse(content)), JSON.stringify(validate.errors, null, 2)).toBe(true);
      const lenient = parseWorkspaceFileLenient(content, createWorkspaceParseContext());
      expect(lenient.issues).toEqual([]);
    });
  }

  for (const file of workspaceArchiveFiles) {
    it(`${path.relative(ROOT_DIR, file)} がスキーマに通ること`, () => {
      const content = fs.readFileSync(file, 'utf8');
      expect(
        validateArchive(JSON.parse(content)),
        JSON.stringify(validateArchive.errors, null, 2)
      ).toBe(true);
    });
  }

  it('type で判別され、未知のフィールド・不正な色・不正な id を拒否すること', () => {
    expect(validate({ ...base, items: [item] })).toBe(true);
    expect(validate({ ...base, items: [{ ...item, unknownField: 1 }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...item, originalName: 'x' }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...item, id: 'not-8-chars' }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...item, type: 'url' }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...item, type: 'dir' }] })).toBe(false);
    expect(
      validate({ ...base, groups: [{ ...group, color: 'var(--color-primary)' }], items: [] })
    ).toBe(false);
    expect(validate({ ...base, groups: [{ ...group, color: '#00897b' }], items: [] })).toBe(true);
    expect(validate({ ...base, groups: [{ ...group, collapsed: true }], items: [] })).toBe(false);
  });

  it('ウィンドウ操作アイテムはデータファイルと同じフィールド名であること', () => {
    const window = {
      id: 'itAAAAA2',
      type: 'window',
      displayName: 'Chrome',
      windowTitle: '*Chrome',
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      workspaceId: 'wsAAAAA1',
      order: 1,
      addedAt: 1,
    };
    expect(validate({ ...base, items: [window] })).toBe(true);
    expect(validate({ ...base, items: [{ ...window, windowX: 0 }] })).toBe(false);
    expect(validate({ ...base, items: [{ ...window, path: '[ウィンドウ操作: x]' }] })).toBe(false);
  });

  it('スキーマが拒否するアイテムは寛容パースも invalid にすること', () => {
    const cases: Record<string, unknown>[] = [
      { ...item, path: undefined },
      { ...item, type: 'group', path: undefined, itemNames: 'not-array' },
      { ...item, type: 'window', path: undefined },
      { ...item, type: 'clipboard', path: undefined, dataFileRef: 'x' },
    ];
    for (const broken of cases) {
      const file = { ...base, items: [broken] };
      expect(validate(file), JSON.stringify(broken)).toBe(false);
      const lenient = parseWorkspaceFileLenient(
        JSON.stringify(file),
        createWorkspaceParseContext()
      );
      expect(
        lenient.issues.map((i) => i.kind),
        JSON.stringify(broken)
      ).toEqual(['invalid']);
    }
  });

  it('アーカイブは archivedAt / archivedGroupId 付きのアイテムだけを受け付けること', () => {
    const archiveBase = { $schema: './schemas/workspace-archive.schema.json', version: '2.0' };
    const archivedGroup = {
      ...group,
      id: 'agAAAAA1',
      archivedAt: 2,
      originalOrder: 0,
      itemCount: 1,
    };
    const archivedItem = {
      ...item,
      id: 'aiAAAAA1',
      groupId: 'agAAAAA1',
      archivedAt: 2,
      archivedGroupId: 'agAAAAA1',
    };
    expect(
      validateArchive({ ...archiveBase, groups: [archivedGroup], items: [archivedItem] })
    ).toBe(true);
    expect(validateArchive({ ...archiveBase, groups: [archivedGroup], items: [item] })).toBe(false);

    const ctx = createWorkspaceParseContext();
    parseWorkspaceFileLenient(JSON.stringify({ ...base, items: [] }), ctx);
    const lenient = parseWorkspaceArchiveFileLenient(
      JSON.stringify({ ...archiveBase, groups: [archivedGroup], items: [archivedItem] }),
      ctx
    );
    expect(lenient.issues).toEqual([]);
  });
});
