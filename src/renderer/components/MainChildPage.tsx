import React, { useEffect, useState } from 'react';
import type { MainChildWindowRequest } from '@common/types';

import { logError } from '../utils/debug';

import IconProgressDetailModal from './IconProgressDetailModal';
import RegisterWindowPage from './RegisterWindowPage';
import { Button } from './ui';

interface MainChildPageProps {
  requestId: string;
}

/**
 * メイン画面が開く子ウィンドウの中身
 *
 * window.name（または URL クエリ）の requestId でメインプロセスから要求を受け取り、
 * 種類に応じたページを描く。要求が見つからなければ（開き元が閉じた等）閉じるだけ
 */
const MainChildPage: React.FC<MainChildPageProps> = ({ requestId }) => {
  const [request, setRequest] = useState<MainChildWindowRequest | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await window.electronAPI.getMainChildWindowRequest(requestId);
        if (cancelled) return;
        if (found) {
          setRequest(found);
        } else {
          setNotFound(true);
        }
      } catch (error) {
        logError('子ウィンドウの要求の取得に失敗しました:', error);
        if (!cancelled) setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (!request) return;
    document.title =
      request.kind === 'register'
        ? request.editingItem
          ? 'アイテムの編集'
          : 'アイテムの登録'
        : 'アイコン取得結果';
  }, [request]);

  if (notFound) {
    return (
      <div className="main-child-page main-child-missing">
        <p>表示する内容が見つかりません。</p>
        <Button variant="cancel" onClick={() => window.close()}>
          閉じる
        </Button>
      </div>
    );
  }

  if (!request) {
    return <div className="main-child-page main-child-loading">読み込み中...</div>;
  }

  switch (request.kind) {
    case 'register':
      return <RegisterWindowPage requestId={requestId} request={request} />;
    case 'iconProgressDetail':
      return (
        <IconProgressDetailModal
          asPage
          isOpen
          onClose={() => window.close()}
          results={request.results}
        />
      );
  }
};

export default MainChildPage;
