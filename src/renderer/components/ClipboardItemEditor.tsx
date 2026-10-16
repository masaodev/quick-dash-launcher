import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';
import type {
  ClipboardContent,
  ClipboardContentSource,
  ClipboardFormat,
  RegisterItem,
} from '@common/types';

import '../styles/components/ClipboardItemEditor.css';
import { logError } from '../utils/debug';

import { Button } from './ui';

/** 内容の作り方。新規はテキストを書く */
type EditorMode = 'text' | 'capture';

/** 取り込み直す前の中身（「元に戻す」で戻す） */
interface ContentSnapshot {
  clipboardSessionId?: string;
  clipboardDataRef?: string;
  clipboardFormats?: ClipboardFormat[];
  clipboardPreview?: string;
  clipboardSavedAt?: number;
}

interface ClipboardItemEditorProps {
  item: RegisterItem;
  onUpdate: (fields: Partial<RegisterItem>) => void;
  onError?: (error: string) => void;
  /** 入力チェックのエラー（内容欄の下に出す） */
  error?: string;
}

const FORMATS: readonly ClipboardFormat[] = ['text', 'html', 'rtf', 'image', 'file'];

function formatToLabel(format: ClipboardFormat): string {
  return FORMATS.includes(format) ? i18next.t(`clipboardEditor.formats.${format}`) : format;
}

/** 表示名に使う 1 行目（30 文字まで） */
function nameFromText(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const trimmed = firstLine.trim();
  return trimmed.length > 30 ? trimmed.substring(0, 30) + '...' : trimmed;
}

function hasSavedContent(item: RegisterItem): boolean {
  return !!item.clipboardSessionId || !!item.clipboardDataRef;
}

/** 取り込み・保存済みの中身がテキストだけか（そのままテキストとして編集できる） */
function isTextOnly(item: RegisterItem): boolean {
  const formats = item.clipboardFormats ?? [];
  return hasSavedContent(item) && formats.length === 1 && formats[0] === 'text';
}

function initialMode(item: RegisterItem): EditorMode {
  if (item.clipboardText !== undefined) return 'text';
  if (!hasSavedContent(item)) return 'text';
  return isTextOnly(item) ? 'text' : 'capture';
}

/** 中身を読む元（取り込んだばかりならセッション、そうでなければ保存済みの参照） */
function contentSourceOf(item: RegisterItem): ClipboardContentSource {
  return item.clipboardSessionId
    ? { sessionId: item.clipboardSessionId }
    : { dataFileRef: item.clipboardDataRef };
}

function snapshotOf(item: RegisterItem): ContentSnapshot {
  return {
    clipboardSessionId: item.clipboardSessionId,
    clipboardDataRef: item.clipboardDataRef,
    clipboardFormats: item.clipboardFormats,
    clipboardPreview: item.clipboardPreview,
    clipboardSavedAt: item.clipboardSavedAt,
  };
}

function discardSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  window.electronAPI.clipboardAPI.discardSession(sessionId).catch(() => undefined);
}

/**
 * クリップボードアイテムの「内容」欄。テキストを書くか、クリップボードから取り込むかを切り替える。
 * クリップボードは「取り込む」を押したときだけ読む（画面を開いただけでは読まない）
 */
const ClipboardItemEditor: React.FC<ClipboardItemEditorProps> = ({
  item,
  onUpdate,
  onError,
  error,
}) => {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<EditorMode>(() => initialMode(item));
  // テキスト欄に書いた値。書くまで（edited が false の間）は item.clipboardText を空のままにし、
  // 取り込み・保存済みの中身をそのまま使う
  const [draft, setDraft] = useState(item.clipboardText ?? '');
  const [edited, setEdited] = useState(item.clipboardText !== undefined);
  // 取り込み・保存済みの中身（テキストの全文・画像の縮小版）
  const [content, setContent] = useState<ClipboardContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [previous, setPrevious] = useState<ContentSnapshot | null>(null);
  // 自分で付けた表示名（書き換えに合わせて付け直す。利用者が書き換えたら触らない）
  const autoNameRef = useRef<string | undefined>(undefined);
  const latestRef = useRef({ item, previous });
  latestRef.current = { item, previous };

  const sourceKey = item.clipboardSessionId ?? item.clipboardDataRef;

  // 閉じるとき、元に戻すために取っておいたキャプチャが使われていなければ捨てる
  useEffect(
    () => () => {
      const { item: last, previous: prev } = latestRef.current;
      if (prev?.clipboardSessionId && prev.clipboardSessionId !== last.clipboardSessionId) {
        discardSession(prev.clipboardSessionId);
      }
    },
    []
  );

  // 取り込み・保存済みの中身を読む（中身＝セッション・参照が変わったときだけ）
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setLoadingContent(!!sourceKey);
    if (!sourceKey) return undefined;
    window.electronAPI.clipboardAPI
      .readContent(contentSourceOf(latestRef.current.item))
      .then((result) => {
        if (!cancelled) setContent(result);
      })
      .catch((error) => logError('クリップボードの中身の読み取りに失敗:', error))
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceKey]);

  /** 表示名が空か、前に自分で付けた名前のままなら付け直す */
  const autoName = (source: string): Partial<RegisterItem> => {
    if (item.displayName && item.displayName !== autoNameRef.current) return {};
    const name = nameFromText(source);
    autoNameRef.current = name;
    return { displayName: name };
  };

  const handleTextChange = (value: string) => {
    setDraft(value);
    setEdited(true);
    onUpdate({ clipboardText: value, ...autoName(value) });
  };

  const switchToText = () => {
    if (mode === 'text') return;
    setMode('text');
    // 書いたことがあれば、その本文を使う。見ただけなら取り込み・保存済みの中身を使い続ける
    if (edited) onUpdate({ clipboardText: draft });
  };

  const switchToCapture = () => {
    if (mode === 'capture') return;
    setMode('capture');
    onUpdate({ clipboardText: undefined });
  };

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await window.electronAPI.clipboardAPI.captureToSession();
      if (!result.success || !result.sessionId) {
        onError?.(result.error || t('clipboardEditor.captureFailed'));
        return;
      }
      // 取り込み直したら、前の中身を 1 つだけ取っておく（それより前の未確定のキャプチャは捨てる）
      if (hasSavedContent(item)) {
        if (previous?.clipboardSessionId) discardSession(previous.clipboardSessionId);
        setPrevious(snapshotOf(item));
      }
      setDraft('');
      setEdited(false);
      onUpdate({
        clipboardSessionId: result.sessionId,
        clipboardFormats: result.formats || [],
        clipboardSavedAt: result.capturedAt || Date.now(),
        clipboardPreview: result.preview || '',
        clipboardText: undefined,
        ...autoName(result.preview || t('register.clipboardFallbackName')),
      });
    } catch (error) {
      onError?.(error instanceof Error ? error.message : t('clipboardEditor.captureFailed'));
    } finally {
      setCapturing(false);
    }
  };

  const handleUndo = () => {
    if (!previous) return;
    discardSession(item.clipboardSessionId);
    onUpdate({ ...previous, clipboardText: undefined });
    setPrevious(null);
  };

  const handleEditAsText = () => {
    if (content?.text === undefined) {
      onError?.(t('clipboardEditor.readFailed'));
      return;
    }
    setDraft(content.text);
    setEdited(true);
    setMode('text');
    onUpdate({ clipboardText: content.text });
  };

  // テキストで保存すると、取り込んだ書式・画像は使わなくなる
  const replacesRichContent =
    mode === 'text' && edited && hasSavedContent(item) && !isTextOnly(item);
  // テキストだけの中身は、書くまでは読んだ全文を見せる
  const showsSavedText = !edited && isTextOnly(item);
  const textValue = showsSavedText ? (content?.text ?? '') : draft;
  const loadingText = showsSavedText && loadingContent;
  const thumbnail = content?.imageThumbnail;

  const renderText = () => (
    <div className="clipboard-text">
      <textarea
        aria-label={t('clipboardEditor.textLabel')}
        value={loadingText ? '' : textValue}
        placeholder={
          loadingText ? t('clipboardEditor.loading') : t('clipboardEditor.textPlaceholder')
        }
        disabled={loadingText}
        onChange={(e) => handleTextChange(e.target.value)}
        autoFocus={!hasSavedContent(item)}
      />
      {replacesRichContent ? (
        <div className="clipboard-text-warning">{t('clipboardEditor.richTextWarning')}</div>
      ) : (
        <div className="clipboard-text-meta">
          <span>{t('clipboardEditor.textHint')}</span>
          <span>{t('clipboardEditor.charCount', { count: textValue.length })}</span>
        </div>
      )}
    </div>
  );

  const renderCapture = () => {
    if (!hasSavedContent(item)) {
      return (
        <div className="clipboard-capture-empty">
          <Button variant="primary" onClick={handleCapture} disabled={capturing}>
            {capturing ? t('clipboardEditor.capturing') : t('clipboardEditor.captureButton')}
          </Button>
          <p>{t('clipboardEditor.captureHint')}</p>
        </div>
      );
    }

    const formats = item.clipboardFormats ?? [];
    const savedAt = item.clipboardSavedAt
      ? new Date(item.clipboardSavedAt).toLocaleString(i18n.language)
      : '';
    return (
      <div className="clipboard-captured">
        <div className={`clipboard-captured-body${thumbnail ? ' image' : ''}`}>
          {thumbnail ? (
            <img src={thumbnail} alt={t('clipboardEditor.imageAlt')} />
          ) : item.clipboardPreview ? (
            <pre>{item.clipboardPreview}</pre>
          ) : (
            <span className="clipboard-no-preview">{t('clipboardEditor.noPreview')}</span>
          )}
        </div>
        <div className="clipboard-captured-meta">
          <span>{formats.map(formatToLabel).join(' / ')}</span>
          {formats.includes('image') && <span>{t('clipboardEditor.imageLimit')}</span>}
          <span className={`clipboard-state${item.clipboardSessionId ? ' unsaved' : ''}`}>
            {item.clipboardSessionId
              ? t('clipboardEditor.capturedState', { date: savedAt })
              : t('clipboardEditor.savedState', { date: savedAt })}
          </span>
          <span className="clipboard-captured-spacer" />
          {previous && (
            <button type="button" className="clipboard-link-button" onClick={handleUndo}>
              {t('clipboardEditor.undo')}
            </button>
          )}
          {formats.includes('text') && (
            <button
              type="button"
              className="clipboard-link-button"
              onClick={handleEditAsText}
              disabled={loadingContent}
            >
              {t('clipboardEditor.editAsText')}
            </button>
          )}
          <button
            type="button"
            className="clipboard-link-button"
            onClick={handleCapture}
            disabled={capturing}
          >
            {capturing ? t('clipboardEditor.capturing') : t('clipboardEditor.recapture')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="form-group clipboard-content-group">
      <label>{t('clipboardEditor.content')}</label>
      <div className="clipboard-item-editor">
        <div className="clipboard-mode" role="group" aria-label={t('clipboardEditor.modeLabel')}>
          <button type="button" aria-pressed={mode === 'text'} onClick={switchToText}>
            {t('clipboardEditor.modeText')}
          </button>
          <button type="button" aria-pressed={mode === 'capture'} onClick={switchToCapture}>
            {t('clipboardEditor.modeCapture')}
          </button>
        </div>
        <div className="clipboard-stage">{mode === 'text' ? renderText() : renderCapture()}</div>
        {error && <span className="error-message">{error}</span>}
      </div>
    </div>
  );
};

export default ClipboardItemEditor;
