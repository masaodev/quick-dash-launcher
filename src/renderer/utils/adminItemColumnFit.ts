import type { AdminItemColumnDef } from './adminItemColumns';

/** 中身に合わせるときの幅の上限（長い URL・メモ 1 件に引っぱられすぎないように） */
export const COLUMN_FIT_MAX_WIDTH = 600;

/** 測る間だけセルに付けるクラス（折り返さず、… で切らない。AdminItemManager.css） */
const MEASURING_CLASS = 'column-fit-measuring';

/**
 * 列の中身がすべて 1 行で収まる幅を測る（列の境目のダブルクリック。A3-184）
 *
 * 呼ぶ前に、測りたい行をすべて描いておく（一覧は見えている行だけ描くので、一覧側で全部の行を描いてから呼ぶ）。
 * 列をいったん最小幅にして、セルを「折り返さない・切らない」状態にし、はみ出した分を含めた幅（scrollWidth）を読む。
 * 見出しの文字より狭くはせず、上限（COLUMN_FIT_MAX_WIDTH）より広くはしない。測れないときは null
 */
export function measureColumnFitWidth(
  table: HTMLTableElement,
  def: AdminItemColumnDef
): number | null {
  if (def.minWidth === undefined) return null;
  const th = table.querySelector<HTMLTableCellElement>(`thead th[data-column-id="${def.id}"]`);
  if (!th) return null;
  const cells = Array.from(
    table.querySelectorAll<HTMLTableCellElement>(`tbody td.${def.className}`)
  );

  const savedHeaderStyle = th.style.cssText;
  const minWidth = `${def.minWidth}px`;
  th.style.width = minWidth;
  th.style.minWidth = minWidth;
  th.style.maxWidth = minWidth;
  cells.forEach((cell) => cell.classList.add(MEASURING_CLASS));
  try {
    // 見出しは並べ替えの印・絞り込みの ▾ まで含めた幅
    let width = th.scrollWidth;
    for (const cell of cells) {
      // scrollWidth は左の余白と中身を含み、はみ出したときは右の余白を含まないので足す
      const paddingRight = parseFloat(getComputedStyle(cell).paddingRight) || 0;
      width = Math.max(width, cell.scrollWidth + paddingRight);
    }
    // 境界線の 1px と、端数の切り上げ
    return Math.min(COLUMN_FIT_MAX_WIDTH, Math.max(def.minWidth, Math.ceil(width) + 1));
  } finally {
    cells.forEach((cell) => cell.classList.remove(MEASURING_CLASS));
    th.style.cssText = savedHeaderStyle;
  }
}
