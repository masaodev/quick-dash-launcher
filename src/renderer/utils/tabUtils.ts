/**
 * タブカウントに基づいてCSSクラス名を取得
 * @param count アイテム数
 * @returns 'zero' | 'has-count'
 */
export function getCountClass(count: number): 'zero' | 'has-count' {
  return count === 0 ? 'zero' : 'has-count';
}
