/**
 * データファイル名（設定フォルダからの相対パス）の検証
 *
 * 画面から受け取ったファイル名をそのままパスに結合すると、datafiles フォルダの外を指せてしまう。
 * 書き込み・削除の前に、datafiles 直下の .json だけを受け付ける。
 */

/** datafiles/ 直下の .json（フォルダの区切りや Windows でファイル名に使えない文字を含まない） */
const DATA_FILE_NAME_PATTERN = /^datafiles\/[^/\\:*?"<>|]+\.json$/;

/** データファイル名として受け付けてよいか（例: datafiles/data.json は true、../settings.json は false） */
export function isValidDataFileName(fileName: unknown): fileName is string {
  return typeof fileName === 'string' && DATA_FILE_NAME_PATTERN.test(fileName);
}
