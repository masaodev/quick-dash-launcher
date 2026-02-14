import {
  convertEditingAppItemToRegisterItem,
  convertEditableJsonItemToRegisterItem,
} from '@common/utils/dataConverters';
import { DEFAULT_DATA_FILE, isEditingLauncherItem } from '@common/types';
import type { RegisterItem, EditingAppItem, DataFileTab, EditableJsonItem } from '@common/types';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { debugInfo, logWarn, logError } from '../utils/debug';

function getDefaultTab(currentTab: string | undefined, tabs: DataFileTab[]): string {
  return currentTab || (tabs.length > 0 ? tabs[0].files[0] : DEFAULT_DATA_FILE);
}

function extractDefaultName(filePath: string): string {
  if (filePath.includes('://')) {
    try {
      const url = new URL(filePath);
      return url.hostname.replace('www.', '');
    } catch {
      return filePath;
    }
  }

  const parts = filePath.split(/[\\/]/);
  const basename = parts[parts.length - 1] || filePath;
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
      let item: RegisterItem;
      let customIconFileName: string | undefined;

      if ('item' in editingItem && 'meta' in editingItem) {
        item = convertEditableJsonItemToRegisterItem(editingItem, tabs);
        const itemType = editingItem.item.type;
        if ((itemType === 'item' || itemType === 'clipboard') && 'customIcon' in editingItem.item) {
          customIconFileName = editingItem.item.customIcon;
        }
      } else {
        item = convertEditingAppItemToRegisterItem(editingItem, tabs);
        if (isEditingLauncherItem(editingItem) && editingItem.customIcon) {
          customIconFileName = editingItem.customIcon;
        }
      }

      if (customIconFileName) {
        await onLoadCustomIcon(0, customIconFileName);
      }

      return [item];
    } catch (error) {
      logError('Error initializing from editing item:', error);
      alert('編集アイテムの初期化中にエラーが発生しました: ' + error);
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
        const itemType = await detectItemType(filePath, window.electronAPI.isDirectory);
        debugInfo('Detected item type:', itemType);
        const name = extractDefaultName(filePath);
        debugInfo('Extracted name:', name);

        let icon: string | undefined;
        try {
          const isBatchFile =
            itemType === 'app' &&
            (filePath.endsWith('.bat') || filePath.endsWith('.cmd') || filePath.endsWith('.com'));
          icon = isBatchFile
            ? ((await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined)
            : ((await window.electronAPI.getIconForItem(filePath, itemType)) ?? undefined);
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
          dirOptions:
            itemType === 'folder'
              ? {
                  depth: 0,
                  types: 'both',
                  filter: undefined,
                  exclude: undefined,
                  prefix: undefined,
                  suffix: undefined,
                }
              : undefined,
        });
      }

      return newItems;
    } catch (error) {
      logError('Error initializing items:', error);
      alert('アイテムの初期化中にエラーが発生しました: ' + error);
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
