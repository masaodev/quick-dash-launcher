import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SetEntry, SetLaunchMode } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';

import {
  catalogItemToEntry,
  describeSetEntry,
  loadSetCatalog,
  placementText,
  SET_KIND_ICONS,
  type SetCatalogItem,
  type SetEntryView,
} from '../utils/setEditing';
import { logError } from '../utils/debug';
import '../styles/components/SetEditor.css';

import SetItemPickerModal from './SetItemPickerModal';
import SetRecordModal from './SetRecordModal';
import SetEntryDetailModal from './SetEntryDetailModal';
import { Button } from './ui';

interface SetEntriesEditorProps {
  entries: SetEntry[];
  launchMode?: SetLaunchMode;
  onChange: (patch: { setEntries?: SetEntry[]; setLaunchMode?: SetLaunchMode }) => void;
  /** セットを置くデータファイル（同じタブのアイテムを先に並べる）。ワークスペースなら undefined */
  currentFile?: string;
  /** ワークスペースのアイテムも選べるようにする（ワークスペースのセット） */
  includeWorkspace?: boolean;
  /** 編集中のアイテム自身の id（種類をセットに変えたとき、自分を行に選べないようにする） */
  selfId?: string;
  error?: string;
}

/**
 * セットの行の一覧（登録・編集画面の中身）
 *
 * アイテムの追加・今の位置の記録・行の詳細はここから開く。行はドラッグか上下のボタンで並べ替える
 */
const SetEntriesEditor: React.FC<SetEntriesEditorProps> = ({
  entries,
  launchMode,
  onChange,
  currentFile,
  includeWorkspace = false,
  selfId,
  error,
}) => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<SetCatalogItem[]>([]);
  const [screens, setScreens] = useState<ScreenArea[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** ドラッグ中に、落とす先になっている行 */
  const [overIndex, setOverIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSetCatalog(currentFile, includeWorkspace)
      .then(
        (items) => !cancelled && setCatalog(items.filter((item) => item.id !== selfId || !selfId))
      )
      .catch((e) => logError('セットに追加できるアイテムを読めませんでした:', e));
    window.electronAPI
      .getScreenAreas()
      .then((areas) => !cancelled && setScreens(areas))
      .catch((e) => logError('画面の情報を取得できませんでした:', e));
    return () => {
      cancelled = true;
    };
  }, [currentFile, includeWorkspace, selfId]);

  const catalogById = useMemo(() => {
    const map = new Map<string, SetCatalogItem>();
    for (const item of catalog) if (item.id) map.set(item.id, item);
    return map;
  }, [catalog]);

  const addedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of entries) {
      if (entry.itemId) keys.add(entry.itemId);
      else if (entry.open) keys.add(`dir:${entry.open.path}`);
    }
    return keys;
  }, [entries]);

  /** 行の 2 段目（開くもの。動かすだけの行は動かすウィンドウ。指す先が無い行は出さない） */
  const rowDetails = (entry: SetEntry, view: SetEntryView): string => {
    if (view.missing) return '';
    if (view.holding === 'none') {
      const target = entry.window?.processName ?? entry.window?.title ?? '';
      return target ? t('set.editor.moveOnlyDetails', { window: target }) : '';
    }
    return view.path ?? '';
  };

  const setEntries = (next: SetEntry[]) => onChange({ setEntries: next });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= entries.length || from === to) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEntries(next);
  };

  return (
    <div className="form-group vertical-layout set-editor">
      <label>{t('set.editor.rows')}</label>
      <div className="set-editor-rows">
        {entries.length === 0 ? (
          <div className="set-empty">{t('set.editor.empty')}</div>
        ) : (
          entries.map((entry, index) => {
            const view = describeSetEntry(entry, catalogById);
            const place = placementText(entry, screens);
            return (
              <div
                key={index}
                className={`set-editor-row${dragIndex === index ? ' dragging' : ''}${
                  dragIndex !== null && overIndex === index && dragIndex !== index
                    ? dragIndex < index
                      ? ' drop-below'
                      : ' drop-above'
                    : ''
                }${view.missing ? ' missing' : ''}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDragIndex(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overIndex !== index) setOverIndex(index);
                }}
                onDrop={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  move(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDoubleClick={(e) => {
                  // ▲ ▼ × を素早く押したときのダブルクリックで、詳細を開かない
                  if ((e.target as Element).closest('button')) return;
                  setDetailIndex(index);
                }}
              >
                <span className="set-drag-handle" aria-hidden>
                  ⠿
                </span>
                <span className="set-row-icon">
                  {view.icon ? <img src={view.icon} alt="" /> : (SET_KIND_ICONS[view.kind] ?? '📄')}
                </span>
                <span className="set-row-name">
                  <span className="set-row-title">
                    {/* 名前だけを省略し、印は長い名前でも隠さない */}
                    <span className="set-row-title-text" title={view.name}>
                      {view.name}
                    </span>
                    {view.missing ? (
                      <span className="set-chip set-chip-danger">{t('set.editor.missing')}</span>
                    ) : (
                      view.holding === 'none' && (
                        <span className="set-chip set-chip-open">{t('set.editor.moveOnly')}</span>
                      )
                    )}
                  </span>
                  {/* 2 段目はその行が開くもの（動かすだけの行は、動かすウィンドウ） */}
                  {rowDetails(entry, view) && (
                    <span className="set-row-details" title={rowDetails(entry, view)}>
                      {rowDetails(entry, view)}
                    </span>
                  )}
                </span>
                {place && <span className="set-row-place">📍 {place}</span>}
                <span className="set-row-actions">
                  <button
                    type="button"
                    className="set-icon-btn"
                    title={t('set.editor.moveUp')}
                    aria-label={t('set.editor.moveUp')}
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="set-icon-btn"
                    title={t('set.editor.moveDown')}
                    aria-label={t('set.editor.moveDown')}
                    disabled={index === entries.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="set-icon-btn"
                    title={t('set.editor.detail')}
                    aria-label={t('set.editor.detail')}
                    onClick={() => setDetailIndex(index)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="close-btn close-btn-sm close-btn-danger"
                    title={t('set.editor.remove')}
                    aria-label={t('set.editor.remove')}
                    onClick={() => setEntries(entries.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
      <div className="set-editor-footer">
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
          {t('set.editor.addItems')}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setRecordOpen(true)}>
          {t('set.editor.record')}
        </Button>
        <span className="set-launch-mode">
          {t('set.editor.launchMode')}
          <select
            aria-label={t('set.editor.launchMode')}
            value={launchMode ?? 'sequential'}
            onChange={(e) =>
              onChange({
                setLaunchMode: e.target.value === 'parallel' ? 'parallel' : undefined,
              })
            }
          >
            <option value="sequential">{t('set.editor.sequential')}</option>
            <option value="parallel">{t('set.editor.parallel')}</option>
          </select>
        </span>
      </div>
      {error && <span className="error-message">{error}</span>}
      <small>{t(launchMode === 'parallel' ? 'set.editor.hintParallel' : 'set.editor.hint')}</small>

      <SetItemPickerModal
        isOpen={pickerOpen}
        catalog={catalog}
        addedKeys={addedKeys}
        onClose={() => setPickerOpen(false)}
        onAdd={(items) => setEntries([...entries, ...items.map(catalogItemToEntry)])}
      />
      <SetRecordModal
        isOpen={recordOpen}
        entries={entries}
        catalog={catalogById}
        screens={screens}
        onClose={() => setRecordOpen(false)}
        onConfirm={setEntries}
      />
      <SetEntryDetailModal
        entry={detailIndex !== null ? (entries[detailIndex] ?? null) : null}
        catalog={catalogById}
        screens={screens}
        onClose={() => setDetailIndex(null)}
        onChange={(entry) => {
          if (detailIndex === null) return;
          setEntries(entries.map((e, i) => (i === detailIndex ? entry : e)));
        }}
      />
    </div>
  );
};

export default SetEntriesEditor;
