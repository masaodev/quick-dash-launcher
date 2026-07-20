/**
 * ICO形式の解析ユーティリティ。
 *
 * nativeImage.createFromBuffer はPNG/JPEGしかデコードできず、ICOを渡すと
 * isEmpty() になる。ファビコンには多サイズ内包の大型ICO（1MB超）を配信する
 * サイトがあるため、内包エントリを取り出して縮小できるようにする。
 * Electron非依存の純粋関数のみを置く（単体テスト用）。
 */

const ICO_HEADER_SIZE = 6;
const ICO_ENTRY_SIZE = 16;
const BITMAPINFOHEADER_SIZE = 40;
const PNG_SIGNATURE = 0x89504e47;
/** 壊れたヘッダによる巨大確保を防ぐための上限（ICO仕様上の最大は256px） */
const MAX_DIMENSION = 1024;

export interface IcoEntry {
  /** 実ピクセル幅（エントリの0は256として解釈済み） */
  width: number;
  height: number;
  dataOffset: number;
  dataSize: number;
  /** エントリの中身がPNGデータかどうか */
  isPng: boolean;
}

export interface DecodedBitmap {
  width: number;
  height: number;
  /** 上から下の行順・プリマルチプライ済みBGRA（nativeImage.createFromBitmap互換） */
  bgra: Buffer;
}

export function isIco(data: Buffer): boolean {
  return (
    data.length >= ICO_HEADER_SIZE &&
    data.readUInt16LE(0) === 0 &&
    data.readUInt16LE(2) === 1 &&
    data.readUInt16LE(4) > 0
  );
}

/**
 * ICOのディレクトリエントリを列挙する。範囲外を指すエントリは除外する。
 */
export function parseIcoEntries(data: Buffer): IcoEntry[] {
  if (!isIco(data)) {
    return [];
  }

  const count = data.readUInt16LE(4);
  const entries: IcoEntry[] = [];

  for (let i = 0; i < count; i++) {
    const offset = ICO_HEADER_SIZE + i * ICO_ENTRY_SIZE;
    if (offset + ICO_ENTRY_SIZE > data.length) {
      break;
    }

    const width = data.readUInt8(offset) || 256;
    const height = data.readUInt8(offset + 1) || 256;
    const dataSize = data.readUInt32LE(offset + 8);
    const dataOffset = data.readUInt32LE(offset + 12);

    if (dataSize < 4 || dataOffset + dataSize > data.length) {
      continue;
    }

    entries.push({
      width,
      height,
      dataOffset,
      dataSize,
      isPng: data.readUInt32BE(dataOffset) === PNG_SIGNATURE,
    });
  }

  return entries;
}

/**
 * targetSize への縮小に適した順に並べ替える。
 * targetSize 以上では小さい順（縮小率最小）、それが無い場合は大きい順。
 */
export function sortEntriesForTarget(entries: IcoEntry[], targetSize: number): IcoEntry[] {
  const longEdge = (e: IcoEntry): number => Math.max(e.width, e.height);
  const larger = entries
    .filter((e) => longEdge(e) >= targetSize)
    .sort((a, b) => longEdge(a) - longEdge(b));
  const smaller = entries
    .filter((e) => longEdge(e) < targetSize)
    .sort((a, b) => longEdge(b) - longEdge(a));
  return [...larger, ...smaller];
}

/**
 * 32bpp BI_RGB のBMPエントリをデコードする。
 * それ以外の形式（8bpp・24bpp・圧縮あり等）はnullを返し、呼び出し側で
 * 別エントリへフォールバックさせる。大型ICOは実質PNGか32bppのため十分。
 */
export function decodeIcoBmpEntry(data: Buffer, entry: IcoEntry): DecodedBitmap | null {
  const o = entry.dataOffset;
  if (o + BITMAPINFOHEADER_SIZE > data.length) {
    return null;
  }

  const headerSize = data.readUInt32LE(o);
  const width = data.readInt32LE(o + 4);
  const rawHeight = data.readInt32LE(o + 8);
  const bitCount = data.readUInt16LE(o + 14);
  const compression = data.readUInt32LE(o + 16);

  if (headerSize !== BITMAPINFOHEADER_SIZE || bitCount !== 32 || compression !== 0) {
    return null;
  }

  // biHeight はXOR(ピクセル)＋AND(マスク)を合わせた高さで通常2倍になっている
  const absHeight = Math.abs(rawHeight);
  const height = absHeight === entry.height ? absHeight : Math.floor(absHeight / 2);
  if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    return null;
  }

  const rowSize = width * 4; // 32bppは常に4バイト境界
  const pixelOffset = o + headerSize; // 32bpp BI_RGBはパレットなし
  if (pixelOffset + rowSize * height > data.length) {
    return null;
  }

  // 下から上の行順を、上から下へ反転しながらコピー
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = pixelOffset + (height - 1 - y) * rowSize;
    data.copy(out, y * rowSize, src, src + rowSize);
  }

  // 旧式ICOはアルファ全0でANDマスクに透明領域を持つため、マスクから復元する
  let hasAlpha = false;
  for (let i = 3; i < out.length; i += 4) {
    if (out[i] !== 0) {
      hasAlpha = true;
      break;
    }
  }
  if (!hasAlpha) {
    applyAndMask(data, out, width, height, pixelOffset + rowSize * height);
  }

  premultiplyAlpha(out);
  return { width, height, bgra: out };
}

function applyAndMask(
  data: Buffer,
  out: Buffer,
  width: number,
  height: number,
  maskOffset: number
): void {
  const maskRowSize = (Math.ceil(width / 32) * 32) / 8; // 1bpp・32bit境界
  const hasMask = maskOffset + maskRowSize * height <= data.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let transparent = false;
      if (hasMask) {
        const maskByte = data[maskOffset + (height - 1 - y) * maskRowSize + (x >> 3)];
        transparent = (maskByte & (0x80 >> (x & 7))) !== 0;
      }
      out[(y * width + x) * 4 + 3] = transparent ? 0 : 0xff;
    }
  }
}

/** createFromBitmap(toBitmap形式)が期待するプリマルチプライ済みアルファへ変換する */
function premultiplyAlpha(bgra: Buffer): void {
  for (let i = 0; i < bgra.length; i += 4) {
    const a = bgra[i + 3];
    if (a === 255) {
      continue;
    }
    if (a === 0) {
      bgra[i] = 0;
      bgra[i + 1] = 0;
      bgra[i + 2] = 0;
      continue;
    }
    bgra[i] = Math.round((bgra[i] * a) / 255);
    bgra[i + 1] = Math.round((bgra[i + 1] * a) / 255);
    bgra[i + 2] = Math.round((bgra[i + 2] * a) / 255);
  }
}
