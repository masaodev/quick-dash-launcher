import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
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

const FORMATS: readonly ClipboardFormat[] = ['text', 'html', 'rtf', 'image', 'file'];

function formatToLabel(format: ClipboardFormat): string {
  return FORMATS.includes(format) ? i18next.t(`clipboardEditor.formats.${format}`) : format;
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
  const { t } = useTranslation();
  const preview = capturedData?.preview || sessionData?.preview;
  const formats = capturedData?.formats || sessionData?.formats || [];
  const timestamp = capturedData?.savedAt || sessionData?.capturedAt || Date.now();
  const isPersisted = !!capturedData;

  return (
    <div className="clipboard-captured-data">
      <div className="section-header">
        <h4>{isPersisted ? t('clipboardEditor.savedData') : t('clipboardEditor.capturedData')}</h4>
      </div>

      <div className="captured-info">
        {preview && (
          <div className="text-preview">
            <pre>{preview}</pre>
          </div>
        )}

        <div className="format-info">
          <span className="label">{t('clipboardEditor.format')}</span>
          <span className="formats">{formats.map(formatToLabel).join(', ')}</span>
        </div>

        <div className="saved-info">
          <span className="label">
            {isPersisted ? t('clipboardEditor.savedAt') : t('clipboardEditor.capturedAt')}
          </span>
          <span className="date">{new Date(timestamp).toLocaleString('ja-JP')}</span>
        </div>

        <div className="recapture-action">
          <Button variant="info" onClick={onRecapture} disabled={capturing || !canCapture}>
            {capturing ? t('clipboardEditor.capturing') : t('clipboardEditor.overwrite')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClipboardPreview({ state }: { state: CurrentClipboardState }): React.ReactElement {
  const { t } = useTranslation();
  if (state.imageThumbnail) {
    return (
      <div className="image-preview">
        <img src={state.imageThumbnail} alt={t('clipboardEditor.imageAlt')} />
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
  return <div className="no-preview">{t('clipboardEditor.noPreview')}</div>;
}

const ClipboardItemEditor: React.FC<ClipboardItemEditorProps> = ({
  capturedData,
  sessionData,
  onCapture,
  onError,
}) => {
  const { t } = useTranslation();
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
        onError?.(result.error || t('clipboardEditor.captureFailed'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('clipboardEditor.captureFailed');
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
          <h4>{t('clipboardEditor.current')}</h4>
          <Button variant="info" size="sm" onClick={checkClipboard} disabled={loading}>
            {loading ? t('clipboardEditor.checking') : t('clipboardEditor.refresh')}
          </Button>
        </div>

        {currentState ? (
          currentState.hasContent ? (
            <div className="clipboard-preview">
              <ClipboardPreview state={currentState} />

              {/* フォーマット情報 */}
              <div className="format-info">
                <span className="label">{t('clipboardEditor.format')}</span>
                <span className="formats">
                  {currentState.formats.map(formatToLabel).join(', ')}
                </span>
              </div>

              {/* サイズ情報 */}
              {currentState.estimatedSize && (
                <div className="size-info">
                  <span className="label">{t('clipboardEditor.estimatedSize')}</span>
                  <span className="size">{formatDataSize(currentState.estimatedSize)}</span>
                </div>
              )}

              {/* キャプチャボタン */}
              <div className="capture-action">
                <Button variant="primary" onClick={handleCapture} disabled={capturing}>
                  {capturing ? t('clipboardEditor.capturing') : t('clipboardEditor.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="clipboard-empty">
              <p>{t('clipboardEditor.empty')}</p>
              <p className="hint">{t('clipboardEditor.emptyHint')}</p>
            </div>
          )
        ) : (
          <div className="clipboard-loading">{t('clipboardEditor.loading')}</div>
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
          <strong>{t('clipboardEditor.notesLabel')}</strong> {t('clipboardEditor.notes')}
        </p>
      </div>
    </div>
  );
};

export default ClipboardItemEditor;
