import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * 最新の値を指す ref を返す
 *
 * 購読は一度だけ張り、ハンドラーの中で ref.current から最新の値を読むときに使う。
 * 値が変わるたびに購読を張り直さずに済む
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
