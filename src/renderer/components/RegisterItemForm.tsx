import React from 'react';
import type { DataFileTab, RegisterItem, WindowInfo } from '@common/types';

import type { useRegisterForm } from '../hooks/useRegisterForm';
import { debugLog } from '../utils/debug';
import { toWindowConfig, toWindowOperationConfig } from '../utils/windowFilter';

import DirOptionsEditor from './DirOptionsEditor';
import WindowConfigEditor from './WindowConfigEditor';
import CustomIconEditor from './CustomIconEditor';
import UrlConverterMenu from './UrlConverterMenu';
import IconFetchButton from './IconFetchButton';
import ClipboardItemEditor from './ClipboardItemEditor';
import LayoutEntryEditor from './LayoutEntryEditor';

type RegisterFormApi = ReturnType<typeof useRegisterForm>;

function getDisplayNamePlaceholder(itemCategory: string): string {
  switch (itemCategory) {
    case 'group':
      return 'グループ名を入力';
    case 'clipboard':
      return 'クリップボードアイテム名を入力';
    default:
      return 'アイテム表示名を入力';
  }
}

interface RegisterItemFormProps {
  item: RegisterItem;
  index: number;
  errors: RegisterFormApi['errors'][number] | undefined;
  form: Pick<
    RegisterFormApi,
    | 'handleItemChange'
    | 'handlePathBlur'
    | 'handleTargetTabChange'
    | 'handleFetchIcon'
    | 'handleAddGroupItem'
    | 'handleRemoveGroupItem'
    | 'updateItem'
  >;
  availableTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
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
  onLayoutCapture: () => void;
  onLayoutEntryWindowSelect: (entryIndex: number) => void;
  onClipboardError: (message: string) => void;
  showSeparator: boolean;
}

/** 登録・編集モーダルのアイテム 1 件分のフォーム */
const RegisterItemForm: React.FC<RegisterItemFormProps> = ({
  item,
  index,
  errors,
  form,
  availableTabs,
  dataFileLabels,
  isPathReadOnly,
  iconFetchLoading,
  optionsOpen,
  onToggleOptions,
  customIconPreview,
  onCustomIconSelect,
  onCustomIconDelete,
  onOpenWindowSelector,
  onFetchFromWindow,
  onLayoutCapture,
  onLayoutEntryWindowSelect,
  onClipboardError,
  showSeparator,
}) => {
  const { handleItemChange, updateItem } = form;
  const selectedTab = availableTabs.find((tab) => tab.files.includes(item.targetTab));
  const hasPath =
    item.itemCategory !== 'group' &&
    item.itemCategory !== 'window' &&
    item.itemCategory !== 'clipboard' &&
    item.itemCategory !== 'layout';

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

      <div className="form-row">
        <div className="form-group">
          <label>保存先タブ:</label>
          <select
            value={item.targetTab}
            onChange={(e) => form.handleTargetTabChange(index, e.target.value)}
          >
            {availableTabs.map((tab) => (
              <option key={tab.files[0]} value={tab.files[0]}>
                {tab.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTab && selectedTab.files.length > 1 && (
          <div className="form-group">
            <label>保存先ファイル:</label>
            <select
              value={item.targetFile || selectedTab.files[0]}
              onChange={(e) => handleItemChange(index, 'targetFile', e.target.value)}
            >
              {selectedTab.files.map((file) => (
                <option key={file} value={file}>
                  {dataFileLabels[file] || file}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>種別:</label>
        <select
          value={item.itemCategory}
          onChange={(e) =>
            handleItemChange(index, 'itemCategory', e.target.value as RegisterItem['itemCategory'])
          }
        >
          <option value="item">📄 単一アイテム</option>
          <option value="dir">🗂️ フォルダ取込</option>
          <option value="group">📦 グループ</option>
          <option value="window">🪟 ウィンドウ操作</option>
          <option value="clipboard">📋 クリップボード</option>
          <option value="layout">🖥️ ウィンドウレイアウト</option>
        </select>
      </div>

      {item.itemCategory !== 'dir' && (
        <div className="form-group">
          <label>アイテム表示名:</label>
          <input
            type="text"
            value={item.displayName}
            className={errors?.displayName ? 'error' : ''}
            onChange={(e) => handleItemChange(index, 'displayName', e.target.value)}
            placeholder={getDisplayNamePlaceholder(item.itemCategory)}
          />
          {errors?.displayName && <span className="error-message">{errors.displayName}</span>}
        </div>
      )}

      {hasPath && (
        <div className="form-group path-input-group">
          <label>パス:</label>
          <input
            type="text"
            value={item.path}
            readOnly={isPathReadOnly}
            className={errors?.path ? 'error' : isPathReadOnly ? 'readonly' : ''}
            onChange={(e) => handleItemChange(index, 'path', e.target.value)}
            onBlur={() => form.handlePathBlur(index)}
            placeholder="ファイルパス、URL、またはカスタムURIを入力"
          />
          <IconFetchButton
            path={item.path}
            loading={iconFetchLoading}
            onFetch={() => form.handleFetchIcon(index)}
            itemType={item.type}
          />
          <UrlConverterMenu
            url={item.path}
            onConvert={(convertedUrl) => handleItemChange(index, 'path', convertedUrl)}
            itemType={item.type}
          />
          {errors?.path && <span className="error-message">{errors.path}</span>}
        </div>
      )}

      {item.itemCategory === 'group' && (
        <div className="form-group vertical-layout">
          <label>グループアイテムリスト:</label>
          <div className="group-item-list">
            {item.groupItemNames && item.groupItemNames.length > 0 ? (
              <div className="selected-items">
                {item.groupItemNames.map((itemName, nameIndex) => (
                  <div key={nameIndex} className="item-chip">
                    <span>{itemName}</span>
                    <button
                      type="button"
                      className="remove-group-item-btn"
                      onClick={() => form.handleRemoveGroupItem(index, nameIndex)}
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-group-items">アイテムが追加されていません</div>
            )}
            <button
              type="button"
              className="add-group-item-btn"
              onClick={() => form.handleAddGroupItem(index)}
            >
              + アイテムを追加
            </button>
          </div>
          {errors?.groupItemNames && <span className="error-message">{errors.groupItemNames}</span>}
          <small>
            同じファイル内の既存アイテムから選択してください。グループ実行時に順番に起動されます。
          </small>
        </div>
      )}

      {(item.itemCategory === 'item' || item.itemCategory === 'dir') && (
        <div className="options-section">
          <button type="button" className="options-toggle" onClick={onToggleOptions}>
            <span className="toggle-icon">{optionsOpen ? '▼' : '▶'}</span>
            {item.itemCategory === 'item'
              ? 'オプション設定（引数・アイコン）'
              : 'フォルダ取り込みオプション'}
          </button>

          {optionsOpen && (
            <div className="options-content">
              {item.itemCategory === 'item' && (
                <>
                  <div className="form-group">
                    <label>引数:</label>
                    <input
                      type="text"
                      value={item.args || ''}
                      onChange={(e) => handleItemChange(index, 'args', e.target.value)}
                      placeholder="コマンドライン引数（実行ファイルやアプリの場合のみ有効）"
                    />
                  </div>
                  {customIconEditor}
                </>
              )}

              {item.itemCategory === 'dir' && (
                <DirOptionsEditor
                  dirOptions={item.dirOptions}
                  onChange={(newDirOptions) => handleItemChange(index, 'dirOptions', newDirOptions)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {item.itemCategory === 'item' && (
        <WindowConfigEditor
          windowConfig={item.windowConfig}
          onChange={(windowConfig) => handleItemChange(index, 'windowConfig', windowConfig)}
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
              handleItemChange(
                index,
                'windowOperationConfig',
                toWindowOperationConfig(item.displayName, wc)
              )
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
              const updates: Partial<RegisterItem> = {
                clipboardSessionId: result.sessionId,
                clipboardFormats: result.formats,
                clipboardSavedAt: result.capturedAt,
                clipboardPreview: result.preview || '',
              };
              if (!item.displayName) {
                const preview = result.preview || 'クリップボード';
                updates.displayName =
                  preview.length > 30 ? preview.substring(0, 30) + '...' : preview;
              }
              updateItem(index, updates);
            }}
            onError={(error) => {
              debugLog('クリップボードキャプチャエラー:', error);
              onClipboardError(error);
            }}
          />
          {errors?.path && <span className="error-message">{errors.path}</span>}
        </>
      )}

      {item.itemCategory === 'layout' && (
        <>
          <LayoutEntryEditor
            entries={item.layoutEntries || []}
            onChange={(entries) => updateItem(index, { layoutEntries: entries })}
            onCaptureClick={onLayoutCapture}
            onSelectWindow={onLayoutEntryWindowSelect}
          />
          {errors?.path && <span className="error-message">{errors.path}</span>}
        </>
      )}

      {(item.itemCategory === 'group' ||
        item.itemCategory === 'clipboard' ||
        item.itemCategory === 'layout') &&
        customIconEditor}

      <div className="form-group">
        <label>メモ:</label>
        <textarea
          value={item.memo || ''}
          onChange={(e) => handleItemChange(index, 'memo', e.target.value)}
          placeholder="自由にメモを入力（任意）"
          rows={3}
          className="memo-textarea"
        />
      </div>

      {showSeparator && <hr />}
    </div>
  );
};

export default RegisterItemForm;
