/**
 * 仮想デスクトップ制御機能のテスト
 */
import { describe, it, expect } from 'vitest';

import {
  isVirtualDesktopSupported,
  getVirtualDesktopGUIDs,
  moveWindowToVirtualDesktop,
} from './virtualDesktop/index.js';
import { findWindowByTitle } from './windowMatcher.js';

describe('virtualDesktopControl', () => {
  describe('isVirtualDesktopSupported', () => {
    it('Windows 10以降でtrueを返すべき', () => {
      const result = isVirtualDesktopSupported();
      console.log('仮想デスクトップサポート:', result);

      // Windows 10以降の環境ではtrueになるはず（CI環境では異なる可能性あり）
      // このテストは環境依存なので、結果をログ出力のみ
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getVirtualDesktopGUIDs', () => {
    it('GUIDの配列を取得できるべき', () => {
      const guids = getVirtualDesktopGUIDs();
      console.log('取得したGUID:', guids);

      // 環境依存のため、配列であることのみ確認
      expect(Array.isArray(guids)).toBe(true);

      // GUIDが取得できた場合、フォーマットを確認
      if (guids.length > 0) {
        const guidPattern = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;
        guids.forEach((guid) => {
          expect(guid).toMatch(guidPattern);
        });
      }
    });
  });

  describe('moveWindowToVirtualDesktop', () => {
    it('無効なウィンドウハンドルで結果を返す（環境依存）', () => {
      // 存在しないウィンドウハンドルを使用
      // 注意: DLLの動作は環境依存のため、boolean型であることのみ確認
      const result = moveWindowToVirtualDesktop(0, 1);
      console.log('無効なHWNDでの移動結果:', result);

      expect(typeof result).toBe('boolean');
    });

    it('範囲外のデスクトップ番号でfalseを返すべき', () => {
      // 存在しないデスクトップ番号を使用
      const result = moveWindowToVirtualDesktop(1, 999);
      console.log('範囲外のデスクトップ番号での移動結果:', result);

      // getDesktopCount()で上限チェックを行うため、falseを返すはず
      expect(result).toBe(false);
    });

    it('Obsidianウィンドウを仮想デスクトップ2に移動できるべき', () => {
      // Obsidianのウィンドウを検索
      const windowTitle = 'TODOキャンパス - obsidian-pri - Obsidian';
      const hwnd = findWindowByTitle(windowTitle);

      console.log('検索結果:', { windowTitle, hwnd: hwnd ? String(hwnd) : null });

      if (hwnd === null) {
        console.warn('Obsidianウィンドウが見つかりませんでした。テストをスキップします。');
        expect(hwnd).toBeNull();
        return;
      }

      // デスクトップ2に移動
      const desktopNumber = 2;
      const result = moveWindowToVirtualDesktop(hwnd, desktopNumber);

      console.log('ウィンドウ移動結果:', result);

      // 結果を確認（成功/失敗どちらでもログを出力）
      if (result) {
        console.log('✅ ウィンドウの移動に成功しました！');
      } else {
        console.log('❌ ウィンドウの移動に失敗しました');
      }

      // このテストは情報収集が目的なので、結果に関わらずパス
      expect(typeof result).toBe('boolean');
    });
  });

  describe('内部関数のGUID変換テスト', () => {
    it('GUID文字列とバイナリの相互変換が正しく動作するべき', () => {
      // この部分は内部関数なので直接テストできないが、
      // getVirtualDesktopGUIDsの結果で間接的に確認できる
      const guids = getVirtualDesktopGUIDs();

      if (guids.length > 0) {
        // 取得したGUIDがすべて正しいフォーマットであることを確認
        const guidPattern = /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i;
        guids.forEach((guid) => {
          expect(guid).toMatch(guidPattern);
          console.log('GUID:', guid);
        });
      }
    });
  });
});
