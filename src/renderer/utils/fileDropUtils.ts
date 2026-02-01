import type React from 'react';

import { logError } from './debug';

/**
 * ドロップされたファイルからパスを抽出する
 */
export function getPathsFromDropEvent(e: DragEvent | React.DragEvent): string[] {
  if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
    return [];
  }

  const paths: string[] = [];
  const files = e.dataTransfer.files;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const filePath = window.electronAPI.getPathForFile(file);
      if (filePath) {
        paths.push(filePath);
      }
    } catch (error) {
      logError(`Error getting path for ${file.name}:`, error);
    }
  }

  return paths;
}
