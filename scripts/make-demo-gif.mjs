/**
 * test-results/demo-gif/<name>/ のスクリーンショットと frames.json（表示時間）から
 * docs/images/demo-<name>.gif を作る。ffmpeg が PATH にあること
 *
 * 使い方: node scripts/make-demo-gif.mjs [name]（既定は main）
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const name = process.argv[2] ?? 'main';
const frameDir = path.join(process.cwd(), 'test-results', 'demo-gif', name);
const frames = JSON.parse(fs.readFileSync(path.join(frameDir, 'frames.json'), 'utf8'));
const output = path.join(process.cwd(), 'docs', 'images', `demo-${name}.gif`);
fs.mkdirSync(path.dirname(output), { recursive: true });

// concat デマルチプレクサ用のリスト。最後のフレームは duration が効かないので 2 回書く
const lines = frames.flatMap((f) => [`file '${f.file}'`, `duration ${f.durationMs / 1000}`]);
lines.push(`file '${frames[frames.length - 1].file}'`);
const listFile = path.join(frameDir, 'list.txt');
fs.writeFileSync(listFile, lines.join('\n') + '\n');

const palette = path.join(frameDir, 'palette.png');
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-vf',
    'palettegen=stats_mode=full',
    palette,
  ],
  { cwd: frameDir, stdio: 'inherit' }
);
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-i',
    palette,
    '-lavfi',
    'fps=10,paletteuse=dither=none',
    '-loop',
    '0',
    output,
  ],
  { cwd: frameDir, stdio: 'inherit' }
);

const sizeKb = Math.round(fs.statSync(output).size / 1024);
console.log(`作成: ${path.relative(process.cwd(), output)}（${sizeKb} KB）`);
