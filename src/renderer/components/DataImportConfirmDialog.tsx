/**
 * 画面: インポートの確認（エクスポートしたファイルで置き換える前）
 * 画面仕様: docs/screens/admin-window.md#553-インポート
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DataImportSummary } from '@common/types';

import ConfirmDialog from './ConfirmDialog';

interface DataImportConfirmDialogProps {
  summary: DataImportSummary | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** エクスポートした日時・版・配布形式と、アイテムの数（今 → インポートした後）を見せて、置き換えてよいかを聞く */
const DataImportConfirmDialog: React.FC<DataImportConfirmDialogProps> = ({
  summary,
  onConfirm,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  if (!summary) return null;

  const exportedAt = new Date(summary.exportedAt);
  const date = Number.isNaN(exportedAt.getTime())
    ? summary.exportedAt
    : exportedAt.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ConfirmDialog
      isOpen
      onClose={onClose}
      onConfirm={onConfirm}
      title={t('dataImport.confirmTitle')}
      message={t('dataImport.confirmMessage')}
      warning={t('dataImport.confirmWarning')}
      details={[
        {
          label: t('dataImport.detailSource'),
          after: t('dataImport.sourceValue', {
            version: summary.appVersion,
            distribution: t(`help.distributions.${summary.distribution}`),
          }),
        },
        { label: t('dataImport.detailExportedAt'), after: date },
        {
          label: t('dataImport.detailItems'),
          before: String(summary.items.before),
          after: String(summary.items.after),
        },
        {
          label: t('dataImport.detailWorkspaceItems'),
          before: String(summary.workspaceItems.before),
          after: String(summary.workspaceItems.after),
        },
      ]}
      confirmText={t('dataImport.confirmButton')}
      danger
    />
  );
};

export default DataImportConfirmDialog;
