import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SetEntry, SetLaunchMode } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';

import {
  catalogItemToEntry,
  describeSetEntry,
  loadSetCatalog,
  loadSetEntryIcons,
  placementText,
  SET_KIND_ICONS,
  type SetCatalogItem,
  type SetEntryView,
} from '../utils/setEditing';
import { logError } from '../utils/debug';
import '../styles/components/SetEditor.css';

import SetItemPickerModal from './SetItemPickerModal';
import SetAddWindowsModal from './SetAddWindowsModal';
import SetUpdatePositionsModal from './SetUpdatePositionsModal';
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
 * アイテムの追加・ウィンドウの追加・位置の更新・行の詳細はここから開く。行はドラッグか上下のボタンで並べ替える
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
  /** 行が自分で持つパスのアイコン（アイテムを指す行は catalog のアイコンを使う） */
  const [ownIcons, setOwnIcons] = useState<ReadonlyMap<string, string>>(new Map());
  const [screens, setScreens] = useState<ScreenArea[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addWindowsOpen, setAddWindowsOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** ドラッグ中に、落とす先になっている行 */
  const [overIndex, setOverIndex] = useState<number | null>(null);
  /** 仮想デスクトップの名前（置き場所の表示に添える） */
  const [desktopNames, setDesktopNames] = useState<Record<number, string | undefined>>({});

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
    window.electronAPI
      .getVirtualDesktopInfo()
      .then((info) => !cancelled && setDesktopNames(info.desktopNames ?? {}))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentFile, includeWorkspace, selfId]);

  // 並べ替えでは読み直さないよう、行が持つパスの組が変わったときだけ読む
  const ownPathsKey = useMemo(
    () =>
      [...new Set(entries.flatMap((e) => (!e.itemId && e.open?.path ? [e.open.path] : [])))]
        .sort()
        .join('\n'),
    [entries]
  );
  useEffect(() => {
    if (!ownPathsKey) return;
    let cancelled = false;
    loadSetEntryIcons(ownPathsKey.split('\n').map((path) => ({ open: { path } })))
      .then((icons) => !cancelled && setOwnIcons(icons))
      .catch((e) => logError('セットの行のアイコンを読めませんでした:', e));
    return () => {
      cancelled = true;
    };
  }, [ownPathsKey]);

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

  /** 行の 2 段目の文字（開くもの。動かすだけの行は動かすウィンドウの exe 名。指す先が無い行は出さない） */
  const rowDetails = (entry: SetEntry, view: SetEntryView): string => {
    if (view.missing) return '';
    if (view.holding === 'none') return entry.window?.processName ?? entry.window?.title ?? '';
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
            const view = describeSetEntry(entry, catalogById, ownIcons);
            const place = placementText(entry, screens, desktopNames);
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
                    {view.missing && (
                      <span className="set-chip set-chip-danger">{t('set.editor.missing')}</span>
                    )}
                  </span>
                  {/* 2 段目はその行が開くもの。動かすだけの行は、印と動かすウィンドウの exe 名 */}
                  {view.holding === 'none' && !view.missing ? (
                    <span className="set-row-details" title={rowDetails(entry, view)}>
                      <span className="set-chip set-chip-open">{t('set.editor.moveOnly')}</span>
                      {rowDetails(entry, view)}
                    </span>
                  ) : (
                    rowDetails(entry, view) && (
                      <span className="set-row-details" title={rowDetails(entry, view)}>
                        {rowDetails(entry, view)}
                      </span>
                    )
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
        <Button variant="secondary" size="sm" onClick={() => setAddWindowsOpen(true)}>
          {t('set.editor.addWindows')}
        </Button>
        {/* 更新する行が無いときは押せない */}
        <Button
          variant="secondary"
          size="sm"
          disabled={entries.length === 0}
          onClick={() => setUpdateOpen(true)}
        >
          {t('set.editor.updatePositions')}
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
      <small>
        {t(launchMode === 'parallel' ? 'set.editor.hintParallel' : 'set.editor.hint')}
        {/* 動かすだけの行があるときだけ、閉じていると動かないことと、開くものの足し方を添える */}
        {entries.some((entry) => {
          const view = describeSetEntry(entry, catalogById);
          return view.holding === 'none' && !view.missing;
        }) && t('set.editor.moveOnlyHint')}
      </small>

      <SetItemPickerModal
        isOpen={pickerOpen}
        catalog={catalog}
        addedKeys={addedKeys}
        onClose={() => setPickerOpen(false)}
        onAdd={(items) => setEntries([...entries, ...items.map(catalogItemToEntry)])}
      />
      <SetAddWindowsModal
        isOpen={addWindowsOpen}
        entries={entries}
        catalog={catalogById}
        screens={screens}
        onClose={() => setAddWindowsOpen(false)}
        onAdd={(added) => setEntries([...entries, ...added])}
      />
      <SetUpdatePositionsModal
        isOpen={updateOpen}
        entries={entries}
        catalog={catalogById}
        ownIcons={ownIcons}
        screens={screens}
        onClose={() => setUpdateOpen(false)}
        onConfirm={setEntries}
      />
      <SetEntryDetailModal
        entry={detailIndex !== null ? (entries[detailIndex] ?? null) : null}
        catalog={catalogById}
        catalogList={catalog}
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
