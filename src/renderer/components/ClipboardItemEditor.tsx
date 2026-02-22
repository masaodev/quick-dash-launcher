import React, { useState, useEffect } from 'react';
import type { CurrentClipboardState, ClipboardFormat } from '@common/types';

import { Button } from './ui';
import '../styles/components/ClipboardItemEditor.css';

interface CapturedDataInfo {
  dataFileRef: string;
  preview?: string;
  formats: ClipboardFormat[];
  savedAt: number;
}

interface SessionDataInfo {
  sessionId: string;
  preview?: string;
  formats: ClipboardFormat[];
  capturedAt: number;
}

interface CaptureResult {
  sessionId: string;
  preview?: string;
  formats: ClipboardFormat[];
  capturedAt: number;
  dataSize: number;
}

interface ClipboardItemEditorProps {
  capturedData?: CapturedDataInfo;
  sessionData?: SessionDataInfo;
  onCapture: (result: CaptureResult) => void;
  onError?: (error: string) => void;
}

const FORMAT_LABELS: Record<ClipboardFormat, string> = {
  text: 'テキスト',
  html: 'HTML',
  rtf: 'RTF',
  image: '画像',
  file: 'ファイル',
};

function formatToLabel(format: ClipboardFormat): string {
  return FORMAT_LABELS[format] || format;
}

function formatDataSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const CLIPBOARD_CHECK_INTERVAL_MS = 3000;

interface CapturedDataSectionProps {
  capturedData?: CapturedDataInfo;
  sessionData?: SessionDataInfo;
  onRecapture: () => void;
  capturing: boolean;
  canCapture: boolean;
}

function CapturedDataSection({
  capturedData,
  sessionData,
  onRecapture,
  capturing,
  canCapture,
}: CapturedDataSectionProps): React.ReactElement {
  const preview = capturedData?.preview || sessionData?.preview;
  const formats = capturedData?.formats || sessionData?.formats || [];
  const timestamp = capturedData?.savedAt || sessionData?.capturedAt || Date.now();
  const isPersisted = !!capturedData;

  return (
    <div className="clipboard-captured-data">
      <div className="section-header">
        <h4>{isPersisted ? '保存済みデータ' : 'キャプチャ済みデータ'}</h4>
      </div>

      <div className="captured-info">
        {preview && (
          <div className="text-preview">
            <pre>{preview}</pre>
          </div>
        )}

        <div className="format-info">
          <span className="label">フォーマット:</span>
          <span className="formats">{formats.map(formatToLabel).join(', ')}</span>
        </div>

        <div className="saved-info">
          <span className="label">{isPersisted ? '保存日時:' : 'キャプチャ日時:'}</span>
          <span className="date">{new Date(timestamp).toLocaleString('ja-JP')}</span>
        </div>

        <div className="recapture-action">
          <Button variant="info" onClick={onRecapture} disabled={capturing || !canCapture}>
            {capturing ? 'キャプチャ中...' : '現在のクリップボードで上書き'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClipboardPreview({ state }: { state: CurrentClipboardState }): React.ReactElement {
  if (state.imageThumbnail) {
    return (
      <div className="image-preview">
        <img src={state.imageThumbnail} alt="クリップボード画像" />
      </div>
    );
  }
  if (state.preview) {
    return (
      <div className="text-preview">
        <pre>{state.preview}</pre>
      </div>
    );
  }
  return <div className="no-preview">プレビューなし</div>;
}

const ClipboardItemEditor: React.FC<ClipboardItemEditorProps> = ({
  capturedData,
  sessionData,
  onCapture,
  onError,
}) => {
  const [currentState, setCurrentState] = useState<CurrentClipboardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);

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

  useEffect(() => {
    checkClipboard();
    const interval = setInterval(checkClipboard, CLIPBOARD_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await window.electronAPI.clipboardAPI.captureToSession();

      if (result.success && result.sessionId) {
        onCapture({
          sessionId: result.sessionId,
          preview: result.preview,
          formats: result.formats || [],
          capturedAt: result.capturedAt || Date.now(),
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
              <ClipboardPreview state={currentState} />

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

      {(capturedData || sessionData) && (
        <CapturedDataSection
          capturedData={capturedData}
          sessionData={sessionData}
          onRecapture={handleCapture}
          capturing={capturing}
          canCapture={currentState?.hasContent ?? false}
        />
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
