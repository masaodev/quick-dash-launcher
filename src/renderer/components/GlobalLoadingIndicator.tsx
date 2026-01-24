import '../styles/components/GlobalLoadingIndicator.css';

interface Props {
  isLoading: boolean;
  message?: string;
}

/**
 * グローバルローディングインジケーター
 *
 * 画面右下に表示される小さなローディングスピナー。
 * 短時間の処理（データ更新、リフレッシュなど）のフィードバックに使用します。
 */
function GlobalLoadingIndicator({ isLoading, message = '処理中' }: Props): React.ReactNode {
  if (!isLoading) return null;

  return (
    <div className="global-loading-indicator">
      <div className="global-loading-spinner">⟳</div>
      <div className="global-loading-message">{message}</div>
    </div>
  );
}

export default GlobalLoadingIndicator;
