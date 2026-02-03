/**
 * URL変換ルール定義
 *
 * SharePointなどのURLをカスタムURIスキーマに変換するためのルールを定義します。
 */

/**
 * 変換オプション
 */
export interface ConversionOption {
  /** 表示名 */
  label: string;
  /** プレフィックス */
  prefix: string;
  /** 説明（オプショナル） */
  description?: string;
}

/**
 * 変換ルール
 */
export interface ConversionRule {
  /** ルール名 */
  name: string;
  /** URLパターン（正規表現） */
  pattern: RegExp;
  /** 変換オプションのリスト */
  options: ConversionOption[];
}

/**
 * SharePoint/OneDrive Excel用の変換ルール
 */
const sharepointExcelRule: ConversionRule = {
  name: 'SharePoint/OneDrive Excel',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(xlsx|xls)(\?|$|\/)/i,
  options: [
    {
      label: '編集モード（SharePoint標準）',
      prefix: 'ms-excel:ofe|ofc|u|',
      description: 'SharePointで使用される標準的な編集モード',
    },
    {
      label: '編集モード',
      prefix: 'ms-excel:ofe|u|',
      description: 'Excelアプリで編集用に開く',
    },
    {
      label: '読み取り専用',
      prefix: 'ms-excel:ofv|u|',
      description: 'Excelアプリで読み取り専用で開く',
    },
  ],
};

/**
 * SharePoint/OneDrive Word用の変換ルール
 */
const sharepointWordRule: ConversionRule = {
  name: 'SharePoint/OneDrive Word',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(docx|doc)(\?|$|\/)/i,
  options: [
    {
      label: '編集モード',
      prefix: 'ms-word:ofe|u|',
      description: 'Wordアプリで編集用に開く',
    },
    {
      label: '読み取り専用',
      prefix: 'ms-word:ofv|u|',
      description: 'Wordアプリで読み取り専用で開く',
    },
  ],
};

/**
 * SharePoint/OneDrive PowerPoint用の変換ルール
 */
const sharepointPowerPointRule: ConversionRule = {
  name: 'SharePoint/OneDrive PowerPoint',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(pptx|ppt)(\?|$|\/)/i,
  options: [
    {
      label: '編集モード',
      prefix: 'ms-powerpoint:ofe|u|',
      description: 'PowerPointアプリで編集用に開く',
    },
    {
      label: '読み取り専用',
      prefix: 'ms-powerpoint:ofv|u|',
      description: 'PowerPointアプリで読み取り専用で開く',
    },
  ],
};

/**
 * 全ての変換ルール
 */
export const conversionRules: ConversionRule[] = [
  sharepointExcelRule,
  sharepointWordRule,
  sharepointPowerPointRule,
];

/**
 * URLから既存のOffice URIスキーマプレフィックスを削除
 * @param url 元のURL
 * @returns プレフィックスが削除されたURL
 */
function removeExistingPrefix(url: string): string {
  // Office URIスキーマのパターン（ms-excel:, ms-word:, ms-powerpoint: など）
  // 例: ms-excel:ofe|ofc|u|https://... → https://...
  // Office URIスキーマから始まり、https?:// の直前までをすべて削除
  return url.replace(/^(ms-excel:|ms-word:|ms-powerpoint:).*?(?=https?:\/\/)/, '');
}

/**
 * URLに一致する変換ルールを検索
 * 既存のプレフィックスがある場合は削除してから検索します
 * @param url 検索対象のURL
 * @returns 一致したルール、または undefined
 */
export function findMatchingRule(url: string | undefined): ConversionRule | undefined {
  if (!url) return undefined;
  // 既存のプレフィックスを削除してから検索
  const cleanUrl = removeExistingPrefix(url);
  return conversionRules.find((rule) => rule.pattern.test(cleanUrl));
}

/**
 * URLに変換プレフィックスを適用
 * 既存のプレフィックスがある場合は削除してから新しいプレフィックスを追加します
 * @param url 元のURL
 * @param prefix 適用するプレフィックス
 * @returns 変換後のURL
 */
export function applyConversionPrefix(url: string, prefix: string): string {
  // 既存のプレフィックスを削除
  const cleanUrl = removeExistingPrefix(url);

  // 新しいプレフィックスを追加
  return prefix + cleanUrl;
}
