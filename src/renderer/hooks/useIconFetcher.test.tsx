import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AppItem } from '@common/types';

import { useIconFetcher } from './useIconFetcher';

type IconResults = {
  favicons: Record<string, string | null>;
  icons: Record<string, string | null>;
};

const items = [
  {
    displayName: 'Example',
    path: 'https://example.com/',
    type: 'url',
    sourceFile: 'datafiles/data.json',
  },
] as unknown as AppItem[];

let resolveFetch: ((results: IconResults) => void) | null;
let fetchIconsCombined: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resolveFetch = null;
  fetchIconsCombined = vi.fn(
    () =>
      new Promise<IconResults>((resolve) => {
        resolveFetch = resolve;
      })
  );
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { fetchIconsCombined },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function renderFetcher(onBusy: () => void) {
  return renderHook(() =>
    useIconFetcher({
      mainItems: items,
      setMainItems: vi.fn(),
      reloadIconFetchErrors: vi.fn().mockResolvedValue(undefined),
      onBusy,
    })
  );
}

describe('useIconFetcher', () => {
  it('取得中に次の取得を頼まれても始めず、onBusy で知らせること', async () => {
    const onBusy = vi.fn();
    const { result } = renderFetcher(onBusy);

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.handleFetchMissingIcons();
    });
    expect(result.current.isFetchingIcons).toBe(true);
    expect(result.current.isIconFetchBusy()).toBe(true);

    // 進捗バーを閉じた後の［取得］・🔄 の「アイコンをすべて取り直す」
    await act(async () => {
      await result.current.handleFetchMissingIcons();
      await result.current.handleRefreshAll(async () => items);
    });
    expect(fetchIconsCombined).toHaveBeenCalledTimes(1);
    expect(onBusy).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveFetch?.({ favicons: { 'https://example.com/': 'data:icon' }, icons: {} });
      await first;
    });
    expect(result.current.isFetchingIcons).toBe(false);
    expect(result.current.isIconFetchBusy()).toBe(false);
  });

  it('ほかのウィンドウから頼まれた取得が重なったときは、始めず知らせもしないこと', async () => {
    const onBusy = vi.fn();
    const { result } = renderFetcher(onBusy);

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.handleFetchMissingIcons();
    });
    await act(async () => {
      await result.current.handleFetchMissingIconsIn(items);
    });
    expect(onBusy).not.toHaveBeenCalled();
    expect(fetchIconsCombined).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.({ favicons: {}, icons: {} });
      await first;
    });
  });

  it('頼まれていない取得（silent）が重なったときは知らせないこと', async () => {
    const onBusy = vi.fn();
    const { result } = renderFetcher(onBusy);

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.handleFetchMissingIcons();
    });
    await act(async () => {
      await result.current.handleFetchMissingIconsSilently();
    });
    expect(onBusy).not.toHaveBeenCalled();
    expect(fetchIconsCombined).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch?.({ favicons: {}, icons: {} });
      await first;
    });
  });

  it('前の取得が終われば、次の取得を始められること', async () => {
    const { result } = renderFetcher(vi.fn());

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.handleFetchMissingIcons();
    });
    await act(async () => {
      resolveFetch?.({ favicons: {}, icons: {} });
      await first;
    });

    act(() => {
      void result.current.handleFetchMissingIcons();
    });
    expect(fetchIconsCombined).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveFetch?.({ favicons: {}, icons: {} });
    });
  });
});
