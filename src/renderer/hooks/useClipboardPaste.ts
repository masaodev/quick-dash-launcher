import { useEffect } from 'react';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

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
 *
 * @example
 * ```tsx
 * useClipboardPaste(() => {
 *   loadItems(); // アイテムを再読み込み
 * });
 * ```
 */
export function useClipboardPaste(onItemsAdded: () => void) {
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
            try {
              const fetchedIcon = await window.electronAPI.fetchFavicon(firstLine);
              icon = fetchedIcon || undefined;
            } catch (error) {
              console.warn('Failed to fetch favicon for pasted URL:', firstLine, error);
            }
          }

          // アイテムを追加
          const item = {
            name: firstLine,
            path: firstLine,
            type: itemType,
            icon,
          };

          await window.electronAPI.workspaceAPI.addItem(item);

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
          const filePaths: string[] = [];

          // ファイルパスを取得
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const file = e.clipboardData.files[i];
            try {
              const filePath = window.electronAPI.getPathForFile(file);
              if (filePath) {
                filePaths.push(filePath);
              }
            } catch (error) {
              console.error(`Error getting path for ${file.name}:`, error);
            }
          }

          // ファイルパスが取得できた場合、アイテムを追加
          if (filePaths.length > 0) {
            await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths);
            onItemsAdded();
          }
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
  }, [onItemsAdded]);
}
