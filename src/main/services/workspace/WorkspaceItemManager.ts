import * as fs from 'fs';
import * as path from 'path';

import type { AppItem, WorkspaceItem, WorkspaceItemUpdate, WorkspaceRefItem } from '@common/types';
import logger from '@common/logger';
import { appItemToWorkspaceItemBody } from '@common/utils/workspaceConverters';
import { normalizeWorkspaceItemBody } from '@common/utils/workspaceParser';

import type { WorkspaceFileStore } from './WorkspaceFileStore.js';
import { refJsonToRuntimeItem, resolveLauncherType } from './WorkspaceFileStore.js';

/**
 * ワークスペースアイテムの管理
 *
 * アイテムの本体（type 固有のフィールド）は appItemToWorkspaceItemBody / WorkspaceItemUpdate で受け取り、
 * ここでは id・並び順・所属（workspaceId / groupId）を付けてストアに書く。
 */
export class WorkspaceItemManager {
  constructor(private readonly store: WorkspaceFileStore) {}

  private getNextOrder(items: WorkspaceItem[]): number {
    return items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;
  }

  public loadItems(): WorkspaceItem[] {
    return this.store.get('items').sort((a, b) => a.order - b.order);
  }

  /**
   * 本体にメタ情報を付けて実行時アイテムにする
   */
  private materialize(
    body: WorkspaceItemUpdate,
    meta: { order: number; groupId?: string; workspaceId?: string }
  ): WorkspaceItem {
    const id = this.store.newId();
    const item = {
      id,
      ...normalizeWorkspaceItemBody(body, id),
      workspaceId: meta.workspaceId || this.store.resolveDefaultWorkspaceId(),
      ...(meta.groupId !== undefined && { groupId: meta.groupId }),
      order: meta.order,
      addedAt: Date.now(),
    } as WorkspaceItem;
    if (item.type === 'item') {
      item.launcherType = resolveLauncherType(item);
    }
    return item;
  }

  public addItem(item: AppItem, groupId?: string, workspaceId?: string): WorkspaceItem {
    return this.createItem(appItemToWorkspaceItemBody(item), groupId, workspaceId);
  }

  /** 中身（編集フォームで入力したものなど）から新しいアイテムを作って末尾に足す */
  public createItem(
    body: WorkspaceItemUpdate,
    groupId?: string,
    workspaceId?: string
  ): WorkspaceItem {
    try {
      const items = this.loadItems();
      const workspaceItem = this.materialize(body, {
        order: this.getNextOrder(items),
        groupId,
        workspaceId,
      });

      items.push(workspaceItem);
      this.store.set('items', items);

      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName, groupId },
        'Added item to workspace'
      );
      return workspaceItem;
    } catch (error) {
      logger.error({ error }, 'Failed to add workspace item');
      throw error;
    }
  }

  /**
   * メインウィンドウのアイテムを指す参照アイテムを末尾に足す
   *
   * @param refItemId 指すアイテムの id（データファイルの名前空間）
   * @param lastKnownName いまの表示名（元が見つからなくなったときの表示に使う）
   */
  public addRef(
    refItemId: string,
    lastKnownName: string,
    groupId?: string,
    workspaceId?: string
  ): WorkspaceItem {
    const items = this.loadItems();
    const item = this.materializeRef(refItemId, lastKnownName, {
      id: this.store.newId(),
      order: this.getNextOrder(items),
      groupId,
      workspaceId: workspaceId || this.store.resolveDefaultWorkspaceId(),
      addedAt: Date.now(),
    });
    items.push(item);
    this.store.set('items', items);
    logger.info({ id: item.id, refItemId, groupId }, 'Added reference item to workspace');
    return item;
  }

  /** 参照アイテムを作る（normalizeWorkspaceItemBody で検証してから実行時の形にする） */
  private materializeRef(
    refItemId: string,
    lastKnownName: string,
    meta: { id: string; order: number; groupId?: string; workspaceId: string; addedAt: number },
    alias?: string
  ): WorkspaceRefItem {
    const body = normalizeWorkspaceItemBody(
      {
        type: 'ref' as const,
        refItemId,
        ...(alias !== undefined && { displayName: alias }),
        ...(lastKnownName !== '' && { lastKnownName }),
      },
      meta.id
    );
    return refJsonToRuntimeItem({
      id: meta.id,
      ...body,
      workspaceId: meta.workspaceId,
      ...(meta.groupId !== undefined && { groupId: meta.groupId }),
      order: meta.order,
      addedAt: meta.addedAt,
    });
  }

  /**
   * アイテムを参照アイテムに置き換える（id・並び順・所属・追加日時は保つ。コピー → 参照、指し直し）
   *
   * @param alias ワークスペースでの表示名（省略するとメインウィンドウの表示名を使う）
   */
  public replaceWithRef(
    id: string,
    refItemId: string,
    lastKnownName: string,
    alias?: string
  ): WorkspaceItem {
    const items = this.loadItems();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error(`Item not found: ${id}`);
    const existing = items[index];
    const replaced = this.materializeRef(
      refItemId,
      lastKnownName,
      {
        id: existing.id,
        order: existing.order,
        groupId: existing.groupId,
        workspaceId: existing.workspaceId,
        addedAt: existing.addedAt,
      },
      alias
    );
    items[index] = replaced;
    this.store.set('items', items);
    logger.info({ id, refItemId }, 'Replaced workspace item with reference');
    return replaced;
  }

  /**
   * 参照アイテムを中身を持つアイテム（コピー）に置き換える（id・並び順・所属・追加日時は保つ）
   */
  public replaceWithContent(id: string, body: WorkspaceItemUpdate): WorkspaceItem {
    const items = this.loadItems();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) throw new Error(`Item not found: ${id}`);
    const existing = items[index];
    const replaced = {
      id: existing.id,
      ...normalizeWorkspaceItemBody(body, existing.id),
      workspaceId: existing.workspaceId,
      ...(existing.groupId !== undefined && { groupId: existing.groupId }),
      order: existing.order,
      addedAt: existing.addedAt,
    } as WorkspaceItem;
    if (replaced.type === 'item') {
      replaced.launcherType = resolveLauncherType(replaced);
    }
    items[index] = replaced;
    this.store.set('items', items);
    logger.info({ id, type: body.type }, 'Replaced reference item with copy');
    return replaced;
  }

  /**
   * 参照アイテムを書き換える（ワークスペースでの表示名・最後に見た表示名・指す先）。変わったものがあれば true
   *
   * 表示名は空なら消す（メインウィンドウの表示名に戻る）
   */
  public updateRefs(
    mutate: (item: WorkspaceRefItem) => boolean,
    target: 'main' | 'archive' = 'main'
  ): boolean {
    let changed = false;
    const apply = (list: WorkspaceItem[]): void => {
      for (const item of list) {
        if (item.type === 'ref' && mutate(item)) changed = true;
      }
    };
    if (target === 'main') {
      const items = this.loadItems();
      apply(items);
      if (changed) this.store.set('items', items);
    } else {
      const items = this.store.archiveStore.get('items');
      apply(items);
      if (changed) this.store.archiveStore.set('items', items);
    }
    return changed;
  }

  public addItemFromPath(filePath: string, groupId?: string, workspaceId?: string): WorkspaceItem {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File or folder does not exist: ${filePath}`);
      }

      const items = this.loadItems();
      const workspaceItem = this.materialize(
        { type: 'item', displayName: path.basename(filePath), path: filePath },
        { order: this.getNextOrder(items), groupId, workspaceId }
      );

      items.push(workspaceItem);
      this.store.set('items', items);

      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName, path: filePath, groupId },
        'Added item from path to workspace'
      );
      return workspaceItem;
    } catch (error) {
      logger.error({ error, path: filePath }, 'Failed to add workspace item from path');
      throw error;
    }
  }

  public removeItem(id: string): void {
    try {
      const items = this.loadItems();
      const filteredItems = items.filter((item) => item.id !== id);

      if (items.length === filteredItems.length) {
        logger.warn({ id }, 'Item not found in workspace');
        return;
      }

      this.store.set('items', filteredItems);
      logger.info({ id }, 'Removed item from workspace');
    } catch (error) {
      logger.error({ error, id }, 'Failed to remove workspace item');
      throw error;
    }
  }

  public updateDisplayName(id: string, displayName: string): void {
    try {
      const items = this.loadItems();
      const item = items.find((i) => i.id === id);

      if (!item) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      if (item.type === 'ref') {
        // 参照はワークスペースでの表示名を変える。空ならメインウィンドウの表示名に戻す
        const alias = displayName.trim();
        if (alias === '') delete item.ref.alias;
        else item.ref.alias = displayName;
        item.displayName = item.ref.alias ?? item.ref.lastKnownName ?? '';
      } else {
        item.displayName = displayName;
      }
      this.store.set('items', items);
      logger.info({ id, displayName }, 'Updated workspace item display name');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item display name');
      throw error;
    }
  }

  /**
   * アイテムの本体を置き換える（id・並び順・所属は保つ）
   */
  public updateItem(id: string, update: WorkspaceItemUpdate): void {
    try {
      const items = this.loadItems();
      const itemIndex = items.findIndex((i) => i.id === id);

      if (itemIndex === -1) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      const existing = items[itemIndex];
      if (existing.type === 'ref') {
        // 参照の中身はメインウィンドウのアイテムのもの。ここでは直さない（メインウィンドウの編集画面で直す）
        throw new Error(`Reference item cannot be edited in the workspace: ${id}`);
      }
      // path が変わらない編集ではショートカットのリンク先（originalPath）を保つ
      const carried =
        existing.type === 'item' &&
        update.type === 'item' &&
        existing.path === update.path &&
        update.originalPath === undefined &&
        existing.originalPath !== undefined
          ? { ...update, originalPath: existing.originalPath }
          : update;
      const replaced = {
        id: existing.id,
        ...normalizeWorkspaceItemBody(carried, existing.id),
        workspaceId: existing.workspaceId,
        ...(existing.groupId !== undefined && { groupId: existing.groupId }),
        order: existing.order,
        addedAt: existing.addedAt,
      } as WorkspaceItem;
      if (replaced.type === 'item') {
        replaced.launcherType = resolveLauncherType(replaced);
      }
      items[itemIndex] = replaced;

      this.store.set('items', items);
      logger.info({ id, type: update.type }, 'Updated workspace item');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item');
      throw error;
    }
  }

  public duplicateItem(
    sourceItemId: string,
    targetGroupId?: string,
    insertOrder?: number
  ): WorkspaceItem {
    try {
      const items = this.loadItems();
      const sourceItem = items.find((i) => i.id === sourceItemId);

      if (!sourceItem) {
        throw new Error(`Item not found: ${sourceItemId}`);
      }

      let order: number;
      if (insertOrder !== undefined) {
        // 指定位置に挿入: 既存アイテムのorderをずらす
        for (const item of items) {
          if (item.order >= insertOrder) {
            item.order++;
          }
        }
        order = insertOrder;
      } else {
        order = this.getNextOrder(items);
      }

      const duplicatedItem: WorkspaceItem = {
        ...sourceItem,
        id: this.store.newId(),
        addedAt: Date.now(),
        order,
        groupId: targetGroupId !== undefined ? targetGroupId : sourceItem.groupId,
      };

      items.push(duplicatedItem);
      this.store.set('items', items);

      logger.info(
        { sourceId: sourceItemId, newId: duplicatedItem.id, targetGroupId },
        'Duplicated workspace item'
      );
      return duplicatedItem;
    } catch (error) {
      logger.error({ error, sourceItemId }, 'Failed to duplicate workspace item');
      throw error;
    }
  }

  public moveItemToGroup(itemId: string, groupId?: string, groups?: { id: string }[]): void {
    try {
      const items = this.loadItems();
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        logger.warn({ itemId }, 'Item not found in workspace');
        throw new Error(`Item not found: ${itemId}`);
      }

      if (groupId && groups && !groups.some((g) => g.id === groupId)) {
        logger.warn({ groupId }, 'Group not found in workspace');
        throw new Error(`Group not found: ${groupId}`);
      }

      if (groupId === undefined) delete item.groupId;
      else item.groupId = groupId;

      this.store.set('items', items);
      logger.info({ itemId, groupId }, 'Moved item to group');
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  }
}
