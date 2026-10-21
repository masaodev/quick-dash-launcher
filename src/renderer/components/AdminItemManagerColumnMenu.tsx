import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminItemColumnsSetting } from '@common/types';

import {
  ADMIN_ITEM_COLUMNS,
  isColumnVisible,
  type AdminItemColumnId,
} from '../utils/adminItemColumns';
import { usePopoverPosition } from '../hooks/usePopoverPosition';

interface AdminItemManagerColumnMenuProps {
  /** 画面上の位置（見出しを右クリックした所） */
  position: { x: number; y: number };
  setting: AdminItemColumnsSetting;
  onToggle: (id: AdminItemColumnId, visible: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * 見出しの右クリックで出す列のメニュー（列の出し入れと、表示・幅を既定に戻す）
 *
 * 外側のクリックと Escape で閉じる。隠せない列（名前・パスと引数）は出さない
 */
const AdminItemManagerColumnMenu: React.FC<AdminItemManagerColumnMenuProps> = ({
  position,
  setting,
  onToggle,
  onReset,
  onClose,
}) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const popoverStyle = usePopoverPosition(ref, position);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="admin-popover" data-testid="admin-column-menu" style={popoverStyle}>
      <div className="dropdown-menu" role="menu">
        <div className="dropdown-section-label">{t('itemManager.columnMenu.title')}</div>
        {ADMIN_ITEM_COLUMNS.filter((def) => def.hideable).map((def) => {
          const visible = isColumnVisible(def, setting);
          return (
            <button
              key={def.id}
              className="dropdown-item"
              role="menuitemcheckbox"
              aria-checked={visible}
              onClick={() => onToggle(def.id, !visible)}
            >
              {visible ? '☑' : '☐'} {t(`itemManager.table.${def.id}`)}
            </button>
          );
        })}
        <div className="dropdown-separator" />
        <button
          className="dropdown-item"
          onClick={() => {
            onReset();
            onClose();
          }}
        >
          {t('itemManager.columnMenu.reset')}
        </button>
      </div>
    </div>
  );
};

export default AdminItemManagerColumnMenu;
