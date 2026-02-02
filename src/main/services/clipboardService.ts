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
} from '@common/types/clipboard';
import {
  MAX_IMAGE_SIZE_BYTES,
  PREVIEW_MAX_LENGTH,
  THUMBNAIL_MAX_WIDTH,
  THUMBNAIL_MAX_HEIGHT,
} from '@common/types/clipboard';

import PathManager from '../config/pathManager.js';

const DATA_FILE_REF_PATTERN = /clipboard-data\/(.+)\.json$/;

export class ClipboardService {
  private static instance: ClipboardService | null = null;

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

  async captureClipboard(): Promise<ClipboardCaptureResult> {
    try {
      const state = await this.checkCurrentClipboard();

      if (!state.hasContent) {
        return { success: false, error: 'クリップボードが空です' };
      }

      const clipboardData: SerializableClipboard = {
        formats: state.formats,
        savedAt: Date.now(),
        dataSize: 0,
      };

      if (state.formats.includes('text')) {
        clipboardData.text = clipboard.readText();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.text || '', 'utf8');
      }

      if (state.formats.includes('html')) {
        clipboardData.html = clipboard.readHTML();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.html || '', 'utf8');
      }

      if (state.formats.includes('rtf')) {
        clipboardData.rtf = clipboard.readRTF();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.rtf || '', 'utf8');
      }

      if (state.formats.includes('image')) {
        const image = clipboard.readImage();
        const pngBuffer = image.toPNG();

        if (pngBuffer.length > MAX_IMAGE_SIZE_BYTES) {
          const maxMB = Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024);
          return { success: false, error: `画像サイズが上限（${maxMB}MB）を超えています` };
        }

        clipboardData.imageBase64 = pngBuffer.toString('base64');
        clipboardData.dataSize += pngBuffer.length;
      }

      if (state.formats.includes('file')) {
        const filePaths = this.readFilePaths();
        if (filePaths.length > 0) {
          clipboardData.filePaths = filePaths;
          clipboardData.dataSize += this.calculatePathsSize(filePaths);

          if (!clipboardData.text) {
            clipboardData.text = filePaths.join('\n');
            if (!clipboardData.formats.includes('text')) {
              clipboardData.formats.push('text');
            }
          }
        }
      }

      const id = generateId();
      const dataFileRef = `clipboard-data/${id}.json`;
      const filePath = PathManager.getClipboardDataFilePath(id);

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(clipboardData, null, 2), 'utf8');

      logger.info(
        { id, formats: state.formats, dataSize: clipboardData.dataSize },
        'クリップボードデータを保存しました'
      );

      return {
        success: true,
        dataFileRef,
        preview: state.preview,
        formats: state.formats,
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

      if (data.text) {
        writeData.text = data.text;
        restoredFormats.push('text');
      }

      if (data.html) {
        writeData.html = data.html;
        restoredFormats.push('html');
      }

      if (data.rtf) {
        writeData.rtf = data.rtf;
        restoredFormats.push('rtf');
      }

      if (data.imageBase64) {
        const imageBuffer = Buffer.from(data.imageBase64, 'base64');
        writeData.image = nativeImage.createFromBuffer(imageBuffer);
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
    if (!imageBase64) {
      return undefined;
    }
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const image = nativeImage.createFromBuffer(imageBuffer);
    const thumbnail = this.createThumbnail(image);
    return thumbnail ? this.toDataUrl(thumbnail) : undefined;
  }

  private createThumbnail(image: NativeImage): NativeImage | null {
    if (image.isEmpty()) {
      return null;
    }

    const size = image.getSize();
    const aspectRatio = size.width / size.height;

    let newWidth = THUMBNAIL_MAX_WIDTH;
    let newHeight = Math.round(THUMBNAIL_MAX_WIDTH / aspectRatio);

    if (newHeight > THUMBNAIL_MAX_HEIGHT) {
      newHeight = THUMBNAIL_MAX_HEIGHT;
      newWidth = Math.round(THUMBNAIL_MAX_HEIGHT * aspectRatio);
    }

    return image.resize({ width: newWidth, height: newHeight });
  }
}

export default ClipboardService;
