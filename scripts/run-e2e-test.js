#!/usr/bin/env node
/* eslint-env node */

/**
 * E2Eテストを個別に実行するためのヘルパースクリプト
 * Usage: node scripts/run-e2e-test.js <test-name>
 * Example: node scripts/run-e2e-test.js app-launch
 */

const { execSync } = require('child_process');

const testName = process.argv[2];

if (!testName) {
  console.error('Error: Test name is required');
  console.log('\nUsage: npm run test:e2e:single <test-name>');
  console.log('\nAvailable tests:');
  console.log('  - first-launch');
  console.log('  - basic-ui');
  console.log('  - item-register');
  console.log('  - multi-tab');
  console.log('  - settings');
  console.log('  - context-menu');
  console.log('\nExample: npm run test:e2e:single first-launch');
  process.exit(1);
}

// テスト名からファイル名へのマッピング
const testMap = {
  'first-launch': 'first-launch-setup.spec.ts',
  'basic-ui': 'basic-ui.spec.ts',
  'item-register': 'item-registration.spec.ts',
  'multi-tab': 'multi-tab.spec.ts',
  'settings': 'settings-tab.spec.ts',
  'context-menu': 'context-menu.spec.ts',
};

const testFile = testMap[testName];

if (!testFile) {
  console.error(`Error: Unknown test name "${testName}"`);
  console.log('\nAvailable tests:', Object.keys(testMap).join(', '));
  process.exit(1);
}

// Windowsでも動作するようにスラッシュ区切りに統一
const testPath = `tests/e2e/specs/${testFile}`;

console.log(`Running E2E test: ${testName} (${testFile})`);
console.log('Building application...');

try {
  execSync(`npm run build && playwright test "${testPath}"`, {
    stdio: 'inherit',
    shell: true,
  });
} catch (error) {
  process.exit(error.status || 1);
}
