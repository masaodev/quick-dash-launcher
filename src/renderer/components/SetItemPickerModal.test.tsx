import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import SetItemPickerModal from './SetItemPickerModal';

describe('SetItemPickerModal', () => {
  it('開いたときに検索欄にフォーカスがある（モーダル本体に取られない）', () => {
    render(
      <SetItemPickerModal
        isOpen
        catalog={[
          {
            key: 'a',
            id: 'a',
            displayName: 'メモ帳',
            kind: 'app',
            groupName: 'メイン',
            sameGroup: true,
          },
        ]}
        addedKeys={new Set()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
      />
    );
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});
