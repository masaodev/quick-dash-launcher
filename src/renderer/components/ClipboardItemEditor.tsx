/**
 * クリップボードアイテムエディター
 *
 * クリップボードの内容をキャプチャして保存するためのエディターコンポーネント
 */

import React, { useState, useEffect } from 'react';
import type { CurrentClipboardState, ClipboardFormat } from '@common/types';

import { Button } from './ui';
import '../styles/components/ClipboardItemEditor.css';

interface ClipboardItemEditorProps {
  /** キャプチャ済みデータがある場合の情報 */
  capturedData?: {
    dataFileRef: string;
    preview?: string;
    formats: ClipboardFormat[];
    savedAt: number;
  };
  /** キャプチャ成功時のコールバック */
  onCapture: (result: {
    dataFileRef: string;
    preview?: string;
    formats: ClipboardFormat[];
    savedAt: number;
    dataSize: number;
  }) => void;
  /** エラー発生時のコールバック */
  onError?: (error: string) => void;
}

/**
 * フォーマットを日本語で表示
 */
function formatToLabel(format: ClipboardFormat): string {
  switch (format) {
    case 'text':
      return 'テキスト';
    case 'html':
      return 'HTML';
    case 'rtf':
      return 'RTF';
    case 'image':
      return '画像';
    case 'file':
      return 'ファイル';
    default:
      return format;
  }
}

/**
 * データサイズを人間が読みやすい形式に変換
 */
function formatDataSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}

const ClipboardItemEditor: React.FC<ClipboardItemEditorProps> = ({
  capturedData,
  onCapture,
  onError,
}) => {
  const [currentState, setCurrentState] = useState<CurrentClipboardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // 現在のクリップボード状態を確認
  const checkClipboard = async () => {
    setLoading(true);
    try {
      const state = await window.electronAPI.clipboardAPI.checkCurrent();
      setCurrentState(state);
    } catch (error) {
      console.error('クリップボード状態の確認に失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時と定期的にクリップボードを確認
  useEffect(() => {
    checkClipboard();

    // 3秒ごとにクリップボードを確認
    const interval = setInterval(checkClipboard, 3000);

    return () => clearInterval(interval);
  }, []);

  // クリップボードをキャプチャ
  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await window.electronAPI.clipboardAPI.capture();

      if (result.success && result.dataFileRef) {
        onCapture({
          dataFileRef: result.dataFileRef,
          preview: result.preview,
          formats: result.formats || [],
          savedAt: result.savedAt || Date.now(),
          dataSize: result.dataSize || 0,
        });
      } else {
        onError?.(result.error || 'キャプチャに失敗しました');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'キャプチャに失敗しました';
      onError?.(message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="clipboard-item-editor">
      {/* 現在のクリップボード状態 */}
      <div className="clipboard-current-state">
        <div className="section-header">
          <h4>現在のクリップボード</h4>
          <Button variant="info" size="sm" onClick={checkClipboard} disabled={loading}>
            {loading ? '確認中...' : '更新'}
          </Button>
        </div>

        {currentState ? (
          currentState.hasContent ? (
            <div className="clipboard-preview">
              {/* プレビュー表示 */}
              {currentState.imageThumbnail ? (
                <div className="image-preview">
                  <img src={currentState.imageThumbnail} alt="クリップボード画像" />
                </div>
              ) : currentState.preview ? (
                <div className="text-preview">
                  <pre>{currentState.preview}</pre>
                </div>
              ) : (
                <div className="no-preview">プレビューなし</div>
              )}

              {/* フォーマット情報 */}
              <div className="format-info">
                <span className="label">フォーマット:</span>
                <span className="formats">
                  {currentState.formats.map(formatToLabel).join(', ')}
                </span>
              </div>

              {/* サイズ情報 */}
              {currentState.estimatedSize && (
                <div className="size-info">
                  <span className="label">推定サイズ:</span>
                  <span className="size">{formatDataSize(currentState.estimatedSize)}</span>
                </div>
              )}

              {/* キャプチャボタン */}
              <div className="capture-action">
                <Button variant="primary" onClick={handleCapture} disabled={capturing}>
                  {capturing ? 'キャプチャ中...' : 'このクリップボードを保存'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="clipboard-empty">
              <p>クリップボードは空です</p>
              <p className="hint">テキストや画像をコピーしてからキャプチャしてください</p>
            </div>
          )
        ) : (
          <div className="clipboard-loading">読み込み中...</div>
        )}
      </div>

      {/* キャプチャ済みデータの表示 */}
      {capturedData && (
        <div className="clipboard-captured-data">
          <div className="section-header">
            <h4>保存済みデータ</h4>
          </div>

          <div className="captured-info">
            {/* プレビュー */}
            {capturedData.preview && (
              <div className="text-preview">
                <pre>{capturedData.preview}</pre>
              </div>
            )}

            {/* フォーマット情報 */}
            <div className="format-info">
              <span className="label">フォーマット:</span>
              <span className="formats">{capturedData.formats.map(formatToLabel).join(', ')}</span>
            </div>

            {/* 保存日時 */}
            <div className="saved-info">
              <span className="label">保存日時:</span>
              <span className="date">{new Date(capturedData.savedAt).toLocaleString('ja-JP')}</span>
            </div>

            {/* 再キャプチャボタン */}
            <div className="recapture-action">
              <Button
                variant="info"
                onClick={handleCapture}
                disabled={capturing || !currentState?.hasContent}
              >
                {capturing ? 'キャプチャ中...' : '現在のクリップボードで上書き'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="clipboard-notes">
        <p>
          <strong>注意:</strong> 画像は最大10MBまで保存できます。
          ファイルの参照情報は保存されますが、復元には対応していません。
        </p>
      </div>
    </div>
  );
};

export default ClipboardItemEditor;
