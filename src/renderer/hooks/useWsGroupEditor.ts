import { useCallback, useState } from 'react';
import { isJsonWsGroupItem, type JsonWsGroupItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';
import { generateId } from '@common/utils/jsonParser';

import type { WsGroupFields } from '../components/WsGroupEditModal';

import type { AdminItemEditing } from './useAdminItemEditing';

interface UseWsGroupEditorOptions {
  editing: Pick<AdminItemEditing, 'addItem' | 'recordEdit'>;
  /** 新しい行を置くデータファイル（今のタブ） */
  dataFile: string;
  /** 新しい行を足す前に呼ぶ（足した行が絞り込みで隠れないように） */
  beforeAdd?: () => void;
}

/**
 * アイテム管理の WSグループのダイアログ（追加・編集）の開け閉めと、結果の反映
 * 結果は未保存の編集として反映する（保存は「変更を保存」）
 */
export function useWsGroupEditor({ editing, dataFile, beforeAdd }: UseWsGroupEditorOptions) {
  // null＝閉じている。target が無ければ新しく追加する
  const [state, setState] = useState<{ target?: EditableJsonItem } | null>(null);

  const open = useCallback((target?: EditableJsonItem) => setState({ target }), []);
  const close = useCallback(() => setState(null), []);

  const confirm = useCallback(
    (fields: WsGroupFields) => {
      const target = state?.target;
      if (target && isJsonWsGroupItem(target.item)) {
        const item: JsonWsGroupItem = { id: target.item.id, type: 'wsgroup', ...fields };
        editing.recordEdit({ ...target, item });
      } else {
        beforeAdd?.();
        editing.addItem(dataFile, {
          id: generateId(),
          type: 'wsgroup',
          ...fields,
          updatedAt: Date.now(),
        });
      }
      setState(null);
    },
    [state, editing, dataFile, beforeAdd]
  );

  const initial =
    state?.target && isJsonWsGroupItem(state.target.item) ? state.target.item : undefined;

  return { isOpen: state !== null, initial, open, close, confirm };
}
