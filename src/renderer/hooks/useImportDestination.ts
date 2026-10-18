import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataFileTab } from '@common/types';

import type { NewImportFileTarget } from './useAdminTabStructure';

/** 取込先。既存のデータファイルか、取り込むときに作る新しいデータファイル（タブごと作ることもある） */
export type ImportDestination = { kind: 'existing'; fileName: string } | NewImportFileTarget;

/** タブのプルダウンで「＋ 新しいタブ」を表す値 */
export const NEW_TAB = -1;
/** ファイルのプルダウンで「＋ 新しいデータファイル」を表す値 */
export const NEW_FILE = '';

interface UseImportDestinationOptions {
  /** 開いているあいだ true。開くたびに初期値へ戻す */
  isOpen: boolean;
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
  /** 初期のタブ（アイテム管理で選んでいるタブなど） */
  initialTabIndex: number;
  /** 初期のデータファイル。省略するとタブの先頭のデータファイル */
  initialFile?: string;
  /** 新しいタブ・データファイルの名前の初期値（「アプリ」「ブックマーク」など） */
  defaultName: string;
}

/**
 * 取込画面の「取込先 [タブ ▼] › [ファイル ▼]」の帯の状態（アプリ取込・ブックマーク取込・ルールの編集で共通）
 *
 * 既定は「選んでいるタブ › そのタブの先頭のデータファイル」（データファイルを分けて使うのは慣れた人なので、
 * 新しいデータファイルは選んだときだけ作る。2026-10-18 本人）。新しいタブ・ファイルは呼び出し側が確定のときに作る
 * （useAdminTabStructure の createImportFile）。帯の見た目は ImportDestinationBand
 */
export function useImportDestination({
  isOpen,
  dataFileTabs,
  dataFileLabels,
  initialTabIndex,
  initialFile,
  defaultName,
}: UseImportDestinationOptions) {
  const { t } = useTranslation();
  const [destTab, setDestTab] = useState<number>(initialTabIndex);
  const [destFile, setDestFile] = useState<string>(NEW_FILE);
  /** タブの先頭のデータファイル（ファイルの無いタブ・新しいタブなら「＋ 新しいデータファイル」） */
  const firstFileOf = (tabIndex: number): string =>
    tabIndex === NEW_TAB ? NEW_FILE : (dataFileTabs[tabIndex]?.files[0] ?? NEW_FILE);
  const [newTabName, setNewTabName] = useState('');
  const [newFileLabel, setNewFileLabel] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    // 初期のファイルが指定されていれば、そのファイルのあるタブを選ぶ
    const fileTab =
      initialFile !== undefined
        ? dataFileTabs.findIndex((tab) => tab.files.includes(initialFile))
        : -1;
    if (fileTab >= 0 && initialFile) {
      setDestTab(fileTab);
      setDestFile(initialFile);
    } else {
      const tabIndex =
        initialTabIndex >= 0 && initialTabIndex < dataFileTabs.length ? initialTabIndex : 0;
      setDestTab(tabIndex);
      setDestFile(firstFileOf(tabIndex));
    }
    setNewTabName(defaultName);
    setNewFileLabel(defaultName);
  }, [isOpen]);

  const destTabFiles = useMemo(
    () => (destTab === NEW_TAB ? [] : (dataFileTabs[destTab]?.files ?? [])),
    [destTab, dataFileTabs]
  );
  const fileLabel = (fileName: string) => dataFileLabels[fileName] || fileName;

  const destination: ImportDestination =
    destTab === NEW_TAB
      ? // 新しいタブにはファイルが 1 つできるだけなので、ファイル名はタブ名と同じにする
        { kind: 'newTab', tabName: newTabName, fileLabel: newTabName }
      : destFile === NEW_FILE
        ? { kind: 'newFile', tabIndex: destTab, fileLabel: newFileLabel }
        : { kind: 'existing', fileName: destFile };

  // フッターの「〜に取り込む」（登録画面の「〜に登録」と同じく、ファイルが 1 つのタブはタブ名だけ）
  const destinationText = (() => {
    if (destination.kind === 'newTab') {
      return t('importCommon.newTabName', { name: newTabName.trim() || defaultName });
    }
    const tab = dataFileTabs[destTab]?.name ?? '';
    if (destination.kind === 'newFile') {
      const file = t('importCommon.newFileName', { name: newFileLabel.trim() || defaultName });
      return t('register.placementTabFile', { tab, file });
    }
    return destTabFiles.length <= 1
      ? t('register.placementTab', { tab })
      : t('register.placementTabFile', { tab, file: fileLabel(destFile) });
  })();

  /** 「登録済み」の判定に使うデータファイル（新しいファイルなら、そのタブのほかのファイル） */
  const compareFiles = useMemo(
    () => (destTab !== NEW_TAB && destFile !== NEW_FILE ? [destFile] : destTabFiles),
    [destTab, destFile, destTabFiles]
  );

  return {
    destTab,
    setDestTab: (tab: number) => {
      setDestTab(tab);
      setDestFile(firstFileOf(tab));
    },
    destFile,
    setDestFile,
    newTabName,
    setNewTabName,
    newFileLabel,
    setNewFileLabel,
    destTabFiles,
    dataFileTabs,
    fileLabel,
    defaultName,
    destination,
    destinationText,
    compareFiles,
  };
}

export type ImportDestinationState = ReturnType<typeof useImportDestination>;
