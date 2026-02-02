/**
 * クリップボードサービス
 *
 * クリップボードの内容をキャプチャ・保存・復元する機能を提供
 */

import * as fs from 'fs';
import * as path from 'path';

import { clipboard, nativeImage, NativeImage } from 'electron';
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

/**
 * クリップボードサービスクラス
 */
export class ClipboardService {
  private static instance: ClipboardService | null = null;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  /**
   * 現在のクリップボードの状態を確認
   */
  async checkCurrentClipboard(): Promise<CurrentClipboardState> {
    const formats: ClipboardFormat[] = [];
    let preview: string | undefined;
    let imageThumbnail: string | undefined;
    let estimatedSize = 0;

    // テキストをチェック
    const text = clipboard.readText();
    if (text) {
      formats.push('text');
      preview = text.substring(0, PREVIEW_MAX_LENGTH);
      if (text.length > PREVIEW_MAX_LENGTH) {
        preview += '...';
      }
      estimatedSize += Buffer.byteLength(text, 'utf8');
    }

    // HTMLをチェック
    const html = clipboard.readHTML();
    if (html && html.trim()) {
      formats.push('html');
      estimatedSize += Buffer.byteLength(html, 'utf8');
    }

    // RTFをチェック
    const rtf = clipboard.readRTF();
    if (rtf && rtf.trim()) {
      formats.push('rtf');
      estimatedSize += Buffer.byteLength(rtf, 'utf8');
    }

    // 画像をチェック
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      formats.push('image');
      const pngBuffer = image.toPNG();
      estimatedSize += pngBuffer.length;

      // サムネイルを生成
      const thumbnail = this.createThumbnail(image);
      if (thumbnail) {
        imageThumbnail = `data:image/png;base64,${thumbnail.toPNG().toString('base64')}`;
      }

      // テキストがなければプレビューを画像情報にする
      if (!preview) {
        const size = image.getSize();
        preview = `画像 (${size.width}x${size.height})`;
      }
    }

    // ファイルをチェック（Windows/macOS）
    // Note: ファイルの復元は非対応だが、参照用として記録
    // Electronのclipboard.read('text/uri-list')などでファイルパスを取得可能

    return {
      hasContent: formats.length > 0,
      formats,
      preview,
      imageThumbnail,
      estimatedSize,
    };
  }

  /**
   * 現在のクリップボードをキャプチャして保存
   */
  async captureClipboard(): Promise<ClipboardCaptureResult> {
    try {
      const state = await this.checkCurrentClipboard();

      if (!state.hasContent) {
        return {
          success: false,
          error: 'クリップボードが空です',
        };
      }

      const clipboardData: SerializableClipboard = {
        formats: state.formats,
        savedAt: Date.now(),
        dataSize: 0,
      };

      // テキストを保存
      if (state.formats.includes('text')) {
        clipboardData.text = clipboard.readText();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.text || '', 'utf8');
      }

      // HTMLを保存
      if (state.formats.includes('html')) {
        clipboardData.html = clipboard.readHTML();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.html || '', 'utf8');
      }

      // RTFを保存
      if (state.formats.includes('rtf')) {
        clipboardData.rtf = clipboard.readRTF();
        clipboardData.dataSize += Buffer.byteLength(clipboardData.rtf || '', 'utf8');
      }

      // 画像を保存
      if (state.formats.includes('image')) {
        const image = clipboard.readImage();
        const pngBuffer = image.toPNG();

        if (pngBuffer.length > MAX_IMAGE_SIZE_BYTES) {
          return {
            success: false,
            error: `画像サイズが上限（${Math.round(MAX_IMAGE_SIZE_BYTES / 1024 / 1024)}MB）を超えています`,
          };
        }

        clipboardData.imageBase64 = pngBuffer.toString('base64');
        clipboardData.dataSize += pngBuffer.length;
      }

      // IDを生成してファイルに保存
      const id = generateId();
      const dataFileRef = `clipboard-data/${id}.json`;
      const filePath = PathManager.getClipboardDataFilePath(id);

      // ディレクトリが存在することを確認
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

  /**
   * 保存したクリップボードを復元
   */
  async restoreClipboard(dataFileRef: string): Promise<ClipboardRestoreResult> {
    try {
      // dataFileRefからIDを抽出
      const match = dataFileRef.match(/clipboard-data\/(.+)\.json$/);
      if (!match) {
        return {
          success: false,
          error: '無効なデータファイル参照です',
        };
      }

      const id = match[1];
      const filePath = PathManager.getClipboardDataFilePath(id);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'クリップボードデータが見つかりません',
        };
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const data: SerializableClipboard = JSON.parse(content);

      const restoredFormats: ClipboardFormat[] = [];

      // 複数フォーマットを一度に書き込むためのオプションを構築
      // ElectronのclipboardはwriteBookmarkのような複合書き込みもサポート
      // ただし、同時に複数フォーマットを設定するにはclipboard.write()を使う

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
        const image = nativeImage.createFromBuffer(imageBuffer);
        writeData.image = image;
        restoredFormats.push('image');
      }

      // クリップボードに書き込み
      clipboard.write(writeData);

      logger.info({ id, restoredFormats }, 'クリップボードを復元しました');

      return {
        success: true,
        restoredFormats,
      };
    } catch (error) {
      logger.error({ error, dataFileRef }, 'クリップボードの復元に失敗しました');
      return {
        success: false,
        error: error instanceof Error ? error.message : '復元に失敗しました',
      };
    }
  }

  /**
   * クリップボードデータファイルを削除
   */
  async deleteClipboardData(dataFileRef: string): Promise<boolean> {
    try {
      const match = dataFileRef.match(/clipboard-data\/(.+)\.json$/);
      if (!match) {
        logger.warn({ dataFileRef }, '無効なデータファイル参照です');
        return false;
      }

      const id = match[1];
      const filePath = PathManager.getClipboardDataFilePath(id);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info({ id }, 'クリップボードデータを削除しました');
        return true;
      }

      return false;
    } catch (error) {
      logger.error({ error, dataFileRef }, 'クリップボードデータの削除に失敗しました');
      return false;
    }
  }

  /**
   * クリップボードデータのプレビュー情報を取得
   */
  async getClipboardPreview(dataFileRef: string): Promise<ClipboardPreview | null> {
    try {
      const match = dataFileRef.match(/clipboard-data\/(.+)\.json$/);
      if (!match) {
        return null;
      }

      const id = match[1];
      const filePath = PathManager.getClipboardDataFilePath(id);

      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const data: SerializableClipboard = JSON.parse(content);

      let preview = '';
      if (data.text) {
        preview = data.text.substring(0, PREVIEW_MAX_LENGTH);
        if (data.text.length > PREVIEW_MAX_LENGTH) {
          preview += '...';
        }
      } else if (data.imageBase64) {
        preview = '画像データ';
      } else if (data.html) {
        // HTMLからテキストを抽出（簡易）
        const textContent = data.html.replace(/<[^>]*>/g, '').trim();
        preview = textContent.substring(0, PREVIEW_MAX_LENGTH);
        if (textContent.length > PREVIEW_MAX_LENGTH) {
          preview += '...';
        }
      }

      let imageThumbnail: string | undefined;
      if (data.imageBase64) {
        const imageBuffer = Buffer.from(data.imageBase64, 'base64');
        const image = nativeImage.createFromBuffer(imageBuffer);
        const thumbnail = this.createThumbnail(image);
        if (thumbnail) {
          imageThumbnail = `data:image/png;base64,${thumbnail.toPNG().toString('base64')}`;
        }
      }

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

  /**
   * サムネイル画像を作成
   */
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
