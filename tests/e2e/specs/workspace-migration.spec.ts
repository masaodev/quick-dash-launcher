import * as fs from 'fs';
import * as path from 'path';

import type {
  JsonWorkspaceArchiveFile,
  JsonWorkspaceFile,
  WorkspaceUiStateFile,
} from '@common/types';

import { test, expect } from '../fixtures/electron-app';
import { TestUtils } from '../helpers/test-utils';

const ID_PATTERN = /^[A-Za-z0-9]{8}$/;

interface LoadReport {
  summary: { skipped: number; idAssigned: number; externallyChangedFiles: string[] };
  files: Array<{
    file: string;
    status: string;
    rewritten: boolean;
    externallyChanged: boolean;
    issues: Array<{ kind: string; reason: string; section?: string; id?: string }>;
  }>;
  preChangeSnapshot: string | null;
}

function listBackupFolders(configDir: string, suffix: string): string[] {
  const backupDir = path.join(configDir, 'backup');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter((name) => name.endsWith(suffix));
}

/**
 * ワークスペースファイルの旧形式（UUID id・path 疑似文字列・collapsed 混在・detached 別ファイル）が
 * 起動時に 2.0 へ移行され、以後はデータファイルと同じ外部編集の扱い（レポート・スナップショット・
 * 破損時の保護）を受けること
 */
test.describe('QuickDashLauncher - ワークスペースファイルの 2.0 移行と外部編集', () => {
  test.use({ configTemplate: 'with-workspace-v1' });

  test('旧形式の workspace.json が起動時に 2.0 に移行される', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const configDir = configHelper.getConfigDir();
    const legacyMain = fs.readFileSync(
      path.join(process.cwd(), 'tests', 'e2e', 'templates', 'with-workspace-v1', 'workspace.json'),
      'utf8'
    );

    await test.step('初期表示を待つ', async () => {
      await utils.waitForPageLoad();
      await mainWindow.locator('.item').first().waitFor({ state: 'visible', timeout: 10000 });
    });

    // 移行はワークスペースサービスの初期化（起動時）で走る。レポートが書かれるまで待つ
    await expect
      .poll(() => configHelper.readConfigJson<LoadReport>('last-load-report.json') !== null, {
        timeout: 10000,
      })
      .toBe(true);

    const main = configHelper.readConfigJson<JsonWorkspaceFile>('workspace.json')!;
    const archive =
      configHelper.readConfigJson<JsonWorkspaceArchiveFile>('workspace-archive.json')!;
    const uiState = configHelper.readConfigJson<WorkspaceUiStateFile>('workspace-ui-state.json')!;

    await test.step('version / $schema が付き、全 id が 8 文字英数字になる', async () => {
      expect(main.version).toBe('2.0');
      expect(main.$schema).toBe('./schemas/workspace.schema.json');
      const ids = [
        ...main.workspaces.map((w) => w.id),
        ...main.groups.map((g) => g.id),
        ...main.items.map((i) => i.id),
        ...archive.groups.map((g) => g.id),
        ...archive.items.map((i) => i.id),
      ];
      expect(ids.every((id) => ID_PATTERN.test(id))).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(main.workspaces).toHaveLength(1);
      expect(main.workspaces[0].id).not.toBe('default');
    });

    await test.step('参照（workspaceId / groupId / parentGroupId / archivedGroupId）が解決できる', async () => {
      const wsId = main.workspaces[0].id;
      const groupIds = new Set(main.groups.map((g) => g.id));
      expect(main.groups.every((g) => g.workspaceId === wsId)).toBe(true);
      expect(main.items.every((i) => i.workspaceId === wsId)).toBe(true);
      expect(main.items.every((i) => i.groupId === undefined || groupIds.has(i.groupId))).toBe(
        true
      );
      const sub = main.groups.find((g) => g.displayName === 'サブ')!;
      expect(sub.parentGroupId).toBe(main.groups.find((g) => g.displayName === '開発')!.id);
      const archiveGroupIds = new Set(archive.groups.map((g) => g.id));
      expect(archive.items.every((i) => archiveGroupIds.has(i.archivedGroupId))).toBe(true);
    });

    await test.step('アイテムがデータファイルと同じ語彙になり、廃止フィールドが消える', async () => {
      const byName = (name: string) => main.items.find((i) => i.displayName === name)!;
      expect(byName('GitHub')).toMatchObject({ type: 'item', path: 'https://github.com/' });
      expect(byName('Chrome を左へ')).toMatchObject({
        type: 'window',
        windowTitle: '*Google Chrome',
        processName: 'chrome.exe',
        x: 0,
        y: 0,
        width: 1280,
        height: 1400,
      });
      expect(byName('クリップ')).toMatchObject({
        type: 'clipboard',
        dataFileRef: 'clipboard-data/abc.json',
        formats: ['text'],
      });
      expect(byName('配置')).toMatchObject({
        type: 'layout',
        entries: [{ windowTitle: 'a', launchApp: false }],
      });

      const raw = JSON.stringify(main);
      for (const legacy of [
        'originalName',
        'label',
        'windowX',
        'clipboardDataRef',
        'layoutEntries',
        'collapsed',
        'ウィンドウ操作:',
        '"icon"',
      ]) {
        expect(raw, `${legacy} が残っている`).not.toContain(legacy);
      }
    });

    await test.step('色がトークンになる', async () => {
      expect(main.groups.find((g) => g.displayName === '開発')!.color).toBe('primary');
      expect(main.groups.find((g) => g.displayName === 'サブ')!.color).toBe('teal');
      expect(archive.groups[0].color).toBe('orange');
    });

    await test.step('折りたたみと切り離し状態が workspace-ui-state.json に移り、detached が消える', async () => {
      const dev = main.groups.find((g) => g.displayName === '開発')!;
      const sub = main.groups.find((g) => g.displayName === 'サブ')!;
      expect(uiState.collapsedGroups).toEqual({ [dev.id]: true });
      expect(uiState.detachedWindows[dev.id]).toEqual({
        collapsedStates: { [dev.id]: false, [sub.id]: true },
        bounds: { x: 10, y: 20, width: 300, height: 400 },
        pinMode: 1,
      });
      expect(fs.existsSync(path.join(configDir, 'workspace-detached.json'))).toBe(false);
    });

    await test.step('変更前が _pre-migration に残り、_pre-external は作られない', async () => {
      const preMigration = listBackupFolders(configDir, '_pre-migration');
      expect(preMigration).toHaveLength(1);
      expect(
        fs.readFileSync(path.join(configDir, 'backup', preMigration[0], 'workspace.json'), 'utf8')
      ).toBe(legacyMain);
      expect(
        fs.existsSync(path.join(configDir, 'backup', preMigration[0], 'workspace-detached.json'))
      ).toBe(true);
      expect(listBackupFolders(configDir, '_pre-external')).toEqual([]);
    });

    await test.step('レポートに移行が normalized として載る', async () => {
      const report = configHelper.readConfigJson<LoadReport>('last-load-report.json')!;
      const files = report.files.map((f) => f.file);
      expect(files).toEqual(
        expect.arrayContaining(['datafiles/data.json', 'workspace.json', 'workspace-archive.json'])
      );
      for (const file of ['workspace.json', 'workspace-archive.json']) {
        const fileReport = report.files.find((f) => f.file === file)!;
        expect(fileReport.status).toBe('ok');
        expect(fileReport.rewritten).toBe(true);
        expect(fileReport.externallyChanged).toBe(false);
        expect(
          fileReport.issues.some((i) => i.kind === 'normalized' && i.reason.includes('2.0'))
        ).toBe(true);
      }
      expect(report.summary.externallyChangedFiles).toEqual([]);
      expect(report.preChangeSnapshot).toBeNull();
    });

    await test.step('F5 しても再移行・外部変更扱いにはならない', async () => {
      await utils.reloadWithF5();
      await expect
        .poll(() => {
          const ws = configHelper
            .readConfigJson<LoadReport>('last-load-report.json')
            ?.files.find((f) => f.file === 'workspace.json');
          if (!ws) return null;
          return {
            rewritten: ws.rewritten,
            issues: ws.issues.length,
            external: ws.externallyChanged,
          };
        })
        .toEqual({ rewritten: false, issues: 0, external: false });
      expect(listBackupFolders(configDir, '_pre-migration')).toHaveLength(1);
      expect(fs.readFileSync(path.join(configDir, 'workspace.json'), 'utf8')).toBe(
        JSON.stringify(main, null, 2)
      );
    });
  });

  test('外部編集した workspace.json が F5 で反映され、壊れていれば上書きされない', async ({
    mainWindow,
    configHelper,
  }) => {
    const utils = new TestUtils(mainWindow);
    const configDir = configHelper.getConfigDir();

    await test.step('初期表示（移行完了）を待つ', async () => {
      await utils.waitForPageLoad();
      await expect
        .poll(() => configHelper.readConfigJson<JsonWorkspaceFile>('workspace.json')?.version, {
          timeout: 10000,
        })
        .toBe('2.0');
    });

    const migrated = configHelper.readConfigJson<JsonWorkspaceFile>('workspace.json')!;
    const migratedRaw = fs.readFileSync(path.join(configDir, 'workspace.json'), 'utf8');

    await test.step('QDL の外で表示名を変え、id なしのアイテムを足して F5', async () => {
      const edited = structuredClone(migrated);
      const github = edited.items.find((i) => i.displayName === 'GitHub')!;
      github.displayName = 'GitHub（外部編集）';
      edited.items.push({
        type: 'item',
        displayName: '外部追加',
        path: 'https://example.com/',
        workspaceId: edited.workspaces[0].id,
      } as JsonWorkspaceFile['items'][number]);
      fs.writeFileSync(
        path.join(configDir, 'workspace.json'),
        JSON.stringify(edited, null, 2),
        'utf8'
      );

      await utils.reloadWithF5();
      await expect
        .poll(
          () =>
            configHelper.readConfigJson<LoadReport>('last-load-report.json')?.summary
              .externallyChangedFiles
        )
        .toEqual(['workspace.json']);
    });

    await test.step('採番されて書き戻され、レポートと変更前スナップショットが残る', async () => {
      const after = configHelper.readConfigJson<JsonWorkspaceFile>('workspace.json')!;
      const added = after.items.find((i) => i.displayName === '外部追加')!;
      expect(added.id).toMatch(ID_PATTERN);
      expect(after.items.find((i) => i.displayName === 'GitHub（外部編集）')).toBeDefined();

      const report = configHelper.readConfigJson<LoadReport>('last-load-report.json')!;
      const ws = report.files.find((f) => f.file === 'workspace.json')!;
      expect(ws.externallyChanged).toBe(true);
      expect(ws.rewritten).toBe(true);
      // id は採番、省略した order / addedAt は補完（normalized）される
      expect(ws.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'idAssigned', section: 'items', id: added.id }),
        ])
      );
      expect(ws.issues.filter((i) => i.kind === 'invalid')).toEqual([]);
      expect(report.summary.idAssigned).toBe(1);
      expect(report.summary.skipped).toBe(0);

      expect(report.preChangeSnapshot).toMatch(/_pre-external$/);
      expect(
        fs.readFileSync(
          path.join(configDir, 'backup', report.preChangeSnapshot!, 'workspace.json'),
          'utf8'
        )
      ).toBe(migratedRaw);
    });

    await test.step('JSON として壊すと corrupted になり、ファイルは上書きされない', async () => {
      const brokenContent = '{ "version": "2.0", "workspaces": [ broken';
      fs.writeFileSync(path.join(configDir, 'workspace.json'), brokenContent, 'utf8');

      await utils.reloadWithF5();
      await expect
        .poll(
          () =>
            configHelper
              .readConfigJson<LoadReport>('last-load-report.json')
              ?.files.find((f) => f.file === 'workspace.json')?.status
        )
        .toBe('corrupted');

      expect(fs.readFileSync(path.join(configDir, 'workspace.json'), 'utf8')).toBe(brokenContent);
      // 破損中もアーカイブは書き換えない
      const archiveReport = configHelper
        .readConfigJson<LoadReport>('last-load-report.json')!
        .files.find((f) => f.file === 'workspace-archive.json')!;
      expect(archiveReport.status).toBe('unreadable');
    });

    await test.step('直して F5 すれば復帰する', async () => {
      const after = { ...migrated };
      fs.writeFileSync(
        path.join(configDir, 'workspace.json'),
        JSON.stringify(after, null, 2),
        'utf8'
      );
      await utils.reloadWithF5();
      await expect
        .poll(
          () =>
            configHelper
              .readConfigJson<LoadReport>('last-load-report.json')
              ?.files.find((f) => f.file === 'workspace.json')?.status
        )
        .toBe('ok');
    });
  });
});
