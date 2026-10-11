/**
 * メインウィンドウ下部の操作ヒント
 *
 * 検索モードごとに主なキー操作を 1 行で出す。幅が足りないときは折り返さず、右側を「…」で省略する。
 * 設定「操作のヒントを表示」（showKeyboardHints）がオフなら出さない（呼び出し側で判定）
 *
 * 画面仕様: docs/screens/main-window.md
 */

import React from 'react';
import type { SearchMode } from '@common/types';

interface LauncherHintBarProps {
  searchMode: SearchMode;
  /** 通常モード: データファイルのタブが 2 つ以上表示されている（Tab で切り替えられる） */
  canSwitchDataFileTab: boolean;
  /** ウィンドウ検索モード: 仮想デスクトップ番号のタブを表示中（Ctrl+←/→ で移動できる） */
  canMoveToDesktop: boolean;
}

interface Hint {
  keys: string;
  label: string;
}

const LauncherHintBar: React.FC<LauncherHintBarProps> = ({
  searchMode,
  canSwitchDataFileTab,
  canMoveToDesktop,
}) => {
  const hints: Hint[] =
    searchMode === 'window'
      ? [
          { keys: 'Ctrl+P', label: 'ピン留め/解除' },
          { keys: 'Ctrl+D', label: 'ウィンドウを閉じる' },
          ...(canMoveToDesktop ? [{ keys: 'Ctrl+←/→', label: '仮想デスクトップ移動' }] : []),
        ]
      : [
          { keys: 'Enter', label: '起動' },
          { keys: 'Shift+Enter', label: 'フォルダを開く' },
          ...(canSwitchDataFileTab ? [{ keys: 'Tab', label: 'タブ切替' }] : []),
          { keys: 'Ctrl+E', label: '管理画面' },
          { keys: 'Ctrl+W', label: 'ワークスペース' },
        ];

  return (
    <div className="shortcut-hint" data-testid="keyboard-hint-bar">
      {hints.map((hint) => (
        <span key={hint.keys} className="shortcut-hint-item">
          <kbd>{hint.keys}</kbd>
          {hint.label}
        </span>
      ))}
    </div>
  );
};

export default LauncherHintBar;
