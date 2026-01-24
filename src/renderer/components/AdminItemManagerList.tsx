import React, { useState, useEffect, useRef } from 'react';
import { parseCSVLine, escapeCSV } from '@common/utils/csvParser';
import {
  isGroupDirective,
  isDirDirective,
  isWindowOperationDirective,
  parseWindowOperationConfig,
} from '@common/utils/directiveUtils';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { RawDataLine, LauncherItem } from '@common/types';

import { logError } from '../utils/debug';

import ConfirmDialog from './ConfirmDialog';

interface EditableRawItemListProps {
  rawLines: RawDataLine[];
  selectedItems: Set<string>;
  onLineEdit: (line: RawDataLine) => void;
  onLineSelect: (line: RawDataLine, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteLines: (lines: RawDataLine[]) => void;
  onEditClick: (line: RawDataLine) => void;
  onDuplicateLines: (lines: RawDataLine[]) => void;
}

const AdminItemManagerList: React.FC<EditableRawItemListProps> = ({
  rawLines,
  selectedItems,
  onLineEdit,
  onLineSelect,
  onSelectAll,
  onDeleteLines,
  onEditClick,
  onDuplicateLines,
}) => {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // アイコンキャッシュ: Map<行番号, base64データURL>
  const [itemIcons, setItemIcons] = useState<Map<number, string>>(new Map());

  // 右クリックされた行を保存（コンテキストメニューイベント用）
  const contextMenuLinesRef = useRef<RawDataLine[]>([]);

  // ConfirmDialog状態管理
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    danger: false,
  });

  // すべてのアイテムアイコンを取得（ファビコン + 自動取得 + カスタム）
  useEffect(() => {
    const loadIcons = async () => {
      // rawLinesからLauncherItemsに変換（type='item'のみ、パスが空でない行のみ）
      const launcherItems = rawLines
        .filter((line) => line.type === 'item')
        .map((line) => {
          const parts = parseCSVLine(line.content);
          const name = parts[0] || '';
          const path = parts[1] || '';

          // パスが空の場合は除外
          if (!path) return null;

          // LauncherItemに変換（typeはdetectItemTypeSyncで判定）
          return {
            name,
            path,
            type: detectItemTypeSync(path),
          } as LauncherItem;
        })
        .filter((item): item is LauncherItem => item !== null);

      // loadCachedIcons()でアイコンを一括取得（Main Windowと同じAPI）
      const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

      // パス→アイコンのMapを作成
      const pathToIconMap = new Map<string, string>();
      Object.entries(iconCache).forEach(([path, iconData]) => {
        if (iconData) {
          pathToIconMap.set(path, iconData);
        }
      });

      // 行番号→アイコンのMapに変換（既存のitemIcons stateと互換性を保つ）
      const lineNumberToIconMap = new Map<number, string>();
      rawLines.forEach((line) => {
        if (line.type === 'item') {
          const parts = parseCSVLine(line.content);
          const path = parts[1] || '';
          const iconData = pathToIconMap.get(path);
          if (iconData) {
            lineNumberToIconMap.set(line.lineNumber, iconData);
          }
        }
      });

      setItemIcons(lineNumberToIconMap);
    };

    loadIcons();
  }, [rawLines]);

  const getLineKey = (line: RawDataLine) => `${line.sourceFile}_${line.lineNumber}`;

  // コンテキストメニューイベントリスナーを登録
  useEffect(() => {
    // 複製
    const cleanupDuplicate = window.electronAPI.onAdminMenuDuplicateItems(() => {
      const targetLines = contextMenuLinesRef.current;
      if (targetLines.length > 0) {
        onDuplicateLines(targetLines);
      }
    });

    // 詳細編集
    const cleanupEdit = window.electronAPI.onAdminMenuEditItem(() => {
      const targetLines = contextMenuLinesRef.current;
      if (targetLines.length === 1) {
        onEditClick(targetLines[0]);
      }
    });

    // 削除
    const cleanupDelete = window.electronAPI.onAdminMenuDeleteItems(() => {
      const targetLines = contextMenuLinesRef.current;
      if (targetLines.length > 0) {
        onDeleteLines(targetLines);
      }
    });

    // クリーンアップ
    return () => {
      cleanupDuplicate();
      cleanupEdit();
      cleanupDelete();
    };
  }, [onDuplicateLines, onEditClick, onDeleteLines]);

  const handleContextMenu = (event: React.MouseEvent, line: RawDataLine) => {
    event.preventDefault();
    event.stopPropagation();

    const lineKey = getLineKey(line);
    let selectedCount: number;
    let isSingleLine: boolean;
    let targetLines: RawDataLine[];

    // 右クリックした行が選択されていない場合、その行だけを対象にする
    if (selectedItems.has(lineKey)) {
      targetLines = rawLines.filter((l) => selectedItems.has(getLineKey(l)));
      selectedCount = targetLines.length;
      isSingleLine = selectedCount === 1;
    } else {
      targetLines = [line];
      selectedCount = 1;
      isSingleLine = true;
    }

    // 対象行を保存（イベントリスナーから参照するため）
    contextMenuLinesRef.current = targetLines;

    // ネイティブメニューを表示
    window.electronAPI.showAdminItemContextMenu(selectedCount, isSingleLine);
  };

  const handleCellEdit = (line: RawDataLine) => {
    // ウィンドウ操作アイテムはパス編集不可（詳細編集のみ）
    if (isWindowOperationDirective(line)) {
      return;
    }

    const cellKey = getLineKey(line);
    setEditingCell(cellKey);

    // パスのみを取得（引数は編集しない）
    let pathOnly = '';
    if (line.type === 'item') {
      const parts = parseCSVLine(line.content);
      pathOnly = parts[1] || '';
    } else if (line.type === 'directive') {
      if (isGroupDirective(line)) {
        // グループの場合：アイテム名のリスト（カンマ区切り）
        const parts = parseCSVLine(line.content);
        const itemNames = parts.slice(2).filter((name) => name);
        pathOnly = itemNames.join(', ');
      } else {
        // フォルダ取込の場合：フォルダパス
        const parts = parseCSVLine(line.content);
        pathOnly = parts[1] || '';
      }
    } else {
      // コメント行や空行の場合：元の内容を表示
      pathOnly = line.content || '';
    }

    // プレースホルダーテキストの場合は空文字列をセット
    if (!pathOnly) {
      setEditingValue('');
    } else {
      setEditingValue(pathOnly);
    }
  };

  const handleCellSave = (line: RawDataLine) => {
    // 現在のパスと編集後のパスを比較
    const parts = parseCSVLine(line.content);
    let currentPath = '';
    if (line.type === 'item' || line.type === 'directive') {
      if (isGroupDirective(line)) {
        // グループの場合：アイテム名のリスト
        const itemNames = parts.slice(2).filter((name) => name);
        currentPath = itemNames.join(', ');
      } else {
        currentPath = parts[1] || '';
      }
    } else {
      currentPath = line.content;
    }

    const trimmedValue = editingValue.trim();

    if (trimmedValue !== currentPath) {
      let newContent = line.content;

      if (line.type === 'item') {
        // アイテム行の場合：パスのみ更新、引数とカスタムアイコンは保持
        const name = parts[0] || '';
        const existingArgs = parts[2] || ''; // 既存の引数を保持
        const existingCustomIcon = parts[3] || ''; // 既存のカスタムアイコンを保持

        // 新しいパスで再構築（引数とカスタムアイコンは保持）
        // CSVエスケープを適用
        if (existingCustomIcon) {
          newContent = `${escapeCSV(name)},${escapeCSV(trimmedValue)},${escapeCSV(existingArgs)},${escapeCSV(existingCustomIcon)}`;
        } else if (existingArgs) {
          newContent = `${escapeCSV(name)},${escapeCSV(trimmedValue)},${escapeCSV(existingArgs)}`;
        } else {
          newContent = `${escapeCSV(name)},${escapeCSV(trimmedValue)}`;
        }
      } else if (line.type === 'directive') {
        if (isGroupDirective(line)) {
          // グループの場合：アイテム名リストを更新
          const groupName = parts[1] || '';
          // カンマ区切りのアイテム名リストをパース
          const newItemNames = trimmedValue
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name);
          newContent = `group,${groupName},${newItemNames.join(',')}`;
        } else {
          // フォルダ取込アイテムの場合：パスのみ更新、オプションは保持
          const directive = parts[0] || 'dir';
          const existingOptions = parts.slice(2).join(','); // 既存のオプションを保持

          // 新しいパスで再構築（オプションは保持）
          // パスにカンマが含まれる場合はCSVエスケープを適用
          if (existingOptions) {
            newContent = `${directive},${escapeCSV(trimmedValue)},${existingOptions}`;
          } else {
            newContent = `${directive},${escapeCSV(trimmedValue)}`;
          }
        }
      } else {
        // コメント行や空行の場合：そのまま更新
        newContent = editingValue;
      }

      const updatedLine = { ...line, content: newContent };
      onLineEdit(updatedLine);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleCellCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameEdit = (line: RawDataLine) => {
    const parts = parseCSVLine(line.content);
    let name = '';
    if (line.type === 'item') {
      name = parts[0] || '';
    } else if (isGroupDirective(line)) {
      // group,グループ名,アイテム1,アイテム2,...
      name = parts[1] || '';
    } else if (isWindowOperationDirective(line)) {
      // window,{JSON形式}
      // parseWindowOperationConfigヘルパーを使用してJSON形式を安全にパース
      // ヘルパー内で形式検証とエラーハンドリングを一元化しており、
      // JSON形式でない場合やパースエラー時は詳細なエラーメッセージをスロー
      try {
        const config = parseWindowOperationConfig(parts[1] || '');
        name = config.displayName || '';
      } catch (error) {
        logError('ウィンドウ操作アイテムのJSON形式が不正です:', error);
        alert(error instanceof Error ? error.message : 'JSON形式が不正です');
        return;
      }
    }
    const cellKey = `${getLineKey(line)}_name`;
    setEditingCell(cellKey);
    setEditingValue(name);
  };

  const handleNameSave = (line: RawDataLine) => {
    // CSVエスケープを正しく処理するためparseCSVLineを使用
    const parts = parseCSVLine(line.content);
    let newContent = '';

    if (line.type === 'item') {
      const newName = editingValue.trim();
      const path = parts[1] || '';
      const args = parts[2] || '';
      const customIcon = parts[3] || '';

      // CSVエスケープを適用して再構築
      if (customIcon) {
        newContent = `${escapeCSV(newName)},${escapeCSV(path)},${escapeCSV(args)},${escapeCSV(customIcon)}`;
      } else if (args) {
        newContent = `${escapeCSV(newName)},${escapeCSV(path)},${escapeCSV(args)}`;
      } else {
        newContent = `${escapeCSV(newName)},${escapeCSV(path)}`;
      }
    } else if (isGroupDirective(line)) {
      // group,グループ名,アイテム1,アイテム2,...
      // グループ名にはカンマは許可されていない（バリデーションで防止）
      const newGroupName = editingValue.trim();
      const itemNames = parts.slice(2);
      newContent = `group,${newGroupName},${itemNames.join(',')}`;
    } else if (isWindowOperationDirective(line)) {
      // window,{JSON形式}
      const newName = editingValue.trim();

      if (!parts[1] || !parts[1].trim().startsWith('{')) {
        alert(
          'ウィンドウ操作アイテムはJSON形式で記述する必要があります。詳細編集で修正してください。'
        );
        setEditingCell(null);
        setEditingValue('');
        return;
      }

      try {
        // parseWindowOperationConfigヘルパーでJSON形式を安全にパース
        const config = parseWindowOperationConfig(parts[1] || '');
        // 名前フィールドのみ更新
        config.displayName = newName;
        // JSON.stringify()でオブジェクトをJSON文字列に変換し、
        // escapeCSV()でCSV形式に適合するようにエスケープ（ダブルクォートを二重化）
        newContent = `window,${escapeCSV(JSON.stringify(config))}`;
      } catch (error) {
        logError('ウィンドウ操作アイテムのJSON形式が不正です:', error);
        alert(error instanceof Error ? error.message : 'JSON形式が不正です');
        setEditingCell(null);
        setEditingValue('');
        return;
      }
    }

    if (newContent && newContent !== line.content) {
      const updatedLine = { ...line, content: newContent };
      onLineEdit(updatedLine);
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const handleNameKeyDown = (e: React.KeyboardEvent, line: RawDataLine) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNameSave(line);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, line: RawDataLine) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSave(line);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCellCancel();
    }
  };

  const getLineTypeIcon = (line: RawDataLine) => {
    if (line.type === 'directive') {
      if (isGroupDirective(line)) {
        return '📦';
      } else if (isDirDirective(line)) {
        return '🗂️';
      } else if (isWindowOperationDirective(line)) {
        return '🪟';
      }
      return '🗂️'; // デフォルトはフォルダ取込
    }

    switch (line.type) {
      case 'item':
        return '📄';
      case 'comment':
        return '💬';
      case 'empty':
        return '⬜';
      default:
        return '❓';
    }
  };

  const getLineTypeDisplayName = (line: RawDataLine) => {
    if (line.type === 'directive') {
      if (isGroupDirective(line)) {
        return 'グループ';
      } else if (isDirDirective(line)) {
        return 'フォルダ取込';
      } else if (isWindowOperationDirective(line)) {
        return 'ウィンドウ操作';
      }
      return 'ディレクティブ'; // デフォルト
    }

    switch (line.type) {
      case 'item':
        return '単一アイテム';
      case 'comment':
        return 'コメント';
      case 'empty':
        return '空行';
      default:
        return '不明';
    }
  };

  const renderNameCell = (line: RawDataLine) => {
    if (line.type === 'item' || isGroupDirective(line) || isWindowOperationDirective(line)) {
      // アイテム行、グループ行、ウィンドウ操作行の場合、CSV形式から名前を抽出
      const parts = parseCSVLine(line.content);
      let name = '';
      let hasError = false;

      if (line.type === 'item') {
        name = parts[0] || '';
      } else if (isGroupDirective(line)) {
        // group,グループ名,アイテム1,アイテム2,...
        name = parts[1] || '';
      } else if (isWindowOperationDirective(line)) {
        // window,{JSON形式}
        try {
          const config = parseWindowOperationConfig(parts[1] || '');
          name = config.displayName || '';
        } catch {
          name = '(JSON形式エラー)';
          hasError = true;
        }
      }

      const cellKey = `${getLineKey(line)}_name`;
      const isEditing = editingCell === cellKey;

      if (isEditing) {
        return (
          <input
            type="text"
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={() => handleNameSave(line)}
            onKeyDown={(e) => handleNameKeyDown(e, line)}
            className="edit-input"
            autoFocus
          />
        );
      }

      return (
        <div
          className={`editable-cell ${hasError ? 'error' : ''}`}
          onClick={() => handleNameEdit(line)}
          title={hasError ? 'JSON形式エラー: 詳細編集で修正してください' : 'クリックして名前を編集'}
        >
          {name || '(名前なし)'}
        </div>
      );
    } else {
      // フォルダ取込アイテムなどは名称編集不可
      return <div className="readonly-cell">-</div>;
    }
  };

  const getPathAndArgs = (line: RawDataLine) => {
    if (line.type === 'item') {
      // アイテム行の場合：パス＋引数の組み合わせ
      const parts = parseCSVLine(line.content);
      const pathPart = parts[1] || '';
      const argsPart = parts[2] || '';
      if (!pathPart) return '(パスなし)';
      return argsPart ? `${pathPart} ${argsPart}` : pathPart;
    } else if (line.type === 'directive') {
      if (isGroupDirective(line)) {
        // グループアイテムの場合：アイテム名のリスト
        // group,グループ名,アイテム1,アイテム2,...
        const parts = parseCSVLine(line.content);
        const itemNames = parts.slice(2).filter((name) => name);
        if (itemNames.length === 0) return '(アイテムなし)';
        return itemNames.join(', ');
      } else if (isWindowOperationDirective(line)) {
        // ウィンドウ操作アイテムの場合：ウィンドウタイトル＋設定情報
        // window,{JSON形式}
        const parts = parseCSVLine(line.content);
        let windowTitle = '';
        const settings: string[] = [];

        try {
          const config = parseWindowOperationConfig(parts[1] || '');
          windowTitle = config.windowTitle || '';
          if (config.x !== undefined) settings.push(`x:${config.x}`);
          if (config.y !== undefined) settings.push(`y:${config.y}`);
          if (config.width !== undefined) settings.push(`w:${config.width}`);
          if (config.height !== undefined) settings.push(`h:${config.height}`);
          if (config.virtualDesktopNumber !== undefined)
            settings.push(`desk:${config.virtualDesktopNumber}`);
          if (config.activateWindow !== undefined) settings.push(`active:${config.activateWindow}`);
        } catch {
          return '(JSON形式エラー)';
        }

        if (!windowTitle) return '(ウィンドウタイトルなし)';
        return settings.length > 0 ? `${windowTitle} [${settings.join(', ')}]` : windowTitle;
      } else {
        // フォルダ取込アイテムの場合：フォルダパス＋オプション
        const parts = parseCSVLine(line.content);
        const pathPart = parts[1] || '';
        const options = parts.slice(2).join(',').trim();
        if (!pathPart) return '(フォルダパスなし)';
        return options ? `${pathPart} ${options}` : pathPart;
      }
    } else {
      // コメント行や空行の場合：元の内容を表示
      return line.content || (line.type === 'empty' ? '(空行)' : '');
    }
  };

  const handleTypeSelection = (
    line: RawDataLine,
    newType: 'item' | 'directive',
    directiveType?: 'dir' | 'group' | 'window'
  ) => {
    let newContent = '';

    if (newType === 'item') {
      // 単一アイテムの場合：名前,パス,引数の形式（名前とパスは空で初期化）
      newContent = ',';
    } else if (newType === 'directive') {
      if (directiveType === 'group') {
        // グループの場合：group,グループ名,アイテム名1,アイテム名2,...の形式（グループ名は空で初期化）
        newContent = 'group,';
      } else if (directiveType === 'window') {
        // ウィンドウ操作の場合：window,{JSON形式}で初期化
        const initialConfig = {
          name: '',
          windowTitle: '',
        };
        newContent = `window,${escapeCSV(JSON.stringify(initialConfig))}`;
      } else {
        // フォルダ取り込みの場合：dir,パスの形式（パスは空で初期化）
        newContent = 'dir,';
      }
    }

    const updatedLine = {
      ...line,
      content: newContent,
      type: newType,
    };
    onLineEdit(updatedLine);
  };

  const renderTypeCell = (line: RawDataLine) => {
    if (line.type === 'empty') {
      return (
        <div className="type-selection">
          <button
            className="type-select-button item-button"
            onClick={() => handleTypeSelection(line, 'item')}
            title="単一アイテムとして設定"
          >
            📄 単一アイテム
          </button>
          <button
            className="type-select-button folder-button"
            onClick={() => handleTypeSelection(line, 'directive', 'dir')}
            title="フォルダ取り込みとして設定"
          >
            🗂️ フォルダ取り込み
          </button>
          <button
            className="type-select-button group-button"
            onClick={() => handleTypeSelection(line, 'directive', 'group')}
            title="グループとして設定"
          >
            📦 グループ
          </button>
          <button
            className="type-select-button window-button"
            onClick={() => handleTypeSelection(line, 'directive', 'window')}
            title="ウィンドウ操作として設定"
          >
            🪟 ウィンドウ操作
          </button>
        </div>
      );
    }

    return (
      <>
        <span className="type-icon">{getLineTypeIcon(line)}</span>
        <span className="type-name">{getLineTypeDisplayName(line)}</span>
      </>
    );
  };

  const renderIconCell = (line: RawDataLine) => {
    // 単一アイテムの場合のみアイコンを表示
    if (line.type === 'item') {
      const iconData = itemIcons.get(line.lineNumber);
      if (iconData) {
        return <img src={iconData} alt="" className="item-icon-image" />;
      }

      // アイコンがない場合、パスから型を判定してフォルダなら絵文字表示
      const parts = parseCSVLine(line.content);
      const path = parts[1] || '';
      if (path && detectItemTypeSync(path) === 'folder') {
        return <span className="folder-emoji">📁</span>;
      }
    }
    return null;
  };

  const renderEditableCell = (line: RawDataLine) => {
    const cellKey = getLineKey(line);
    const isEditing = editingCell === cellKey;
    const isEmptyLine = line.type === 'empty';

    if (isEditing) {
      return (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleCellSave(line)}
          onKeyDown={(e) => handleKeyDown(e, line)}
          className="edit-input"
          autoFocus
        />
      );
    }

    if (isEmptyLine) {
      // 空行の場合は編集不可として表示
      return (
        <div
          className="readonly-cell"
          title="空行の場合は編集できません。まず種類を選択してください。"
        >
          (まず種類を選択してください)
        </div>
      );
    }

    // ウィンドウ操作アイテムは編集不可
    if (isWindowOperationDirective(line)) {
      return (
        <div
          className="readonly-cell"
          title="ウィンドウ操作アイテムは✏️ボタンから詳細編集を開いてください"
        >
          {getPathAndArgs(line)}
        </div>
      );
    }

    // ツールチップテキストを動的に生成
    let tooltipText = '';
    if (isGroupDirective(line)) {
      tooltipText = 'クリックしてアイテム名リストを編集できます（カンマ区切りで入力）';
    } else {
      tooltipText =
        'クリックしてパスを編集できます。引数を変更する場合は✏️ボタンから詳細編集を開いてください';
    }

    return (
      <div className="editable-cell" onClick={() => handleCellEdit(line)} title={tooltipText}>
        {getPathAndArgs(line)}
      </div>
    );
  };

  const allSelected =
    rawLines.length > 0 && rawLines.every((line) => selectedItems.has(getLineKey(line)));
  const someSelected = rawLines.some((line) => selectedItems.has(getLineKey(line)));

  return (
    <div className="editable-raw-item-list">
      <table className="raw-items-table">
        <thead>
          <tr>
            <th className="checkbox-column">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = someSelected && !allSelected;
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="line-number-column">#</th>
            <th className="type-column">種類</th>
            <th className="icon-column"></th>
            <th className="name-column">名前</th>
            <th className="content-column">パスと引数 (パスのみ編集可、引数編集は✏️から)</th>
            <th className="actions-column">操作</th>
          </tr>
        </thead>
        <tbody>
          {rawLines.map((line) => {
            const lineKey = getLineKey(line);
            const isSelected = selectedItems.has(lineKey);

            return (
              <tr
                key={lineKey}
                className={`raw-item-row ${isSelected ? 'selected' : ''} ${line.type}`}
                onContextMenu={(e) => handleContextMenu(e, line)}
              >
                <td className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onLineSelect(line, e.target.checked)}
                  />
                </td>
                <td className="line-number-column">{line.lineNumber}</td>
                <td className="type-column">{renderTypeCell(line)}</td>
                <td className="icon-column">{renderIconCell(line)}</td>
                <td className="name-column">{renderNameCell(line)}</td>
                <td className="content-column">{renderEditableCell(line)}</td>
                <td className="actions-column">
                  <div className="action-buttons">
                    <button
                      className="detail-edit-button"
                      onClick={() => onEditClick(line)}
                      title="詳細編集"
                      disabled={line.type === 'empty'}
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => {
                        setConfirmDialog({
                          isOpen: true,
                          message: `行 ${line.lineNumber} を削除しますか？`,
                          onConfirm: () => {
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                            onDeleteLines([line]);
                          },
                          danger: true,
                        });
                      }}
                      title="削除"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rawLines.length === 0 && <div className="no-items">データファイルに行がありません</div>}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
      />
    </div>
  );
};

export default AdminItemManagerList;
