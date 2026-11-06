import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { AppSettings } from '@common/types';

import { useSettingsManager } from './useSettingsManager';

const settings = { backupEnabled: false } as unknown as AppSettings;

function setup(onSave: (s: AppSettings) => Promise<boolean>) {
  const showAlert = vi.fn();
  const showToast = vi.fn();
  const { result } = renderHook(() =>
    useSettingsManager({
      editedSettings: settings,
      setEditedSettings: vi.fn(),
      onSave,
      showAlert,
      showConfirm: vi.fn(async () => true),
      showToast,
    })
  );
  return { result, showAlert, showToast };
}

describe('useSettingsManager の保存の知らせ（A3-258）', () => {
  it('保存できたら「保存しました」を出す', async () => {
    const { result, showToast } = setup(async () => true);
    await act(() => result.current.handleSettingChange('backupEnabled', true));
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('保存できなかったら（知らせは保存した側が出す）「保存しました」を出さない', async () => {
    const { result, showToast, showAlert } = setup(async () => false);
    await act(() => result.current.handleSettingChange('backupEnabled', true));
    expect(showToast).not.toHaveBeenCalled();
    expect(showAlert).not.toHaveBeenCalled();
  });
});
