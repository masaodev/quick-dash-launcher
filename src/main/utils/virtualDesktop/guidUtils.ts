/**
 * GUID変換ユーティリティ
 * バイナリデータとGUID文字列の相互変換
 */

/**
 * 16バイトのBufferをGUID文字列に変換
 * @param buffer 16バイトのGUIDバイナリ
 * @returns GUID文字列（{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}形式）
 */
export function bufferToGuidString(buffer: Buffer): string {
  if (buffer.length !== 16) {
    throw new Error('GUIDは16バイトである必要があります');
  }

  // GUIDのバイト順序（リトルエンディアン）
  const part1 = buffer.readUInt32LE(0).toString(16).padStart(8, '0');
  const part2 = buffer.readUInt16LE(4).toString(16).padStart(4, '0');
  const part3 = buffer.readUInt16LE(6).toString(16).padStart(4, '0');
  const part4 = buffer.readUInt16BE(8).toString(16).padStart(4, '0');
  const part5 = buffer.subarray(10, 16).toString('hex');

  return `{${part1}-${part2}-${part3}-${part4}-${part5}}`;
}
