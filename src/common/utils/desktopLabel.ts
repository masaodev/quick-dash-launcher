/**
 * 仮想デスクトップの表示名
 *
 * 名前を付けたデスクトップは「2: 仕事」、名前が無ければ「2」。ウィンドウ検索のタブ・右クリックの移動先・
 * ウィンドウを選ぶ画面・セットの置き場所で同じ形にする（どれが同じデスクトップか分かるように）
 */

/** 名前が「デスクトップ 2」「Desktop 2」のように番号を繰り返しているだけか（全角・空白の違いは問わない） */
function isDefaultName(name: string, desktopNumber: number): boolean {
  const normalized = name.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  // 画面に出す文言ではなく、Windows が付けた（または利用者が同じ形で付けた）名前との照らし合わせ
  // eslint-disable-next-line no-restricted-syntax
  return normalized === `デスクトップ${desktopNumber}` || normalized === `desktop${desktopNumber}`;
}

/**
 * @param desktopNumber デスクトップ番号（1 から）
 * @param names デスクトップ番号から名前への表（名前の無い番号は undefined）
 */
export function desktopLabel(
  desktopNumber: number,
  names?: Readonly<Record<number, string | undefined>>
): string {
  const name = names?.[desktopNumber]?.trim();
  if (!name || isDefaultName(name, desktopNumber)) return String(desktopNumber);
  return `${desktopNumber}: ${name}`;
}
