import { useEffect } from 'react';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { logError } from '../utils/debug';

import { useFileOperations } from './useFileOperations';

export function useClipboardPaste(onItemsAdded: () => void, activeGroupId?: string) {
  const { extractFilePaths, addItemsFromFilePaths, fetchFaviconSafely } = useFileOperations();

  useEffect(() => {
    function isInputElement(target: EventTarget | null): boolean {
      const el = target as HTMLElement;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'v') return;
      if (isInputElement(e.target)) return;

      try {
        const text = await navigator.clipboard.readText();
        const firstLine = text.split('\n')[0].trim();
        if (!firstLine) return;

        const itemType = detectItemTypeSync(firstLine);
        let icon: string | undefined;
        if (itemType === 'url') {
          icon = await fetchFaviconSafely(firstLine);
        }

        await window.electronAPI.workspaceAPI.addItem(
          { displayName: firstLine, path: firstLine, type: itemType, icon },
          activeGroupId
        );
        onItemsAdded();
      } catch (error) {
        logError('Failed to add item from clipboard paste:', error);
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (isInputElement(e.target)) return;
      if (!e.clipboardData?.files || e.clipboardData.files.length === 0) return;

      e.preventDefault();
      try {
        const filePaths = await extractFilePaths(e.clipboardData.files);
        await addItemsFromFilePaths(filePaths, onItemsAdded, activeGroupId);
      } catch (error) {
        logError('Failed to add items from file paste:', error);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [onItemsAdded, extractFilePaths, addItemsFromFilePaths, fetchFaviconSafely, activeGroupId]);
}
