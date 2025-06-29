import React from 'react';

interface TabControlProps {
  activeTab: 'main' | 'temp';
  onTabChange: (tab: 'main' | 'temp') => void;
}

const TabControl: React.FC<TabControlProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tab-control">
      <button
        className={`tab ${activeTab === 'main' ? 'active' : ''}`}
        onClick={() => onTabChange('main')}
      >
        メイン
      </button>
      <button
        className={`tab ${activeTab === 'temp' ? 'active' : ''}`}
        onClick={() => onTabChange('temp')}
      >
        一時
      </button>
    </div>
  );
};

export default TabControl;