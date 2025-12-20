import { useEffect } from 'react';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { useFileOperations } from './useFileOperations';

/**
 * クリップボードペースト処理を管理するカスタムフック
 *
 * Ctrl+V（またはCmd+V）でクリップボードからURL/パス/ファイルを取得し、
 * ワークスペースにアイテムを追加します。
 *
 * 対応形式：
 * - テキスト（URL、ファイルパス、カスタムURI）
 * - ファイルオブジェクト（エクスプローラーからCtrl+Cでコピーしたファイル）
 *
 * @param onItemsAdded アイテム追加完了時のコールバック
 * @param activeGroupId アクティブなグループID（指定された場合、そのグループに追加）
 *
 * @example
 * ```tsx
 * useClipboardPaste(() => {
 *   loadItems(); // アイテムを再読み込み
 * }, activeGroupId);
 * ```
 */
export function useClipboardPaste(onItemsAdded: () => void, activeGroupId?: string) {
  const { extractFilePaths, addItemsFromFilePaths, fetchFaviconSafely } = useFileOperations();

  useEffect(() => {
    /**
     * キーボードイベントハンドラー
     * Ctrl+V または Cmd+V を検出してペースト処理を実行
     */
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ctrl+V または Cmd+V の検出
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // Input/Textarea要素内でのペーストはスキップ（通常の入力として処理）
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        try {
          // クリップボードからテキストを取得
          const text = await navigator.clipboard.readText();

          // 最初の行のみを抽出・トリム
          const firstLine = text.split('\n')[0].trim();

          // 空文字の場合はスキップ
          if (!firstLine) {
            return;
          }

          // アイテムタイプを判定
          const itemType = detectItemTypeSync(firstLine);

          // URLの場合、ファビコンを取得
          let icon: string | undefined;
          if (itemType === 'url') {
            icon = await fetchFaviconSafely(firstLine);
          }

          // アイテムを追加（アクティブグループに追加）
          const item = {
            name: firstLine,
            path: firstLine,
            type: itemType,
            icon,
          };

          await window.electronAPI.workspaceAPI.addItem(item, activeGroupId);

          // UI更新のコールバックを実行
          onItemsAdded();
        } catch (error) {
          console.error('Failed to add item from clipboard paste:', error);
        }
      }
    };

    /**
     * ペーストイベントハンドラー
     * ファイルオブジェクトのペーストを処理
     */
    const handlePaste = async (e: ClipboardEvent) => {
      // Input/Textarea要素内でのペーストはスキップ（通常の入力として処理）
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // ファイルがペーストされた場合
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        e.preventDefault();

        try {
          const filePaths = await extractFilePaths(e.clipboardData.files);
          await addItemsFromFilePaths(filePaths, onItemsAdded, activeGroupId);
        } catch (error) {
          console.error('Failed to add items from file paste:', error);
        }
      }
    };

    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);

    // クリーンアップ
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
    };
  }, [onItemsAdded, extractFilePaths, addItemsFromFilePaths, fetchFaviconSafely, activeGroupId]);
}
