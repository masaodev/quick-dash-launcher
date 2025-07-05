import React, { useState, useEffect } from 'react';
import { LauncherItem } from '../../common/types';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (items: RegisterItem[]) => void;
  droppedPaths: string[];
}

export interface RegisterItem {
  name: string;
  path: string;
  type: LauncherItem['type'];
  args?: string;
  targetTab: 'main' | 'temp';
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  // DIRディレクティブオプション
  dirOptions?: {
    depth: number;
    types: 'file' | 'folder' | 'both';
    filter?: string;
    exclude?: string;
    prefix?: string;
  };
}

const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onRegister, droppedPaths }) => {
  const [items, setItems] = useState<RegisterItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && droppedPaths && droppedPaths.length > 0) {
      console.log('RegisterModal opened with paths:', droppedPaths);
      initializeItems();
    }
  }, [isOpen, droppedPaths]);

  const initializeItems = async () => {
    setLoading(true);
    const newItems: RegisterItem[] = [];

    try {
      if (!droppedPaths || droppedPaths.length === 0) {
        console.error('No dropped paths provided');
        return;
      }
      
      for (const filePath of droppedPaths) {
        if (!filePath) {
          console.warn('Skipping undefined path');
          continue;
        }
        console.log('Processing dropped path:', filePath);
        const itemType = await detectItemType(filePath);
        console.log('Detected item type:', itemType);
        const name = extractDefaultName(filePath);
        console.log('Extracted name:', name);
      
      let icon: string | undefined;
      try {
        if (itemType === 'app' || itemType === 'file') {
          icon = await window.electronAPI.extractIcon(filePath);
        } else if (itemType === 'customUri') {
          icon = await window.electronAPI.extractCustomUriIcon(filePath);
          if (!icon) {
            icon = await window.electronAPI.extractFileIconByExtension(filePath);
          }
        }
      } catch (error) {
        console.error('Failed to extract icon:', error);
      }

      newItems.push({
        name,
        path: filePath,
        type: itemType,
        targetTab: 'main',
        folderProcessing: itemType === 'folder' ? 'folder' : undefined,
        icon,
        dirOptions: itemType === 'folder' ? {
          depth: 0,
          types: 'both',
          filter: undefined,
          exclude: undefined,
          prefix: undefined
        } : undefined
      });
    }

      setItems(newItems);
    } catch (error) {
      console.error('Error initializing items:', error);
      alert('アイテムの初期化中にエラーが発生しました: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const detectItemType = async (itemPath: string): Promise<LauncherItem['type']> => {
    // URLs
    if (itemPath.includes('://')) {
      const scheme = itemPath.split('://')[0];
      if (!['http', 'https', 'ftp'].includes(scheme)) {
        return 'customUri';
      }
      return 'url';
    }

    // Check if it's a directory
    try {
      const isDirectory = await window.electronAPI.isDirectory(itemPath);
      if (isDirectory) {
        return 'folder';
      }
    } catch (error) {
      console.error('Error checking if directory:', error);
    }

    // File extensions
    const lastDot = itemPath.lastIndexOf('.');
    const ext = lastDot !== -1 ? itemPath.substring(lastDot).toLowerCase() : '';
    
    // Executables and shortcuts
    if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.com' || ext === '.lnk') {
      return 'app';
    }

    // Default to file
    return 'file';
  };

  const extractDefaultName = (filePath: string): string => {
    if (filePath.includes('://')) {
      // For URLs, extract domain name
      try {
        const url = new URL(filePath);
        return url.hostname.replace('www.', '');
      } catch {
        return filePath;
      }
    }
    
    // For files and folders, extract the last part of the path
    const parts = filePath.split(/[\\/]/);
    const basename = parts[parts.length - 1] || filePath;
    const lastDot = basename.lastIndexOf('.');
    const ext = lastDot !== -1 ? basename.substring(lastDot) : '';
    return ext ? basename.slice(0, -ext.length) : basename;
  };

  const handleItemChange = (index: number, field: keyof RegisterItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleRegister = () => {
    onRegister(items);
    onClose();
  };

  const handleCancel = () => {
    setItems([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
        <h2>アイテムの登録</h2>
        
        {loading ? (
          <div className="loading">アイテム情報を読み込み中...</div>
        ) : (
          <>
            <div className="register-items">
              {items.map((item, index) => (
                <div key={index} className="register-item">
                  <div className="item-header">
                    {item.icon && (
                      <img src={item.icon} alt="" className="item-icon" />
                    )}
                    <span className="item-type">{item.type}</span>
                  </div>
                  
                  <div className="form-group">
                    <label>名前:</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="表示名を入力"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>パス:</label>
                    <input
                      type="text"
                      value={item.path}
                      readOnly
                      className="readonly"
                    />
                  </div>
                  
                  {item.type === 'app' && (
                    <div className="form-group">
                      <label>引数 (オプション):</label>
                      <input
                        type="text"
                        value={item.args || ''}
                        onChange={(e) => handleItemChange(index, 'args', e.target.value)}
                        placeholder="コマンドライン引数"
                      />
                    </div>
                  )}
                  
                  {item.type === 'folder' && (
                    <>
                      <div className="form-group">
                        <label>フォルダ処理:</label>
                        <select
                          value={item.folderProcessing}
                          onChange={(e) => handleItemChange(index, 'folderProcessing', e.target.value as 'folder' | 'expand')}
                        >
                          <option value="folder">フォルダ自体を登録</option>
                          <option value="expand">フォルダ内容を展開 (dir,)</option>
                        </select>
                      </div>
                      
                      {item.folderProcessing === 'expand' && item.dirOptions && (
                        <div className="dir-options">
                          <div className="form-group">
                            <label>階層深度:</label>
                            <select
                              value={item.dirOptions.depth}
                              onChange={(e) => {
                                const newDirOptions = { ...item.dirOptions!, depth: parseInt(e.target.value) };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                            >
                              <option value="0">現在のフォルダのみ</option>
                              <option value="1">1階層下まで</option>
                              <option value="2">2階層下まで</option>
                              <option value="3">3階層下まで</option>
                              <option value="-1">無制限</option>
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label>取得タイプ:</label>
                            <select
                              value={item.dirOptions.types}
                              onChange={(e) => {
                                const newDirOptions = { ...item.dirOptions!, types: e.target.value as 'file' | 'folder' | 'both' };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                            >
                              <option value="file">ファイルのみ</option>
                              <option value="folder">フォルダーのみ</option>
                              <option value="both">ファイルとフォルダー</option>
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label>フィルター (例: *.txt):</label>
                            <input
                              type="text"
                              value={item.dirOptions.filter || ''}
                              onChange={(e) => {
                                const newDirOptions = { ...item.dirOptions!, filter: e.target.value || undefined };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="ワイルドカードパターン"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>除外パターン (例: temp*):</label>
                            <input
                              type="text"
                              value={item.dirOptions.exclude || ''}
                              onChange={(e) => {
                                const newDirOptions = { ...item.dirOptions!, exclude: e.target.value || undefined };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="除外するパターン"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>プレフィックス (例: 仕事):</label>
                            <input
                              type="text"
                              value={item.dirOptions.prefix || ''}
                              onChange={(e) => {
                                const newDirOptions = { ...item.dirOptions!, prefix: e.target.value || undefined };
                                handleItemChange(index, 'dirOptions', newDirOptions);
                              }}
                              placeholder="アイテム名の前に付ける文字"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="form-group">
                    <label>保存先:</label>
                    <select
                      value={item.targetTab}
                      onChange={(e) => handleItemChange(index, 'targetTab', e.target.value as 'main' | 'temp')}
                    >
                      <option value="main">メインタブ</option>
                      <option value="temp">一時タブ</option>
                    </select>
                  </div>
                  
                  {items.length > 1 && <hr />}
                </div>
              ))}
            </div>
            
            <div className="modal-actions">
              <button onClick={handleCancel}>キャンセル</button>
              <button onClick={handleRegister} className="primary">登録</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RegisterModal;