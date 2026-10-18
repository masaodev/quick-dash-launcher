/**
 * メインウィンドウ下部の操作ヒント
 *
 * 検索モードごとに、画面上のボタン・表示からは気づきにくいキー操作だけを 1 行で出す
 * （Enter・↑↓・Esc のような自明なキー、検索ボックス下にある Shift+Tab、
 * ⚙️ メニューに添えてある Ctrl+E、⭐ ボタンのツールチップに添えてある Ctrl+W、
 * 🔄 メニューに添えてある通常モードの F5 は出さない）。
 * 幅が足りないときは折り返さず、右側を「…」で省略するので、大事なキーほど左に、
 * 条件つきで出るキーは末尾に置く。
 * 設定「操作のヒントを表示」（showKeyboardHints）がオフなら出さない（呼び出し側で判定）
 *
 * 画面仕様: docs/screens/main-window.md
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchMode } from '@common/types';

interface LauncherHintBarProps {
  searchMode: SearchMode;
  /** 通常モード: データファイルのタブが 2 つ以上表示されている（Tab で切り替えられる） */
  canSwitchDataFileTab: boolean;
  /** ウィンドウ検索モード: 仮想デスクトップ番号のタブを表示中（Ctrl+←/→ で移動できる） */
  canMoveToDesktop: boolean;
  /** ウィンドウ検索モード: 選んでいるウィンドウの数（1 つ以上なら、選んだものへの操作を出す） */
  markedCount?: number;
  /** ウィンドウ検索モード: ウィンドウの固定（Ctrl+P）が使える（仮想デスクトップ非対応の環境では出さない） */
  canPinWindow?: boolean;
}

interface Hint {
  keys: string;
  label: string;
}

const LauncherHintBar: React.FC<LauncherHintBarProps> = ({
  searchMode,
  canSwitchDataFileTab,
  canMoveToDesktop,
  markedCount = 0,
  canPinWindow = true,
}) => {
  const { t } = useTranslation();
  const moveToDesktopHint = { keys: 'Ctrl+←/→', label: t('launcher.hints.moveToDesktop') };
  const hints: Hint[] =
    searchMode === 'window' && markedCount > 0
      ? [
          { keys: 'Ctrl+D', label: t('launcher.hints.closeMarked', { count: markedCount }) },
          ...(canPinWindow
            ? [
                {
                  keys: 'Ctrl+P',
                  label: t('launcher.hints.showMarkedOnAllDesktops', { count: markedCount }),
                },
              ]
            : []),
          { keys: 'Esc', label: t('launcher.hints.clearSelection') },
          ...(canMoveToDesktop ? [moveToDesktopHint] : []),
        ]
      : searchMode === 'window'
        ? // よく使う順。Tab（デスクトップ切替）はタブの表示で分かるので出さない
          [
            { keys: 'Ctrl+D', label: t('launcher.hints.closeWindow') },
            ...(canPinWindow
              ? [{ keys: 'Ctrl+P', label: t('launcher.hints.showOnAllDesktops') }]
              : []),
            { keys: 'Shift+↑/↓', label: t('launcher.hints.selectMultiple') },
            { keys: 'F5', label: t('launcher.hints.refreshWindows') },
            ...(canMoveToDesktop ? [moveToDesktopHint] : []),
          ]
        : [
            { keys: 'F2', label: t('launcher.hints.edit') },
            { keys: 'Shift+Enter', label: t('launcher.hints.openContainingFolder') },
            { keys: 'Ctrl+↑/↓', label: t('launcher.hints.searchHistory') },
            ...(canSwitchDataFileTab
              ? [{ keys: 'Tab', label: t('launcher.hints.switchTab') }]
              : []),
          ];

  return (
    <div className="shortcut-hint" data-testid="keyboard-hint-bar">
      {hints.map((hint, index) => (
        <React.Fragment key={hint.keys}>
          {index > 0 && '\u3000'}
          <strong>{hint.keys}</strong>:{hint.label}
        </React.Fragment>
      ))}
    </div>
  );
};

export default LauncherHintBar;
