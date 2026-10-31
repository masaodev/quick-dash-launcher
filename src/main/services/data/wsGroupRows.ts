/**
 * 最後に読み込んだデータファイルに WSグループの行があったか
 *
 * WSグループは展開が 0 件だとランチャーの一覧に何も残らないので、renderer は一覧だけでは
 * 「ワークスペースが変わったら読み直す」必要があるかを判断できない。読み込みのついでにここに残す。
 */
let hasRows = false;

export function setHasWsGroupRows(value: boolean): void {
  hasRows = value;
}

export function hasWsGroupRows(): boolean {
  return hasRows;
}
