import React, { useState } from 'react';
import { WindowConfig } from '@common/types';

import { Button } from './ui/Button';

interface WindowConfigEditorProps {
  /** ウィンドウ設定 */
  windowConfig?: WindowConfig;
  /** ウィンドウ設定変更時のコールバック */
  onChange: (windowConfig: WindowConfig) => void;
  /** ウィンドウから取得ボタンクリック時のコールバック */
  onGetWindowClick: () => void;
  /** 初期状態で展開するか（デフォルト: false） */
  defaultExpanded?: boolean;
  /** 折りたたみトグルを表示するか（デフォルト: true） */
  showToggle?: boolean;
}

/**
 * 数値入力フィールドのonChange処理を簡略化するヘルパー
 */
function createNumericChangeHandler(
  windowConfig: WindowConfig | undefined,
  onChange: (config: WindowConfig) => void,
  fieldName: keyof WindowConfig
): (e: React.ChangeEvent<HTMLInputElement>) => void {
  return (e) => {
    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onChange({
      ...(windowConfig || { title: '' }),
      [fieldName]: value,
    });
  };
}

/**
 * ウィンドウ設定エディター
 *
 * ウィンドウタイトル、X座標、Y座標、幅、高さを編集するUIコンポーネント
 *
 * Note: TypeScriptを使用しているため、prop-typesは不要です
 */
/* eslint-disable react/prop-types */
const WindowConfigEditor: React.FC<WindowConfigEditorProps> = React.memo(
  ({ windowConfig, onChange, onGetWindowClick, defaultExpanded = false, showToggle = true }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // 数値フィールドのonChangeハンドラーを生成
    const handleNumericChange = (fieldName: keyof WindowConfig) =>
      createNumericChangeHandler(windowConfig, onChange, fieldName);

    // 折りたたみトグルを表示しない場合は、常にコンテンツを表示
    const shouldShowContent = !showToggle || isExpanded;

    // コンテンツ部分を共通化
    const renderContent = () => (
      <>
        <div className="help-box">
          <p className="help-title">
            {showToggle ? '既存ウィンドウの再利用機能' : 'ウィンドウ操作機能'}
          </p>
          <p className="help-flow">
            {showToggle ? (
              <>
                ① タイトル/プロセス名で対象ウィンドウを検索
                <br />
                ② 見つかったら下記の操作を実行
                <br />③ 見つからなければ → パスのアイテムを新規起動
              </>
            ) : (
              <>
                ① タイトル/プロセス名で対象ウィンドウを検索
                <br />② 見つかったら下記の操作を実行
              </>
            )}
          </p>
        </div>

        <div className="window-config-section">
          <Button variant="info" type="button" onClick={onGetWindowClick}>
            ウィンドウから取得
          </Button>

          {/* 1. ウィンドウ検索設定 */}
          <div className="window-config-group">
            <h4 className="window-config-group-title">🔍 ① ウィンドウ検索</h4>
            <div className="window-config-row">
              <label className="window-config-label">ウィンドウタイトル:</label>
              <input
                type="text"
                value={windowConfig?.title || ''}
                onChange={(e) =>
                  onChange({
                    ...(windowConfig || { title: '' }),
                    title: e.target.value,
                  })
                }
                placeholder="例: *Chrome* または Google Chrome"
                className="window-config-input"
              />
            </div>
            <div className="window-config-help-text">
              💡 * で任意の文字列にマッチ（例: *Chrome* → タイトルに「Chrome」を含むウィンドウ）
            </div>
            <div className="window-config-row">
              <label className="window-config-label">プロセス名:</label>
              <input
                type="text"
                value={windowConfig?.processName || ''}
                onChange={(e) =>
                  onChange({
                    ...(windowConfig || { title: '' }),
                    processName: e.target.value || undefined,
                  })
                }
                placeholder="プロセス名（部分一致、例: chrome）"
                className="window-config-input"
              />
            </div>
          </div>

          {/* 2. ウィンドウが見つかった場合の動作 */}
          <div className="window-config-group">
            <h4 className="window-config-group-title">⚙️ ② 操作内容</h4>

            {/* 2-1. 前面表示（アクティブ化） */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">✨ 前面表示</h5>
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.activateWindow !== false}
                    onChange={(e) =>
                      onChange({
                        ...(windowConfig || { title: '' }),
                        activateWindow: e.target.checked,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>ウィンドウを前面に表示する</span>
                </label>
              </div>
            </div>

            {/* 2-2. 位置調整 */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">📐 位置</h5>
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.moveToActiveMonitorCenter || false}
                    onChange={(e) =>
                      onChange({
                        ...(windowConfig || { title: '' }),
                        moveToActiveMonitorCenter: e.target.checked || undefined,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>カーソルがあるモニターの中央に配置</span>
                </label>
              </div>
              <div className="window-config-help-text">座標で指定</div>
              <div className="window-config-row-double" style={{ marginLeft: 'var(--spacing-lg)' }}>
                <div className="window-config-field">
                  <label className="window-config-label">X座標:</label>
                  <input
                    type="number"
                    value={windowConfig?.x ?? ''}
                    onChange={handleNumericChange('x')}
                    placeholder="X座標"
                    className="window-config-input-number"
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
                  />
                </div>
                <div className="window-config-field">
                  <label className="window-config-label">Y座標:</label>
                  <input
                    type="number"
                    value={windowConfig?.y ?? ''}
                    onChange={handleNumericChange('y')}
                    placeholder="Y座標"
                    className="window-config-input-number"
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
                  />
                </div>
              </div>
            </div>

            {/* 2-3. サイズ調整 */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">📏 サイズ</h5>
              <div className="window-config-row-double">
                <div className="window-config-field">
                  <label className="window-config-label">幅:</label>
                  <input
                    type="number"
                    value={windowConfig?.width ?? ''}
                    onChange={handleNumericChange('width')}
                    placeholder="幅"
                    className="window-config-input-number"
                  />
                </div>
                <div className="window-config-field">
                  <label className="window-config-label">高さ:</label>
                  <input
                    type="number"
                    value={windowConfig?.height ?? ''}
                    onChange={handleNumericChange('height')}
                    placeholder="高さ"
                    className="window-config-input-number"
                  />
                </div>
              </div>
            </div>

            {/* 2-4. 仮想デスクトップ移動・ピン止め */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">🖥️ 仮想デスクトップ</h5>
              <div className="window-config-checkbox-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.pinToAllDesktops || false}
                    onChange={(e) =>
                      onChange({
                        ...(windowConfig || { title: '' }),
                        pinToAllDesktops: e.target.checked || undefined,
                        // ピン止め時は仮想デスクトップ番号をクリア
                        virtualDesktopNumber: e.target.checked
                          ? undefined
                          : windowConfig?.virtualDesktopNumber,
                      })
                    }
                    className="window-config-checkbox"
                  />
                  <span>📌 全デスクトップにピン止め</span>
                </label>
              </div>
              <div className="window-config-help-text">番号で指定</div>
              <div className="window-config-row" style={{ marginLeft: 'var(--spacing-lg)' }}>
                <label className="window-config-label">デスクトップ番号:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={windowConfig?.virtualDesktopNumber ?? ''}
                  onChange={handleNumericChange('virtualDesktopNumber')}
                  placeholder="1から開始"
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
              <span>オプション設定（ウィンドウ切り替え）</span>
            </button>

            {shouldShowContent && <div className="options-content">{renderContent()}</div>}
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
