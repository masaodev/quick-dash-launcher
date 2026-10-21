import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { AdminItemColumnsSetting } from '@common/types';

import {
  ADMIN_ITEM_COLUMNS,
  EMPTY_COLUMNS_SETTING,
  columnWidthOf,
  isColumnVisible,
  normalizeColumnsSetting,
  type AdminItemColumnDef,
  type AdminItemColumnId,
} from '../utils/adminItemColumns';
import { logError } from '../utils/debug';

/** 見出しに出す列と、その幅（ドラッグで変えていなければ null） */
export interface VisibleAdminItemColumn {
  def: AdminItemColumnDef;
  width: number | null;
}

/**
 * アイテム管理の一覧の列の表示と幅（設定 adminItemColumns に保存する）
 *
 * 幅はドラッグ中は画面だけで変え、離したときに保存する
 */
export function useAdminItemColumns() {
  const [setting, setSetting] = useState<AdminItemColumnsSetting>(EMPTY_COLUMNS_SETTING);
  const settingRef = useRef(setting);
  settingRef.current = setting;
  /** ドラッグ中の列と幅（離すまで保存しない） */
  const [dragging, setDragging] = useState<{ id: AdminItemColumnId; width: number } | null>(null);
  const dragRef = useRef<{ id: AdminItemColumnId; startX: number; startWidth: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      .getSettings()
      .then((settings) => {
        if (!cancelled) setSetting(normalizeColumnsSetting(settings.adminItemColumns));
      })
      .catch((error) => logError('列の設定を読めませんでした:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback((next: AdminItemColumnsSetting) => {
    setSetting(next);
    window.electronAPI
      .setMultipleSettings({ adminItemColumns: next })
      .catch((error) => logError('列の設定を保存できませんでした:', error));
  }, []);

  const visibleColumns = useMemo<VisibleAdminItemColumn[]>(
    () =>
      ADMIN_ITEM_COLUMNS.filter((def) => isColumnVisible(def, setting)).map((def) => ({
        def,
        width:
          dragging?.id === def.id
            ? Math.max(def.minWidth ?? 0, dragging.width)
            : columnWidthOf(def, setting),
      })),
    [setting, dragging]
  );

  /** 列の出し入れ（隠せない列は無視する） */
  const setColumnVisible = useCallback(
    (id: AdminItemColumnId, visible: boolean) => {
      const def = ADMIN_ITEM_COLUMNS.find((c) => c.id === id);
      if (!def?.hideable) return;
      const current = settingRef.current;
      save({ ...current, visible: { ...current.visible, [id]: visible } });
    },
    [save]
  );

  /** すべての列を既定の表示と幅に戻す */
  const resetColumns = useCallback(() => save(EMPTY_COLUMNS_SETTING), [save]);

  /** 見出しの右端のつまみを押したとき。th は今の幅を測るのに使う */
  const startResize = useCallback(
    (e: ReactMouseEvent, id: AdminItemColumnId, th: HTMLTableCellElement | null) => {
      e.preventDefault();
      e.stopPropagation();
      if (!th) return;
      const startWidth = th.getBoundingClientRect().width;
      dragRef.current = { id, startX: e.clientX, startWidth };
      setDragging({ id, width: startWidth });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setDragging({ id: drag.id, width: drag.startWidth + e.clientX - drag.startX });
    };
    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(null);
      const def = ADMIN_ITEM_COLUMNS.find((c) => c.id === drag.id);
      const width = Math.round(
        Math.max(def?.minWidth ?? 0, drag.startWidth + e.clientX - drag.startX)
      );
      const current = settingRef.current;
      if (current.widths[drag.id] === width) return;
      save({ ...current, widths: { ...current.widths, [drag.id]: width } });
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [save]);

  return { setting, visibleColumns, setColumnVisible, resetColumns, startResize };
}

export type AdminItemColumns = ReturnType<typeof useAdminItemColumns>;
