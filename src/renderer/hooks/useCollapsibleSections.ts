import { useState } from 'react';

/**
 * 複数のセクションの折りたたみ状態を一元管理するカスタムフック
 *
 * グループ、未分類、実行履歴など、複数のセクションの折りたたみ状態を
 * 効率的に管理し、全展開・全閉じの機能も提供します。
 *
 * @param initialSections 各セクションの初期折りたたみ状態（キー: セクションID、値: 折りたたみ状態）
 * @returns 折りたたみ状態の管理オブジェクト
 *
 * @example
 * ```tsx
 * const { collapsed, toggleSection, expandAll, collapseAll } = useCollapsibleSections({
 *   uncategorized: false,
 *   history: false,
 * });
 *
 * // 特定のセクションを切り替え
 * <button onClick={() => toggleSection('uncategorized')}>切り替え</button>
 *
 * // 全セクションを展開
 * <button onClick={expandAll}>全て展開</button>
 *
 * // 全セクションを閉じる
 * <button onClick={collapseAll}>全て閉じる</button>
 *
 * // 折りたたみ状態を参照
 * {!collapsed.uncategorized && <div>未分類セクション</div>}
 * ```
 */
export function useCollapsibleSections(initialSections: Record<string, boolean> = {}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(initialSections);

  /**
   * 特定のセクションの折りたたみ状態を切り替え
   *
   * @param id セクションID
   */
  const toggleSection = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /**
   * 全てのセクションを展開
   */
  const expandAll = () => {
    setCollapsed((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, false])));
  };

  /**
   * 全てのセクションを閉じる
   */
  const collapseAll = () => {
    setCollapsed((prev) => Object.fromEntries(Object.keys(prev).map((key) => [key, true])));
  };

  return { collapsed, toggleSection, expandAll, collapseAll, setCollapsed };
}
