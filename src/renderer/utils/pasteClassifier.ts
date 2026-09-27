import { PathUtils } from '@common/utils/pathUtils';

/**
 * ワークスペースに貼り付けられたテキストの扱い
 *
 * - url: http(s)/ftp の URL。URL アイテムにする（ファビコン取得）
 * - customUri: obsidian:// や ms-todo: などのカスタム URI。customUri アイテムにする
 * - path: Windows のパス（ドライブ文字・UNC・shell:・環境変数）。ファイル／フォルダのアイテムにする
 * - text: それ以外の文字列（複数行を含む）。クリップボードアイテムとして丸ごと保存する
 */
export type PastedTextKind = 'url' | 'customUri' | 'path' | 'text';

export interface PastedTextClassification {
  kind: PastedTextKind;
  /** アイテムの path や保存対象になる値。url/customUri/path は 1 行目、text は全文 */
  value: string;
}

const URL_PATTERN = /^(https?|ftp):\/\/\S+$/i;
const DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const UNC_PATH_PATTERN = /^\\\\[^\\]/;
const SHELL_PATH_PATTERN = /^shell:/i;
const ENV_PATH_PATTERN = /^%[^%\s]+%[\\/]/;

/** 「パスのコピー」で付く前後の引用符を外す */
function stripQuotes(line: string): string {
  const m = line.match(/^"(.*)"$/);
  return m ? m[1] : line;
}

/** Windows のパスに見えるか（実在は確かめない。ネットワークパスの応答待ちを避ける） */
export function looksLikeWindowsPath(line: string): boolean {
  return (
    DRIVE_PATH_PATTERN.test(line) ||
    UNC_PATH_PATTERN.test(line) ||
    SHELL_PATH_PATTERN.test(line) ||
    ENV_PATH_PATTERN.test(line)
  );
}

/**
 * 貼り付けられたテキストを分類する
 *
 * 以前は 1 行目を取り出して種別判定にかけるだけだったため、「会議メモ」のような
 * ただの文字列が「拡張子なし → folder」でフォルダになっていた。ここでは
 * URL・URI・パスの形をしているものだけをアイテムにし、それ以外は text として返す。
 *
 * @returns 空（空白だけ）なら null
 */
export function classifyPastedText(text: string): PastedTextClassification | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== '');
  // 複数行は「まとまった文章」とみなして丸ごと保存する（1 行目だけを黙って使わない）
  if (lines.length > 1) {
    return { kind: 'text', value: trimmed };
  }

  const line = stripQuotes(lines[0].trim());

  if (URL_PATTERN.test(line)) {
    return { kind: 'url', value: line };
  }

  if (looksLikeWindowsPath(line)) {
    return { kind: 'path', value: line };
  }

  // 「TODO: 買い物」のような文はスキーム構文に一致するが、空白を含むので text に落とす
  if (!/\s/.test(line) && PathUtils.isCustomUriScheme(line)) {
    return { kind: 'customUri', value: line };
  }

  return { kind: 'text', value: trimmed };
}

/** クリップボードアイテムの表示名に使う長さ */
const DISPLAY_NAME_MAX_LENGTH = 30;

/**
 * テキストからクリップボードアイテムの表示名を作る（1 行目を短く切る）
 */
export function makeClipboardDisplayName(text: string): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l !== '');
  if (!firstLine) return 'テキスト';
  return firstLine.length > DISPLAY_NAME_MAX_LENGTH
    ? `${firstLine.slice(0, DISPLAY_NAME_MAX_LENGTH)}…`
    : firstLine;
}
