import { useEffect } from 'react';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { PathUtils } from '@common/utils/pathUtils';
import type { ClipboardItem, LauncherItem } from '@common/types';

import { logError, logWarn } from '../utils/debug';
import { classifyPastedText, makeClipboardDisplayName } from '../utils/pasteClassifier';

import { useFileOperations } from './useFileOperations';

/**
 * ワークスペースへの Ctrl+V 貼り付け
 *
 * クリップボードの中身で振り分ける:
 * - ファイル（エクスプローラーでコピー）→ paste イベントでパスからアイテム
 * - URL / カスタム URI / Windows のパス → 起動アイテム
 * - それ以外のテキスト・画像 → クリップボードアイテム（起動時にクリップボードへ書き戻す）
 *
 * 以前はテキストの 1 行目を種別判定にかけるだけで、ただの文字列がフォルダになっていた。
 */
export function useClipboardPaste(
  onItemsAdded: () => void,
  activeGroupId?: string,
  activeWorkspaceId?: string
) {
  const { extractFilePaths, addItemsFromFilePaths, fetchFaviconSafely } = useFileOperations();

  useEffect(() => {
    function isInputElement(target: EventTarget | null): boolean {
      const el = target as HTMLElement;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    }

    async function notifyAdded(displayName: string, path: string): Promise<void> {
      try {
        await window.electronAPI.showToastWindow({
          displayName,
          itemType: 'workspaceAdd',
          path,
        });
      } catch (error) {
        logWarn('Failed to show toast for pasted item:', error);
      }
    }

    async function addLauncherItem(
      value: string,
      type: LauncherItem['type'],
      displayName: string,
      icon?: string
    ): Promise<void> {
      await window.electronAPI.workspaceAPI.addItem(
        { displayName, path: value, type, icon },
        activeGroupId,
        activeWorkspaceId
      );
      await notifyAdded(displayName, value);
      onItemsAdded();
    }

    /** パスは実在すればアイコン付きで、なければ実在確認なしで追加する（ネットワークパスの応答待ちを避ける） */
    async function addPathItem(value: string): Promise<void> {
      const added = await window.electronAPI.workspaceAPI.addItemsFromPaths(
        [value],
        activeGroupId,
        activeWorkspaceId
      );
      const displayName = PathUtils.getFileName(value.replace(/[\\/]+$/, '')) || value;
      if (added.length > 0) {
        await notifyAdded(displayName, value);
        onItemsAdded();
        return;
      }
      await addLauncherItem(value, detectItemTypeSync(value), displayName);
    }

    /** クリップボードの中身をそのまま保存するアイテム（テキスト・画像） */
    async function addClipboardItem(displayNameHint?: string): Promise<void> {
      const result = await window.electronAPI.clipboardAPI.capture();
      if (!result.success || !result.dataFileRef) {
        logWarn('Clipboard capture for paste failed:', result.error);
        return;
      }
      const displayName = displayNameHint ?? result.preview ?? 'クリップボード';
      const item: ClipboardItem = {
        type: 'clipboard',
        displayName,
        clipboardDataRef: result.dataFileRef,
        savedAt: result.savedAt ?? Date.now(),
        preview: result.preview,
        formats: result.formats ?? [],
      };
      await window.electronAPI.workspaceAPI.addItem(item, activeGroupId, activeWorkspaceId);
      await notifyAdded(displayName, result.preview ?? '');
      onItemsAdded();
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'v') return;
      if (isInputElement(e.target)) return;

      try {
        const state = await window.electronAPI.clipboardAPI.checkCurrent();
        if (!state.hasContent) return;
        // ファイルは paste イベント（File オブジェクトからパスを取る）に任せる
        if (state.formats.includes('file')) return;

        const text = state.formats.includes('text') ? await navigator.clipboard.readText() : '';
        const classified = classifyPastedText(text);

        if (!classified) {
          // テキストがない: 画像や HTML だけならクリップボードアイテムにする
          if (state.formats.some((f) => f === 'image' || f === 'html' || f === 'rtf')) {
            await addClipboardItem();
          }
          return;
        }

        switch (classified.kind) {
          case 'url': {
            const icon = await fetchFaviconSafely(classified.value);
            await addLauncherItem(classified.value, 'url', classified.value, icon);
            return;
          }
          case 'customUri':
            await addLauncherItem(classified.value, 'customUri', classified.value);
            return;
          case 'path':
            await addPathItem(classified.value);
            return;
          case 'text':
            await addClipboardItem(makeClipboardDisplayName(classified.value));
            return;
        }
      } catch (error) {
        logError('Failed to add item from clipboard paste:', error);
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      if (isInputElement(e.target)) return;
      if (!e.clipboardData?.files || e.clipboardData.files.length === 0) return;

      e.preventDefault();
      try {
        // スクリーンショットのような、パスを持たない画像 File は空になり何も追加されない
        //（その場合は keydown 側がクリップボードアイテムにしている）
        const filePaths = await extractFilePaths(e.clipboardData.files);
        await addItemsFromFilePaths(filePaths, onItemsAdded, activeGroupId, activeWorkspaceId);
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
  }, [
    onItemsAdded,
    extractFilePaths,
    addItemsFromFilePaths,
    fetchFaviconSafely,
    activeGroupId,
    activeWorkspaceId,
  ]);
}
