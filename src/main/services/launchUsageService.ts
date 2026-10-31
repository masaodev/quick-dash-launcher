import * as fs from 'fs';
import * as path from 'path';

import { itemLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { isNewerFormatVersion } from '@common/utils/formatVersion';
import {
  launchUsagePathKey,
  type LaunchUsageRecord,
  type LaunchUsageSnapshot,
} from '@common/types/launchUsage';

import { SettingsService } from './settingsService.js';

/** item-usage.json の形式の版 */
const LAUNCH_USAGE_VERSION = 1;

interface LaunchUsageFile extends LaunchUsageSnapshot {
  version: typeof LAUNCH_USAGE_VERSION;
  /** 設定「起動の記録を残す」を切った日時（入れ直したとき、since をその日に進める） */
  pausedAt?: number;
}

function emptyFile(): LaunchUsageFile {
  return { version: LAUNCH_USAGE_VERSION, since: Date.now(), byId: {}, byPath: {} };
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
 * メイン画面・セットからの起動は id で、ワークスペースからの起動は id がメインと違うのでパス（引数は含めない）で記録する。
 * フォルダ取込で展開したアイテムは、フォルダ取込の行の id で記録する。
 * アイテム管理は id とパスの両方の記録を足して見せる
 */
export class LaunchUsageService {
  private static instance: LaunchUsageService | null = null;
  private data: LaunchUsageFile | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 書いていない記録があるか（読んだだけのときは書かない） */
  private dirty = false;
  /** 新しい版の QDL が書いたファイル。読んで使うが、上書きすると新しい版の形を壊すので書かない */
  private newerFormat = false;

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

  /**
   * 記録を読む。読めなかったときは null（一時的にロックされているなど。次に呼ばれたとき読み直す）
   */
  private load(): LaunchUsageFile | null {
    if (this.data) return this.data;
    let text: string;
    try {
      text = fs.readFileSync(this.filePath, 'utf8');
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        // 初めてなら記録を始め、始めた日時を残す（何も起動しないまま再起動しても日時が進まないように）
        this.data = emptyFile();
        this.dirty = true;
        this.scheduleWrite();
        return this.data;
      }
      // ウイルス対策・同期ソフトが一時的にロックしているなど。始め直すと記録を上書きで消すので、今回は読まない
      itemLogger.warn({ error }, '起動の記録を読めませんでした（次に読み直します）');
      return null;
    }
    try {
      const raw = JSON.parse(text) as Partial<LaunchUsageFile>;
      this.newerFormat = isNewerFormatVersion(raw.version, LAUNCH_USAGE_VERSION);
      if (this.newerFormat) {
        itemLogger.warn(
          '起動の記録は新しい版の QDL が書いたものなので、読むだけにします（記録を足しても書きません）'
        );
      }
      this.data = {
        version: LAUNCH_USAGE_VERSION,
        since: typeof raw.since === 'number' ? raw.since : Date.now(),
        byId: validRecords(raw.byId),
        byPath: validRecords(raw.byPath),
        ...(typeof raw.pausedAt === 'number' ? { pausedAt: raw.pausedAt } : {}),
      };
    } catch (error) {
      // 中身が壊れていたら、消さずに脇へ移してから始め直す。移せなければ上書きしないよう読まない
      const aside = `${this.filePath}.broken-${Date.now()}`;
      try {
        fs.renameSync(this.filePath, aside);
      } catch (renameError) {
        itemLogger.warn({ error, renameError }, '壊れた起動の記録を脇へ移せませんでした');
        return null;
      }
      itemLogger.warn({ error, aside }, '起動の記録が読めなかったので、脇へ移して始め直します');
      this.data = emptyFile();
      this.dirty = true;
      this.scheduleWrite();
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
    if (!this.data || !this.dirty || this.newerFormat) return;
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

  private async record(table: 'byId' | 'byPath', key: string): Promise<void> {
    if (!(await this.isEnabled())) return;
    const data = this.load();
    if (!data) return;
    this.bump(data[table], key, Date.now());
    this.dirty = true;
    this.scheduleWrite();
  }

  /** メイン画面・セットから開いたアイテム（データファイルの id。フォルダ取込はその行の id） */
  async recordById(id: string | undefined): Promise<void> {
    if (id) await this.record('byId', id);
  }

  /** ワークスペースから開いたアイテム（id がデータファイルと違う） */
  async recordByPath(itemPath: string | undefined): Promise<void> {
    if (itemPath) await this.record('byPath', launchUsagePathKey(itemPath));
  }

  /**
   * 設定「起動の記録を残す」を変えたとき。切っていた間の起動は記録に無いので、入れ直したら since をその日に進める
   *（進めないと、切っていた間に使ったアイテムが「90 日以上起動していない」に出る）
   */
  setRecording(enabled: boolean): void {
    const data = this.load();
    if (!data) return;
    if (!enabled && data.pausedAt === undefined) {
      data.pausedAt = Date.now();
    } else if (enabled && data.pausedAt !== undefined) {
      data.since = Date.now();
      delete data.pausedAt;
    } else {
      return;
    }
    this.dirty = true;
    this.scheduleWrite();
  }

  getSnapshot(): LaunchUsageSnapshot {
    const data = this.load();
    if (!data) return { since: Date.now(), byId: {}, byPath: {} };
    const { since, byId, byPath } = data;
    return { since, byId, byPath };
  }
}
