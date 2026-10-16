import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { NEW_FILE, NEW_TAB, type ImportDestinationState } from '../hooks/useImportDestination';

interface ImportDestinationBandProps {
  dest: ImportDestinationState;
}

/**
 * 取込先の帯「取込先 [タブ ▼] › [ファイル ▼]」（登録画面の保存先の帯と同じ形）
 *
 * アプリ取込・ブックマーク取込・ブックマークの取込ルールの編集で使う。状態は useImportDestination が持つ。
 * 新しいタブを選ぶとタブ名、新しいデータファイルを選ぶとファイル名の欄を出す
 */
function ImportDestinationBand({ dest }: ImportDestinationBandProps): ReactElement {
  const { t } = useTranslation();
  return (
    <div className="import-dest">
      <span className="import-dest-label">{t('importCommon.destination')}</span>
      <select
        aria-label={t('importCommon.destTab')}
        value={dest.destTab}
        onChange={(e) => dest.setDestTab(Number(e.target.value))}
      >
        {dest.dataFileTabs.map((tab, index) => (
          <option key={`${index}-${tab.files[0] ?? ''}`} value={index}>
            {tab.name}
          </option>
        ))}
        <option value={NEW_TAB}>{t('importCommon.newTab')}</option>
      </select>
      <span className="import-dest-sep" aria-hidden>
        ›
      </span>
      <select
        aria-label={t('importCommon.destFile')}
        value={dest.destFile}
        onChange={(e) => dest.setDestFile(e.target.value)}
        disabled={dest.destTab === NEW_TAB}
      >
        <option value={NEW_FILE}>{t('importCommon.newFile')}</option>
        {dest.destTabFiles.map((file) => (
          <option key={file} value={file}>
            {dest.fileLabel(file)}
          </option>
        ))}
      </select>
      {dest.destTab === NEW_TAB && (
        <label className="import-dest-field">
          <span>{t('importCommon.tabName')}</span>
          <input
            type="text"
            value={dest.newTabName}
            onChange={(e) => dest.setNewTabName(e.target.value)}
            placeholder={dest.defaultName}
          />
        </label>
      )}
      {dest.destFile === NEW_FILE && (
        <label className="import-dest-field">
          <span>{t('importCommon.fileName')}</span>
          <input
            type="text"
            value={dest.newFileLabel}
            onChange={(e) => dest.setNewFileLabel(e.target.value)}
            placeholder={dest.defaultName}
          />
        </label>
      )}
    </div>
  );
}

export default ImportDestinationBand;
