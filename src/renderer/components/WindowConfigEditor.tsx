import React from 'react';
import { WindowConfig } from '@common/types';

interface WindowConfigEditorProps {
  /** ウィンドウ設定 */
  windowConfig?: WindowConfig;
  /** ウィンドウ設定変更時のコールバック */
  onChange: (windowConfig: WindowConfig) => void;
  /** ウィンドウから取得ボタンクリック時のコールバック */
  onGetWindowClick: () => void;
}

/**
 * ウィンドウ設定エディター
 *
 * ウィンドウタイトル、X座標、Y座標、幅、高さを編集するUIコンポーネント
 */
const WindowConfigEditor: React.FC<WindowConfigEditorProps> = ({
  windowConfig,
  onChange,
  onGetWindowClick,
}) => {
  return (
    <div className="form-group vertical-layout">
      <label>ウィンドウ設定（オプション）:</label>
      <div className="window-config-section">
        <div className="window-config-row">
          <label className="window-config-label">ウィンドウタイトル:</label>
          <input
            type="text"
            value={windowConfig?.title || ''}
            onChange={(e) =>
              onChange({
                ...windowConfig,
                title: e.target.value,
              })
            }
            placeholder="ウィンドウタイトル（部分一致）"
            className="window-config-input"
          />
        </div>
        <div className="window-config-row-double">
          <div className="window-config-field">
            <label className="window-config-label">X座標:</label>
            <input
              type="number"
              value={windowConfig?.x ?? ''}
              onChange={(e) =>
                onChange({
                  ...(windowConfig || { title: '' }),
                  x: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="X座標"
              className="window-config-input-number"
            />
          </div>
          <div className="window-config-field">
            <label className="window-config-label">Y座標:</label>
            <input
              type="number"
              value={windowConfig?.y ?? ''}
              onChange={(e) =>
                onChange({
                  ...(windowConfig || { title: '' }),
                  y: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="Y座標"
              className="window-config-input-number"
            />
          </div>
        </div>
        <div className="window-config-row-double">
          <div className="window-config-field">
            <label className="window-config-label">幅:</label>
            <input
              type="number"
              value={windowConfig?.width ?? ''}
              onChange={(e) =>
                onChange({
                  ...(windowConfig || { title: '' }),
                  width: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="幅"
              className="window-config-input-number"
            />
          </div>
          <div className="window-config-field">
            <label className="window-config-label">高さ:</label>
            <input
              type="number"
              value={windowConfig?.height ?? ''}
              onChange={(e) =>
                onChange({
                  ...(windowConfig || { title: '' }),
                  height: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              placeholder="高さ"
              className="window-config-input-number"
            />
          </div>
        </div>
        <button type="button" className="get-window-btn" onClick={onGetWindowClick}>
          ウィンドウから取得
        </button>
      </div>
    </div>
  );
};

export default WindowConfigEditor;
