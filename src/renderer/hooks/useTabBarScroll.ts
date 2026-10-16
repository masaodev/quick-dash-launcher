import { useEffect, useRef, type WheelEvent } from 'react';

/**
 * 横に並べたタブがはみ出すときのスクロール（タブバーは横スクロール。スクロールバーは出さない）
 * - マウスホイールの縦の回転を横のスクロールにする
 * - 選択中のタブが変わったら、そのタブが見える位置までスクロールする（Tab キーで切り替えたときも見える）
 */
export function useTabBarScroll(activeKey: string | number) {
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = tabBarRef.current?.querySelector<HTMLElement>('.tab-button.active');
    active?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>): void => {
    if (tabBarRef.current) {
      tabBarRef.current.scrollLeft += e.deltaY;
    }
  };

  return { tabBarRef, handleWheel };
}
