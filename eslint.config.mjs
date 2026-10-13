import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

/** 日本語（ひらがな・カタカナ・漢字）を含むか */
const JAPANESE = '/[\u3040-\u30ff\u3400-\u9fff]/';
/**
 * ログの呼び出し（引数の文言は訳さない）。logger.info(...)・console.error(...) のようなロガーのメソッドと、
 * renderer のログ関数（logError(...) など。src/renderer/utils/debug.ts）。
 * toast.error(...) のような画面に出す呼び出しは含めない
 */
const LOG_CALL =
  ':matches(' +
  'CallExpression[callee.object.name=/^(console|[a-z]*[lL]ogger)$/][callee.property.name=/^(trace|debug|info|warn|error|fatal|log)$/], ' +
  'CallExpression[callee.name=/^(debugLog|debugInfo|logWarn|logError)$/]' +
  ')';
/**
 * ログの文言の置き場（訳さないので直書きを許す）: 引数そのもの・文字列の連結、添える値のオブジェクトの値
 * （`a || 'なし'` のような既定値も）。ログの引数の中でも、関数の呼び出しの中などは対象のまま
 */
const LOG_LITERAL = [
  `${LOG_CALL} > Literal`,
  `${LOG_CALL} > BinaryExpression > Literal`,
  `${LOG_CALL} > ObjectExpression > Property > Literal`,
  `${LOG_CALL} > ObjectExpression > Property > :matches(LogicalExpression, ConditionalExpression) > Literal`,
].join(', ');
const LOG_TEMPLATE_ELEMENT = [
  `${LOG_CALL} > TemplateLiteral > TemplateElement`,
  `${LOG_CALL} > ObjectExpression > Property > TemplateLiteral > TemplateElement`,
].join(', ');
const I18N_MESSAGE =
  '画面に出す文言は辞書（src/common/i18n/locales/ja.ts・en.ts）に書き、t() で引いてください';
const I18N_RESTRICTED_SYNTAX = [
  { selector: `JSXText[value=${JAPANESE}]`, message: I18N_MESSAGE },
  { selector: `Literal[value=${JAPANESE}]:not(${LOG_LITERAL})`, message: I18N_MESSAGE },
  {
    selector: `TemplateElement[value.raw=${JAPANESE}]:not(${LOG_TEMPLATE_ELEMENT})`,
    message: I18N_MESSAGE,
  },
];
/**
 * 日本語の直書きを禁止しないファイル（src 全体に禁止をかけ、ここに挙げたものだけ外す）
 *
 * 画面に出る文言はすべて辞書へ移した（段階 1〜4）。ここに残るのは、ログや開発者向けの内部エラー
 * （利用者の画面に出ない）だけのファイルと、辞書そのもの
 */
const I18N_EXEMPT_FILES = [
  // 辞書の正本
  'src/common/i18n/locales/ja.ts',
  // 既定の名前（初回起動で表示言語の名前に置き換える。workspace は main が表示言語の名前を渡す）
  'src/common/types/json-workspace.ts',
  'src/main/services/settingsService.ts',
  // ログ・開発者向けの内部エラーだけ（画面に出ない）
  'src/common/utils/directiveUtils.ts',
  'src/main/ipc/{editHandlers,itemHandlers,workspaceHandlers}.ts',
  'src/main/main.ts',
  'src/main/workspaceWindowManager.ts',
  'src/main/services/{childWindowService,faviconService}.ts',
  'src/main/services/cli/cliInstallService.ts',
  'src/main/utils/{itemLauncher,nativeWindowControl,progressManager,windowActivator}.ts',
  'src/main/utils/virtualDesktop/{dllLoader,guidUtils,windowOperations}.ts',
];

/** TypeScript のコード（本体・テスト）に共通の設定 */
const TS_LANGUAGE_OPTIONS = {
  parser: tsParser,
  ecmaVersion: 'latest',
  sourceType: 'module',
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.es2021,
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },
};
const TS_PLUGINS = {
  '@typescript-eslint': tsPlugin,
  react: reactPlugin,
  import: importPlugin,
  prettier: prettierPlugin,
};
const TS_RULES = {
  // TypeScript推奨ルール
  ...tsPlugin.configs.recommended.rules,

  // React推奨ルール
  ...reactPlugin.configs.recommended.rules,
  ...reactPlugin.configs['jsx-runtime'].rules,

  // カスタムルール
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-deprecated': 'warn',
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/no-var-requires': 'off',
  '@typescript-eslint/no-require-imports': 'off',
  'import/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'always',
    },
  ],
  'import/no-duplicates': 'error',

  // Prettier統合
  'prettier/prettier': 'error',
};
const REACT_SETTINGS = {
  react: {
    version: 'detect',
  },
};

export default [
  // 基本設定
  js.configs.recommended,

  // 除外設定
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'release/',
      'html/',
      '.vitest/',
      'test-results/',
      'coverage/',
      '*.min.js',
      'src/common/types.js',
      'src/common/types.js.map',
      'src/main/winrt/generated/',
    ],
  },

  // スクリプトファイル設定（Node.js専用）
  {
    files: ['scripts/**/*.{js,mjs}', '.claude/hooks/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'no-redeclare': 'off',
    },
  },

  // TypeScript + React設定（メインコード）
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: TS_LANGUAGE_OPTIONS,
    plugins: { ...TS_PLUGINS, 'react-hooks': reactHooksPlugin },
    rules: {
      ...TS_RULES,
      // React Hooks推奨ルール
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
    settings: REACT_SETTINGS,
  },

  // テストファイル設定（より具体的なパターンなので後に配置。react-hooks は使わない）
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    languageOptions: TS_LANGUAGE_OPTIONS,
    plugins: TS_PLUGINS,
    rules: {
      ...TS_RULES,
      'no-console': 'off', // テストファイルではconsole.logを許可
    },
    settings: REACT_SETTINGS,
  },

  // 多言語化: 画面に出す日本語をコードに直接書かない（文言は src/common/i18n/locales/ の辞書に書き、t() で引く）。
  // ログ（logger.info など）の文言は訳さないので対象外。外すファイルは I18N_EXEMPT_FILES
  {
    files: ['src/**/*.{ts,tsx}'],
    // テストは日本語の画面を確かめるので対象外
    ignores: ['**/*.test.ts', '**/*.test.tsx', 'src/test/**', ...I18N_EXEMPT_FILES],
    rules: {
      'no-restricted-syntax': ['error', ...I18N_RESTRICTED_SYNTAX],
    },
  },

  // Prettier競合解決
  prettierConfig,
];
