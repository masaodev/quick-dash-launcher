/**
 * CSV の読み書き（RFC 4180。区切りはカンマ、改行は CRLF で書き、CRLF・LF のどちらも読む）
 *
 * カンマ・引用符・改行を含む値は引用符で囲み、引用符は 2 つ重ねる
 */

function quote(value: string): string {
  return /[",\r\n]/.test(value) || /^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(quote).join(',')).join('\r\n') + '\r\n';
}

export interface ParsedCsv {
  rows: string[][];
  /** 引用符が閉じないまま終わったとき、その引用符を開いた行の番号（1 始まり） */
  unclosedQuoteRow?: number;
}

/** CSV を行の配列にする。先頭の BOM は除く。最後の改行の後の空行は捨てる */
export function parseCsv(text: string): string[][] {
  return parseCsvDetailed(text).rows;
}

/** parseCsv と同じに読み、引用符の閉じ忘れも返す（閉じ忘れると、その後ろが 1 つのセルに入ってしまう） */
export function parseCsvDetailed(text: string): ParsedCsv {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let quoteRow = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      quoteRow = rows.length + 1;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return inQuotes ? { rows, unclosedQuoteRow: quoteRow } : { rows };
}
