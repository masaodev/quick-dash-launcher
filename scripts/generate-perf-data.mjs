#!/usr/bin/env node
/**
 * 速さとメモリを比べるための、アイテムの多い設定フォルダを作る（A3-254）
 *
 * 使い方:
 *   node scripts/generate-perf-data.mjs [--items 3000] [--icons 2000] [--files 5] [--out tmp/perf-data]
 *
 * - アイテムは Web サイト（ドメインがすべて違う）を `--files` 本のデータファイルに分けて入れ、タブも同じ数だけ作る
 * - 先頭から `--icons` 件のアイテムには、アイコンのキャッシュ（ファビコン）を置く。中身は 24×24 の PNG（約 2KB。
 *   本番の平均に合わせた大きさ）で、ファイルごとに色を変えて中身を別にする
 * - 設定は tests/dev/full/settings.json を元にし、タブとホットキー（Ctrl+Alt+F8）だけ差し替える
 * - 出力先は消してから作り直す（既定の tmp/ は git で管理しない）
 *
 * 起動: QUICK_DASH_CONFIG_DIR=./tmp/perf-data npm run dev  → logs/main.log の「起動の計測」「設定ファイルを読み直しました」
 * 「キャッシュのアイコンを読み込みました」「メモリの計測」を見る
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = { items: 3000, icons: 2000, files: 5, out: 'tmp/perf-data' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (!(key in opts) || value === undefined) {
      console.error(`不明な引数です: ${argv[i]}`);
      process.exit(1);
    }
    opts[key] = key === 'out' ? value : Number(value);
  }
  if (!Number.isInteger(opts.items) || opts.items < 1) throw new Error('--items は 1 以上の整数');
  if (!Number.isInteger(opts.files) || opts.files < 1) throw new Error('--files は 1 以上の整数');
  opts.icons = Math.min(Math.max(0, opts.icons), opts.items);
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const outDir = path.resolve(root, opts.out);
// 消してよいのはリポジトリの中だけ（打ち間違いで別の場所を消さないため）
if (!outDir.startsWith(root + path.sep)) {
  console.error(`出力先はリポジトリの中にしてください: ${outDir}`);
  process.exit(1);
}
fs.rmSync(outDir, { recursive: true, force: true });

const dataDir = path.join(outDir, 'datafiles');
const faviconDir = path.join(outDir, 'icon-cache', 'favicons');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(faviconDir, { recursive: true });

const fileNames = Array.from({ length: opts.files }, (_, i) =>
  i === 0 ? 'datafiles/data.json' : `datafiles/data${i + 1}.json`
);
const perFile = fileNames.map(() => []);
for (let i = 0; i < opts.items; i++) {
  const n = String(i + 1).padStart(5, '0');
  perFile[i % opts.files].push({
    id: `pf${String(i + 1).padStart(6, "0")}`, // ID は英数字 8 文字（jsonParser の ID_PATTERN）
    type: 'item',
    displayName: `計測用サイト ${n}（keisoku ${n}）`,
    path: `https://site${n}.example.com/`,
    ...(i % 7 === 0 ? { memo: `メモ ${n}` } : {}),
  });
}
fileNames.forEach((fileName, i) => {
  const json = { version: '1.0', items: perFile[i] };
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(json, null, 2) + '\n');
});

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** 24×24 の RGBA の PNG。seed ごとに模様を変え、圧縮しても約 2KB 残るようにする */
function makeIconPng(seed) {
  const size = 24;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let x = (seed * 2654435761) >>> 0;
  for (let row = 0; row < size; row++) {
    const offset = row * (size * 4 + 1);
    raw[offset] = 0; // フィルタなし
    for (let i = 1; i <= size * 4; i++) {
      x = (x * 1103515245 + 12345) >>> 0;
      raw[offset + i] = i % 4 === 0 ? 255 : (x >>> 16) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

let iconTotal = 0;
for (let i = 0; i < opts.icons; i++) {
  const n = String(i + 1).padStart(5, '0');
  const png = makeIconPng(i + 1);
  iconTotal += png.length;
  fs.writeFileSync(path.join(faviconDir, `site${n}.example.com_favicon_32.png`), png);
}

const settings = JSON.parse(
  fs.readFileSync(path.join(root, 'tests', 'dev', 'full', 'settings.json'), 'utf8')
);
settings.hotkey = 'Ctrl+Alt+F8';
settings.dataFileTabs = fileNames.map((file, i) => ({ files: [file], name: `計測 ${i + 1}` }));
settings.defaultFileTab = fileNames[0];
settings.dataFileLabels = {};
fs.writeFileSync(path.join(outDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n');

console.log(
  `作りました: ${outDir}\n  アイテム ${opts.items} 件（データファイル ${opts.files} 本）・アイコン ${opts.icons} 個` +
    `（合計 ${Math.round(iconTotal / 1024)} KB）`
);
