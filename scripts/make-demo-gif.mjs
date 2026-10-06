/**
 * test-results/demo-gif/<name>/ の動画（meta.json が指す範囲）から docs/images/demo-<name>.gif を作る。
 * ffmpeg が PATH にあること
 *
 * 使い方: node scripts/make-demo-gif.mjs [name]（既定は main）
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const name = process.argv[2] ?? 'main';
const FPS = 15;
// 高 DPI の画面で撮った動画も、README では 800px 幅にそろえる
const SCALE = 'scale=800:-1:flags=lanczos';
const dir = path.join(process.cwd(), 'test-results', 'demo-gif', name);
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const video = path.join(dir, meta.video);
const output = path.join(process.cwd(), 'docs', 'images', `demo-${name}.gif`);
fs.mkdirSync(path.dirname(output), { recursive: true });

const range = ['-ss', String(meta.startSec), '-to', String(meta.endSec)];
const palette = path.join(dir, 'palette.png');
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    ...range,
    '-i',
    video,
    '-vf',
    `fps=${FPS},${SCALE},palettegen=stats_mode=diff`,
    palette,
  ],
  { stdio: 'inherit' }
);
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-v',
    'error',
    ...range,
    '-i',
    video,
    '-i',
    palette,
    '-lavfi',
    `fps=${FPS},${SCALE}[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop',
    '0',
    output,
  ],
  { stdio: 'inherit' }
);

const sizeKb = Math.round(fs.statSync(output).size / 1024);
const seconds = (meta.endSec - meta.startSec).toFixed(1);
console.log(`作成: ${path.relative(process.cwd(), output)}（${seconds} 秒・${sizeKb} KB）`);
