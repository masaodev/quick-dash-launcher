import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('../config/pathManager.js', () => ({
  default: { getIconCacheFolder: vi.fn(() => '/mock/config/icon-cache') },
}));

vi.mock('electron-store', () => {
  return {
    default: class MockElectronStore {
      get = mockStore.get;
      set = mockStore.set;
    },
  };
});

vi.mock('@common/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { IconFetchErrorService } from './iconFetchErrorService';

describe('IconFetchErrorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.get.mockReturnValue([]);
    IconFetchErrorService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recordError', () => {
    it('新規エラーを記録できる', async () => {
      const service = await IconFetchErrorService.getInstance();

      await service.recordError('https://example.com', 'favicon', 'Connection failed');

      expect(mockStore.set).toHaveBeenCalledWith('errors', [
        expect.objectContaining({
          key: 'https://example.com',
          type: 'favicon',
          errorMessage: 'Connection failed',
          failCount: 1,
        }),
      ]);
    });

    it('既存エラーの failCount をインクリメントする', async () => {
      const service = await IconFetchErrorService.getInstance();

      mockStore.get.mockReturnValue([
        {
          key: 'https://example.com',
          type: 'favicon' as const,
          errorMessage: 'Previous error',
          errorAt: Date.now() - 1000,
          failCount: 1,
        },
      ]);

      await service.recordError('https://example.com', 'favicon', 'New error');

      expect(mockStore.set).toHaveBeenCalledWith('errors', [
        expect.objectContaining({
          key: 'https://example.com',
          type: 'favicon',
          errorMessage: 'New error',
          failCount: 2,
        }),
      ]);
    });

    it('異なるタイプのエラーは別々に記録される', async () => {
      const service = await IconFetchErrorService.getInstance();

      const existingError = {
        key: 'C:\\test\\file.exe',
        type: 'icon' as const,
        errorMessage: 'Icon error',
        errorAt: Date.now() - 1000,
        failCount: 1,
      };
      mockStore.get.mockReturnValue([existingError]);

      await service.recordError('C:\\test\\file.exe', 'favicon', 'Favicon error');

      expect(mockStore.set).toHaveBeenCalledWith('errors', [
        existingError,
        expect.objectContaining({
          key: 'C:\\test\\file.exe',
          type: 'favicon',
          errorMessage: 'Favicon error',
          failCount: 1,
        }),
      ]);
    });
  });

  describe('hasError', () => {
    it('エラー記録がある場合は true を返す', async () => {
      const service = await IconFetchErrorService.getInstance();

      mockStore.get.mockReturnValue([
        {
          key: 'https://example.com',
          type: 'favicon',
          errorMessage: 'Test',
          errorAt: Date.now(),
          failCount: 1,
        },
      ]);

      expect(await service.hasError('https://example.com', 'favicon')).toBe(true);
    });

    it('エラー記録がない場合は false を返す', async () => {
      const service = await IconFetchErrorService.getInstance();

      expect(await service.hasError('https://example.com', 'favicon')).toBe(false);
    });

    it('異なるキーのエラー記録は検出しない', async () => {
      const service = await IconFetchErrorService.getInstance();

      mockStore.get.mockReturnValue([
        {
          key: 'https://other.com',
          type: 'favicon',
          errorMessage: 'Test',
          errorAt: Date.now(),
          failCount: 1,
        },
      ]);

      expect(await service.hasError('https://example.com', 'favicon')).toBe(false);
    });

    it('異なるタイプのエラー記録は検出しない', async () => {
      const service = await IconFetchErrorService.getInstance();

      mockStore.get.mockReturnValue([
        {
          key: 'https://example.com',
          type: 'icon',
          errorMessage: 'Test',
          errorAt: Date.now(),
          failCount: 1,
        },
      ]);

      expect(await service.hasError('https://example.com', 'favicon')).toBe(false);
    });
  });

  describe('clearAllErrors', () => {
    it('すべてのエラー記録をクリアする', async () => {
      const service = await IconFetchErrorService.getInstance();

      await service.clearAllErrors();

      expect(mockStore.set).toHaveBeenCalledWith('errors', []);
    });
  });

  describe('getAllErrors', () => {
    it('すべてのエラー記録を取得する', async () => {
      const service = await IconFetchErrorService.getInstance();

      const errors = [
        {
          key: 'https://example.com',
          type: 'favicon' as const,
          errorMessage: 'Error 1',
          errorAt: Date.now(),
          failCount: 1,
        },
        {
          key: 'C:\\test\\file.exe',
          type: 'icon' as const,
          errorMessage: 'Error 2',
          errorAt: Date.now(),
          failCount: 2,
        },
      ];
      mockStore.get.mockReturnValue(errors);

      expect(await service.getAllErrors()).toEqual(errors);
    });

    it('エラー記録が空の場合は空配列を返す', async () => {
      const service = await IconFetchErrorService.getInstance();

      expect(await service.getAllErrors()).toEqual([]);
    });
  });
});
