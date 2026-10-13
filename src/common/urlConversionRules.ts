/**
 * URL変換ルール定義
 *
 * SharePointなどのURLをカスタムURIスキーマに変換するためのルールを定義します。
 */

/**
 * 変換オプション
 */
export interface ConversionOption {
  /** 開き方（画面の表示名と説明は辞書の urlConverter.options・urlConverter.descriptions から引く） */
  kind: 'sharePointEdit' | 'edit' | 'readOnly';
  /** プレフィックス */
  prefix: string;
}

/**
 * 変換ルール
 */
export interface ConversionRule {
  /** ルール名 */
  name: string;
  /** 開くアプリ（説明の文言に差し込む） */
  app: 'Excel' | 'Word' | 'PowerPoint';
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
  app: 'Excel',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(xlsx|xls)(\?|$|\/)/i,
  options: [
    {
      kind: 'sharePointEdit',
      prefix: 'ms-excel:ofe|ofc|u|',
    },
    {
      kind: 'edit',
      prefix: 'ms-excel:ofe|u|',
    },
    {
      kind: 'readOnly',
      prefix: 'ms-excel:ofv|u|',
    },
  ],
};

/**
 * SharePoint/OneDrive Word用の変換ルール
 */
const sharepointWordRule: ConversionRule = {
  name: 'SharePoint/OneDrive Word',
  app: 'Word',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(docx|doc)(\?|$|\/)/i,
  options: [
    {
      kind: 'edit',
      prefix: 'ms-word:ofe|u|',
    },
    {
      kind: 'readOnly',
      prefix: 'ms-word:ofv|u|',
    },
  ],
};

/**
 * SharePoint/OneDrive PowerPoint用の変換ルール
 */
const sharepointPowerPointRule: ConversionRule = {
  name: 'SharePoint/OneDrive PowerPoint',
  app: 'PowerPoint',
  pattern: /(sharepoint\.com|docs\.live\.net).*\.(pptx|ppt)(\?|$|\/)/i,
  options: [
    {
      kind: 'edit',
      prefix: 'ms-powerpoint:ofe|u|',
    },
    {
      kind: 'readOnly',
      prefix: 'ms-powerpoint:ofv|u|',
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
