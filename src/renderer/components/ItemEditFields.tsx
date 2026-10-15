import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import type {
  ClipboardFormat,
  DataFileTab,
  RegisterItem,
  SetEntry,
  WindowConfig,
  WindowInfo,
} from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { debugLog } from '../utils/debug';
import { toWindowConfig, toWindowOperationConfig } from '../utils/windowFilter';

import DirOptionsEditor from './DirOptionsEditor';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import ItemConverterMenu from './ItemConverterMenu';
import IconFetchButton from './IconFetchButton';
import ClipboardItemEditor from './ClipboardItemEditor';
import SetEntriesEditor from './SetEntriesEditor';

/** 行の無いセットに渡す空の配列（描き直しのたびに新しい配列を渡すと、記録の画面が選んだ内容をやり直す） */
const NO_SET_ENTRIES: SetEntry[] = [];

/** フォームの 1 項目に入れられる値 */
export type ItemFieldValue =
  | string
  | boolean
  | number
  | RegisterItem['dirOptions']
  | WindowConfig
  | RegisterItem['windowOperationConfig']
  | ClipboardFormat[]
  | SetEntry[];

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
  onPathBlur: () => void;
  onFetchIcon: () => void;
  /** 保存先（タブ・データファイル）の選択。省略すると出さない（ワークスペースは保存先が決まっている） */
  placement?: {
    availableTabs: DataFileTab[];
    dataFileLabels: Record<string, string>;
    onTargetTabChange: (targetTab: string) => void;
  };
  /** 種別を表示だけにする（ワークスペースのアイテムは種別を変えない） */
  typeLocked?: boolean;
  /** セットの行の追加で、ワークスペースのアイテムも選べるようにする（ワークスペースのセット） */
  setIncludesWorkspace?: boolean;
  /** 編集中のアイテム自身の id（種類をセットに変えたとき、自分を行に選べないようにする） */
  selfId?: string;
  /** ドロップしたファイルから登録するときはパスを書き換えさせない */
  isPathReadOnly: boolean;
  iconFetchLoading: boolean;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  customIconPreview: string | undefined;
  onCustomIconSelect: () => void;
  onCustomIconDelete: () => void;
  onOpenWindowSelector: () => void;
  onFetchFromWindow: () => Promise<WindowInfo | null>;
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
  typeLocked = false,
  setIncludesWorkspace = false,
  selfId,
  isPathReadOnly,
  iconFetchLoading,
  optionsOpen,
  onToggleOptions,
  customIconPreview,
  onCustomIconSelect,
  onCustomIconDelete,
  onOpenWindowSelector,
  onFetchFromWindow,
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
  const flashClass = convertedFlash ? ' item-converted-flash' : '';
  const selectedTab = placement?.availableTabs.find((tab) => tab.files.includes(item.targetTab));
  const hasPath =
    item.itemCategory !== 'set' &&
    item.itemCategory !== 'window' &&
    item.itemCategory !== 'clipboard';

  const customIconEditor = (
    <CustomIconEditor
      customIconPreview={customIconPreview}
      onSelectClick={onCustomIconSelect}
      onDeleteClick={onCustomIconDelete}
    />
  );

  return (
    <div className="register-item">
      <div className="item-header">
        {item.icon && <img src={item.icon} alt="" className="item-icon" />}
      </div>

      {placement && (
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

      <div className="form-group">
        <label>{t('register.type')}</label>
        <select
          value={item.itemCategory}
          disabled={typeLocked}
          onChange={(e) =>
            onFieldChange('itemCategory', e.target.value as RegisterItem['itemCategory'])
          }
        >
          <option value="item">{t('register.types.item')}</option>
          <option value="dir">{t('register.types.dir')}</option>
          <option value="set">{t('register.types.set')}</option>
          <option value="window">{t('register.types.window')}</option>
          <option value="clipboard">{t('register.types.clipboard')}</option>
        </select>
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
            readOnly={isPathReadOnly}
            className={(errors?.path ? 'error' : isPathReadOnly ? 'readonly' : '') + flashClass}
            onChange={(e) => onFieldChange('path', e.target.value)}
            onBlur={() => onPathBlur()}
            placeholder={t('register.pathPlaceholder')}
          />
          <IconFetchButton
            path={item.path}
            loading={iconFetchLoading}
            onFetch={() => onFetchIcon()}
            itemType={item.type}
          />
          {!isPathReadOnly && (
            <ItemConverterMenu path={item.path} args={item.args} onConvert={handleConvert} />
          )}
          {errors?.path && <span className="error-message">{errors.path}</span>}
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
          <button type="button" className="options-toggle" onClick={onToggleOptions}>
            <span className="toggle-icon">{optionsOpen ? '▼' : '▶'}</span>
            {item.itemCategory === 'item' ? t('register.itemOptions') : t('register.dirOptions')}
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

      {item.itemCategory === 'item' && (
        <WindowConfigEditor
          windowConfig={item.windowConfig}
          onChange={(windowConfig) => onFieldChange('windowConfig', windowConfig)}
          onGetWindowClick={onOpenWindowSelector}
          onFetchFromWindow={onFetchFromWindow}
          defaultExpanded={false}
        />
      )}

      {item.itemCategory === 'window' && (
        <div>
          <WindowConfigEditor
            windowConfig={
              item.windowOperationConfig
                ? toWindowConfig(item.windowOperationConfig)
                : { title: '' }
            }
            onChange={(wc) =>
              onFieldChange('windowOperationConfig', toWindowOperationConfig(item.displayName, wc))
            }
            onGetWindowClick={onOpenWindowSelector}
            onFetchFromWindow={onFetchFromWindow}
            showToggle={false}
            defaultExpanded={false}
          />
          {errors?.displayName && (
            <div className="form-group">
              <span className="error-message">{errors.displayName}</span>
            </div>
          )}
        </div>
      )}

      {item.itemCategory === 'clipboard' && (
        <>
          <ClipboardItemEditor
            capturedData={
              item.clipboardDataRef
                ? {
                    dataFileRef: item.clipboardDataRef,
                    preview: item.clipboardPreview,
                    formats: item.clipboardFormats || [],
                    savedAt: item.clipboardSavedAt || Date.now(),
                  }
                : undefined
            }
            sessionData={
              item.clipboardSessionId
                ? {
                    sessionId: item.clipboardSessionId,
                    preview: item.clipboardPreview,
                    formats: item.clipboardFormats || [],
                    capturedAt: item.clipboardSavedAt || Date.now(),
                  }
                : undefined
            }
            onCapture={(result) => {
              // 取り直したら、前の未確定のキャプチャは使わないので捨てる
              if (item.clipboardSessionId && item.clipboardSessionId !== result.sessionId) {
                window.electronAPI.clipboardAPI
                  .discardSession(item.clipboardSessionId)
                  .catch(() => undefined);
              }
              const updates: Partial<RegisterItem> = {
                clipboardSessionId: result.sessionId,
                clipboardFormats: result.formats,
                clipboardSavedAt: result.capturedAt,
                clipboardPreview: result.preview || '',
              };
              if (!item.displayName) {
                const preview = result.preview || t('register.clipboardFallbackName');
                updates.displayName =
                  preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
              }
              onUpdate(updates);
            }}
            onError={(error) => {
              debugLog('クリップボードキャプチャエラー:', error);
              onClipboardError(error);
            }}
          />
          {errors?.path && <span className="error-message">{errors.path}</span>}
        </>
      )}

      {(item.itemCategory === 'clipboard' || item.itemCategory === 'set') && customIconEditor}

      <div className="form-group">
        <label>{t('register.note')}</label>
        <textarea
          value={item.memo || ''}
          onChange={(e) => onFieldChange('memo', e.target.value)}
          placeholder={t('register.notePlaceholder')}
          rows={3}
          className="memo-textarea"
        />
      </div>

      {showSeparator && <hr />}
    </div>
  );
};

export default ItemEditFields;
