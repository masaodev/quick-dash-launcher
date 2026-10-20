/**
 * 取り込む CSV の文字コードを判じて読む。UTF-8 として正しくなければ Shift_JIS とみなす
 * （書き出した CSV を日本語版 Excel で「CSV (カンマ区切り)」として上書き保存すると Shift_JIS になる）
 */
export function decodeCsvText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('shift_jis').decode(bytes);
  }
}
