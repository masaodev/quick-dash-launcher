import * as fs from 'fs';
import * as path from 'path';

import { itemLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  launchUsagePathKey,
  type LaunchUsageRecord,
  type LaunchUsageSnapshot,
} from '@common/types/launchUsage';

import { SettingsService } from './settingsService.js';

interface LaunchUsageFile extends LaunchUsageSnapshot {
  version: 1;
}

/** 数の項目がそろった記録だけを残す（手で書き換えた・一部が壊れたファイルに備える） */
function validRecords(value: unknown): Record<string, LaunchUsageRecord> {
  const records: Record<string, LaunchUsageRecord> = {};
  if (!value || typeof value !== 'object') return records;
  for (const [key, record] of Object.entries(value as Record<string, unknown>)) {
    const r = record as Partial<LaunchUsageRecord> | null;
    if (
      r &&
      typeof r.lastLaunchedAt === 'number' &&
      Number.isFinite(r.lastLaunchedAt) &&
      typeof r.count === 'number' &&
      Number.isInteger(r.count) &&
      r.count > 0
    ) {
      records[key] = { lastLaunchedAt: r.lastLaunchedAt, count: r.count };
    }
  }
  return records;
}

/** 書き込みをまとめる間隔（続けて起動したときに毎回書かない） */
const WRITE_DELAY_MS = 1000;

/**
 * アイテムを起動した記録（最後に起動した日時と回数）を item-usage.json に残す
 *
 * データファイルには書かない（起動のたびにデータファイルを書き換えると、ファイル監視で一覧を読み直し、
 * 同期・Git 管理している人の差分も増えるため）。
 * メイン画面・セットからの起動は id で、ワークスペースからの起動は id がメインと違うのでパスと引数で記録する。
 * アイテム管理は id とパスの両方の記録を足して見せる
 */
export class LaunchUsageService {
  private static instance: LaunchUsageService | null = null;
  private data: LaunchUsageFile | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 書いていない記録があるか（読んだだけのときは書かない） */
  private dirty = false;

  private constructor(private readonly filePath: string) {}

  static initialize(configFolder: string): LaunchUsageService {
    LaunchUsageService.instance = new LaunchUsageService(
      path.join(configFolder, 'item-usage.json')
    );
    return LaunchUsageService.instance;
  }

  static getInstance(): LaunchUsageService | null {
    return LaunchUsageService.instance;
  }

  private load(): LaunchUsageFile {
    if (this.data) return this.data;
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<LaunchUsageFile>;
      this.data = {
        version: 1,
        since: typeof raw.since === 'number' ? raw.since : Date.now(),
        byId: validRecords(raw.byId),
        byPath: validRecords(raw.byPath),
      };
    } catch (error) {
      // 初めて（ファイルが無い）なら記録を始める。壊れていたら、消さずに脇へ移してから始め直す
      if (fs.existsSync(this.filePath)) {
        const aside = `${this.filePath}.broken-${Date.now()}`;
        try {
          fs.renameSync(this.filePath, aside);
          itemLogger.warn({ error, aside }, '起動の記録が読めなかったので、脇へ移して始め直します');
        } catch {
          // 移せなくても始め直す（次の書き込みで上書きする）
        }
      }
      this.data = { version: 1, since: Date.now(), byId: {}, byPath: {} };
    }
    return this.data;
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, WRITE_DELAY_MS);
  }

  /** 書き込み待ちを今すぐ書く（終了時にも呼ぶ） */
  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (!this.data || !this.dirty) return;
    // 書いている途中で落ちても壊れないよう、一時ファイルに書いてから置き換える
    if (FileUtils.safeWriteTextFile(this.filePath, JSON.stringify(this.data, null, 2))) {
      this.dirty = false;
    } else {
      itemLogger.warn('起動の記録を書けませんでした');
    }
  }

  private bump(table: Record<string, LaunchUsageRecord>, key: string, now: number): void {
    const current = table[key];
    table[key] = { lastLaunchedAt: now, count: (current?.count ?? 0) + 1 };
  }

  /** 設定「起動の記録を残す」が切ってあれば何もしない */
  private async isEnabled(): Promise<boolean> {
    try {
      const settings = await SettingsService.getInstance();
      return (await settings.get('recordLaunchUsage')) !== false;
    } catch {
      return true;
    }
  }

  /** メイン画面・セットから開いたアイテム（データファイルの id） */
  async recordById(id: string | undefined): Promise<void> {
    if (!id || !(await this.isEnabled())) return;
    this.bump(this.load().byId, id, Date.now());
    this.dirty = true;
    this.scheduleWrite();
  }

  /**
   * ワークスペースから開いたアイテム（id がデータファイルと違う）と、フォルダ取込で展開したアイテム
   * （呼び出し側が展開元のフォルダのパスを渡す）
   */
  async recordByPath(itemPath: string | undefined): Promise<void> {
    if (!itemPath || !(await this.isEnabled())) return;
    this.bump(this.load().byPath, launchUsagePathKey(itemPath), Date.now());
    this.dirty = true;
    this.scheduleWrite();
  }

  getSnapshot(): LaunchUsageSnapshot {
    const { since, byId, byPath } = this.load();
    return { since, byId, byPath };
  }
}
