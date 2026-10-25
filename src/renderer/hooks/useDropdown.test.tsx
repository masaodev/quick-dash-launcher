import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useDropdown } from './useDropdown';

/** jsdom はレイアウトしないので、メニューの位置（left と幅）を決め打ちで返す */
function stubMenuRect(left: number, width: number) {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (!this.classList.contains('dropdown-menu')) return new DOMRect(0, 0, 0, 0);
    return new DOMRect(left, 0, width, 80);
  };
}

const original = HTMLElement.prototype.getBoundingClientRect;

function Dropdown() {
  const { isOpen, ref, toggle } = useDropdown();
  return (
    <div ref={ref}>
      <button onClick={toggle}>開く</button>
      {isOpen && <div className="dropdown-menu" data-testid="menu" />}
    </div>
  );
}

afterEach(() => {
  cleanup();
  HTMLElement.prototype.getBoundingClientRect = original;
});

describe('useDropdown のメニューの位置', () => {
  it('左にはみ出すときは、ウィンドウの中に入るよう右へずらす', () => {
    stubMenuRect(-13, 228);
    render(<Dropdown />);
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    expect(screen.getByTestId('menu').style.transform).toBe('translateX(17px)');
  });

  it('開いたままウィンドウが狭くなってはみ出したら、ずらし直す', () => {
    stubMenuRect(100, 228);
    render(<Dropdown />);
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    expect(screen.getByTestId('menu').style.transform).toBe('');

    stubMenuRect(-20, 228);
    fireEvent(window, new Event('resize'));
    expect(screen.getByTestId('menu').style.transform).toBe('translateX(24px)');
  });

  it('はみ出さないときは動かさない', () => {
    stubMenuRect(100, 228);
    render(<Dropdown />);
    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    expect(screen.getByTestId('menu').style.transform).toBe('');
  });
});
