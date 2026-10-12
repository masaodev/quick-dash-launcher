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
const I18N_MESSAGE = '画面に出す文言は辞書（src/common/i18n/locales/ja.ts・en.ts）に書き、t() で引いてください';
const I18N_RESTRICTED_SYNTAX = [
  { selector: `JSXText[value=${JAPANESE}]`, message: I18N_MESSAGE },
  { selector: `Literal[value=${JAPANESE}]:not(${LOG_CALL} > Literal)`, message: I18N_MESSAGE },
  {
    selector: `TemplateElement[value.raw=${JAPANESE}]:not(${LOG_CALL} > TemplateLiteral > TemplateElement)`,
    message: I18N_MESSAGE
  }
];
/** 日本語の直書きを禁止するファイル（辞書へ移し終えたもの） */
const I18N_ENFORCED_FILES = [
  'src/common/i18n/languages.ts',
  'src/common/i18n/index.ts',
  'src/main/services/i18nService.ts',
  'src/renderer/i18n.ts',
  'src/common/utils/bookmarkImportUtils.ts',
  // メインウィンドウ（段階 2）
  'src/renderer/App.tsx',
  'src/renderer/SplashApp.tsx',
  'src/renderer/components/Launcher*.tsx',
  'src/renderer/components/AlertDialog.tsx',
  'src/renderer/components/ConfirmDialog.tsx',
  'src/renderer/components/HotkeyInput.tsx',
  'src/renderer/components/IconProgressDetailModal.tsx',
  'src/renderer/components/MemoViewModal.tsx',
  'src/renderer/components/MissingIconNotice.tsx',
  'src/renderer/components/SetupFirstLaunch.tsx',
  'src/renderer/hooks/useDataFileTabs.ts',
  'src/renderer/hooks/useDialogManager.ts',
  'src/renderer/hooks/useDragAndDrop.ts',
  'src/renderer/hooks/useItemActions.ts',
  'src/renderer/hooks/useKeyboardShortcuts.ts',
  'src/renderer/hooks/useWindowOperations.ts',
  'src/renderer/utils/tooltipTextGenerator.ts'
];

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
      'src/main/winrt/generated/'
    ]
  },

  // スクリプトファイル設定（Node.js専用）
  {
    files: ['scripts/**/*.{js,mjs}', '.claude/hooks/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
      }],
      'no-redeclare': 'off'
    }
  },

  // TypeScript + React設定（メインコード）
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import': importPlugin,
      'prettier': prettierPlugin
    },
    rules: {
      // TypeScript推奨ルール
      ...tsPlugin.configs.recommended.rules,

      // React推奨ルール
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // React Hooks推奨ルール
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',

      // カスタムルール
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],
      'import/no-duplicates': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@common/ipcChannels',
          importNames: [
            'OPEN_ITEM', 'OPEN_PARENT_FOLDER', 'EXECUTE_GROUP', 'EXECUTE_WINDOW_OPERATION',
            'LOAD_DATA_FILES', 'LOAD_RAW_DATA_FILES', 'SAVE_RAW_DATA_FILES', 'REGISTER_ITEMS',
            'GET_CONFIG_FOLDER', 'GET_DATA_FILES', 'CREATE_DATA_FILE', 'DELETE_DATA_FILE',
            'IS_DIRECTORY', 'FETCH_FAVICON', 'EXTRACT_ICON', 'EXTRACT_FILE_ICON_BY_EXTENSION',
            'EXTRACT_CUSTOM_URI_ICON', 'GET_ICON_FOR_ITEM', 'LOAD_CACHED_ICONS',
            'LOAD_CACHED_ICONS_BY_ITEMS', 'FETCH_ICONS_COMBINED', 'SELECT_CUSTOM_ICON_FILE',
            'SAVE_CUSTOM_ICON', 'DELETE_CUSTOM_ICON', 'GET_CUSTOM_ICON',
            'SELECT_BOOKMARK_FILE', 'PARSE_BOOKMARK_FILE', 'DETECT_INSTALLED_BROWSERS',
            'PARSE_BROWSER_BOOKMARKS', 'GET_WINDOW_PIN_MODE', 'CYCLE_WINDOW_PIN_MODE',
            'QUIT_APP', 'SET_EDIT_MODE', 'GET_EDIT_MODE', 'SHOW_EDIT_WINDOW',
            'HIDE_EDIT_WINDOW', 'TOGGLE_EDIT_WINDOW', 'IS_EDIT_WINDOW_SHOWN',
            'OPEN_EDIT_WINDOW_WITH_TAB', 'GET_INITIAL_TAB', 'GET_ALL_WINDOWS',
            'GET_ALL_WINDOWS_ALL_DESKTOPS', 'GET_VIRTUAL_DESKTOP_INFO', 'ACTIVATE_WINDOW',
            'COPY_TO_CLIPBOARD', 'SET_MODAL_MODE', 'LOG_PERFORMANCE_TIMING',
            'UPDATE_ITEM', 'UPDATE_RAW_LINE', 'DELETE_ITEMS', 'BATCH_UPDATE_ITEMS',
            'SETTINGS_IS_FIRST_LAUNCH', 'SETTINGS_GET', 'SETTINGS_SET',
            'SETTINGS_SET_MULTIPLE', 'SETTINGS_RESET', 'SETTINGS_VALIDATE_HOTKEY',
            'SETTINGS_GET_CONFIG_PATH', 'SETTINGS_CHANGE_HOTKEY',
            'SETTINGS_CHECK_HOTKEY_AVAILABILITY', 'OPEN_CONFIG_FOLDER', 'GET_APP_INFO',
            'OPEN_EXTERNAL_URL', 'SPLASH_READY', 'LOAD_SEARCH_HISTORY',
            'LOAD_SEARCH_HISTORY_BY_TAB', 'SAVE_SEARCH_HISTORY', 'ADD_SEARCH_HISTORY_ENTRY',
            'CLEAR_SEARCH_HISTORY'
          ],
          message: 'IPC定数の個別インポートは禁止されています。IPC_CHANNELSオブジェクトを使用してください。'
        }]
      }],

      // Prettier統合
      'prettier/prettier': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // テストファイル設定（より具体的なパターンなので後に配置）
  {
    files: ['tests/**/*.{js,jsx,ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'import': importPlugin,
      'prettier': prettierPlugin
    },
    rules: {
      // TypeScript推奨ルール
      ...tsPlugin.configs.recommended.rules,

      // React推奨ルール（テストファイルではreact-hooksを無効化）
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,

      // カスタムルール
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],
      'import/no-duplicates': 'error',
      'no-console': 'off', // テストファイルではconsole.logを許可
      'no-restricted-imports': ['error', {
        paths: [{
          name: '@common/ipcChannels',
          importNames: [
            'OPEN_ITEM', 'OPEN_PARENT_FOLDER', 'EXECUTE_GROUP', 'EXECUTE_WINDOW_OPERATION',
            'LOAD_DATA_FILES', 'LOAD_RAW_DATA_FILES', 'SAVE_RAW_DATA_FILES', 'REGISTER_ITEMS',
            'GET_CONFIG_FOLDER', 'GET_DATA_FILES', 'CREATE_DATA_FILE', 'DELETE_DATA_FILE',
            'IS_DIRECTORY', 'FETCH_FAVICON', 'EXTRACT_ICON', 'EXTRACT_FILE_ICON_BY_EXTENSION',
            'EXTRACT_CUSTOM_URI_ICON', 'GET_ICON_FOR_ITEM', 'LOAD_CACHED_ICONS',
            'LOAD_CACHED_ICONS_BY_ITEMS', 'FETCH_ICONS_COMBINED', 'SELECT_CUSTOM_ICON_FILE',
            'SAVE_CUSTOM_ICON', 'DELETE_CUSTOM_ICON', 'GET_CUSTOM_ICON',
            'SELECT_BOOKMARK_FILE', 'PARSE_BOOKMARK_FILE', 'DETECT_INSTALLED_BROWSERS',
            'PARSE_BROWSER_BOOKMARKS', 'GET_WINDOW_PIN_MODE', 'CYCLE_WINDOW_PIN_MODE',
            'QUIT_APP', 'SET_EDIT_MODE', 'GET_EDIT_MODE', 'SHOW_EDIT_WINDOW',
            'HIDE_EDIT_WINDOW', 'TOGGLE_EDIT_WINDOW', 'IS_EDIT_WINDOW_SHOWN',
            'OPEN_EDIT_WINDOW_WITH_TAB', 'GET_INITIAL_TAB', 'GET_ALL_WINDOWS',
            'GET_ALL_WINDOWS_ALL_DESKTOPS', 'GET_VIRTUAL_DESKTOP_INFO', 'ACTIVATE_WINDOW',
            'COPY_TO_CLIPBOARD', 'SET_MODAL_MODE', 'LOG_PERFORMANCE_TIMING',
            'UPDATE_ITEM', 'UPDATE_RAW_LINE', 'DELETE_ITEMS', 'BATCH_UPDATE_ITEMS',
            'SETTINGS_IS_FIRST_LAUNCH', 'SETTINGS_GET', 'SETTINGS_SET',
            'SETTINGS_SET_MULTIPLE', 'SETTINGS_RESET', 'SETTINGS_VALIDATE_HOTKEY',
            'SETTINGS_GET_CONFIG_PATH', 'SETTINGS_CHANGE_HOTKEY',
            'SETTINGS_CHECK_HOTKEY_AVAILABILITY', 'OPEN_CONFIG_FOLDER', 'GET_APP_INFO',
            'OPEN_EXTERNAL_URL', 'SPLASH_READY', 'LOAD_SEARCH_HISTORY',
            'LOAD_SEARCH_HISTORY_BY_TAB', 'SAVE_SEARCH_HISTORY', 'ADD_SEARCH_HISTORY_ENTRY',
            'CLEAR_SEARCH_HISTORY'
          ],
          message: 'IPC定数の個別インポートは禁止されています。IPC_CHANNELSオブジェクトを使用してください。'
        }]
      }],

      // Prettier統合
      'prettier/prettier': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },

  // 多言語化: 画面に出す日本語をコードに直接書かない（文言は src/common/i18n/locales/ の辞書に書き、t() で引く）。
  // ログ（logger.info など）の文言は訳さないので対象外。辞書へ移し終えたファイル・フォルダから順に files へ足す
  {
    files: I18N_ENFORCED_FILES,
    // テストは日本語の画面を確かめるので対象外
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...I18N_RESTRICTED_SYNTAX]
    }
  },

  // Prettier競合解決
  prettierConfig
];
