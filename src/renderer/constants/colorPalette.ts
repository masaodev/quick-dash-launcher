/**
 * ワークスペースグループのプリセット色パレット
 */

export interface ColorPaletteItem {
  /** 色の名前 */
  name: string;
  /** CSS変数名またはカラーコード */
  value: string;
}

/**
 * グループ色選択用のプリセット色パレット（12色）
 */
export const GROUP_COLOR_PALETTE: ColorPaletteItem[] = [
  {
    name: 'プライマリ',
    value: 'var(--color-primary)',
  },
  {
    name: 'サクセス',
    value: 'var(--color-success)',
  },
  {
    name: 'ダンジャー',
    value: 'var(--color-danger)',
  },
  {
    name: 'ワーニング',
    value: 'var(--color-warning)',
  },
  {
    name: 'インフォ',
    value: 'var(--color-info)',
  },
  {
    name: 'セカンダリ',
    value: 'var(--color-secondary)',
  },
  {
    name: 'パープル',
    value: '#9c27b0',
  },
  {
    name: 'ティール',
    value: '#00897b',
  },
  {
    name: 'ピンク',
    value: '#e91e63',
  },
  {
    name: 'インディゴ',
    value: '#3f51b5',
  },
  {
    name: 'オレンジ',
    value: '#ff5722',
  },
  {
    name: 'シアン',
    value: '#00bcd4',
  },
];
