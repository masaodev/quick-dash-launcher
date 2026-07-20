import { describe, it, expect } from 'vitest';

import {
  isIco,
  parseIcoEntries,
  sortEntriesForTarget,
  decodeIcoBmpEntry,
  type IcoEntry,
} from './icoDecoder';

/** [B, G, R, A] の上から下の行順ピクセルから32bpp BMPエントリデータを構築する */
function buildBmpEntryData(
  width: number,
  height: number,
  topDownPixels: number[][],
  opts?: {
    bitCount?: number;
    compression?: number;
    mask?: (x: number, y: number) => boolean;
  }
): Buffer {
  const rowSize = width * 4;
  const maskRowSize = (Math.ceil(width / 32) * 32) / 8;
  const buf = Buffer.alloc(40 + rowSize * height + maskRowSize * height);
  buf.writeUInt32LE(40, 0);
  buf.writeInt32LE(width, 4);
  buf.writeInt32LE(height * 2, 8); // XOR+ANDの合計高さ
  buf.writeUInt16LE(1, 12);
  buf.writeUInt16LE(opts?.bitCount ?? 32, 14);
  buf.writeUInt32LE(opts?.compression ?? 0, 16);

  // ピクセルは下から上の行順で格納される
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [b, g, r, a] = topDownPixels[y * width + x];
      const off = 40 + (height - 1 - y) * rowSize + x * 4;
      buf[off] = b;
      buf[off + 1] = g;
      buf[off + 2] = r;
      buf[off + 3] = a;
    }
  }

  if (opts?.mask) {
    const maskOffset = 40 + rowSize * height;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (opts.mask(x, y)) {
          const off = maskOffset + (height - 1 - y) * maskRowSize + (x >> 3);
          buf[off] |= 0x80 >> (x & 7);
        }
      }
    }
  }

  return buf;
}

function buildIco(images: { width: number; height: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length;
  const chunks: Buffer[] = [header];
  images.forEach((img, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(img.width >= 256 ? 0 : img.width, e);
    header.writeUInt8(img.height >= 256 ? 0 : img.height, e + 1);
    header.writeUInt32LE(img.data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    chunks.push(img.data);
    offset += img.data.length;
  });
  return Buffer.concat(chunks);
}

const PNG_STUB = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe('isIco', () => {
  it('ICOヘッダを判定できる', () => {
    const ico = buildIco([{ width: 16, height: 16, data: PNG_STUB }]);
    expect(isIco(ico)).toBe(true);
  });

  it('PNGデータはICOと判定しない', () => {
    expect(isIco(PNG_STUB)).toBe(false);
  });

  it('ヘッダより短いデータはICOと判定しない', () => {
    expect(isIco(Buffer.from([0x00, 0x00, 0x01]))).toBe(false);
  });
});

describe('parseIcoEntries', () => {
  it('エントリのサイズ・オフセット・PNG判定を読み取れる', () => {
    const bmp = buildBmpEntryData(1, 1, [[1, 2, 3, 255]]);
    const ico = buildIco([
      { width: 16, height: 16, data: PNG_STUB },
      { width: 32, height: 32, data: bmp },
    ]);
    const entries = parseIcoEntries(ico);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ width: 16, height: 16, isPng: true });
    expect(entries[1]).toMatchObject({ width: 32, height: 32, isPng: false });
    expect(entries[1].dataSize).toBe(bmp.length);
  });

  it('幅・高さ0は256として解釈する', () => {
    const ico = buildIco([{ width: 256, height: 256, data: PNG_STUB }]);
    const entries = parseIcoEntries(ico);
    expect(entries[0].width).toBe(256);
    expect(entries[0].height).toBe(256);
  });

  it('バッファ範囲外を指すエントリは除外する', () => {
    const ico = buildIco([{ width: 16, height: 16, data: PNG_STUB }]);
    ico.writeUInt32LE(9999, 6 + 8); // dataSizeを改ざん
    expect(parseIcoEntries(ico)).toHaveLength(0);
  });

  it('ICO以外は空配列を返す', () => {
    expect(parseIcoEntries(PNG_STUB)).toEqual([]);
  });
});

describe('sortEntriesForTarget', () => {
  const entry = (size: number): IcoEntry => ({
    width: size,
    height: size,
    dataOffset: 0,
    dataSize: 0,
    isPng: false,
  });

  it('target以上は小さい順、target未満は大きい順で後ろに並べる', () => {
    const sorted = sortEntriesForTarget([entry(16), entry(256), entry(48), entry(128)], 64);
    expect(sorted.map((e) => e.width)).toEqual([128, 256, 48, 16]);
  });

  it('target以上が無い場合は大きい順', () => {
    const sorted = sortEntriesForTarget([entry(16), entry(48), entry(32)], 64);
    expect(sorted.map((e) => e.width)).toEqual([48, 32, 16]);
  });
});

describe('decodeIcoBmpEntry', () => {
  function decodeSingle(data: Buffer, width: number, height: number) {
    const ico = buildIco([{ width, height, data }]);
    const [entry] = parseIcoEntries(ico);
    return decodeIcoBmpEntry(ico, entry);
  }

  it('下から上の行順を上から下へ反転してデコードする', () => {
    const bmp = buildBmpEntryData(2, 2, [
      [1, 2, 3, 255],
      [4, 5, 6, 255],
      [7, 8, 9, 255],
      [10, 11, 12, 255],
    ]);
    const result = decodeSingle(bmp, 2, 2);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(2);
    expect(result!.height).toBe(2);
    expect([...result!.bgra]).toEqual([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  });

  it('アルファ全0の旧式ICOはANDマスクから透明領域を復元する', () => {
    const bmp = buildBmpEntryData(
      2,
      2,
      [
        [1, 2, 3, 0],
        [4, 5, 6, 0],
        [7, 8, 9, 0],
        [10, 11, 12, 0],
      ],
      { mask: (x, y) => x === 0 && y === 0 } // 左上のみ透明
    );
    const result = decodeSingle(bmp, 2, 2);
    expect(result).not.toBeNull();
    // 左上: 透明（プリマルチプライで色も0）、他: 不透明
    expect([...result!.bgra]).toEqual([0, 0, 0, 0, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  });

  it('半透明ピクセルはプリマルチプライされる', () => {
    const bmp = buildBmpEntryData(1, 1, [[100, 200, 50, 128]]);
    const result = decodeSingle(bmp, 1, 1);
    expect(result).not.toBeNull();
    expect([...result!.bgra]).toEqual([
      Math.round((100 * 128) / 255),
      Math.round((200 * 128) / 255),
      Math.round((50 * 128) / 255),
      128,
    ]);
  });

  it('32bpp以外はnullを返す', () => {
    const bmp = buildBmpEntryData(1, 1, [[1, 2, 3, 255]], { bitCount: 24 });
    expect(decodeSingle(bmp, 1, 1)).toBeNull();
  });

  it('圧縮ありはnullを返す', () => {
    const bmp = buildBmpEntryData(1, 1, [[1, 2, 3, 255]], { compression: 3 });
    expect(decodeSingle(bmp, 1, 1)).toBeNull();
  });

  it('ピクセルデータが不足している場合はnullを返す', () => {
    const bmp = buildBmpEntryData(2, 2, [
      [1, 2, 3, 255],
      [4, 5, 6, 255],
      [7, 8, 9, 255],
      [10, 11, 12, 255],
    ]);
    const truncated = bmp.subarray(0, 44); // ヘッダ+1ピクセル分のみ
    const ico = buildIco([{ width: 2, height: 2, data: truncated }]);
    const [entry] = parseIcoEntries(ico);
    expect(decodeIcoBmpEntry(ico, entry)).toBeNull();
  });
});
