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
          <>
            <img
              src={customIconPreview}
              alt="カスタムアイコン"
              className="custom-icon-img-inline"
            />
            <button type="button" className="delete-icon-btn-inline" onClick={onDeleteClick}>
              削除
            </button>
          </>
        ) : (
          <span className="no-custom-icon-inline">未設定</span>
        )}
        <button type="button" className="select-icon-btn-inline" onClick={onSelectClick}>
          ファイルから選択
        </button>
      </div>
    </div>
  );
};

export default CustomIconEditor;
