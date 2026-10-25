import { useState, useRef, useEffect, useLayoutEffect, useCallback, type RefObject } from 'react';

interface UseDropdownReturn {
  isOpen: boolean;
  ref: RefObject<HTMLDivElement | null>;
  toggle: () => void;
  close: () => void;
}

/** メニューとウィンドウの端のあいだに残す余白（px） */
const VIEWPORT_MARGIN = 4;

/**
 * ドロップダウンの開閉状態とクリック外判定を管理するフック
 */
export function useDropdown(): UseDropdownReturn {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // メニュー（.dropdown-menu）はボタンの右端にそろえて開くので、ボタンが左寄りで
  // ウィンドウが狭いと左にはみ出す。開いたとき・開いたまま大きさが変わったときに測り、
  // はみ出す分だけ横にずらす（A3-119）
  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = ref.current?.querySelector<HTMLElement>(':scope > .dropdown-menu');
    if (!menu) return;

    const fit = () => {
      menu.style.transform = '';
      const rect = menu.getBoundingClientRect();
      const maxRight = window.innerWidth - VIEWPORT_MARGIN;
      let shift = 0;
      if (rect.left < VIEWPORT_MARGIN) shift = VIEWPORT_MARGIN - rect.left;
      else if (rect.right > maxRight) shift = maxRight - rect.right;
      if (shift !== 0) menu.style.transform = `translateX(${shift}px)`;
    };
    fit();

    window.addEventListener('resize', fit);
    // 項目が後から増える・文字が変わるなどでメニューの幅が変わったときも合わせ直す
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(menu);
    return () => {
      window.removeEventListener('resize', fit);
      observer?.disconnect();
    };
  }, [isOpen]);

  return { isOpen, ref, toggle, close };
}
