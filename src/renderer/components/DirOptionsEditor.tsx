/**
 * 画面: フォルダ取込オプションエディタ
 * 画面仕様: docs/screens/dir-options-editor.md
 */
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <label>{t('dirOptions.depth')}</label>
        <select
          value={dirOptions.depth}
          onChange={(e) => handleChange('depth', parseInt(e.target.value))}
        >
          <option value="0">{t('dirOptions.depths.current')}</option>
          <option value="1">{t('dirOptions.depths.one')}</option>
          <option value="2">{t('dirOptions.depths.two')}</option>
          <option value="3">{t('dirOptions.depths.three')}</option>
          <option value="-1">{t('dirOptions.depths.unlimited')}</option>
        </select>
      </div>

      <div className="form-group">
        <label>{t('dirOptions.types')}</label>
        <select
          value={dirOptions.types}
          onChange={(e) => handleChange('types', e.target.value as 'file' | 'folder' | 'both')}
        >
          <option value="file">{t('dirOptions.typeOptions.file')}</option>
          <option value="folder">{t('dirOptions.typeOptions.folder')}</option>
          <option value="both">{t('dirOptions.typeOptions.both')}</option>
        </select>
      </div>

      <div className="form-group">
        <label>{t('dirOptions.filter')}</label>
        <input
          type="text"
          value={dirOptions.filter || ''}
          onChange={(e) => handleChange('filter', e.target.value || undefined)}
          placeholder={t('dirOptions.filterPlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('dirOptions.exclude')}</label>
        <input
          type="text"
          value={dirOptions.exclude || ''}
          onChange={(e) => handleChange('exclude', e.target.value || undefined)}
          placeholder={t('dirOptions.excludePlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('dirOptions.prefix')}</label>
        <input
          type="text"
          value={dirOptions.prefix || ''}
          onChange={(e) => handleChange('prefix', e.target.value || undefined)}
          placeholder={t('dirOptions.prefixPlaceholder')}
        />
      </div>

      <div className="form-group">
        <label>{t('dirOptions.suffix')}</label>
        <input
          type="text"
          value={dirOptions.suffix || ''}
          onChange={(e) => handleChange('suffix', e.target.value || undefined)}
          placeholder={t('dirOptions.suffixPlaceholder')}
        />
      </div>
    </div>
  );
};

export default DirOptionsEditor;
