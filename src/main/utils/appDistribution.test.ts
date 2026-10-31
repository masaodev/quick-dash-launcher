import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const appMock = vi.hoisted(() => ({ isPackaged: true }));

vi.mock('electron', () => ({ app: appMock }));
const portableMock = vi.hoisted(() => ({ edition: false }));
vi.mock('./portableMode.js', () => ({ isPortableEdition: () => portableMock.edition }));

import { getAppDistribution } from './appDistribution';

describe('getAppDistribution', () => {
  const originalWindowsStore = Object.getOwnPropertyDescriptor(process, 'windowsStore');
  const originalPortable = process.env.PORTABLE_EXECUTABLE_FILE;

  function setWindowsStore(value: boolean | undefined): void {
    Object.defineProperty(process, 'windowsStore', { value, configurable: true });
  }

  beforeEach(() => {
    appMock.isPackaged = true;
    portableMock.edition = false;
    setWindowsStore(undefined);
    delete process.env.PORTABLE_EXECUTABLE_FILE;
  });

  afterEach(() => {
    if (originalWindowsStore) {
      Object.defineProperty(process, 'windowsStore', originalWindowsStore);
    } else {
      delete (process as { windowsStore?: boolean }).windowsStore;
    }
    if (originalPortable === undefined) {
      delete process.env.PORTABLE_EXECUTABLE_FILE;
    } else {
      process.env.PORTABLE_EXECUTABLE_FILE = originalPortable;
    }
  });

  it('exe の横に印のファイル（ZIP のポータブル版）があれば portable', () => {
    portableMock.edition = true;
    expect(getAppDistribution()).toBe('portable');
  });

  it('パッケージ化されていなければ dev', () => {
    appMock.isPackaged = false;
    setWindowsStore(true);
    expect(getAppDistribution()).toBe('dev');
  });

  it('process.windowsStore が true なら store', () => {
    setWindowsStore(true);
    expect(getAppDistribution()).toBe('store');
  });

  it('PORTABLE_EXECUTABLE_FILE があれば portable', () => {
    process.env.PORTABLE_EXECUTABLE_FILE = 'C:\\tools\\QuickDashLauncher.exe';
    expect(getAppDistribution()).toBe('portable');
  });

  it('どちらでもなければ installer', () => {
    expect(getAppDistribution()).toBe('installer');
  });
});
