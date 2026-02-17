import type React from 'react';

import { logError } from './debug';

type DropEvent = DragEvent | React.DragEvent;

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * ドロップされたファイルからパスを抽出する
 */
export function getPathsFromDropEvent(e: DropEvent): string[] {
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

/**
 * ドロップイベントからURLを抽出する（ブラウザからのドラッグ&ドロップ対応）
 * text/uri-list → text/plain の順でHTTP(S) URLを取得
 */
export function getUrlsFromDropEvent(e: DropEvent): string[] {
  const dt = e.dataTransfer;
  if (!dt) return [];

  // text/uri-list を優先（複数URL対応、コメント行を除外）
  const uriList = dt.getData('text/uri-list');
  if (uriList) {
    const urls = uriList
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.startsWith('#') && isHttpUrl(line));
    if (urls.length > 0) return urls;
  }

  // フォールバック: text/plain から単一URL取得
  const text = dt.getData('text/plain')?.trim();
  if (text && isHttpUrl(text) && !text.includes('\n')) {
    return [text];
  }

  return [];
}
