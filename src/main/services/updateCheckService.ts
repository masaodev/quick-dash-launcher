import * as fs from 'fs';

import logger from '@common/logger';
import type { AppDistribution, UpdateCheckStatus } from '@common/types';
import { FileUtils } from '@common/utils/fileUtils';
import { isNewerFormatVersion } from '@common/utils/formatVersion';

import {
  compareAppVersions,
  isPrereleaseVersion,
  isReleasePageUrl,
  pickAvailableRelease,
  type AvailableRelease,
} from '../utils/releaseVersion.js';

const updateLogger = logger.child({ context: 'update' });

/** update-check.json の形式の版 */
const UPDATE_CHECK_VERSION = 1;

export const UPDATE_CHECK_REPOSITORY = 'masaodev/quick-dash-launcher';
// 新しい順に返る。ベータ版が続いても正式版を取りこぼさないよう、1 回で読める最大の 100 件を読む
const RELEASES_API_URL = `https://api.github.com/repos/${UPDATE_CHECK_REPOSITORY}/releases?per_page=100`;

/** 起動してから最初に確かめるまで */
const FIRST_CHECK_DELAY_MS = 60 * 1000;
/** 確かめる間隔 */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** 間隔が来たかを見る周期（スリープから戻ったときに取りこぼさないよう、24 時間のタイマーにはしない） */
const TICK_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;

interface UpdateCheckFile {
  version: typeof UPDATE_CHECK_VERSION;
  /** 最後に確かめた日時（Unix ミリ秒。失敗した回も数える） */
  lastCheckedAt?: number;
  /** 最後に確かめたときに見つけた、今の版より新しい版 */
  latest?: AvailableRelease | null;
  /** トーストで知らせ済みの版（同じ版は 2 回知らせない） */
  notifiedVersion?: string;
}

export interface UpdateCheckDeps {
  currentVersion: string;
  distribution: AppDistribution;
  filePath: string;
  /** 設定「新しい版を確かめる」「ベータ版も知らせる」 */
  getSettings: () => Promise<{ enabled: boolean; includeBeta: boolean }>;
  /** GitHub の releases API の返事（JSON） */
  fetchReleases: () => Promise<unknown>;
  /** 新しい版を初めて見つけたとき（トースト） */
  notify: (release: AvailableRelease) => void;
  /** 知らせる版が変わったとき（トレイのメニューを作り直す） */
  onChange: () => void;
  now?: () => number;
  /** 開発版でも動かす（手で試すとき。環境変数 QDL_UPDATE_CHECK_IN_DEV=1） */
  allowInDev?: boolean;
}

/**
 * 更新の知らせ。GitHub のリリース一覧を起動の 1 分後と 24 時間ごとに読み、
 * 今の版より新しい版があればトースト（1 回）・トレイ・ヘルプタブで知らせる。
 * 入れ替えはしない（リリースのページを開くだけ）。Store 版は Store が更新するので確かめない
 */
export class UpdateCheckService {
  private static instance: UpdateCheckService | null = null;

  private state: UpdateCheckFile = { version: UPDATE_CHECK_VERSION };
  /** ファイルが新しい版の QDL で書かれていれば上書きしない */
  private newerFormat = false;
  private checking: Promise<UpdateCheckStatus> | null = null;
  private lastError = false;
  /** 最後に確かめられなかった日時（失敗したら 24 時間を待たず、1 時間ごとの見回りで確かめ直す） */
  private lastFailedAt: number | null = null;
  /** 最後に確かめたときの「ベータ版も知らせる」（変わったら確かめ直す） */
  private checkedWithBeta: boolean | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly deps: UpdateCheckDeps) {
    this.load();
  }

  static getInstance(): UpdateCheckService | null {
    return UpdateCheckService.instance;
  }

  static setInstance(instance: UpdateCheckService | null): void {
    UpdateCheckService.instance?.stop();
    UpdateCheckService.instance = instance;
  }

  /** この配布形式で確かめるか */
  isSupported(): boolean {
    if (this.deps.distribution === 'store') return false;
    if (this.deps.distribution === 'dev') return this.deps.allowInDev === true;
    return true;
  }

  start(): void {
    if (!this.isSupported()) return;
    this.timers.push(setTimeout(() => void this.checkIfDue(), FIRST_CHECK_DELAY_MS));
    const tick = setInterval(() => void this.checkIfDue(), TICK_MS);
    tick.unref?.();
    this.timers.push(tick);
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  /** 知らせる版（設定を切っている・今の版が追いついたときは null） */
  async getAvailableRelease(): Promise<AvailableRelease | null> {
    if (!this.isSupported()) return null;
    const { enabled, includeBeta } = await this.deps.getSettings();
    if (!enabled) return null;
    const latest = this.state.latest;
    if (!latest || compareAppVersions(latest.version, this.deps.currentVersion) <= 0) return null;
    // 「ベータ版も知らせる」を切った・正式版に上げた後に、前に見つけたベータ版を出し続けない
    if (
      isPrereleaseVersion(latest.version) &&
      !includeBeta &&
      !isPrereleaseVersion(this.deps.currentVersion)
    ) {
      return null;
    }
    if (!isReleasePageUrl(latest.url, UPDATE_CHECK_REPOSITORY)) return null;
    return latest;
  }

  async getStatus(): Promise<UpdateCheckStatus> {
    const supported = this.isSupported();
    const enabled = supported && (await this.deps.getSettings()).enabled;
    return {
      supported,
      enabled,
      lastCheckedAt: this.state.lastCheckedAt ?? null,
      available: await this.getAvailableRelease(),
      failed: this.lastError,
    };
  }

  /** 設定が変わったとき。入れたら間隔が来ていれば確かめ、切ったらトレイから消す。ベータ版の設定を変えたら確かめ直す */
  async onSettingsChanged(): Promise<void> {
    this.deps.onChange();
    const { enabled, includeBeta } = await this.deps.getSettings();
    if (
      enabled &&
      this.isSupported() &&
      this.checkedWithBeta !== null &&
      this.checkedWithBeta !== includeBeta
    ) {
      await this.checkNow();
      return;
    }
    await this.checkIfDue();
  }

  /** 前回から 24 時間たっていれば確かめる */
  async checkIfDue(): Promise<void> {
    if (!this.isSupported()) return;
    if (!(await this.deps.getSettings()).enabled) return;
    const now = this.now();
    const last = this.state.lastCheckedAt;
    // 失敗した後は、1 時間たつまで確かめ直さない（設定を変えるたびに問い合わせないように）
    if (this.lastFailedAt !== null && now - this.lastFailedAt < TICK_MS && now >= this.lastFailedAt)
      return;
    // 時計が戻った（未来の日時が入っている）ときも確かめ直す
    if (last !== undefined && now - last < CHECK_INTERVAL_MS && now >= last) return;
    await this.checkNow();
  }

  /** すぐに確かめる（ヘルプタブの「今すぐ確かめる」）。確かめている途中なら、その結果を待つ */
  checkNow(): Promise<UpdateCheckStatus> {
    if (!this.checking) {
      this.checking = this.runCheck().finally(() => {
        this.checking = null;
      });
    }
    return this.checking;
  }

  private async runCheck(): Promise<UpdateCheckStatus> {
    if (!this.isSupported()) return this.getStatus();
    const { includeBeta } = await this.deps.getSettings();
    const before = this.state.latest?.version ?? null;
    try {
      const releases = await this.deps.fetchReleases();
      if (!Array.isArray(releases)) throw new Error('Unexpected releases response');
      this.state.latest = pickAvailableRelease(releases, this.deps.currentVersion, {
        includePrerelease: includeBeta,
        repository: UPDATE_CHECK_REPOSITORY,
      });
      this.lastError = false;
      this.lastFailedAt = null;
      this.checkedWithBeta = includeBeta;
      this.state.lastCheckedAt = this.now();
    } catch (error) {
      // ネットにつながらない・GitHub が応えないときは知らせず、1 時間ごとの見回りでまた確かめる。
      // 「最後に確かめた日時」は確かめられた日時のまま残す（進めると 24 時間確かめず、確かめられたようにも見える）
      updateLogger.info({ error }, '新しい版を確かめられませんでした');
      this.lastError = true;
      this.lastFailedAt = this.now();
    }

    const available = await this.getAvailableRelease();
    if (available && this.state.notifiedVersion !== available.version) {
      this.state.notifiedVersion = available.version;
      updateLogger.info({ version: available.version }, '新しい版があります');
      this.deps.notify(available);
    }
    this.save();
    if ((this.state.latest?.version ?? null) !== before) this.deps.onChange();
    return this.getStatus();
  }

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private load(): void {
    let raw: string;
    try {
      raw = fs.readFileSync(this.deps.filePath, 'utf-8');
    } catch {
      return;
    }
    try {
      const parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return;
      const file = parsed as Partial<UpdateCheckFile> & { version?: unknown };
      if (isNewerFormatVersion(file.version, UPDATE_CHECK_VERSION)) {
        this.newerFormat = true;
      }
      if (typeof file.lastCheckedAt === 'number' && Number.isFinite(file.lastCheckedAt)) {
        this.state.lastCheckedAt = file.lastCheckedAt;
      }
      const latest = file.latest;
      if (
        latest &&
        typeof latest === 'object' &&
        typeof latest.version === 'string' &&
        typeof latest.url === 'string'
      ) {
        this.state.latest = { version: latest.version, url: latest.url };
      }
      if (typeof file.notifiedVersion === 'string') {
        this.state.notifiedVersion = file.notifiedVersion;
      }
    } catch {
      // 壊れていれば初めからやり直す（中身は数値と版だけで、失っても困らない）
    }
  }

  private save(): void {
    if (this.newerFormat) return;
    FileUtils.safeWriteTextFile(this.deps.filePath, JSON.stringify(this.state, null, 2));
  }
}

/** GitHub の releases API を読む（electron の net.fetch。ログインは要らない） */
export async function fetchGitHubReleases(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
  userAgent: string
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(RELEASES_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': userAgent,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
