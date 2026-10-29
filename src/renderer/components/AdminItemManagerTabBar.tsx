import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataFileTab } from '@common/types';
import { TabStructureEdits } from '@common/utils/tabManager';

import type { AdminTabStructure } from '../hooks/useAdminTabStructure';
import { isCommitEnter } from '../utils/inlineName';

type MenuEntry =
  | {
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      title?: string;
      danger?: boolean;
      testId?: string;
    }
  | { heading: string }
  | 'separator';

interface MenuState {
  x: number;
  y: number;
  entries: MenuEntry[];
}

/** 右クリック・「＋ ファイル」で出すメニュー（クリック位置に出し、外側のクリックか Esc で閉じる） */
const PopupMenu: React.FC<{ menu: MenuState; onClose: () => void }> = ({ menu, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  // 画面の端からはみ出さないように寄せる
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      left: Math.max(0, Math.min(menu.x, window.innerWidth - rect.width - 4)),
      top: Math.max(0, Math.min(menu.y, window.innerHeight - rect.height - 4)),
    });
  }, [menu]);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    // Esc はメニューを閉じるだけにする（画面のキー操作に渡さない）
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="admin-tab-popup-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      data-testid="admin-tab-popup-menu"
    >
      {menu.entries.map((entry, index) => {
        if (entry === 'separator') return <hr key={index} />;
        if ('heading' in entry) {
          return (
            <div key={index} className="admin-tab-popup-heading">
              {entry.heading}
            </div>
          );
        }
        return (
          <button
            key={index}
            type="button"
            role="menuitem"
            className={`admin-tab-popup-item${entry.danger ? ' danger' : ''}`}
            disabled={entry.disabled}
            title={entry.title}
            data-testid={entry.testId}
            onClick={() => {
              onClose();
              entry.onSelect();
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
};

/** タブ名・データファイル名をその場で書き換える入力欄（Enter で確定、Esc で取り消し） */
const InlineNameInput: React.FC<{
  initialValue: string;
  placeholder?: string;
  /** フォーカスが外れたときも確定するか（新しいタブは誤って作らないよう取り消す） */
  commitOnBlur: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  testId?: string;
}> = ({ initialValue, placeholder, commitOnBlur, onCommit, onCancel, testId }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (commit: boolean): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit && value.trim()) {
      onCommit(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="admin-tab-name-input"
      value={value}
      placeholder={placeholder}
      data-testid={testId}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // 管理画面のショートカット（Delete など）に渡さない
        e.stopPropagation();
        if (isCommitEnter(e)) finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(commitOnBlur)}
    />
  );
};

interface AdminItemManagerTabBarProps {
  dataFileTabs: DataFileTab[];
  selectedTabIndex: number;
  selectedDataFile: string;
  getFileLabel: (fileName: string) => string;
  onSelectTab: (tabIndex: number) => void;
  onSelectFile: (fileName: string) => void;
  structure: AdminTabStructure;
}

/**
 * アイテム管理のタブの列と、データファイルの札の列
 *
 * タブの追加（＋）・右クリックでの名前の変更・移動・削除と、データファイルの追加・外す・削除をここで行う。
 * 変更はその場で確定する（アイテムの「変更を保存」とは別）。
 */
const AdminItemManagerTabBar: React.FC<AdminItemManagerTabBarProps> = ({
  dataFileTabs,
  selectedTabIndex,
  selectedDataFile,
  getFileLabel,
  onSelectTab,
  onSelectFile,
  structure,
}) => {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [addingTab, setAddingTab] = useState(false);
  const [renamingTabIndex, setRenamingTabIndex] = useState<number | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);

  const currentTab = dataFileTabs[selectedTabIndex];
  const currentFiles = currentTab?.files ?? [];
  const closeMenu = (): void => setMenu(null);
  /** 「表示名（data2.json）」の形 */
  const fileWithName = (fileName: string): string =>
    t('itemManager.tabs.fileWithName', {
      label: getFileLabel(fileName),
      file: fileName.replace(/^datafiles\//, ''),
    });

  /** タブに入れられる既存のデータファイル（ディスクにあり、このタブに入っていないもの） */
  const existingFileEntries = async (tabIndex: number): Promise<MenuEntry[]> => {
    const filesOnDisk = await window.electronAPI.getDataFiles().catch(() => [] as string[]);
    const inTab = new Set(dataFileTabs[tabIndex]?.files ?? []);
    const candidates = filesOnDisk.filter((fileName) => !inTab.has(fileName));
    if (candidates.length === 0) {
      return [
        {
          label: t('itemManager.tabs.noExistingFiles'),
          onSelect: () => {},
          disabled: true,
        },
      ];
    }
    return candidates.map((fileName) => ({
      label: `📂 ${fileWithName(fileName)}`,
      onSelect: () => {
        void structure.addExistingFile(tabIndex, fileName).then((saved) => {
          if (saved) {
            onSelectTab(tabIndex);
            onSelectFile(fileName);
          }
        });
      },
    }));
  };

  const addFileEntries = async (tabIndex: number): Promise<MenuEntry[]> => [
    {
      label: t('itemManager.tabs.newFile'),
      testId: 'admin-file-create',
      onSelect: () => {
        void structure.addNewFile(tabIndex).then((fileName) => {
          if (fileName) {
            onSelectTab(tabIndex);
            onSelectFile(fileName);
          }
        });
      },
    },
    { heading: t('itemManager.tabs.existingFiles') },
    ...(await existingFileEntries(tabIndex)),
  ];

  const openTabMenu = async (event: React.MouseEvent, tabIndex: number): Promise<void> => {
    event.preventDefault();
    const { clientX: x, clientY: y } = event;
    const deleteBlocker = TabStructureEdits.getDeleteTabBlocker(dataFileTabs, tabIndex);
    const entries: MenuEntry[] = [
      { heading: t('itemManager.tabs.tabHeading', { name: dataFileTabs[tabIndex]?.name ?? '' }) },
      {
        label: t('itemManager.tabs.rename'),
        testId: 'admin-tab-rename',
        onSelect: () => setRenamingTabIndex(tabIndex),
      },
      {
        label: t('itemManager.tabs.moveLeft'),
        disabled: tabIndex === 0,
        onSelect: () => {
          void structure.moveTab(tabIndex, -1).then((saved) => {
            if (saved && selectedTabIndex === tabIndex) onSelectTab(tabIndex - 1);
            else if (saved && selectedTabIndex === tabIndex - 1) onSelectTab(tabIndex);
          });
        },
      },
      {
        label: t('itemManager.tabs.moveRight'),
        disabled: tabIndex === dataFileTabs.length - 1,
        onSelect: () => {
          void structure.moveTab(tabIndex, 1).then((saved) => {
            if (saved && selectedTabIndex === tabIndex) onSelectTab(tabIndex + 1);
            else if (saved && selectedTabIndex === tabIndex + 1) onSelectTab(tabIndex);
          });
        },
      },
      'separator',
      { heading: t('itemManager.tabs.addFile') },
      ...(await addFileEntries(tabIndex)),
      'separator',
      {
        label: t('itemManager.tabs.deleteTab'),
        danger: true,
        disabled: deleteBlocker !== null,
        title: deleteBlocker ?? undefined,
        testId: 'admin-tab-delete',
        onSelect: () => {
          void structure.deleteTab(tabIndex).then((saved) => {
            if (!saved) return;
            if (selectedTabIndex >= tabIndex && selectedTabIndex > 0) {
              onSelectTab(selectedTabIndex - 1);
            }
          });
        },
      },
    ];
    setMenu({ x, y, entries });
  };

  const openFileMenu = (event: React.MouseEvent, fileName: string): void => {
    event.preventDefault();
    const index = currentFiles.indexOf(fileName);
    const removeBlocker = TabStructureEdits.getRemoveFileBlocker(
      dataFileTabs,
      selectedTabIndex,
      fileName
    );
    const usedElsewhere = TabStructureEdits.isFileUsedInOtherTabs(
      dataFileTabs,
      selectedTabIndex,
      fileName
    );
    setMenu({
      x: event.clientX,
      y: event.clientY,
      entries: [
        {
          heading: t('itemManager.tabs.fileHeading', {
            label: getFileLabel(fileName),
            file: fileName.replace(/^datafiles\//, ''),
          }),
        },
        {
          label: t('itemManager.tabs.rename'),
          testId: 'admin-file-rename',
          onSelect: () => setRenamingFile(fileName),
        },
        {
          label: t('itemManager.tabs.moveLeft'),
          disabled: index <= 0,
          onSelect: () => void structure.moveFile(selectedTabIndex, fileName, -1),
        },
        {
          label: t('itemManager.tabs.moveRight'),
          disabled: index >= currentFiles.length - 1,
          onSelect: () => void structure.moveFile(selectedTabIndex, fileName, 1),
        },
        'separator',
        usedElsewhere
          ? {
              label: t('itemManager.tabs.removeFromTab'),
              disabled: removeBlocker !== null,
              title: removeBlocker ?? t('itemManager.tabs.removeKeepsFile'),
              testId: 'admin-file-remove',
              onSelect: () => void structure.removeFile(selectedTabIndex, fileName),
            }
          : {
              label: t('itemManager.tabs.deleteFile'),
              danger: true,
              disabled: removeBlocker !== null,
              title: removeBlocker ?? undefined,
              testId: 'admin-file-delete',
              onSelect: () => void structure.removeFile(selectedTabIndex, fileName),
            },
      ],
    });
  };

  const openAddFileMenu = async (event: React.MouseEvent): Promise<void> => {
    const rect = event.currentTarget.getBoundingClientRect();
    const entries = await addFileEntries(selectedTabIndex);
    setMenu({ x: rect.left, y: rect.bottom + 2, entries });
  };

  const commitNewTab = (name: string): void => {
    setAddingTab(false);
    void structure.addTab(name).then((newIndex) => {
      if (newIndex !== null) onSelectTab(newIndex);
    });
  };

  return (
    <div className="admin-tab-bar-area">
      <div className="admin-tab-bar" data-testid="admin-tab-bar">
        {dataFileTabs.map((tab, index) => {
          const isActive = index === selectedTabIndex;
          const filesTitle = tab.files.map(fileWithName).join('\n');
          return (
            <button
              key={`${index}-${tab.files[0] ?? ''}`}
              type="button"
              className={`admin-tab${isActive ? ' active' : ''}`}
              onClick={() => onSelectTab(index)}
              onContextMenu={(e) => void openTabMenu(e, index)}
              title={`${tab.name}\n${t('itemManager.tabs.tabTitle', { files: filesTitle })}`}
              data-testid="admin-tab"
            >
              {renamingTabIndex === index ? (
                <InlineNameInput
                  initialValue={tab.name}
                  commitOnBlur
                  testId="admin-tab-name-input"
                  onCommit={(value) => {
                    setRenamingTabIndex(null);
                    if (value !== tab.name) void structure.renameTab(index, value);
                  }}
                  onCancel={() => setRenamingTabIndex(null)}
                />
              ) : (
                <>
                  <span className="admin-tab-name">{tab.name}</span>
                  {tab.files.length > 1 && (
                    <span className="admin-tab-file-count">📄{tab.files.length}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
        {addingTab ? (
          <span className="admin-tab adding">
            <InlineNameInput
              initialValue=""
              placeholder={t('itemManager.tabs.newTabPlaceholder')}
              commitOnBlur={false}
              testId="admin-tab-new-input"
              onCommit={commitNewTab}
              onCancel={() => setAddingTab(false)}
            />
          </span>
        ) : (
          <button
            type="button"
            className="admin-tab admin-tab-add"
            onClick={() => setAddingTab(true)}
            title={t('itemManager.tabs.addTabTitle')}
            data-testid="admin-tab-add"
          >
            ＋
          </button>
        )}
      </div>

      {currentFiles.length > 1 && (
        <div className="admin-file-bar" data-testid="admin-file-bar">
          <span className="admin-file-bar-label">{t('itemManager.tabs.dataFiles')}</span>
          {currentFiles.map((fileName) => (
            <button
              key={fileName}
              type="button"
              className={`admin-file-chip${fileName === selectedDataFile ? ' active' : ''}`}
              onClick={() => onSelectFile(fileName)}
              onContextMenu={(e) => openFileMenu(e, fileName)}
              title={t('itemManager.tabs.fileTitle', {
                file: fileName.replace(/^datafiles\//, ''),
              })}
              data-testid="admin-file-chip"
            >
              {renamingFile === fileName ? (
                <InlineNameInput
                  initialValue={getFileLabel(fileName)}
                  commitOnBlur
                  testId="admin-file-name-input"
                  onCommit={(value) => {
                    setRenamingFile(null);
                    if (value !== getFileLabel(fileName))
                      void structure.renameFile(fileName, value);
                  }}
                  onCancel={() => setRenamingFile(null)}
                />
              ) : (
                getFileLabel(fileName)
              )}
            </button>
          ))}
          <button
            type="button"
            className="admin-file-chip admin-file-add"
            onClick={(e) => void openAddFileMenu(e)}
            title={t('itemManager.tabs.addFileTitle')}
            data-testid="admin-file-add"
          >
            {t('itemManager.tabs.addFileButton')}
          </button>
          <span className="admin-file-bar-path">
            {selectedDataFile.replace(/^datafiles\//, '')}
          </span>
        </div>
      )}

      {menu && <PopupMenu menu={menu} onClose={closeMenu} />}
    </div>
  );
};

export default AdminItemManagerTabBar;
