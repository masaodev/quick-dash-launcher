/**
 * アイテム管理: 今のタブのデータファイルが JSON として読めなかったときの知らせ
 * 画面仕様: docs/screens/admin-window.md（アイテム管理の「読めなかったデータファイル」）
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

interface CorruptedFilesNoticeProps {
  /** 今のタブにある、読めなかったデータファイル（無ければ何も出さない） */
  files: string[];
}

const CorruptedFilesNotice: React.FC<CorruptedFilesNoticeProps> = ({ files }) => {
  const { t } = useTranslation();
  if (files.length === 0) return null;
  return (
    <div
      className="edit-mode-corrupted-notice"
      role="alert"
      data-testid="edit-mode-corrupted-notice"
    >
      {t('itemManager.corruptedTab', { files: files.join(', ') })}
    </div>
  );
};

export default CorruptedFilesNotice;
