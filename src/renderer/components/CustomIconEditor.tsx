import React from 'react';

interface CustomIconEditorProps {
  /** カスタムアイコンのプレビューURL */
  customIconPreview?: string;
  /** ファイルから選択ボタンクリック時のコールバック */
  onSelectClick: () => void;
  /** 削除ボタンクリック時のコールバック */
  onDeleteClick: () => void;
}

/**
 * カスタムアイコンエディター
 *
 * カスタムアイコンのプレビュー表示と選択・削除操作を行うUIコンポーネント
 */
const CustomIconEditor: React.FC<CustomIconEditorProps> = ({
  customIconPreview,
  onSelectClick,
  onDeleteClick,
}) => {
  return (
    <div className="form-group">
      <label>カスタムアイコン:</label>
      <div className="custom-icon-section">
        {customIconPreview ? (
          <div className="custom-icon-preview">
            <img src={customIconPreview} alt="カスタムアイコン" className="custom-icon-img" />
            <button type="button" className="delete-icon-btn" onClick={onDeleteClick}>
              削除
            </button>
          </div>
        ) : (
          <div className="no-custom-icon">
            <span>カスタムアイコン未設定</span>
          </div>
        )}
        <button type="button" className="select-icon-btn" onClick={onSelectClick}>
          ファイルから選択
        </button>
      </div>
    </div>
  );
};

export default CustomIconEditor;
