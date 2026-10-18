import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceHintKey } from '@common/types';

import { logError } from '../utils/debug';

/** 案内ごとの文言キー */
const HINT_MESSAGE_KEYS = {
  workspaceOpened: 'workspace.hints.workspaceOpened',
  groupDetached: 'workspace.hints.groupDetached',
} as const satisfies Record<WorkspaceHintKey, string>;

interface WindowHintProps {
  hintKey: WorkspaceHintKey;
  /** 帯に足すクラス（置き場所ごとの余白） */
  className?: string;
  /** 帯が出た・消えた後に呼ぶ（ウィンドウの高さを合わせ直すため） */
  onToggle?: () => void;
}

/**
 * 1 回だけ出す案内の帯（ワークスペース・切り離しウィンドウの一番上）
 *
 * 「わかった」を押すまで出し続け、押したら覚えてもう出さない（ほかのウィンドウの帯も閉じる）。
 */
const WindowHint: React.FC<WindowHintProps> = ({ hintKey, className, onToggle }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.electronAPI.hint
      .isPending(hintKey)
      .then((pending) => {
        if (!cancelled) setVisible(pending);
      })
      .catch((error) => logError('案内を出すかどうかを読めませんでした:', error));
    const unsubscribe = window.electronAPI.hint.onDismissed((key) => {
      if (key === hintKey) setVisible(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hintKey]);

  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  useEffect(() => {
    onToggleRef.current?.();
  }, [visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    window.electronAPI.hint
      .dismiss(hintKey)
      .catch((error) => logError('案内を閉じたことを保存できませんでした:', error));
  };

  return (
    <div className={['window-hint', className].filter(Boolean).join(' ')} role="status">
      <p className="window-hint-message">{t(HINT_MESSAGE_KEYS[hintKey])}</p>
      <button type="button" className="window-hint-dismiss" onClick={handleDismiss}>
        {t('workspace.hints.dismiss')}
      </button>
    </div>
  );
};

export default WindowHint;
