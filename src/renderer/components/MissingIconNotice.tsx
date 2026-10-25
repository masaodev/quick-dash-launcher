import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from './ui/Button';

interface MissingIconNoticeProps {
  /** 未取得アイコン数 */
  missingCount: number;
  /** 取得ボタンクリック時のハンドラ */
  onFetchClick: () => void;
}

/**
 * アイコン未取得通知コンポーネント
 * 起動時に未取得アイコンがあれば画面下部に表示し、クリックで取得を開始できる
 */
const MissingIconNotice: React.FC<MissingIconNoticeProps> = ({ missingCount, onFetchClick }) => {
  const { t } = useTranslation();
  // 未取得がなければ非表示
  if (missingCount === 0) {
    return null;
  }

  return (
    <div className="missing-icon-notice">
      {/* 何の処理か・何度もかかるのかが分かるように、1 回だけ取りに行くことも書く（A3-174） */}
      <div className="missing-icon-notice__content">
        <span className="missing-icon-notice__label">
          {t('launcher.missingIcons.label', { count: missingCount })}
        </span>
        <span className="missing-icon-notice__hint">{t('launcher.missingIcons.hint')}</span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onFetchClick}
        title={t('launcher.missingIcons.fetchTooltip')}
      >
        {t('launcher.missingIcons.fetch')}
      </Button>
    </div>
  );
};

export default MissingIconNotice;
