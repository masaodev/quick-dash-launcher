/**
 * 登録・編集画面のフォルダ取込の「取り込まれるもの」（プレビュー）
 *
 * フォルダを読むのは「フォルダを選択」で選んだときと「🔍 プレビュー更新」を押したときだけ（A3-183）。
 * パス欄に手で打っている途中では読まない（ネットワークのフォルダで勝手に重くしない）。
 * パス・階層・種類・条件を変えたら結果を薄くして数え直しを促し、頭・後ろに付ける文字だけはその場で反映する
 */
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import type { DirPreviewResult, JsonDirOptions } from '@common/types';
import { DIR_PREVIEW_TIMEOUT_MS } from '@common/types/json-data';

import { logError } from '../utils/debug';

import { Button } from './ui';

/** 一覧に並べる件数（残りは「ほか N 件」にまとめる） */
const SHOWN_ITEMS = 100;

interface DirPreviewPanelProps {
  path: string;
  dirOptions: JsonDirOptions | undefined;
  /** 増えるたびに、その時点のパスで読む（「フォルダを選択」で選んだとき）。0 なら読まない */
  autoRunToken?: number;
}

/** 走査し直しが要る条件（頭・後ろに付ける文字は含めない） */
function scanSignature(path: string, options: JsonDirOptions | undefined): string {
  return JSON.stringify([
    path.trim(),
    options?.depth,
    options?.types,
    options?.filter ?? '',
    options?.exclude ?? '',
  ]);
}

const DirPreviewPanel: React.FC<DirPreviewPanelProps> = ({
  path,
  dirOptions,
  autoRunToken = 0,
}) => {
  const { t } = useTranslation();
  const [result, setResult] = useState<DirPreviewResult | null>(null);
  const [scannedWith, setScannedWith] = useState('');
  const [scannedFilter, setScannedFilter] = useState('');
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  // 走査の通し番号。読み直しで前の走査をやめたとき、前の結果（「やめました」）で上書きしないため
  const scanIdRef = useRef(0);

  // 走査中に画面を閉じた・種別を変えたときは、裏の走査もやめる
  useEffect(
    () => () => {
      if (runningRef.current) void window.electronAPI.cancelDirPreview();
    },
    []
  );

  const scan = async () => {
    // 前の走査が続いていればやめてから読む（「フォルダを選択」で別のフォルダを選び直したとき）
    if (runningRef.current) await window.electronAPI.cancelDirPreview();
    const scanId = ++scanIdRef.current;
    const signature = scanSignature(path, dirOptions);
    setRunning(true);
    runningRef.current = true;
    try {
      const next = await window.electronAPI.previewDirItems(path.trim(), dirOptions ?? {});
      if (scanId !== scanIdRef.current) return;
      setResult(next);
      setScannedWith(signature);
      setScannedFilter(dirOptions?.filter ?? '');
    } catch (error) {
      if (scanId !== scanIdRef.current) return;
      setResult(null);
      setScannedWith('');
      logError('フォルダ取込のプレビューに失敗', error);
    } finally {
      if (scanId === scanIdRef.current) {
        setRunning(false);
        runningRef.current = false;
      }
    }
  };

  const run = async () => {
    if (running) {
      await window.electronAPI.cancelDirPreview();
      return;
    }
    await scan();
  };

  // 「フォルダを選択」で選んだら、押さなくても読む
  useEffect(() => {
    if (autoRunToken === 0 || path.trim() === '') return;
    void scan();
    // 選んだときだけ読む（パス・条件の変化では読まない）ので、依存は autoRunToken だけ
  }, [autoRunToken]);

  const hasPath = path.trim() !== '';
  const isStale = !!result && !running && scannedWith !== scanSignature(path, dirOptions);
  const items = result?.status === 'ok' ? result.items : [];

  const status = (() => {
    if (running) return t('dirPreview.scanning');
    if (result?.status !== 'ok') return '';
    return result.truncated
      ? t('dirPreview.countTruncated', { count: items.length })
      : t('dirPreview.count', { count: items.length });
  })();

  const message = (() => {
    if (running) return null;
    if (!result) {
      return hasPath
        ? { text: t('dirPreview.idle'), hint: t('dirPreview.idleHint') }
        : { text: t('dirPreview.noPath') };
    }
    switch (result.status) {
      case 'notFound':
        return { text: t('dirPreview.notFound') };
      case 'notFolder':
        return { text: t('dirPreview.notFolder') };
      case 'timeout':
        return { text: t('dirPreview.timeout', { seconds: DIR_PREVIEW_TIMEOUT_MS / 1000 }) };
      case 'cancelled':
        return { text: t('dirPreview.cancelled') };
      case 'ok':
        return items.length === 0
          ? {
              text: scannedFilter
                ? t('dirPreview.emptyFilter', { filter: scannedFilter })
                : t('dirPreview.empty'),
              hint: t('dirPreview.emptyHint'),
            }
          : null;
    }
  })();

  const prefix = dirOptions?.prefix;
  const suffix = dirOptions?.suffix;

  return (
    <div className="dir-preview" data-testid="dir-preview">
      <div className="dir-preview-head">
        <span className="dir-preview-title">{t('dirPreview.title')}</span>
        <span className="dir-preview-status" aria-live="polite">
          {running && <span className="icon-fetch-spinner" aria-hidden></span>}
          {status}
        </span>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="dir-preview-btn"
          onClick={run}
          disabled={!running && !hasPath}
          title={running ? undefined : t('dirPreview.runTitle')}
        >
          {running ? t('dirPreview.cancel') : `🔍 ${t('dirPreview.run')}`}
        </Button>
      </div>

      {isStale && <div className="dir-preview-stale">⚠ {t('dirPreview.stale')}</div>}

      <div className={`dir-preview-list${isStale ? ' is-stale' : ''}`}>
        {message ? (
          <div className="dir-preview-empty">
            <p>{message.text}</p>
            {message.hint && <p className="dir-preview-empty-hint">{message.hint}</p>}
          </div>
        ) : (
          <>
            {items.slice(0, SHOWN_ITEMS).map((item, index) => (
              <div key={index} className="dir-preview-item">
                <span className="dir-preview-icon" aria-hidden>
                  {item.shortcutTarget ? '🔗' : item.isFolder ? '📁' : '📄'}
                </span>
                <span className="dir-preview-name">
                  {prefix && <span className="dir-preview-affix">{prefix}</span>}
                  {item.baseName}
                  {suffix && <span className="dir-preview-affix">{suffix}</span>}
                </span>
                <span className="dir-preview-where">
                  {item.shortcutTarget ? `→ ${item.shortcutTarget}` : item.location}
                </span>
              </div>
            ))}
            {items.length > SHOWN_ITEMS && (
              <div className="dir-preview-more">
                {result?.truncated
                  ? t('dirPreview.moreTruncated', { count: items.length - SHOWN_ITEMS })
                  : t('dirPreview.more', { count: items.length - SHOWN_ITEMS })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DirPreviewPanel;
