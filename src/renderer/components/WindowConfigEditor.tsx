import React, { useState } from 'react';
import { WindowConfig } from '@common/types';

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
                ① ウィンドウタイトルで既存ウィンドウを検索
                <br />
                ② 見つかれば → 設定に従って制御
                <br />③ 見つからなければ → パスのアイテムを新規実行
              </>
            ) : (
              <>
                ① ウィンドウタイトルで既存ウィンドウを検索
                <br />② 見つかれば → 設定に従って制御
              </>
            )}
          </p>
        </div>

        <div className="window-config-section">
          <button type="button" className="get-window-btn" onClick={onGetWindowClick}>
            ウィンドウから取得
          </button>

          {/* 1. ウィンドウ検索設定 */}
          <div className="window-config-group">
            <h4 className="window-config-group-title">🔍 ウィンドウ検索</h4>
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
              💡 ワイルドカード: *（任意の文字列）、?（任意の1文字）
              <br />
              ワイルドカードなし → 完全一致、ワイルドカードあり → パターンマッチ
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
            <h4 className="window-config-group-title">⚙️ ウィンドウが見つかった場合の動作</h4>

            {/* 2-1. 位置・サイズ調整 */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">📐 位置・サイズ調整</h5>
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
                  <span>アクティブモニター（カーソルがあるモニター）の中央に移動</span>
                </label>
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
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
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
                    disabled={windowConfig?.moveToActiveMonitorCenter || false}
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
            </div>

            {/* 2-2. 仮想デスクトップ移動 */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">🖥️ 仮想デスクトップ移動</h5>
              <div className="window-config-row">
                <label className="window-config-label">デスクトップ番号:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={windowConfig?.virtualDesktopNumber ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...(windowConfig || { title: '' }),
                      virtualDesktopNumber: e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined,
                    })
                  }
                  placeholder="1から開始"
                  className="window-config-input-number"
                />
              </div>
              <div className="window-config-row">
                <label className="window-config-checkbox-label">
                  <input
                    type="checkbox"
                    checked={windowConfig?.pinToAllDesktops ?? false}
                    onChange={(e) =>
                      onChange({
                        ...(windowConfig || { title: '' }),
                        pinToAllDesktops: e.target.checked,
                      })
                    }
                    className="window-config-checkbox"
                    title="ウィンドウを全てのデスクトップにピン留めします（Windows 10/11の「すべてのデスクトップで表示」機能）"
                  />
                  <span>📌 全ての仮想デスクトップに表示</span>
                </label>
              </div>
            </div>

            {/* 2-3. アクティブ化 */}
            <div className="window-config-subgroup">
              <h5 className="window-config-subgroup-title">✨ アクティブ化</h5>
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
                  <span>ウィンドウをアクティブにする</span>
                </label>
              </div>
              <div className="help-box">
                <p className="help-note">
                  💡 チェックを外すと、位置・サイズ調整や仮想デスクトップ移動のみ実行
                </p>
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
