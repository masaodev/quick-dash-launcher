import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { RegisterSetEntry, SetEntry, SetLaunchMode } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import { hasPlacementRect } from '@common/utils/placementMap';

import {
  catalogItemToEntry,
  describeSetEntry,
  entryWindowMatch,
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
import PlacementMinimap, { SetPlacementMap, type SetPlacementMapHandle } from './PlacementMinimap';
import { Button } from './ui';

interface SetEntriesEditorProps {
  entries: RegisterSetEntry[];
  launchMode?: SetLaunchMode;
  onChange: (patch: { setEntries?: RegisterSetEntry[]; setLaunchMode?: SetLaunchMode }) => void;
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
  /** セット全体の図（マウスが乗っている行の位置だけを濃くする。状態は図の中に持ち、一覧は描き直さない） */
  const mapRef = useRef<SetPlacementMapHandle>(null);
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
    // 動かすだけの行は動かすウィンドウの exe 名（パスの無い単一アイテムを指す行で、行に無ければアイテムのもの）
    if (view.moveOnly) {
      const match = entryWindowMatch(entry, view);
      return match?.processName ?? match?.title ?? '';
    }
    return view.path ?? '';
  };

  const setEntries = (next: RegisterSetEntry[]) => onChange({ setEntries: next });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= entries.length || from === to) return;
    const next = [...entries];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setEntries(next);
  };

  /** セット全体の図に描く位置（添字＝行。位置の無い行は描かれない）。番号は行の頭の番号と同じ */
  const mapPlacements = useMemo(
    () =>
      entries.map((entry, index) => ({
        placement: entry.placement ?? {},
        tag: String(index + 1),
      })),
    [entries]
  );
  const hasPlacement = entries.some((entry) => hasPlacementRect(entry.placement));

  return (
    <div className="form-group vertical-layout set-editor">
      <label>{t('set.editor.rows')}</label>
      {/* セット全体の図: 位置のある行を番号つきで 1 枚にまとめる */}
      {hasPlacement && screens.length > 0 && (
        <div className="set-editor-map">
          <SetPlacementMap
            ref={mapRef}
            screens={screens}
            placements={mapPlacements}
            label={t('set.editor.mapLabel')}
          />
          <span className="set-muted">{t('set.editor.mapHint')}</span>
        </div>
      )}
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
                onMouseEnter={hasPlacement ? () => mapRef.current?.highlight(index) : undefined}
                onMouseLeave={hasPlacement ? () => mapRef.current?.highlight(null) : undefined}
                onDragStart={(e) => {
                  // ドラッグ中は mouseleave が来ないので、ここで強調を外す
                  mapRef.current?.highlight(null);
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
                {hasPlacement && <span className="set-row-number">{index + 1}</span>}
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
                    {/* メインウィンドウへ登録するときに、ワークスペースのアイテムをパスに置き換えた行 */}
                    {entry.expandedFrom && (
                      <span
                        className="set-chip set-chip-open"
                        title={t('set.editor.expandedHint', { name: entry.expandedFrom })}
                      >
                        {t('set.editor.expanded')}
                      </span>
                    )}
                  </span>
                  {/* 2 段目はその行が開くもの。動かすだけの行は、印と動かすウィンドウの exe 名 */}
                  {view.moveOnly && !view.missing ? (
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
                {/* 図と位置の言葉は決まった幅の列に置き、行ごとに縦をそろえる（位置の無い行は空けておく） */}
                {hasPlacement && (
                  <>
                    <span className="set-row-map">
                      {place && hasPlacementRect(entry.placement) && (
                        <PlacementMinimap
                          screens={screens}
                          placements={[{ placement: entry.placement }]}
                          size="tiny"
                          label={place}
                          caption={place}
                        />
                      )}
                    </span>
                    <span className="set-row-place set-row-place-column" title={place}>
                      {place && `📍 ${place}`}
                    </span>
                  </>
                )}
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
      {/* 開き方の説明は「開き方」の真下に右寄せで小さく */}
      <span className="set-launch-hint">
        {t(launchMode === 'parallel' ? 'set.editor.hintParallel' : 'set.editor.hint')}
      </span>
      {/* ボタンの使い方と、動かすだけの行の注意は 1 行に 1 つ */}
      <ul className="set-editor-tips">
        <li>
          <b>{t('set.editor.addWindows')}</b>: {t('set.editor.tipAddWindows')}
        </li>
        <li>
          <b>{t('set.editor.updatePositions')}</b>: {t('set.editor.tipUpdatePositions')}
        </li>
        {/* 動かすだけの行があるときだけ、閉じていると動かないことと、開くものの足し方を添える */}
        {entries.some((entry) => {
          const view = describeSetEntry(entry, catalogById);
          return view.moveOnly && !view.missing;
        }) && (
          <li>
            {/* 印は文の中のタグ（<chip>）にし、語順は辞書の文に任せる */}
            <Trans
              i18nKey="set.editor.moveOnlyHint"
              components={{ chip: <span className="set-chip set-chip-open" /> }}
            />
          </li>
        )}
      </ul>

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
