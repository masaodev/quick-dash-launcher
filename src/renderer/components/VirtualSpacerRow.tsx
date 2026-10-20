import React from 'react';

interface VirtualSpacerRowProps {
  /** 埋める高さ（px）。0 以下なら何も出さない */
  height: number;
  colSpan: number;
}

/**
 * 仮想スクロールの表で、描画していない行の分の高さを埋める行（先頭・末尾に置く）
 */
const VirtualSpacerRow: React.FC<VirtualSpacerRowProps> = ({ height, colSpan }) => {
  if (height <= 0) return null;
  return (
    <tr className="virtual-spacer-row" aria-hidden="true">
      <td className="virtual-spacer-cell" colSpan={colSpan} style={{ height }} />
    </tr>
  );
};

export default VirtualSpacerRow;
