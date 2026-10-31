import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { DataImportProblem, DataImportSummary } from '@common/types';

/** 読み込めなかった理由を、画面に出す文にする */
export function dataImportProblemMessage(t: TFunction, problem: DataImportProblem): string {
  switch (problem.kind) {
    case 'notExport':
      return t('dataImport.notExport');
    case 'newerVersion':
      return t('dataImport.newerVersion');
    case 'invalidFile':
      return t('dataImport.invalidFile', { file: problem.file });
  }
}

interface UseDataImportOptions {
  /** 読み込めなかった・失敗したときの知らせ */
  onProblem: (message: string) => void;
  /** 読み込めて、再起動を待っているときの知らせ */
  onApplied: (message: string) => void;
}

/**
 * 一括エクスポートのファイルからの読み込み（設定タブと初回設定の画面で使う）
 *
 * start でファイルを選んで確かめ、読み込めるなら pending に件数を入れる。確認ダイアログで confirm すると、
 * 設定フォルダをまるごと置き換えて QDL が再起動する
 */
export function useDataImport({ onProblem, onApplied }: UseDataImportOptions) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ token: string; summary: DataImportSummary } | null>(
    null
  );
  const [isBusy, setIsBusy] = useState(false);

  const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const start = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await window.electronAPI.backupAPI.inspectImport();
      if (!result) return;
      if (!result.ok) {
        onProblem(dataImportProblemMessage(t, result.problem));
        return;
      }
      setPending({ token: result.token, summary: result.summary });
    } catch (error) {
      onProblem(t('dataImport.failed', { error: errorText(error) }));
    } finally {
      setIsBusy(false);
    }
  }, [onProblem, t]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    const { token } = pending;
    setPending(null);
    setIsBusy(true);
    try {
      const result = await window.electronAPI.backupAPI.applyImport(token);
      if (result.success) {
        // 成功すると QDL は終わるので、ボタンは押せないままにしておく
        onApplied(t('dataImport.restarting'));
        return;
      }
      onProblem(t('dataImport.failed', { error: result.error }));
    } catch (error) {
      onProblem(t('dataImport.failed', { error: errorText(error) }));
    }
    setIsBusy(false);
  }, [onApplied, onProblem, pending, t]);

  const cancel = useCallback(() => setPending(null), []);

  return { start, confirm, cancel, pending, isBusy };
}
