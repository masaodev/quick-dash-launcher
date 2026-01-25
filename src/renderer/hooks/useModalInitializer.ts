import {
  convertEditingAppItemToRegisterItem,
  convertEditableJsonItemToRegisterItem,
} from '@common/utils/dataConverters';
import type { RegisterItem, EditingAppItem, DataFileTab, EditableJsonItem } from '@common/types';
import { isEditingLauncherItem } from '@common/types';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { debugInfo, logWarn, logError } from '../utils/debug';

/**
 * RegisterModalの初期化ロジックを管理するフック
 *
 * ドロップされたファイルや編集アイテムから、RegisterItemリストを生成します。
 */
export function useModalInitializer() {
  /**
   * パスから表示名を抽出
   */
  const extractDefaultName = (filePath: string): string => {
    if (filePath.includes('://')) {
      // URLの場合、ドメイン名を抽出
      try {
        const url = new URL(filePath);
        return url.hostname.replace('www.', '');
      } catch {
        return filePath;
      }
    }

    // ファイルまたはフォルダの場合、パスの最後の部分を抽出
    const parts = filePath.split(/[\\/]/);
    const basename = parts[parts.length - 1] || filePath;
    const lastDot = basename.lastIndexOf('.');
    const ext = lastDot !== -1 ? basename.substring(lastDot) : '';
    return ext ? basename.slice(0, -ext.length) : basename;
  };

  /**
   * 編集アイテムから初期化
   * EditingAppItemまたはEditableJsonItemを受け取る
   */
  const initializeFromEditingItem = async (
    editingItem: EditingAppItem | EditableJsonItem,
    tabs: DataFileTab[],
    onLoadCustomIcon: (index: number, customIconFileName: string) => Promise<void>
  ): Promise<RegisterItem[]> => {
    try {
      if (!editingItem) {
        logError('No editing item provided');
        return [];
      }

      let item: RegisterItem;
      let customIconFileName: string | undefined;

      // EditableJsonItem（アイテム管理画面から）かEditingAppItem（通常のランチャー画面から）かを判定
      if ('item' in editingItem && 'meta' in editingItem) {
        // EditableJsonItem
        item = convertEditableJsonItemToRegisterItem(editingItem, tabs);
        // EditableJsonItemの場合、カスタムアイコンはjsonItem.customIconに含まれている
        if (editingItem.item.type === 'item' && 'customIcon' in editingItem.item) {
          customIconFileName = editingItem.item.customIcon;
        }
      } else {
        // EditingAppItem
        item = convertEditingAppItemToRegisterItem(editingItem, tabs);
        // カスタムアイコンのプレビューを読み込み（LauncherItemの場合のみ）
        if (isEditingLauncherItem(editingItem) && editingItem.customIcon) {
          customIconFileName = editingItem.customIcon;
        }
      }

      // カスタムアイコンのプレビュー読み込み
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

  /**
   * ドロップされたパスから初期化
   */
  const initializeFromDroppedPaths = async (
    droppedPaths: string[],
    currentTab: string | undefined,
    tabs: DataFileTab[]
  ): Promise<RegisterItem[]> => {
    const newItems: RegisterItem[] = [];
    const defaultTab = currentTab || (tabs.length > 0 ? tabs[0].files[0] : 'data.json');

    try {
      if (!droppedPaths || droppedPaths.length === 0) {
        logError('No dropped paths provided');
        return [];
      }

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
          // IconService統合APIを使用（.bat/.cmd/.comの特別処理を含む）
          if (
            itemType === 'app' &&
            (filePath.endsWith('.bat') || filePath.endsWith('.cmd') || filePath.endsWith('.com'))
          ) {
            // .bat/.cmd/.comファイルは拡張子ベースのアイコン取得を使用
            icon = (await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined;
          } else {
            // その他は統合APIを使用
            icon = (await window.electronAPI.getIconForItem(filePath, itemType)) ?? undefined;
          }
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

  /**
   * 空のテンプレートアイテムを作成
   */
  const createEmptyTemplateItem = (
    currentTab: string | undefined,
    tabs: DataFileTab[]
  ): RegisterItem[] => {
    const defaultTab = currentTab || (tabs.length > 0 ? tabs[0].files[0] : 'data.json');
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
    extractDefaultName,
    initializeFromEditingItem,
    initializeFromDroppedPaths,
    createEmptyTemplateItem,
  };
}
