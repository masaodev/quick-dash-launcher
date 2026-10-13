import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { WindowConfig, WindowInfo } from '@common/types';

import { Button } from './ui/Button';

interface WindowConfigEditorProps {
  /** ウィンドウ設定 */
  windowConfig?: WindowConfig;
  /** ウィンドウ設定変更時のコールバック */
  onChange: (windowConfig: WindowConfig) => void;
  /** ウィンドウから取得ボタンクリック時のコールバック */
  onGetWindowClick: () => void;
  /** ウィンドウ検索で位置/サイズを取得するコールバック */
  onFetchFromWindow?: () => Promise<WindowInfo | null>;
  /** 初期状態で展開するか（デフォルト: false） */
  defaultExpanded?: boolean;
  /** 折りたたみトグルを表示するか（デフォルト: true） */
  showToggle?: boolean;
}

/* eslint-disable react/prop-types */
const WindowConfigEditor: React.FC<WindowConfigEditorProps> = React.memo(
  ({
    windowConfig,
    onChange,
    onGetWindowClick,
    onFetchFromWindow,
    defaultExpanded = false,
    showToggle = true,
  }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [fetchError, setFetchError] = useState<'position' | 'size' | null>(null);

    const baseConfig = windowConfig || { title: '' };

    const handleNumericChange =
      (fieldName: keyof WindowConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
        onChange({ ...baseConfig, [fieldName]: value });
      };

    const handleFetchFromWindow = async (
      type: 'position' | 'size',
      extractFields: (info: WindowInfo) => Partial<WindowConfig>
    ) => {
      if (!onFetchFromWindow) return;
      setFetchError(null);
      const windowInfo = await onFetchFromWindow();
      if (windowInfo) {
        onChange({ ...baseConfig, ...extractFields(windowInfo) });
      } else {
        setFetchError(type);
        setTimeout(() => setFetchError(null), 3000);
      }
    };

    const handleFetchPosition = () =>
      handleFetchFromWindow('position', (info) => ({ x: info.x, y: info.y }));

    const handleFetchSize = () =>
      handleFetchFromWindow('size', (info) => ({ width: info.width, height: info.height }));

    const renderContent = () => (
      <>
        <div className="help-box">
          <p className="help-title">
            {showToggle ? t('windowConfig.reuseTitle') : t('windowConfig.actionTitle')}
          </p>
          <p className="help-flow">
            {showToggle ? (
              <>
                {t('windowConfig.stepSearch')}
                <br />
                {t('windowConfig.stepAct')}
                <br />
                {t('windowConfig.stepLaunch')}
              </>
            ) : (
              <>
                {t('windowConfig.stepSearch')}
                <br />
                {t('windowConfig.stepAct')}
              </>
            )}
          </p>
        </div>

        <div className="window-config-section">
          {/* 1. ウィンドウ検索設定 */}
          <div className="window-config-group">
            <div className="window-config-group-header">
              <h4 className="window-config-group-title">{t('windowConfig.searchHeading')}</h4>
              <Button variant="info" type="button" size="sm" onClick={onGetWindowClick}>
                {t('windowConfig.selectWindow')}
              </Button>
            </div>
            <div className="window-config-row">
              <label className="window-config-label">{t('windowConfig.windowTitle')}</label>
              <input
                type="text"
                value={windowConfig?.title || ''}
                onChange={(e) =>
                  onChange({
                    ...baseConfig,
                    title: e.target.value,
                  })
                }
                placeholder={t('windowConfig.windowTitlePlaceholder')}
                className="window-config-input"
              />
            </div>
            <div className="window-config-help-text">{t('windowConfig.windowTitleHint')}</div>
            <div className="window-config-row">
              <label className="window-config-label">{t('windowConfig.processName')}</label>
              <input
                type="text"
                value={windowConfig?.processName || ''}
                onChange={(e) =>
                  onChange({
                    ...baseConfig,
                    processName: e.target.value || undefined,
                  })
                }
                placeholder={t('windowConfig.processNamePlaceholder')}
                className="window-config-input"
              />
            </div>
          </div>

          {/* 2. ウィンドウが見つかった場合の動作 */}
          <div className="window-config-group">
            <h4 className="window-config-group-title">{t('windowConfig.actionHeading')}</h4>

            {/* 2-1. 前面表示（アクティブ化） */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">{t('windowConfig.activateHeading')}</h5>
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.activateWindow !== false}
                    onChange={(e) =>
                      onChange({
                        ...baseConfig,
                        activateWindow: e.target.checked,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>{t('windowConfig.activate')}</span>
                </label>
              </div>
            </div>

            {/* 2-2. 位置調整 */}
            <div className="window-config-subgroup">
              <div className="window-config-subgroup-header">
                <h5 className="window-config-subgroup-title">
                  {t('windowConfig.positionHeading')}
                </h5>
                {onFetchFromWindow && (
                  <Button variant="info" type="button" size="sm" onClick={handleFetchPosition}>
                    {t('windowConfig.fetchFromWindow')}
                  </Button>
                )}
              </div>
              {fetchError === 'position' && (
                <div className="window-config-fetch-error">{t('windowConfig.windowNotFound')}</div>
              )}
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.moveToActiveMonitorCenter || false}
                    onChange={(e) =>
                      onChange({
                        ...baseConfig,
                        moveToActiveMonitorCenter: e.target.checked || undefined,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>{t('windowConfig.centerOnCursorMonitor')}</span>
                </label>
              </div>
              <div className="window-config-help-text">{t('windowConfig.byCoordinates')}</div>
              <div className="window-config-row-double" style={{ marginLeft: 'var(--spacing-lg)' }}>
                <div className="window-config-field">
                  <label className="window-config-label">{t('windowConfig.x')}</label>
                  <input
                    type="number"
                    value={windowConfig?.x ?? ''}
                    onChange={handleNumericChange('x')}
                    placeholder={t('windowConfig.xPlaceholder')}
                    className="window-config-input-number"
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
                  />
                </div>
                <div className="window-config-field">
                  <label className="window-config-label">{t('windowConfig.y')}</label>
                  <input
                    type="number"
                    value={windowConfig?.y ?? ''}
                    onChange={handleNumericChange('y')}
                    placeholder={t('windowConfig.yPlaceholder')}
                    className="window-config-input-number"
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
                  />
                </div>
              </div>
            </div>

            {/* 2-3. サイズ調整 */}
            <div className="window-config-subgroup">
              <div className="window-config-subgroup-header">
                <h5 className="window-config-subgroup-title">{t('windowConfig.sizeHeading')}</h5>
                {onFetchFromWindow && (
                  <Button variant="info" type="button" size="sm" onClick={handleFetchSize}>
                    {t('windowConfig.fetchFromWindow')}
                  </Button>
                )}
              </div>
              {fetchError === 'size' && (
                <div className="window-config-fetch-error">{t('windowConfig.windowNotFound')}</div>
              )}
              <div className="window-config-row-double">
                <div className="window-config-field">
                  <label className="window-config-label">{t('windowConfig.width')}</label>
                  <input
                    type="number"
                    value={windowConfig?.width ?? ''}
                    onChange={handleNumericChange('width')}
                    placeholder={t('windowConfig.widthPlaceholder')}
                    className="window-config-input-number"
                  />
                </div>
                <div className="window-config-field">
                  <label className="window-config-label">{t('windowConfig.height')}</label>
                  <input
                    type="number"
                    value={windowConfig?.height ?? ''}
                    onChange={handleNumericChange('height')}
                    placeholder={t('windowConfig.heightPlaceholder')}
                    className="window-config-input-number"
                  />
                </div>
              </div>
            </div>

            {/* 2-4. 仮想デスクトップ移動・ピン止め */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">{t('windowConfig.desktopHeading')}</h5>
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.pinToAllDesktops || false}
                    onChange={(e) =>
                      onChange({
                        ...baseConfig,
                        pinToAllDesktops: e.target.checked || undefined,
                        // ピン止め時は仮想デスクトップ番号をクリア
                        virtualDesktopNumber: e.target.checked
                          ? undefined
                          : windowConfig?.virtualDesktopNumber,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>{t('windowConfig.showOnAllDesktops')}</span>
                </label>
              </div>
              <div className="window-config-help-text">{t('windowConfig.byNumber')}</div>
              <div className="window-config-row" style={{ marginLeft: 'var(--spacing-lg)' }}>
                <label className="window-config-label">{t('windowConfig.desktopNumber')}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={windowConfig?.virtualDesktopNumber ?? ''}
                  onChange={handleNumericChange('virtualDesktopNumber')}
                  placeholder={t('windowConfig.desktopNumberPlaceholder')}
                  className="window-config-input-number"
                  disabled={windowConfig?.pinToAllDesktops || false}
                />
              </div>
            </div>
          </div>
        </div>
      </>
    );

    return (
      <div className="form-group vertical-layout">
        {showToggle ? (
          <div className="options-section">
            <button
              type="button"
              className="options-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
              <span>{t('windowConfig.optionsToggle')}</span>
            </button>

            {isExpanded && <div className="options-content">{renderContent()}</div>}
          </div>
        ) : (
          renderContent()
        )}
      </div>
    );
  }
);

WindowConfigEditor.displayName = 'WindowConfigEditor';

export default WindowConfigEditor;
