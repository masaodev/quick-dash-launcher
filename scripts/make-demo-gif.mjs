/**
 * test-results/demo-gif/<name>/ の動画（meta.json が指す範囲）から docs/images/demo-<name>.gif を作る。
 * ffmpeg が PATH にあること
 *
 * 使い方: node scripts/make-demo-gif.mjs [name]（既定は main。環境変数 DEMO_LANG=en のときは末尾に -en を付けた main-en など）
 */
import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const base = process.argv[2] ?? 'main';
const name = process.env.DEMO_LANG === 'en' ? `${base}-en` : base;
const FPS = 15;
const dir = path.join(process.cwd(), 'test-results', 'demo-gif', name);
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
// 高 DPI の画面で撮った動画は、ウィンドウの論理サイズ（meta.width）に縮める
const SCALE = `scale=${meta.width}:-2:flags=lanczos`;
const video = path.join(dir, meta.video);
const output = path.join(process.cwd(), 'docs', 'images', `demo-${name}.gif`);
fs.mkdirSync(path.dirname(output), { recursive: true });

/**
 * 動画の中で、画面全体を覆うマゼンタの目印が消えた時刻（秒）を返す
 *
 * 録画の開始の遅れや、動画の時刻と PC の時計のずれは 1〜数秒ぶれるので、どこから使うかは動画の中の目印で決める。
 * 小さく縮めたコマごとの色の平均を見て、マゼンタ（U・V がともに高い）が続いたあと、最初に消えたコマの時刻を返す
 */
function findMarkerEnd() {
  const r = spawnSync(
    'ffmpeg',
    [
      '-v',
      'info',
      '-t',
      '30',
      '-i',
      video,
      '-vf',
      'scale=32:-2,signalstats,metadata=print',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  let t = null;
  let u = 0;
  let seenMarker = false;
  for (const line of String(r.stderr).split(/\r?\n/)) {
    const pts = line.match(/pts_time:([0-9.]+)/);
    if (pts) t = Number(pts[1]);
    const um = line.match(/lavfi\.signalstats\.UAVG=([0-9.]+)/);
    if (um) u = Number(um[1]);
    const vm = line.match(/lavfi\.signalstats\.VAVG=([0-9.]+)/);
    if (vm && t !== null) {
      const isMarker = u > 180 && Number(vm[1]) > 180;
      if (isMarker) seenMarker = true;
      else if (seenMarker) return t;
    }
  }
  throw new Error('動画の中に目印（マゼンタ）が見つかりません。撮り直してください');
}

let startSec = meta.startSec;
let endSec = meta.endSec;
if (meta.marker) {
  // 目印が消えた直後のコマは描き直しの途中のことがあるので、少しだけ後ろから使う
  startSec = findMarkerEnd() + 0.1;
  endSec = startSec + meta.durationSec - 0.1;
}
const range = ['-ss', String(startSec), '-to', String(endSec)];
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
const seconds = (endSec - startSec).toFixed(1);
console.log(`作成: ${path.relative(process.cwd(), output)}（${seconds} 秒・${sizeKb} KB）`);
