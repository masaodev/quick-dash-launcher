/**
 * 画面: アイテム管理の CSV 取り込みの確認
 * 画面仕様: docs/screens/admin-window.md#531-csv-の書き出しと取り込み
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { JsonItem } from '@common/types';

import type { CsvImportPlan } from '../utils/itemCsv';
import { describePathAndArgs } from '../utils/editableItemOperations';

import { Button } from './ui';
import '../styles/components/Modal.css';

interface AdminItemCsvImportModalProps {
  fileName: string;
  plan: CsvImportPlan;
  /** データファイル → 表示名 */
  getFileLabel: (fileName: string) => string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 変わった項目だけを「名前: A → B」の形で並べる */
function describeChanges(before: JsonItem, after: JsonItem, labels: Record<string, string>) {
  const fields: Array<[string, (item: JsonItem) => string]> = [
    ['displayName', (item) => ('displayName' in item ? item.displayName || '' : '')],
    ['pathAndArgs', (item) => describePathAndArgs(item)],
    ['memo', (item) => item.memo ?? ''],
  ];
  return fields
    .map(([key, read]) => [key, read(before), read(after)] as const)
    .filter(([, a, b]) => a !== b)
    .map(([key, a, b]) => `${labels[key]}: ${a || '—'} → ${b || '—'}`);
}

/** 取り込む前に、変わる行・足す行・エラーを見せて確かめてもらう */
const AdminItemCsvImportModal: React.FC<AdminItemCsvImportModalProps> = ({
  fileName,
  plan,
  getFileLabel,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const canImport = plan.updates.length + plan.additions.length > 0;
  const labels = {
    displayName: t('itemManager.table.name'),
    pathAndArgs: t('itemManager.table.pathAndArgs'),
    memo: t('itemManager.table.memo'),
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const nameOf = (item: JsonItem) =>
    ('displayName' in item && item.displayName) || describePathAndArgs(item);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content csv-import-modal"
        onClick={(e) => e.stopPropagation()}
        data-testid="csv-import-modal"
        role="dialog"
        aria-labelledby="csv-import-title"
      >
        <h2 id="csv-import-title">{t('itemCsv.previewTitle')}</h2>
        <p className="csv-import-file">{fileName}</p>
        <p className="csv-import-summary" data-testid="csv-import-summary">
          {t('itemCsv.summary', {
            updates: plan.updates.length,
            additions: plan.additions.length,
            unchanged: plan.unchangedCount,
            errors: plan.errors.length,
          })}
        </p>

        <div className="csv-import-sections">
          {plan.updates.length > 0 && (
            <section>
              <h3>{t('itemCsv.updatesHeading', { count: plan.updates.length })}</h3>
              <ul>
                {plan.updates.map(({ before, after }) => (
                  <li key={after.id}>
                    <strong>{nameOf(before.item)}</strong>
                    {describeChanges(before.item, after, labels).map((line) => (
                      <div key={line} className="csv-import-change">
                        {line}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plan.additions.length > 0 && (
            <section>
              <h3>{t('itemCsv.additionsHeading', { count: plan.additions.length })}</h3>
              <ul>
                {plan.additions.map(({ dataFile, item }) => (
                  <li key={item.id}>
                    <strong>{nameOf(item)}</strong>
                    <span className="csv-import-dest">{getFileLabel(dataFile)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plan.ignored.length > 0 && (
            <section className="csv-import-ignored" data-testid="csv-import-ignored">
              <h3>{t('itemCsv.ignoredHeading', { count: plan.ignored.length })}</h3>
              <p className="csv-import-ignored-note">{t('itemCsv.ignoredNote')}</p>
              <ul>
                {plan.ignored.map(({ line, name, columns }) => (
                  <li key={line}>
                    {t('itemCsv.ignoredLine', {
                      line,
                      name,
                      columns: columns
                        .map((column) => t(`itemCsv.columns.${column}`))
                        .join(t('common.listSeparator')),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plan.errors.length > 0 && (
            <section className="csv-import-errors">
              <h3>{t('itemCsv.errorsHeading', { count: plan.errors.length })}</h3>
              <ul>
                {plan.errors.map((error) => (
                  <li key={`${error.line}-${error.code}`}>
                    {t('itemCsv.errorLine', {
                      line: error.line,
                      message: t(`itemCsv.errors.${error.code}`, { value: error.value ?? '' }),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <p className="csv-import-note">{t('itemCsv.note')}</p>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!canImport}
            data-testid="csv-import-confirm"
          >
            {t('itemCsv.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminItemCsvImportModal;
