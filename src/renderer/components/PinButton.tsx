import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PinLevel } from '@common/types';

import { logError } from '../utils/debug';

/** 段階ごとのツールチップ（今の状態を書く） */
const PIN_TITLE_KEYS = {
  0: 'common.pin.off',
  1: 'common.pin.stayVisible',
  2: 'common.pin.alwaysOnTop',
} as const satisfies Record<PinLevel, string>;

/** 段階ごとの見た目（なし＝通常のボタン、表示固定＝押し込み＋ピンを立てる、常に最前面＝それに黄色と ▲） */
const PIN_CLASS_NAMES: Record<PinLevel, string> = {
  0: '',
  1: 'toggle-on',
  2: 'toggle-on pin-always-on-top',
};

interface PinButtonProps {
  level: PinLevel;
  onLevelChange: (level: PinLevel) => void;
  /** action-btn に足すクラス（置き場所ごとの見た目） */
  className?: string;
}

/**
 * 📌 ボタン（メイン・ワークスペース・切り離しで共通）
 *
 * クリックで表示固定のオン・オフ（常に最前面のときはなしに戻す）、右クリックで表示固定・常に最前面のメニュー。
 * 対象は、このボタンがあるウィンドウ（メインプロセスが送り元から判断する）。
 */
const PinButton: React.FC<PinButtonProps> = ({ level, onLevelChange, className }) => {
  const { t } = useTranslation();

  const handleClick = async () => {
    try {
      onLevelChange(await window.electronAPI.pin.set(level === 0 ? 1 : 0));
    } catch (error) {
      logError('ピン留めの切り替えに失敗しました:', error);
    }
  };

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      onLevelChange(await window.electronAPI.pin.showMenu());
    } catch (error) {
      logError('ピン留めのメニューを開けませんでした:', error);
    }
  };

  const title = t(PIN_TITLE_KEYS[level]);
  const classes = ['action-btn', 'pin-btn', className, PIN_CLASS_NAMES[level]]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={title}
      aria-label={title}
      aria-pressed={level !== 0}
    >
      <span className="pin-btn-icon" aria-hidden="true">
        📌
      </span>
    </button>
  );
};

export default PinButton;
