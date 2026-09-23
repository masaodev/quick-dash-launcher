/**
 * パースに失敗した（破損の可能性がある）データファイル名の集合。
 * 破損ファイルを空データや部分データで上書きすると復旧不能になるため、
 * このセットに載っているファイルへの保存系操作は拒否する。
 * ユーザーがファイルを修復（または削除）して再読み込みに成功すると解除される。
 */
const corruptedDataFiles = new Set<string>();

export function markDataFileCorrupted(fileName: string): void {
  corruptedDataFiles.add(fileName);
}

export function clearDataFileCorrupted(fileName: string): void {
  corruptedDataFiles.delete(fileName);
}

export function getCorruptedDataFiles(): string[] {
  return [...corruptedDataFiles];
}
