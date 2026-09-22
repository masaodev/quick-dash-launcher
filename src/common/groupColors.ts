/**
 * ワークスペースグループの色
 *
 * ファイル（workspace.json の groups[].color）には CSS 変数名ではなく**色トークン**を保存する。
 * CSS 変数名を保存すると変数を改名しただけで保存済みデータの色が壊れるため、
 * トークン → CSS 変数の解決はレンダラー側（resolveGroupColorCss）で行う。
 * 6 桁の hex（例: "#00897b"）も許容する（AI や人が自由に色を書けるように）。
 */

/** グループ色トークン（variables.css の --group-color-<token> に対応） */
export const GROUP_COLOR_TOKENS = [
  'primary',
  'success',
  'danger',
  'warning',
  'info',
  'secondary',
  'purple',
  'teal',
  'pink',
  'indigo',
  'orange',
  'cyan',
] as const;

export type GroupColorToken = (typeof GROUP_COLOR_TOKENS)[number];

/** カラーピッカーに並べるプリセット（表示名付き） */
export const GROUP_COLOR_PALETTE: ReadonlyArray<{ token: GroupColorToken; name: string }> = [
  { token: 'primary', name: 'プライマリ' },
  { token: 'success', name: 'サクセス' },
  { token: 'danger', name: 'ダンジャー' },
  { token: 'warning', name: 'ワーニング' },
  { token: 'info', name: 'インフォ' },
  { token: 'secondary', name: 'セカンダリ' },
  { token: 'purple', name: 'パープル' },
  { token: 'teal', name: 'ティール' },
  { token: 'pink', name: 'ピンク' },
  { token: 'indigo', name: 'インディゴ' },
  { token: 'orange', name: 'オレンジ' },
  { token: 'cyan', name: 'シアン' },
];

/**
 * トークンに対応する hex（variables.css の --group-color-* と同じ値）。
 * セマンティック色（primary 等）はテーマ変数を参照するのでここには無い。
 * 旧形式（生の hex を保存していた）からトークンへ移行するときの逆引きに使う
 */
export const GROUP_COLOR_HEX: Partial<Record<GroupColorToken, string>> = {
  purple: '#9c27b0',
  teal: '#00897b',
  pink: '#e91e63',
  indigo: '#3f51b5',
  orange: '#ff5722',
  cyan: '#00bcd4',
};

/** 階層深さごとのデフォルト色 */
const DEFAULT_COLOR_BY_DEPTH: Record<number, GroupColorToken> = {
  0: 'primary',
  1: 'teal',
  2: 'secondary',
};

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isGroupColorToken(value: unknown): value is GroupColorToken {
  return typeof value === 'string' && (GROUP_COLOR_TOKENS as readonly string[]).includes(value);
}

/** ファイルに保存できる色か（トークンまたは 6 桁 hex） */
export function isValidGroupColor(value: unknown): value is string {
  return isGroupColorToken(value) || (typeof value === 'string' && HEX_COLOR_PATTERN.test(value));
}

export function getDefaultGroupColor(depth: number): GroupColorToken {
  return DEFAULT_COLOR_BY_DEPTH[depth] ?? 'primary';
}

/**
 * 保存値を CSS の色値に解決する
 *
 * トークン → `var(--group-color-<token>)`、hex → そのまま。
 * それ以外（未移行の旧形式 `var(--color-primary)` など）は CSS として解釈可能なものはそのまま返し、
 * 空や不明なものはプライマリに落とす。
 */
export function resolveGroupColorCss(value: string | undefined): string {
  if (isGroupColorToken(value)) {
    return `var(--group-color-${value})`;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return 'var(--group-color-primary)';
}
