import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';

interface UseDropdownReturn {
  isOpen: boolean;
  ref: RefObject<HTMLDivElement | null>;
  toggle: () => void;
  close: () => void;
}

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

  return { isOpen, ref, toggle, close };
}
