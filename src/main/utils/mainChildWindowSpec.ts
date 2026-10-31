import type { MainChildWindowRequest } from '@common/types';

import { mainI18n } from '../services/mainI18n.js';

/** ランチャーの子ウィンドウの標準サイズ・タイトル */
export interface MainChildWindowSpec {
  title: string;
  size: { width: number; height: number };
}

/**
 * 要求の種類ごとのウィンドウ仕様を返す
 *
 * サイズは以前のモーダルがランチャーに要求していた大きさ（登録 850x1000、
 * アイコン取得結果 800x700）を基準に、フォームが収まる範囲で少し詰めたもの。
 * 実際の大きさは作業領域で切り詰められる（calculateEditorBounds）
 */
export function resolveMainChildWindowSpec(request: MainChildWindowRequest): MainChildWindowSpec {
  switch (request.kind) {
    case 'register':
      return {
        title: mainI18n.t(request.editingItem ? 'register.editTitle' : 'register.addTitle'),
        size: { width: 850, height: 900 },
      };
    case 'iconProgressDetail':
      return {
        title: mainI18n.t('register.iconResultTitle'),
        size: { width: 760, height: 700 },
      };
  }
}
