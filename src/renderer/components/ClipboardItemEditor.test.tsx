import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import type { RegisterItem } from '@common/types';

import ClipboardItemEditor from './ClipboardItemEditor';

const checkCurrent = vi.fn();
const captureToSession = vi.fn();
const readContent = vi.fn();
const discardSession = vi.fn(async () => true);

beforeEach(() => {
  checkCurrent.mockReset();
  captureToSession.mockReset();
  readContent.mockReset().mockResolvedValue(null);
  discardSession.mockClear();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { clipboardAPI: { checkCurrent, captureToSession, readContent, discardSession } },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function baseItem(fields: Partial<RegisterItem> = {}): RegisterItem {
  return {
    displayName: '',
    path: '',
    type: 'clipboard',
    targetTab: 'datafiles/data.json',
    itemCategory: 'clipboard',
    ...fields,
  };
}

/** 親のフォームと同じく、onUpdate を item に反映しながら描く */
function renderEditor(initial: RegisterItem) {
  const latest: { item: RegisterItem } = { item: initial };
  function Host() {
    const [item, setItem] = useState(initial);
    latest.item = item;
    return (
      <ClipboardItemEditor item={item} onUpdate={(fields) => setItem({ ...item, ...fields })} />
    );
  }
  render(<Host />);
  return latest;
}

describe('ClipboardItemEditor', () => {
  it('新規は「テキストを書く」で開き、クリップボードを読まない', () => {
    renderEditor(baseItem());
    expect(
      screen.getByRole('button', { name: 'テキストを書く' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(screen.getByRole('textbox', { name: '保存するテキスト' })).toBeTruthy();
    expect(checkCurrent).not.toHaveBeenCalled();
    expect(captureToSession).not.toHaveBeenCalled();
  });

  it('書いた本文を clipboardText に入れ、1 行目を表示名にする', () => {
    const latest = renderEditor(baseItem());
    fireEvent.change(screen.getByRole('textbox', { name: '保存するテキスト' }), {
      target: { value: '\nお世話になっております。\n2 行目' },
    });
    expect(latest.item.clipboardText).toBe('\nお世話になっております。\n2 行目');
    expect(latest.item.displayName).toBe('お世話になっております。');
  });

  it('利用者が付けた表示名は書き換えない', () => {
    const latest = renderEditor(baseItem({ displayName: '会議の案内' }));
    fireEvent.change(screen.getByRole('textbox', { name: '保存するテキスト' }), {
      target: { value: '本文' },
    });
    expect(latest.item.displayName).toBe('会議の案内');
  });

  it('取り込むを押したときだけ読み、取り込み直したら元に戻せる', async () => {
    captureToSession
      .mockResolvedValueOnce({
        success: true,
        sessionId: 's1',
        preview: '1 回目',
        formats: ['text', 'html'],
        capturedAt: 1,
      })
      .mockResolvedValueOnce({
        success: true,
        sessionId: 's2',
        preview: '2 回目',
        formats: ['text'],
        capturedAt: 2,
      });
    const latest = renderEditor(baseItem());

    fireEvent.click(screen.getByRole('button', { name: 'クリップボードから取り込む' }));
    expect(captureToSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '今のクリップボードを取り込む' }));
    await screen.findByText('1 回目');
    expect(latest.item.clipboardSessionId).toBe('s1');
    expect(latest.item.clipboardText).toBeUndefined();
    expect(latest.item.displayName).toBe('1 回目');

    fireEvent.click(screen.getByRole('button', { name: '取り込み直す' }));
    await screen.findByText('2 回目');
    expect(latest.item.clipboardSessionId).toBe('s2');

    fireEvent.click(screen.getByRole('button', { name: '元に戻す' }));
    await screen.findByText('1 回目');
    expect(latest.item.clipboardSessionId).toBe('s1');
    expect(latest.item.clipboardFormats).toEqual(['text', 'html']);
    expect(discardSession).toHaveBeenCalledWith('s2');
  });

  it('保存済みのテキストだけのアイテムは、全文を読んでテキスト欄に出す（書き換えるまで保存し直さない）', async () => {
    readContent.mockResolvedValue({ text: '保存してある全文' });
    const latest = renderEditor(
      baseItem({
        displayName: '定型文',
        clipboardDataRef: 'clipboard-data/a.json',
        clipboardFormats: ['text'],
        clipboardPreview: '保存して...',
      })
    );
    const textarea = screen.getByRole('textbox', { name: '保存するテキスト' });
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe('保存してある全文'));
    expect(readContent).toHaveBeenCalledWith({ dataFileRef: 'clipboard-data/a.json' });
    expect(latest.item.clipboardText).toBeUndefined();
  });

  it('書式付きのアイテムはプレビューで開き、テキストとして編集すると書式を使わないと知らせる', async () => {
    readContent.mockResolvedValue({ text: '書式付きの全文' });
    const latest = renderEditor(
      baseItem({
        displayName: 'メール文',
        clipboardDataRef: 'clipboard-data/b.json',
        clipboardFormats: ['text', 'html'],
        clipboardPreview: '書式付き',
      })
    );
    expect(
      screen
        .getByRole('button', { name: 'クリップボードから取り込む' })
        .getAttribute('aria-pressed')
    ).toBe('true');
    expect(screen.getByText('書式付き')).toBeTruthy();

    const editAsText = screen.getByRole('button', { name: 'テキストとして編集' });
    await waitFor(() => expect((editAsText as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(editAsText);
    expect(latest.item.clipboardText).toBe('書式付きの全文');
    expect(screen.getByText(/取り込んだ書式（HTML・RTF）や画像は使いません/)).toBeTruthy();

    // 取り込むに戻すと、書いた本文は使わない
    fireEvent.click(screen.getByRole('button', { name: 'クリップボードから取り込む' }));
    expect(latest.item.clipboardText).toBeUndefined();
  });

  it('書いた本文は、取り込むに切り替えて戻しても使う', async () => {
    readContent.mockResolvedValue({ text: '元の文' });
    const latest = renderEditor(
      baseItem({
        displayName: '定型文',
        clipboardDataRef: 'clipboard-data/c.json',
        clipboardFormats: ['text'],
      })
    );
    const textarea = screen.getByRole('textbox', { name: '保存するテキスト' });
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe('元の文'));
    fireEvent.change(textarea, { target: { value: '直した文' } });

    fireEvent.click(screen.getByRole('button', { name: 'クリップボードから取り込む' }));
    expect(latest.item.clipboardText).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'テキストを書く' }));
    expect(latest.item.clipboardText).toBe('直した文');
    expect(
      (screen.getByRole('textbox', { name: '保存するテキスト' }) as HTMLTextAreaElement).value
    ).toBe('直した文');
  });

  it('取り込んだ書式付きの中身は、テキストのタブを見ただけでは置き換えない', async () => {
    readContent.mockResolvedValue({ text: '書式付き' });
    const latest = renderEditor(
      baseItem({
        displayName: 'メール文',
        clipboardSessionId: 's9',
        clipboardFormats: ['text', 'html'],
        clipboardPreview: '書式付き',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'テキストを書く' }));
    expect(latest.item.clipboardText).toBeUndefined();
    expect(screen.queryByText(/取り込んだ書式（HTML・RTF）や画像は使いません/)).toBeNull();
  });
});
