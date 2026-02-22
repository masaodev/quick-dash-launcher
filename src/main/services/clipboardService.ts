/**
 * クリップボードサービス
 *
 * クリップボードの内容をキャプチャ・保存・復元する機能を提供
 */

import * as fs from 'fs';
import * as path from 'path';

import { clipboard, nativeImage, NativeImage } from 'electron';
import clipboardFiles from 'clipboard-files';
import logger from '@common/logger';
import { generateId } from '@common/utils/jsonParser';
import type {
  SerializableClipboard,
  ClipboardFormat,
  ClipboardCaptureResult,
  ClipboardRestoreResult,
  ClipboardPreview,
  CurrentClipboardState,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
} from '@common/types/clipboard';
import {
  MAX_IMAGE_SIZE_BYTES,
  PREVIEW_MAX_LENGTH,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_MAX_HEIGHT,
} from '@common/types/clipboard';

import PathManager from '../config/pathManager.js';

const DATA_FILE_REF_PATTERN = /clipboard-data\/(.+)\.json$/;

interface SessionData {
  clipboardData: SerializableClipboard;
  preview?: string;
  capturedAt: number;
}

interface CollectedClipboardData {
  clipboardData: SerializableClipboard;
  preview?: string;
}

type CollectResult =
  | { success: true; data: CollectedClipboardData }
  | { success: false; error: string };

export class ClipboardService {
  private static instance: ClipboardService | null = null;
  private pendingSessions: Map<string, SessionData> = new Map();

  private constructor() {}

  static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  async checkCurrentClipboard(): Promise<CurrentClipboardState> {
    const formats: ClipboardFormat[] = [];
    let preview: string | undefined;
    let imageThumbnail: string | undefined;
    let estimatedSize = 0;

    const text = clipboard.readText();
    if (text) {
      formats.push('text');
      preview = this.truncatePreview(text);
      estimatedSize += Buffer.byteLength(text, 'utf8');
    }

    const html = clipboard.readHTML();
    if (html?.trim()) {
      formats.push('html');
      estimatedSize += Buffer.byteLength(html, 'utf8');
    }

    const rtf = clipboard.readRTF();
    if (rtf?.trim()) {
      formats.push('rtf');
      estimatedSize += Buffer.byteLength(rtf, 'utf8');
    }

    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      formats.push('image');
      const pngBuffer = image.toPNG();
      estimatedSize += pngBuffer.length;

      const thumbnail = this.createThumbnail(image);
      if (thumbnail) {
        imageThumbnail = this.toDataUrl(thumbnail);
      }

      if (!preview) {
        const size = image.getSize();
        preview = `画像 (${size.width}x${size.height})`;
      }
    }

    const filePaths = this.readFilePaths();
    if (filePaths.length > 0) {
      formats.push('file');
      if (!preview) {
        const filePreview =
          filePaths.length === 1
            ? filePaths[0]
            : `${filePaths.length}個のファイル: ${filePaths[0]}...`;
        preview = this.truncatePreview(filePreview);
      }
      estimatedSize += this.calculatePathsSize(filePaths);
    }

    return {
      hasContent: formats.length > 0,
      formats,
      preview,
      imageThumbnail,
      estimatedSize,
    };
  }

  private readFilePaths(): string[] {
    try {
      const files = clipboardFiles.readFiles();
      if (files?.length > 0) {
        logger.debug({ files }, 'クリップボードからファイルパスを取得');
        return files;
      }
    } catch (error) {
      logger.debug({ error }, 'ファイルパスの読み取りに失敗');
    }
    return [];
  }

  private async collectClipboardData(): Promise<CollectResult> {
    const formats: ClipboardFormat[] = [];
    const clipboardData: SerializableClipboard = {
      formats,
      savedAt: Date.now(),
      dataSize: 0,
    };
    let preview: string | undefined;

    const text = clipboard.readText();
    if (text) {
      formats.push('text');
      clipboardData.text = text;
      clipboardData.dataSize += Buffer.byteLength(text, 'utf8');
      preview = this.truncatePreview(text);
    }

    const html = clipboard.readHTML();
    if (html?.trim()) {
      formats.push('html');
      clipboardData.html = html;
      clipboardData.dataSize += Buffer.byteLength(html, 'utf8');
    }

    const rtf = clipboard.readRTF();
    if (rtf?.trim()) {
      formats.push('rtf');
      clipboardData.rtf = rtf;
      clipboardData.dataSize += Buffer.byteLength(rtf, 'utf8');
    }

    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      const pngBuffer = image.toPNG();

      if (pngBuffer.length > MAX_IMAGE_SIZE_BYTES) {
        const maxMB = Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024);
        return { success: false, error: `画像サイズが上限（${maxMB}MB）を超えています` };
      }

      formats.push('image');
      clipboardData.imageBase64 = pngBuffer.toString('base64');
      clipboardData.dataSize += pngBuffer.length;

      if (!preview) {
        const size = image.getSize();
        preview = `画像 (${size.width}x${size.height})`;
      }
    }

    const filePaths = this.readFilePaths();
    if (filePaths.length > 0) {
      formats.push('file');
      clipboardData.filePaths = filePaths;
      clipboardData.dataSize += this.calculatePathsSize(filePaths);

      if (!clipboardData.text) {
        clipboardData.text = filePaths.join('\n');
        formats.push('text');
      }

      if (!preview) {
        const filePreview =
          filePaths.length === 1
            ? filePaths[0]
            : `${filePaths.length}個のファイル: ${filePaths[0]}...`;
        preview = this.truncatePreview(filePreview);
      }
    }

    if (formats.length === 0) {
      return { success: false, error: 'クリップボードが空です' };
    }

    return {
      success: true,
      data: { clipboardData, preview },
    };
  }

  /**
   * クリップボードデータをファイルに保存する共通処理
   */
  private saveClipboardDataToFile(clipboardData: SerializableClipboard): string {
    const id = generateId();
    const dataFileRef = `clipboard-data/${id}.json`;
    const filePath = PathManager.getClipboardDataFilePath(id);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(clipboardData, null, 2), 'utf8');
    return dataFileRef;
  }

  async captureClipboard(): Promise<ClipboardCaptureResult> {
    try {
      const result = await this.collectClipboardData();
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const { clipboardData, preview } = result.data;
      const dataFileRef = this.saveClipboardDataToFile(clipboardData);

      logger.info(
        { dataFileRef, formats: clipboardData.formats, dataSize: clipboardData.dataSize },
        'クリップボードデータを保存しました'
      );

      return {
        success: true,
        dataFileRef,
        preview,
        formats: clipboardData.formats,
        dataSize: clipboardData.dataSize,
        savedAt: clipboardData.savedAt,
      };
    } catch (error) {
      logger.error({ error }, 'クリップボードのキャプチャに失敗しました');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'キャプチャに失敗しました',
      };
    }
  }

  async captureToSession(): Promise<ClipboardSessionCaptureResult> {
    try {
      const result = await this.collectClipboardData();
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const { clipboardData, preview } = result.data;
      const sessionId = generateId();
      const capturedAt = Date.now();

      this.pendingSessions.set(sessionId, { clipboardData, preview, capturedAt });

      logger.info(
        { sessionId, formats: clipboardData.formats, dataSize: clipboardData.dataSize },
        'クリップボードデータをセッションにキャプチャしました'
      );

      return {
        success: true,
        sessionId,
        preview,
        formats: clipboardData.formats,
        dataSize: clipboardData.dataSize,
        capturedAt,
      };
    } catch (error) {
      logger.error({ error }, 'セッションキャプチャに失敗しました');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'キャプチャに失敗しました',
      };
    }
  }

  async commitSession(sessionId: string): Promise<ClipboardSessionCommitResult> {
    try {
      const session = this.pendingSessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'セッションが見つかりません' };
      }

      const dataFileRef = this.saveClipboardDataToFile(session.clipboardData);
      this.pendingSessions.delete(sessionId);

      logger.info({ sessionId, dataFileRef }, 'セッションデータをファイルに永続化しました');

      return {
        success: true,
        dataFileRef,
        savedAt: session.clipboardData.savedAt,
      };
    } catch (error) {
      logger.error({ error, sessionId }, 'セッションのコミットに失敗しました');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'コミットに失敗しました',
      };
    }
  }

  discardSession(sessionId: string): boolean {
    const deleted = this.pendingSessions.delete(sessionId);
    if (deleted) {
      logger.info({ sessionId }, 'セッションデータを破棄しました');
    }
    return deleted;
  }

  async restoreClipboard(dataFileRef: string): Promise<ClipboardRestoreResult> {
    try {
      const id = this.extractIdFromRef(dataFileRef);
      if (!id) {
        return { success: false, error: '無効なデータファイル参照です' };
      }

      const filePath = PathManager.getClipboardDataFilePath(id);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'クリップボードデータが見つかりません' };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const data: SerializableClipboard = JSON.parse(content);

      const restoredFormats: ClipboardFormat[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writeData: any = {};

      const textFormats = ['text', 'html', 'rtf'] as const;
      for (const format of textFormats) {
        if (data[format]) {
          writeData[format] = data[format];
          restoredFormats.push(format);
        }
      }

      if (data.imageBase64) {
        writeData.image = nativeImage.createFromBuffer(Buffer.from(data.imageBase64, 'base64'));
        restoredFormats.push('image');
      }

      if (data.filePaths?.length) {
        const existingFiles = data.filePaths.filter((fp) => fs.existsSync(fp));
        if (existingFiles.length > 0) {
          clipboardFiles.writeFiles(existingFiles);
          restoredFormats.push('file');
          logger.info(
            { id, restoredFormats, fileCount: existingFiles.length },
            'クリップボードを復元しました（ファイル）'
          );
          return { success: true, restoredFormats };
        }
      }

      clipboard.write(writeData);
      logger.info({ id, restoredFormats }, 'クリップボードを復元しました');

      return { success: true, restoredFormats };
    } catch (error) {
      logger.error({ error, dataFileRef }, 'クリップボードの復元に失敗しました');
      return {
        success: false,
        error: error instanceof Error ? error.message : '復元に失敗しました',
      };
    }
  }

  async deleteClipboardData(dataFileRef: string): Promise<boolean> {
    try {
      const id = this.extractIdFromRef(dataFileRef);
      if (!id) {
        logger.warn({ dataFileRef }, '無効なデータファイル参照です');
        return false;
      }

      const filePath = PathManager.getClipboardDataFilePath(id);
      if (!fs.existsSync(filePath)) {
        return false;
      }

      fs.unlinkSync(filePath);
      logger.info({ id }, 'クリップボードデータを削除しました');
      return true;
    } catch (error) {
      logger.error({ error, dataFileRef }, 'クリップボードデータの削除に失敗しました');
      return false;
    }
  }

  async getClipboardPreview(dataFileRef: string): Promise<ClipboardPreview | null> {
    try {
      const id = this.extractIdFromRef(dataFileRef);
      if (!id) {
        return null;
      }

      const filePath = PathManager.getClipboardDataFilePath(id);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const data: SerializableClipboard = JSON.parse(content);

      const preview = this.generatePreviewText(data);
      const imageThumbnail = this.generateImageThumbnail(data.imageBase64);

      return {
        preview,
        formats: data.formats,
        dataSize: data.dataSize,
        savedAt: data.savedAt,
        imageThumbnail,
      };
    } catch (error) {
      logger.error({ error, dataFileRef }, 'プレビュー情報の取得に失敗しました');
      return null;
    }
  }

  private extractIdFromRef(dataFileRef: string): string | null {
    const match = dataFileRef.match(DATA_FILE_REF_PATTERN);
    return match ? match[1] : null;
  }

  private truncatePreview(text: string): string {
    if (text.length <= PREVIEW_MAX_LENGTH) {
      return text;
    }
    return text.substring(0, PREVIEW_MAX_LENGTH) + '...';
  }

  private calculatePathsSize(paths: string[]): number {
    return paths.reduce((sum, p) => sum + Buffer.byteLength(p, 'utf8'), 0);
  }

  private toDataUrl(image: NativeImage): string {
    return `data:image/png;base64,${image.toPNG().toString('base64')}`;
  }

  private generatePreviewText(data: SerializableClipboard): string {
    if (data.text) {
      return this.truncatePreview(data.text);
    }
    if (data.imageBase64) {
      return '画像データ';
    }
    if (data.html) {
      const textContent = data.html.replace(/<[^>]*>/g, '').trim();
      return this.truncatePreview(textContent);
    }
    return '';
  }

  private generateImageThumbnail(imageBase64: string | undefined): string | undefined {
    if (!imageBase64) return undefined;

    const image = nativeImage.createFromBuffer(Buffer.from(imageBase64, 'base64'));
    const thumbnail = this.createThumbnail(image);
    return thumbnail ? this.toDataUrl(thumbnail) : undefined;
  }

  private createThumbnail(image: NativeImage): NativeImage | null {
    if (image.isEmpty()) return null;

    const { width, height } = image.getSize();
    const aspectRatio = width / height;

    const scaledByWidth = {
      width: THUMBNAIL_MAX_WIDTH,
      height: Math.round(THUMBNAIL_MAX_WIDTH / aspectRatio),
    };

    if (scaledByWidth.height <= THUMBNAIL_MAX_HEIGHT) {
      return image.resize(scaledByWidth);
    }

    return image.resize({
      width: Math.round(THUMBNAIL_MAX_HEIGHT * aspectRatio),
      height: THUMBNAIL_MAX_HEIGHT,
    });
  }
}

export default ClipboardService;
