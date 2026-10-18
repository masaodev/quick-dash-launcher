import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import React from 'react';
import type { DataFileTab, RegisterItem } from '@common/types';

interface RegisterPlacementBarProps {
  item: RegisterItem;
  availableTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  onTargetTabChange: (targetTab: string) => void;
  onTargetFileChange: (targetFile: string) => void;
}

/**
 * 保存先を「「メイン」タブ」「「仕事」タブの「資料」」の形で返す（フッターの「〜に登録」に使う）。
 * ファイルが 1 つのタブはタブ名だけ
 */
export function describePlacement(
  item: RegisterItem,
  availableTabs: DataFileTab[],
  dataFileLabels: Record<string, string>,
  t: TFunction
): string {
  const tab = availableTabs.find((candidate) => candidate.files.includes(item.targetTab));
  if (!tab) return '';
  if (tab.files.length <= 1) return t('register.placementTab', { tab: tab.name });
  const file = item.targetFile || tab.files[0];
  return t('register.placementTabFile', { tab: tab.name, file: dataFileLabels[file] || file });
}

/**
 * 登録・編集画面の上の帯。保存先のタブとファイルを選ぶ（入力欄の前提なので、ほかの欄と分けて出す）
 */
const RegisterPlacementBar: React.FC<RegisterPlacementBarProps> = ({
  item,
  availableTabs,
  dataFileLabels,
  onTargetTabChange,
  onTargetFileChange,
}) => {
  const { t } = useTranslation();
  const selectedTab = availableTabs.find((tab) => tab.files.includes(item.targetTab));

  return (
    <div className="register-dest">
      <span className="register-dest-label">{t('register.destination')}</span>
      <select
        aria-label={t('register.targetTab')}
        value={item.targetTab}
        onChange={(e) => onTargetTabChange(e.target.value)}
      >
        {availableTabs.map((tab) => (
          <option key={tab.files[0]} value={tab.files[0]}>
            {tab.name}
          </option>
        ))}
      </select>
      {selectedTab && selectedTab.files.length > 1 && (
        <>
          <span className="register-dest-sep" aria-hidden>
            ›
          </span>
          <select
            aria-label={t('register.targetFile')}
            value={item.targetFile || selectedTab.files[0]}
            onChange={(e) => onTargetFileChange(e.target.value)}
          >
            {selectedTab.files.map((file) => (
              <option key={file} value={file}>
                {dataFileLabels[file] || file}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
};

export default RegisterPlacementBar;
