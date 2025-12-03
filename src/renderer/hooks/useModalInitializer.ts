import { convertRawDataLineToRegisterItem, type RegisterItem } from '@common/utils/dataConverters';
import { detectItemType } from '@common/utils/itemTypeDetector';

import { RawDataLine, DataFileTab } from '../../common/types';
import { debugInfo, logWarn } from '../utils/debug';

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
   */
  const initializeFromEditingItem = async (
    editingItem: RawDataLine,
    tabs: DataFileTab[],
    onLoadCustomIcon: (index: number, customIconFileName: string) => Promise<void>
  ): Promise<RegisterItem[]> => {
    try {
      if (!editingItem) {
        console.error('No editing item provided');
        return [];
      }

      const item = await convertRawDataLineToRegisterItem(editingItem, tabs, (path) =>
        detectItemType(path, window.electronAPI.isDirectory)
      );

      // カスタムアイコンのプレビューを読み込み
      if (item.customIcon) {
        await onLoadCustomIcon(0, item.customIcon);
      }

      return [item];
    } catch (error) {
      console.error('Error initializing from editing item:', error);
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
    const defaultTab = currentTab || (tabs.length > 0 ? tabs[0].files[0] : 'data.txt');

    try {
      if (!droppedPaths || droppedPaths.length === 0) {
        console.error('No dropped paths provided');
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
          if (itemType === 'app') {
            // .bat/.cmd/.comファイルは拡張子ベースのアイコン取得を使用
            if (
              filePath.endsWith('.bat') ||
              filePath.endsWith('.cmd') ||
              filePath.endsWith('.com')
            ) {
              icon = (await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined;
            } else {
              icon = (await window.electronAPI.extractIcon(filePath)) ?? undefined;
            }
          } else if (itemType === 'file') {
            icon = (await window.electronAPI.extractIcon(filePath)) ?? undefined;
          } else if (itemType === 'customUri') {
            icon = (await window.electronAPI.extractCustomUriIcon(filePath)) ?? undefined;
            if (!icon) {
              icon = (await window.electronAPI.extractFileIconByExtension(filePath)) ?? undefined;
            }
          }
        } catch (error) {
          console.error('Failed to extract icon:', error);
        }

        newItems.push({
          name,
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
      console.error('Error initializing items:', error);
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
    const defaultTab = currentTab || (tabs.length > 0 ? tabs[0].files[0] : 'data.txt');
    return [
      {
        name: '',
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
