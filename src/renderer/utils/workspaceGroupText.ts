import type { MixedChild, WorkspaceGroup, WorkspaceItem } from '@common/types';

/** 1 段の字下げ（全角の空白） */
const INDENT = '　';

/**
 * グループの右クリック「テキストでコピー」の本文を作る
 *
 * サブグループも、画面と同じ並び（アイテムとサブグループを混ぜた順。「すべて開く」と同じたどり方）で、
 * 見出し【名前】付きで含める。段が深くなるごとに全角の空白 1 つぶん字下げする。
 * アイテム・サブグループのあいだは空行で区切る。サブグループが無ければ従来と同じ形になる（A3-258）
 *
 * @param describe アイテムの 2 行目（パスや参照先など）
 */
export function formatGroupAsText(
  group: WorkspaceGroup,
  mixedChildrenByGroup: Record<string, MixedChild[]>,
  describe: (item: WorkspaceItem) => string
): string {
  const lines: string[] = [];
  const visited = new Set<string>();

  const walk = (current: WorkspaceGroup, depth: number): void => {
    // 壊れたデータで親子が輪になっていても止まる
    if (visited.has(current.id)) return;
    visited.add(current.id);
    lines.push(`${INDENT.repeat(depth)}【${current.displayName}】`);
    const children = mixedChildrenByGroup[current.id] || [];
    const pad = INDENT.repeat(depth + 1);
    children.forEach((child, index) => {
      if (child.kind === 'item') {
        lines.push(`${pad}■${child.item.displayName}`);
        lines.push(`${pad}${INDENT}${describe(child.item)}`);
      } else {
        walk(child.group, depth + 1);
      }
      if (index < children.length - 1) lines.push('');
    });
  };

  walk(group, 0);
  return lines.map((line) => `${line}\r\n`).join('');
}
