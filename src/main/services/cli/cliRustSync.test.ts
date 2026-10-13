/**
 * qdl.exe（cli/src/main.rs）と本体で手で合わせている取り決めが、ずれていないことを確かめる
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

import { CLI_LAUNCHER_INFO_FILE_NAME } from './cliLauncherInfo';
import { CLI_EXIT, CLI_PROTOCOL_VERSION, getCliPipeName } from './cliProtocol';

const rustSource = fs.readFileSync(path.resolve(process.cwd(), 'cli/src/main.rs'), 'utf8');

/** `const NAME: 型 = 値;` の値を読む */
function readRustConst(name: string): number {
  const match = new RegExp(`const ${name}: \\w+ = (\\d+);`).exec(rustSource);
  if (!match) throw new Error(`cli/src/main.rs に ${name} が見つからない`);
  return Number(match[1]);
}

describe('qdl.exe と本体の取り決め', () => {
  it('やり取りの版が同じ', () => {
    expect(readRustConst('PROTOCOL_VERSION')).toBe(CLI_PROTOCOL_VERSION);
  });

  it('qdl.exe 側で使う終了コードが同じ', () => {
    expect(readRustConst('EXIT_NOT_AVAILABLE')).toBe(CLI_EXIT.notAvailable);
    expect(readRustConst('EXIT_PROTOCOL')).toBe(CLI_EXIT.protocol);
  });

  it('本体の場所を書くファイルの名前が同じ', () => {
    expect(rustSource).toContain(`"${CLI_LAUNCHER_INFO_FILE_NAME}"`);
  });

  it('パイプ名の組み立て方が同じ', () => {
    expect(rustSource).toContain('format!(r"\\\\.\\pipe\\{base}-cli-{user}")');
    expect(getCliPipeName('{base}', '{user}')).toBe('\\\\.\\pipe\\{base}-cli-{user}');
  });
});
