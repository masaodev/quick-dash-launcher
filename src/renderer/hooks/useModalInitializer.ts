import i18next from 'i18next';
import {
  convertEditingAppItemToRegisterItem,
  convertEditableJsonItemToRegisterItem,
  getDefaultTab,
} from '@common/utils/dataConverters';
import { DIR_OPTIONS_DEFAULTS, isEditableJsonItem } from '@common/types';
import type { RegisterItem, EditingAppItem, DataFileTab, EditableJsonItem } from '@common/types';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { debugInfo, logWarn, logError } from '../utils/debug';

/**
 * ドロップされたパスから表示名の初期値を作る
 *
 * ファイルは拡張子を除く。フォルダは名前にドットがあっても削らない（`j-gate3.0` を `j-gate3` にしない）
 */
function extractDefaultName(filePath: string, itemType: RegisterItem['type']): string {
  if (filePath.includes('://')) {
    try {
      const url = new URL(filePath);
      return url.hostname.replace('www.', '');
    } catch {
      return filePath;
    }
  }

  const parts = filePath.replace(/[\\/]+$/, '').split(/[\\/]/);
  const basename = parts[parts.length - 1] || filePath;
  if (itemType === 'folder') return basename;
  const lastDot = basename.lastIndexOf('.');
  const ext = lastDot !== -1 ? basename.substring(lastDot) : '';
  return ext ? basename.slice(0, -ext.length) : basename;
}

export function useModalInitializer() {
  const initializeFromEditingItem = async (
    editingItem: EditingAppItem | EditableJsonItem,
    tabs: DataFileTab[],
    onLoadCustomIcon: (index: number, customIconFileName: string) => Promise<void>
  ): Promise<RegisterItem[]> => {
    try {
      // カスタムアイコンは変換後の RegisterItem から読む（アイテム・クリップボード・セットのどれでも入る）
      const item: RegisterItem = isEditableJsonItem(editingItem)
        ? convertEditableJsonItemToRegisterItem(editingItem, tabs)
        : convertEditingAppItemToRegisterItem(editingItem, tabs);

      if (item.customIcon) {
        await onLoadCustomIcon(0, item.customIcon);
      }

      return [item];
    } catch (error) {
      logError('Error initializing from editing item:', error);
      alert(i18next.t('register.errors.initEditFailed', { error: String(error) }));
      return [];
    }
  };

  const initializeFromDroppedPaths = async (
    droppedPaths: string[],
    currentTab: string | undefined,
    tabs: DataFileTab[]
  ): Promise<RegisterItem[]> => {
    const defaultTab = getDefaultTab(currentTab, tabs);
    const newItems: RegisterItem[] = [];

    try {
      for (const filePath of droppedPaths) {
        if (!filePath) {
          logWarn('Skipping undefined path');
          continue;
        }
        debugInfo('Processing dropped path:', filePath);
        const itemType = await detectItemType(filePath, window.electronAPI.getPathKind);
        debugInfo('Detected item type:', itemType);
        const name = extractDefaultName(filePath, itemType);
        debugInfo('Extracted name:', name);

        let icon: string | undefined;
        try {
          // スクリプト系やUWPの扱いはgetIconForItem側に集約されている
          icon = (await window.electronAPI.getIconForItem(filePath, itemType)) ?? undefined;
        } catch (error) {
          logError('Failed to extract icon:', error);
        }

        newItems.push({
          displayName: name,
          path: filePath,
          type: itemType,
          targetTab: defaultTab,
          targetFile: defaultTab,
          folderProcessing: itemType === 'folder' ? 'folder' : undefined,
          icon,
          itemCategory: 'item',
          dirOptions: itemType === 'folder' ? { ...DIR_OPTIONS_DEFAULTS } : undefined,
        });
      }

      return newItems;
    } catch (error) {
      logError('Error initializing items:', error);
      alert(i18next.t('register.errors.initFailed', { error: String(error) }));
      return [];
    }
  };

  const createEmptyTemplateItem = (
    currentTab: string | undefined,
    tabs: DataFileTab[]
  ): RegisterItem[] => {
    const defaultTab = getDefaultTab(currentTab, tabs);
    return [
      {
        displayName: '',
        path: '',
        type: 'app',
        targetTab: defaultTab,
        targetFile: defaultTab,
        itemCategory: 'item',
      },
    ];
  };

  return {
    initializeFromEditingItem,
    initializeFromDroppedPaths,
    createEmptyTemplateItem,
  };
}
