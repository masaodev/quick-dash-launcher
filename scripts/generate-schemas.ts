/**
 * 設定ファイル用 JSON Schema の生成
 *
 * TypeScript の型定義（JsonDataFile / AppSettings）から JSON Schema を生成し、
 * assets/schemas/ に出力する。生成物はリポジトリにコミットし、アプリに同梱して
 * 起動時に config/schemas/ へコピーする（人や AI がエディタで補完・検証できるように）。
 *
 * 使い方:
 *   npm run schema:generate（tsx で実行）
 *
 * 型を変えたら必ず再生成する。tests/unit/schemas.test.ts が
 * 「生成結果とコミット済みファイルが一致する」ことを検証しているため、
 * 忘れると単体テストが落ちる。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGenerator } from 'ts-json-schema-generator';
import type { Schema, Definition } from 'ts-json-schema-generator';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** definitions を必ず持つスキーマ（生成物の型） */
interface GeneratedSchema extends Schema {
  definitions: Record<string, Definition>;
}

export interface SchemaTarget {
  /** 出力ファイル名 */
  file: string;
  /** 型定義ファイル（リポジトリルートからの相対パス） */
  source: string;
  /** ルートにする型名 */
  type: string;
  /** スキーマの title */
  title: string;
  additionalProperties: boolean;
  /** 生成後の調整 */
  postProcess?: (schema: GeneratedSchema) => void;
}

/** union は type で判別できるので、判別可能な oneOf にする（エディタのエラー表示が明確になる） */
function anyOfToOneOf(def: Definition): void {
  if (def.anyOf) {
    def.oneOf = def.anyOf;
    delete def.anyOf;
  }
}

/** 寛容パースが補完するフィールド。ワークスペース系では省略を許す（README の説明と揃える） */
const WORKSPACE_OPTIONAL_ON_WRITE = new Set(['order', 'createdAt', 'addedAt']);

/**
 * ワークスペース系スキーマの required から、QDL が補完するフィールドを外す
 * definitions 直下と、oneOf に展開された各バリアントの両方を処理する
 */
function relaxWorkspaceRequired(schema: GeneratedSchema): void {
  const relax = (def: Definition | boolean | undefined): void => {
    if (!def || typeof def !== 'object') return;
    if (Array.isArray(def.required)) {
      def.required = def.required.filter((key) => !WORKSPACE_OPTIONAL_ON_WRITE.has(key));
      if (def.required.length === 0) delete def.required;
    }
    for (const variant of def.oneOf ?? def.anyOf ?? []) relax(variant);
  };
  for (const def of Object.values(schema.definitions)) relax(def);
}

function definition(schema: GeneratedSchema, name: string): Definition {
  const def = schema.definitions[name];
  if (!def) {
    throw new Error(`definition "${name}" が生成されていません`);
  }
  return def;
}

/** 生成物の出力先（electron-builder の build.files に含まれる assets/ 配下） */
export const SCHEMA_OUTPUT_DIR = path.join(ROOT_DIR, 'assets', 'schemas');

/**
 * $id の基底。スキーマの同一性を表す安定した URL（main の生ファイル）。
 * アプリの版は入れない: config/schemas/ は起動のたびに同梱版で上書きされ、
 * 隣の README.md に生成したアプリの版が書かれるため、ここで示す必要がない
 */
const SCHEMA_ID_BASE =
  'https://raw.githubusercontent.com/masaodev/quick-dash-launcher/main/assets/schemas';

/**
 * 生成対象の定義
 *
 * - data: アイテムは type で判別する oneOf。未知のフィールドは寛容パースが黙って落とすので、
 *   書く前に気づけるよう additionalProperties: false
 * - settings: 将来のキー追加で古いスキーマが赤くならないよう additionalProperties: true。
 *   欠けたキーは electron-store がデフォルトで補うので required も付けない
 */
export const SCHEMA_TARGETS: SchemaTarget[] = [
  {
    file: 'data.schema.json',
    source: 'src/common/types/json-data.ts',
    type: 'JsonDataFile',
    title: 'QuickDashLauncher データファイル（datafiles/data*.json）',
    additionalProperties: false,
    postProcess: (schema) => {
      anyOfToOneOf(definition(schema, 'JsonItem'));
    },
  },
  {
    file: 'workspace.schema.json',
    source: 'src/common/types/json-workspace.ts',
    type: 'JsonWorkspaceFile',
    title: 'QuickDashLauncher ワークスペースファイル（workspace.json）',
    additionalProperties: false,
    postProcess: (schema) => {
      anyOfToOneOf(definition(schema, 'JsonWorkspaceItem'));
      relaxWorkspaceRequired(schema);
    },
  },
  {
    file: 'workspace-archive.schema.json',
    source: 'src/common/types/json-workspace.ts',
    type: 'JsonWorkspaceArchiveFile',
    title: 'QuickDashLauncher ワークスペースのアーカイブ（workspace-archive.json）',
    additionalProperties: false,
    postProcess: (schema) => {
      // 交差型（JsonWorkspaceItem & メタ）は type ごとに展開された anyOf になる
      anyOfToOneOf(definition(schema, 'JsonArchivedWorkspaceItem'));
      relaxWorkspaceRequired(schema);
    },
  },
  {
    file: 'settings.schema.json',
    source: 'src/common/types/settings.ts',
    type: 'AppSettings',
    title: 'QuickDashLauncher 設定ファイル（settings.json）',
    additionalProperties: true,
    postProcess: (schema) => {
      delete definition(schema, 'AppSettings').required;
    },
  },
];

/**
 * 1 つのスキーマを生成して JSON 文字列で返す
 *
 * @returns 整形済み JSON（末尾改行あり）
 */
export function generateSchema(target: SchemaTarget): string {
  const generator = createGenerator({
    path: path.join(ROOT_DIR, target.source),
    tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
    type: target.type,
    additionalProperties: target.additionalProperties,
    jsDoc: 'extended',
    skipTypeCheck: true,
    sortProps: false,
  });
  const generated = generator.createSchema(target.type) as GeneratedSchema;

  const schema: GeneratedSchema = {
    $schema: generated.$schema,
    $id: `${SCHEMA_ID_BASE}/${target.file}`,
    title: target.title,
    description: definition(generated, target.type).description,
    $ref: generated.$ref,
    definitions: generated.definitions,
  };
  target.postProcess?.(schema);

  return JSON.stringify(schema, null, 2) + '\n';
}

/**
 * すべてのスキーマを生成する
 *
 * @returns ファイル名 → JSON 文字列
 */
export function generateSchemas(): Map<string, string> {
  const result = new Map<string, string>();
  for (const target of SCHEMA_TARGETS) {
    result.set(target.file, generateSchema(target));
  }
  return result;
}

function main(): void {
  fs.mkdirSync(SCHEMA_OUTPUT_DIR, { recursive: true });
  for (const [file, content] of generateSchemas()) {
    const outPath = path.join(SCHEMA_OUTPUT_DIR, file);
    const previous = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
    fs.writeFileSync(outPath, content, 'utf8');
    const status = previous === null ? 'created' : previous === content ? 'unchanged' : 'updated';
    // CLI の進捗表示
    // eslint-disable-next-line no-console
    console.log(`${status}: ${path.relative(ROOT_DIR, outPath)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
