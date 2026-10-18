import * as path from 'path';

import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import type { ItemPathPickKind } from '@common/types';

import { expandEnvironmentVariables } from '../services/icon/iconFileCache.js';
import { mainI18n } from '../services/mainI18n.js';

import { getPathKind } from './folderPathProbe.js';

/**
 * ダイアログを開く場所。入っているパスがあればそこ（ファイルならフォルダを選ぶときはその親）、
 * 無ければ親のフォルダ。どちらも無い・URL などのときは指定しない（OS が前回の場所を開く）
 */
async function resolveDefaultPath(
  kind: ItemPathPickKind,
  currentPath: string | undefined
): Promise<string | undefined> {
  const trimmed = currentPath?.trim();
  if (!trimmed || !path.win32.isAbsolute(expandEnvironmentVariables(trimmed))) return undefined;
  const expanded = expandEnvironmentVariables(trimmed);

  const pathKind = await getPathKind(expanded);
  if (pathKind === 'folder') return expanded;
  if (pathKind === 'file') return kind === 'file' ? expanded : path.dirname(expanded);

  const parent = path.dirname(expanded);
  return parent !== expanded && (await getPathKind(parent)) === 'folder' ? parent : undefined;
}

/**
 * 登録・編集画面のパス欄の「選択」から、ファイルかフォルダを選ぶダイアログを開く。
 * 呼び出した画面を親にして、ダイアログの裏に画面が回らないようにする
 */
export async function selectItemPath(
  kind: ItemPathPickKind,
  currentPath: string | undefined,
  parent: BrowserWindow | null
): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: mainI18n.t(kind === 'folder' ? 'pathPicker.folderTitle' : 'pathPicker.fileTitle'),
    defaultPath: await resolveDefaultPath(kind, currentPath),
    properties: [kind === 'folder' ? 'openDirectory' : 'openFile'],
  };
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}
