import { useTranslation } from 'react-i18next';
import React from 'react';

import { Button } from './ui';

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
  const { t } = useTranslation();
  return (
    <div className="form-group">
      <label>{t('customIcon.label')}</label>
      <div className="custom-icon-section">
        {customIconPreview ? (
          <>
            <img
              src={customIconPreview}
              alt={t('customIcon.alt')}
              className="custom-icon-img-inline"
            />
            <Button
              variant="danger"
              size="sm"
              type="button"
              className="delete-icon-btn-inline"
              onClick={onDeleteClick}
            >
              {t('customIcon.delete')}
            </Button>
          </>
        ) : (
          <span className="no-custom-icon-inline">{t('customIcon.notSet')}</span>
        )}
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="select-icon-btn-inline"
          onClick={onSelectClick}
        >
          {t('customIcon.selectFile')}
        </Button>
      </div>
    </div>
  );
};

export default CustomIconEditor;
