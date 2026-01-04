import React, { useState, useRef, useEffect } from 'react';
import { findMatchingRule, applyConversionPrefix } from '@common/urlConversionRules';
import type { ConversionRule } from '@common/urlConversionRules';

interface UrlConverterMenuProps {
  /** 現在のURL */
  url: string;
  /** URL変換時のコールバック */
  onConvert: (convertedUrl: string) => void;
}

/**
 * URL変換メニューコンポーネント
 *
 * パス入力欄の下に表示されるリンクで、クリックするとSharePoint等のURL変換メニューを表示します。
 */
const UrlConverterMenu: React.FC<UrlConverterMenuProps> = ({ url, onConvert }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [matchedRule, setMatchedRule] = useState<ConversionRule | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  // URLが変更されたときにルールを再検索
  useEffect(() => {
    const rule = findMatchingRule(url);
    setMatchedRule(rule);
  }, [url]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (prefix: string) => {
    const convertedUrl = applyConversionPrefix(url, prefix);
    onConvert(convertedUrl);
    setIsOpen(false);
  };

  // URLが空の場合は表示しない
  if (!url) {
    return null;
  }

  return (
    <div className="url-converter-menu-container" ref={menuRef}>
      <a href="#" onClick={handleLinkClick} className="url-converter-link">
        🔗 URL形式を変換
      </a>

      {isOpen && (
        <div className="url-converter-menu">
          {matchedRule ? (
            <>
              <div className="url-converter-menu-header">{matchedRule.name}</div>
              <div className="url-converter-menu-options">
                {matchedRule.options.map((option, index) => (
                  <div
                    key={index}
                    className="url-converter-option"
                    onClick={() => handleOptionClick(option.prefix)}
                  >
                    <div className="url-converter-option-label">{option.label}</div>
                    <div className="url-converter-option-prefix">{option.prefix}</div>
                    {option.description && (
                      <div className="url-converter-option-description">{option.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="url-converter-menu-empty">
              <div className="url-converter-menu-empty-message">
                このURLに対応する変換ルールが見つかりませんでした
              </div>
              <div className="url-converter-menu-empty-hint">
                SharePoint上のOfficeファイル（Excel、Word、PowerPoint）のURLに対応しています
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UrlConverterMenu;
