/**
 * ウィンドウ操作アイテムのタイトル指定に関する共通規則
 */

/** 全一致のワイルドカード（プロセス名だけで探すときのタイトル） */
export const ANY_WINDOW_TITLE = '*';

/**
 * 「タイトルが空でプロセス名だけ」の指定を全一致ワイルドカード "*" に正規化する
 *
 * 登録フォームは「タイトルまたはプロセス名」を許すが、保存形式では windowTitle が必須。
 * 空タイトルは完全一致で何にもマッチしないため、プロセス名だけで探す意図を "*" で表す。
 * データファイル・ワークスペースの書き込みと寛容な読み込み、旧形式の移行で同じ規則を使う。
 *
 * @returns 正規化が必要なら "*"、それ以外は undefined
 */
export function normalizeWindowTitleForProcessOnly(
  windowTitle: unknown,
  processName: unknown
): string | undefined {
  // 文字列でない値（数値など）は救済せず、検証で invalid にする
  const titleEmpty =
    windowTitle === undefined || (typeof windowTitle === 'string' && windowTitle.trim() === '');
  const hasProcess = typeof processName === 'string' && processName.trim() !== '';
  return titleEmpty && hasProcess ? ANY_WINDOW_TITLE : undefined;
}

/**
 * ワイルドカードパターンを正規表現に変換（* = 任意の文字列、? = 任意の1文字。大文字小文字は区別しない完全一致）
 */
function wildcardToRegex(pattern: string): RegExp {
  // 正規表現の特殊文字をエスケープ（*と?以外）
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i');
}

/**
 * ウィンドウタイトルのマッチング関数を作成する（main のウィンドウ検索と renderer の一覧の照合で共通）
 *
 * ワイルドカード（* または ?）を含めばワイルドカード照合、含まなければ完全一致。どちらも大文字小文字は区別しない。
 * ポーリングループなど同じタイトルで繰り返し検索する場合に、正規表現のプリコンパイルにも使う
 */
export function createTitleMatcher(windowTitle: string): (title: string) => boolean {
  const hasWildcard = windowTitle.includes('*') || windowTitle.includes('?');
  const regex = hasWildcard ? wildcardToRegex(windowTitle) : null;
  const lowerWindowTitle = windowTitle.toLowerCase();
  return (title: string): boolean =>
    regex ? regex.test(title) : title.toLowerCase() === lowerWindowTitle;
}

/** タイトルを部品に分ける区切り（前後に空白のある「-」「|」「—」「–」） */
export const WINDOW_TITLE_SEPARATOR = /\s+[-|—–]\s+/;

/**
 * ウィンドウタイトルから行の名前を作る（セットの行の自動の名前）
 *
 * 区切りで 2 つ以上の部品に分かれるタイトルは、最後の部品（多くはアプリ名と版）を落とす。
 * 区切りが無ければ前後の空白を落としただけのタイトル
 */
export function titleToEntryName(title: string): string {
  const trimmed = title.trim();
  const parts = trimmed.split(WINDOW_TITLE_SEPARATOR).filter((part) => part.trim() !== '');
  if (parts.length < 2) return trimmed;
  const separators = [...trimmed.matchAll(new RegExp(WINDOW_TITLE_SEPARATOR.source, 'g'))];
  const last = separators[separators.length - 1];
  return trimmed.slice(0, last.index).trim() || trimmed;
}

/**
 * 記録するウィンドウタイトルから、版が上がっても当たる一部一致の形を作る（例: `*一時メモ.txt*`）
 *
 * titleToEntryName と同じく最後の部品（多くはアプリ名と版）を落とし、残りを * で囲む。
 * 元のタイトルの * と ? はワイルドカードと取り違えないよう除く（候補の titleParts と同じ扱い）。
 * 区切りで 2 つ以上の部品に分かれないタイトルは undefined（タイトル全体で探す）
 */
export function titleToPartialPattern(title: string): string | undefined {
  const plain = title.replace(/[*?]/g, '').trim();
  const head = titleToEntryName(plain);
  return head && head !== plain ? `*${head}*` : undefined;
}

/**
 * 対象ウィンドウから行の名前を作る（名前の無い、動かすだけの行の自動の名前）
 *
 * タイトルのワイルドカード（* と ?）を除いて titleToEntryName をかける。タイトルが無ければ exe 名
 */
export function windowMatchEntryName(
  match: { title?: string; processName?: string } | undefined
): string {
  const title = (match?.title ?? '').replace(/[*?]/g, '').trim();
  return (title && titleToEntryName(title)) || match?.processName || '';
}
