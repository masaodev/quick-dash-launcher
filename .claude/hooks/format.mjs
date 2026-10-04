#!/usr/bin/env node
// Claude Code の PostToolUse（Edit|Write）hook から呼ぶ整形スクリプト。
// 同じ処理のスクリプトを各リポジトリの .claude/hooks/format.mjs に置く（共有の場所に置かず、
// リポジトリ単体で完結させる。書式は各リポジトリの prettier に従う）。
//
// - 編集したファイルから親を遡り、.claude/hooks/format.mjs を持つ最も近いリポジトリを探す。
//   それが自分のリポジトリでなければ、そのリポジトリのスクリプトに処理を渡す
//   （/add-dir でつないだ他リポジトリのファイルも、そのリポジトリのやり方で整形される）。
// - .md は markdownlint-cli2 --fix、コードは prettier --write。どちらもリポジトリの
//   node_modules にあるものだけを使う（無ければ何もしない。npx は使わない）。
// - 失敗しても編集は止めない（終了コード 0）。異常終了だけ ~/.claude/logs/format-hook.log に残す。
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK_REL = join('.claude', 'hooks', 'format.mjs');
const MD_EXTS = new Set(['.md']);
const CODE_EXTS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.css',
  '.scss',
  '.html',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
]);

function log(message) {
  try {
    const dir = join(homedir(), '.claude', 'logs');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'format-hook.log'), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // ログに書けなくても編集は止めない
  }
}

function findOwner(file) {
  let dir = dirname(file);
  for (;;) {
    if (existsSync(join(dir, HOOK_REL))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function run(root, script, args, file, okCodes) {
  const bin = join(root, 'node_modules', ...script);
  if (!existsSync(bin)) return;
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 25000,
  });
  if (r.error || !okCodes.includes(r.status)) {
    const detail = (r.error?.message || r.stderr || r.stdout || '')
      .trim()
      .split('\n')
      .slice(0, 3)
      .join(' / ');
    log(`${script[0]} exit=${r.status} ${file} ${detail}`);
  }
}

let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}
let file;
try {
  file = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!file) process.exit(0);
file = resolve(file);
if (!existsSync(file) || /[\\/](node_modules|\.git)[\\/]/.test(file)) process.exit(0);

const owner = findOwner(file);
if (!owner) process.exit(0);
if (resolve(owner).toLowerCase() !== SELF_ROOT.toLowerCase()) {
  // 他リポジトリのファイル → そのリポジトリのスクリプトに渡す
  spawnSync(process.execPath, [join(owner, HOOK_REL)], { input, encoding: 'utf8', timeout: 28000 });
  process.exit(0);
}

const ext = extname(file).toLowerCase();
if (MD_EXTS.has(ext)) {
  // 引数は glob として解釈されるので、先頭の ':' で「そのままのパス」と指定する（括弧・Windows の \ 対策）。
  // 終了コード 1 は「直せない指摘が残った」なので正常扱い
  const literal = ':' + relative(owner, file).split(sep).join('/');
  run(owner, ['markdownlint-cli2', 'markdownlint-cli2-bin.mjs'], ['--fix', literal], file, [0, 1]);
} else if (CODE_EXTS.has(ext)) {
  run(
    owner,
    ['prettier', 'bin', 'prettier.cjs'],
    ['--write', '--ignore-unknown', '--log-level', 'warn', file],
    file,
    [0]
  );
}
process.exit(0);
