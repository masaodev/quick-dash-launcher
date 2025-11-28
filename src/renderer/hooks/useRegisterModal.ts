import { useState } from 'react';

import { RawDataLine } from '../../common/types';

/**
 * 登録モーダルの状態管理を行うカスタムフック
 * モーダルの開閉、ドロップされたパス、編集中のアイテムを管理
 */
export const useRegisterModal = () => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<RawDataLine | null>(null);

  /**
   * モーダルを開く（新規登録モード）
   */
  const openRegisterModal = () => {
    setEditingItem(null);
    setIsRegisterModalOpen(true);
  };

  /**
   * モーダルを開く（編集モード）
   */
  const openEditModal = (item: RawDataLine) => {
    setEditingItem(item);
    setIsRegisterModalOpen(true);
  };

  /**
   * ドロップされたファイルでモーダルを開く
   */
  const openWithDroppedPaths = (paths: string[]) => {
    setDroppedPaths(paths);
    setIsRegisterModalOpen(true);
  };

  /**
   * モーダルを閉じて状態をリセット
   */
  const closeModal = () => {
    setIsRegisterModalOpen(false);
    setDroppedPaths([]);
    setEditingItem(null);
  };

  return {
    // 状態
    isRegisterModalOpen,
    droppedPaths,
    editingItem,

    // アクション
    openRegisterModal,
    openEditModal,
    openWithDroppedPaths,
    closeModal,
  };
};
