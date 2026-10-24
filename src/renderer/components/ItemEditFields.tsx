import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import type { ClipboardFormat, DataFileTab, RegisterItem, SetEntry } from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { isPathlessItem } from '@common/utils/itemWindowConversion';
import { canSetRunAsAdmin } from '@common/utils/runAsAdmin';

import { debugLog } from '../utils/debug';
import { describeDirOptionsShort } from '../utils/editableItemOperations';

import DirOptionsEditor from './DirOptionsEditor';
import DirPreviewPanel from './DirPreviewPanel';
import ItemWindowSwitchEditor from './ItemWindowSwitchEditor';
import CustomIconEditor from './CustomIconEditor';
import ItemConverterMenu from './ItemConverterMenu';
import IconFetchButton from './IconFetchButton';
import PathPickerButton from './PathPickerButton';
import ClipboardItemEditor from './ClipboardItemEditor';
import SetEntriesEditor from './SetEntriesEditor';

/** 種別ごとの絵文字（登録画面の見出しに添える） */
export const ITEM_CATEGORY_ICONS: Readonly<Record<RegisterItem['itemCategory'], string>> = {
  item: '📄',
  dir: '🗂️',
  set: '📦',
  clipboard: '📋',
};

/** 行の無いセットに渡す空の配列（描き直しのたびに新しい配列を渡すと、位置を更新の画面が選んだ内容をやり直す） */
const NO_SET_ENTRIES: SetEntry[] = [];

/** フォームの 1 項目に入れられる値 */
export type ItemFieldValue =
  string | boolean | number | RegisterItem['dirOptions'] | ClipboardFormat[] | SetEntry[];

export interface ItemEditFieldErrors {
  displayName?: string;
  path?: string;
  setEntries?: string;
}

function getDisplayNamePlaceholder(itemCategory: string): string {
  switch (itemCategory) {
    case 'set':
      return i18next.t('register.placeholders.set');
    case 'clipboard':
      return i18next.t('register.placeholders.clipboard');
    default:
      return i18next.t('register.placeholders.item');
  }
}

interface ItemEditFieldsProps {
  item: RegisterItem;
  errors: ItemEditFieldErrors | undefined;
  onFieldChange: (field: keyof RegisterItem, value: ItemFieldValue) => void;
  onUpdate: (fields: Partial<RegisterItem>) => void;
  /** パス欄を離れたとき。「選択」で選んだときは選んだパスを渡す */
  onPathBlur: (pickedPath?: string) => void;
  onFetchIcon: () => void;
  /** 保存先（タブ・データファイル）の選択。省略すると出さない（ワークスペースは保存先が決まっている） */
  placement?: {
    availableTabs: DataFileTab[];
    dataFileLabels: Record<string, string>;
    onTargetTabChange: (targetTab: string) => void;
  };
  /** 保存先とアイコンを呼び出し側（登録画面の上の帯・見出し）で出すので、ここでは出さない */
  headerInParent?: boolean;
  /** 種別を表示だけにする（ワークスペースのアイテムは種別を変えない） */
  typeLocked?: boolean;
  /** 種別に「フォルダ取込」を出す（ワークスペースの新規ではデータファイル向けの種別なので出さない） */
  allowFolderImport?: boolean;
  /** セットの行の追加で、ワークスペースのアイテムも選べるようにする（ワークスペースのセット） */
  setIncludesWorkspace?: boolean;
  /** 編集中のアイテム自身の id（種類をセットに変えたとき、自分を行に選べないようにする） */
  selfId?: string;
  iconFetchLoading: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  customIconPreview: string | undefined;
  onCustomIconSelect: () => void;
  onCustomIconDelete: () => void;
  onClipboardError: (message: string) => void;
  showSeparator: boolean;
}

/**
 * アイテム 1 件分の編集欄（登録・編集画面の中身）。
 * 状態は持たず、読み込み・保存は呼び出し側に任せる
 */
const ItemEditFields: React.FC<ItemEditFieldsProps> = ({
  item,
  errors,
  onFieldChange,
  onUpdate,
  onPathBlur,
  onFetchIcon,
  placement,
  headerInParent = false,
  typeLocked = false,
  allowFolderImport = true,
  setIncludesWorkspace = false,
  selfId,
  iconFetchLoading,
  optionsOpen,
  onToggleOptions,
  customIconPreview,
  onCustomIconSelect,
  onCustomIconDelete,
  onClipboardError,
  showSeparator,
}) => {
  const { t } = useTranslation();
  // 変換で書き換えた欄を一瞬光らせる
  const [convertedFlash, setConvertedFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const handleConvert = (converted: { path: string; args: string }) => {
    // 種別はパスから決まる（ブラウザの exe ならアプリ）。パス欄を離れたときの判定を待たずに合わせる。
    // 前の種別で読み込んだアイコン（ファビコンなど）は合わなくなるので外す
    onUpdate({
      path: converted.path,
      args: converted.args || undefined,
      type: detectItemTypeSync(converted.path),
      icon: undefined,
    });
    // 引数は普段閉じているオプションの中にあるので、書き換えたら開いて見せる
    if (converted.args && !optionsOpen) onToggleOptions();
    setConvertedFlash(true);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setConvertedFlash(false), 800);
  };
  // 選んだパスを入れ、パス欄を離れたときと同じく種別を決め直す
  const handlePick = (pickedPath: string) => {
    onFieldChange('path', pickedPath);
    onPathBlur(pickedPath);
  };

  // メモはあまり使わないので畳んでおく。開くかを選ぶまでは、メモが書いてあれば開く（編集でメモに気づけるように）
  const [memoOpenChoice, setMemoOpenChoice] = useState<boolean | null>(null);
  const memoOpen = memoOpenChoice ?? !!item.memo?.trim();
  const memoFirstLine = item.memo?.trim().split(/\r?\n/)[0] ?? '';
  // 「常に管理者として実行」はアプリ（exe・.lnk・.bat/.cmd など）の単一アイテムだけ
  const canRunAsAdmin = item.itemCategory === 'item' && canSetRunAsAdmin(item.path);
  const optionsSummary =
    item.itemCategory === 'dir' && item.dirOptions
      ? describeDirOptionsShort(item.dirOptions)
      : canRunAsAdmin && item.runAsAdmin
        ? t('register.runAsAdminSummary')
        : '';

  const flashClass = convertedFlash ? ' item-converted-flash' : '';
  const selectedTab = placement?.availableTabs.find((tab) => tab.files.includes(item.targetTab));
  const hasPath = item.itemCategory !== 'set' && item.itemCategory !== 'clipboard';

  const customIconEditor = (
    <CustomIconEditor
      customIconPreview={customIconPreview}
      onSelectClick={onCustomIconSelect}
      onDeleteClick={onCustomIconDelete}
    />
  );

  return (
    <div className="register-item">
      {!headerInParent && (
        <div className="item-header">
          {item.icon && <img src={item.icon} alt="" className="item-icon" />}
        </div>
      )}

      {placement && !headerInParent && (
        <div className="form-row">
          <div className="form-group">
            <label>{t('register.targetTab')}</label>
            <select
              value={item.targetTab}
              onChange={(e) => placement.onTargetTabChange(e.target.value)}
            >
              {placement.availableTabs.map((tab) => (
                <option key={tab.files[0]} value={tab.files[0]}>
                  {tab.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTab && selectedTab.files.length > 1 && (
            <div className="form-group">
              <label>{t('register.targetFile')}</label>
              <select
                value={item.targetFile || selectedTab.files[0]}
                onChange={(e) => onFieldChange('targetFile', e.target.value)}
              >
                {selectedTab.files.map((file) => (
                  <option key={file} value={file}>
                    {placement.dataFileLabels[file] || file}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="form-group register-kind">
        <label>{t('register.type')}</label>
        <select
          value={item.itemCategory}
          disabled={typeLocked}
          onChange={(e) =>
            onFieldChange('itemCategory', e.target.value as RegisterItem['itemCategory'])
          }
        >
          <option value="item">{t('register.types.item')}</option>
          {allowFolderImport && <option value="dir">{t('register.types.dir')}</option>}
          <option value="set">{t('register.types.set')}</option>
          <option value="clipboard">{t('register.types.clipboard')}</option>
        </select>
        <div className="register-kind-desc">
          <span className="register-kind-desc-main">
            {t(`register.typeDescriptions.${item.itemCategory}.main`)}
          </span>
          <span className="register-kind-desc-sub">
            {t(`register.typeDescriptions.${item.itemCategory}.sub`)}
          </span>
        </div>
      </div>

      {item.itemCategory !== 'dir' && (
        <div className="form-group">
          <label>{t('register.displayName')}</label>
          <input
            type="text"
            value={item.displayName}
            className={errors?.displayName ? 'error' : ''}
            onChange={(e) => onFieldChange('displayName', e.target.value)}
            placeholder={getDisplayNamePlaceholder(item.itemCategory)}
          />
          {errors?.displayName && <span className="error-message">{errors.displayName}</span>}
        </div>
      )}

      {hasPath && (
        <div className="form-group path-input-group">
          <label>{t('register.path')}</label>
          <input
            type="text"
            value={item.path}
            className={(errors?.path ? 'error' : '') + flashClass}
            onChange={(e) => onFieldChange('path', e.target.value)}
            onBlur={() => onPathBlur()}
            placeholder={
              item.itemCategory === 'dir'
                ? t('register.dirPathPlaceholder')
                : t('register.pathPlaceholder')
            }
          />
          <PathPickerButton
            mode={item.itemCategory === 'dir' ? 'folder' : 'any'}
            currentPath={item.path}
            onPick={handlePick}
          />
          {/* フォルダ取込はアイコンを取らず変換もしない（いつも押せない）ので出さない */}
          {item.itemCategory !== 'dir' && (
            <IconFetchButton
              path={item.path}
              loading={iconFetchLoading}
              onFetch={() => onFetchIcon()}
              itemType={item.type}
            />
          )}
          {item.itemCategory !== 'dir' && (
            <ItemConverterMenu path={item.path} args={item.args} onConvert={handleConvert} />
          )}
          {errors?.path && <span className="error-message">{errors.path}</span>}
          {/* パスの無い単一アイテム: 開くものが無く、開いているウィンドウへ切り替えるだけと添える */}
          {!errors?.path && item.itemCategory === 'item' && isPathlessItem(item) && (
            <small className="path-pathless-note">{t('register.windowSwitch.pathlessNote')}</small>
          )}
        </div>
      )}

      {item.itemCategory === 'set' && (
        <SetEntriesEditor
          entries={item.setEntries ?? NO_SET_ENTRIES}
          launchMode={item.setLaunchMode}
          onChange={(patch) => onUpdate(patch)}
          currentFile={setIncludesWorkspace ? undefined : item.targetFile || item.targetTab}
          includeWorkspace={setIncludesWorkspace}
          selfId={selfId}
          error={errors?.setEntries}
        />
      )}

      {(item.itemCategory === 'item' || item.itemCategory === 'dir') && (
        <div className="options-section">
          <button
            type="button"
            className="options-toggle"
            aria-expanded={optionsOpen}
            onClick={onToggleOptions}
          >
            <span className={`toggle-icon${optionsOpen ? ' open' : ''}`}>▶</span>
            <span>
              {item.itemCategory === 'item' ? t('register.itemOptions') : t('register.dirOptions')}
            </span>
            {/* たたんでいても、今効いているフォルダ取込の設定・管理者として実行が分かるように見出しの横に出す */}
            {optionsSummary && (
              <span className="options-toggle-summary" data-testid="options-summary">
                {optionsSummary}
              </span>
            )}
          </button>

          {optionsOpen && (
            <div className="options-content">
              {item.itemCategory === 'item' && (
                <>
                  <div className="form-group">
                    <label>{t('register.args')}</label>
                    <input
                      type="text"
                      value={item.args || ''}
                      className={flashClass.trim()}
                      onChange={(e) => onFieldChange('args', e.target.value)}
                      placeholder={t('register.argsPlaceholder')}
                    />
                  </div>
                  {canRunAsAdmin && (
                    <div className="form-group">
                      <label className="register-check">
                        <input
                          type="checkbox"
                          checked={item.runAsAdmin === true}
                          onChange={(e) =>
                            onUpdate({ runAsAdmin: e.target.checked ? true : undefined })
                          }
                        />
                        {t('register.runAsAdmin')}
                      </label>
                    </div>
                  )}
                  {customIconEditor}
                </>
              )}

              {item.itemCategory === 'dir' && (
                <DirOptionsEditor
                  dirOptions={item.dirOptions}
                  onChange={(newDirOptions) => onFieldChange('dirOptions', newDirOptions)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {item.itemCategory === 'dir' && (
        <DirPreviewPanel path={item.path} dirOptions={item.dirOptions} />
      )}

      {item.itemCategory === 'item' && (
        <ItemWindowSwitchEditor
          value={item}
          itemType={item.type}
          opensSomething={item.path.trim() !== ''}
          onChange={(patch) => onUpdate(patch)}
        />
      )}

      {item.itemCategory === 'clipboard' && (
        <ClipboardItemEditor
          item={item}
          onUpdate={onUpdate}
          onError={(error) => {
            debugLog('クリップボードキャプチャエラー:', error);
            onClipboardError(error);
          }}
          error={errors?.path}
        />
      )}

      {(item.itemCategory === 'clipboard' || item.itemCategory === 'set') && customIconEditor}

      <div className="options-section memo-section">
        <button
          type="button"
          className="options-toggle"
          aria-expanded={memoOpen}
          onClick={() => setMemoOpenChoice(!memoOpen)}
        >
          <span className={`toggle-icon${memoOpen ? ' open' : ''}`}>▶</span>
          <span>{t('register.note')}</span>
          {!memoOpen && memoFirstLine && (
            <span className="options-toggle-summary memo-summary">{memoFirstLine}</span>
          )}
        </button>

        {memoOpen && (
          <div className="options-content">
            <textarea
              value={item.memo || ''}
              onChange={(e) => onFieldChange('memo', e.target.value)}
              placeholder={t('register.notePlaceholder')}
              aria-label={t('register.note')}
              rows={3}
              className="memo-textarea"
            />
          </div>
        )}
      </div>

      {showSeparator && <hr />}
    </div>
  );
};

export default ItemEditFields;
