import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { HotkeyInput } from './HotkeyInput';

beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      setHotkeyRecording: vi.fn(async () => undefined),
      validateHotkey: vi.fn(async () => ({ isValid: true })),
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electronAPI');
});

function startRecording() {
  const onChange = vi.fn();
  render(<HotkeyInput value="" onChange={onChange} onValidationChange={vi.fn()} />);
  const input = screen.getByRole('textbox');
  fireEvent.click(input);
  return { input, onChange };
}

describe('HotkeyInput', () => {
  it('押して離した修飾キーは、次の組み合わせに混ぜない（A3-238）', () => {
    const { input, onChange } = startRecording();

    fireEvent.keyDown(input, { key: 'Control', code: 'ControlLeft' });
    fireEvent.keyUp(input, { key: 'Control', code: 'ControlLeft' });
    fireEvent.keyDown(input, { key: 'Alt', code: 'AltLeft' });
    fireEvent.keyDown(input, { key: 'K', code: 'KeyK' });
    fireEvent.keyUp(input, { key: 'K', code: 'KeyK' });

    expect(onChange).toHaveBeenCalledWith('Alt+K');
  });

  it('Shift と数字の組み合わせを、記号ではなく数字のキーで記録する（A3-238）', () => {
    const { input, onChange } = startRecording();

    fireEvent.keyDown(input, { key: 'Control', code: 'ControlLeft' });
    fireEvent.keyDown(input, { key: 'Shift', code: 'ShiftLeft' });
    fireEvent.keyDown(input, { key: '!', code: 'Digit1' });
    fireEvent.keyUp(input, { key: '!', code: 'Digit1' });

    expect(onChange).toHaveBeenCalledWith('Ctrl+Shift+1');
  });

  it('Alt+Space は Space を離したときに拾って確定する', () => {
    const { input, onChange } = startRecording();

    fireEvent.keyDown(input, { key: 'Alt', code: 'AltLeft' });
    fireEvent.keyUp(input, { key: ' ', code: 'Space' });

    expect(onChange).toHaveBeenCalledWith('Alt+Space');
  });
});
