import React from 'react';
import type { RegisterItem } from '@common/types';

interface DirOptionsEditorProps {
  dirOptions: RegisterItem['dirOptions'];
  onChange: (newDirOptions: RegisterItem['dirOptions']) => void;
}

/**
 * フォルダ取込アイテムのオプション設定コンポーネント
 *
 * 階層深度、取得タイプ、フィルター、除外パターン、
 * プレフィックス、サフィックスの設定を提供します。
 */
const DirOptionsEditor: React.FC<DirOptionsEditorProps> = ({ dirOptions, onChange }) => {
  if (!dirOptions) return null;

  const handleChange = <K extends keyof NonNullable<RegisterItem['dirOptions']>>(
    field: K,
    value: NonNullable<RegisterItem['dirOptions']>[K]
  ) => {
    onChange({
      ...dirOptions,
      [field]: value,
    });
  };

  return (
    <div className="dir-options">
      <div className="form-group">
        <label>階層深度:</label>
        <select
          value={dirOptions.depth}
          onChange={(e) => handleChange('depth', parseInt(e.target.value))}
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
          value={dirOptions.types}
          onChange={(e) => handleChange('types', e.target.value as 'file' | 'folder' | 'both')}
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
          value={dirOptions.filter || ''}
          onChange={(e) => handleChange('filter', e.target.value || undefined)}
          placeholder="ワイルドカードパターン"
        />
      </div>

      <div className="form-group">
        <label>除外パターン (例: temp*):</label>
        <input
          type="text"
          value={dirOptions.exclude || ''}
          onChange={(e) => handleChange('exclude', e.target.value || undefined)}
          placeholder="除外するパターン"
        />
      </div>

      <div className="form-group">
        <label>プレフィックス (例: 仕事):</label>
        <input
          type="text"
          value={dirOptions.prefix || ''}
          onChange={(e) => handleChange('prefix', e.target.value || undefined)}
          placeholder="アイテム名の前に付ける文字"
        />
      </div>

      <div className="form-group">
        <label>サフィックス (例: Dev):</label>
        <input
          type="text"
          value={dirOptions.suffix || ''}
          onChange={(e) => handleChange('suffix', e.target.value || undefined)}
          placeholder="アイテム名の後に付ける文字"
        />
      </div>
    </div>
  );
};

export default DirOptionsEditor;
