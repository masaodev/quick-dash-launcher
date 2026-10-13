import { useTranslation } from 'react-i18next';
import React, { useState, useRef, useEffect } from 'react';
import { findMatchingRule, applyConversionPrefix } from '@common/urlConversionRules';
import type { ConversionRule } from '@common/urlConversionRules';

interface UrlConverterMenuProps {
  url: string;
  onConvert: (convertedUrl: string) => void;
  itemType?: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard';
}

const UrlConverterMenu: React.FC<UrlConverterMenuProps> = ({ url, onConvert, itemType }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [matchedRule, setMatchedRule] = useState<ConversionRule | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rule = findMatchingRule(url);
    setMatchedRule(rule);
  }, [url]);

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

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (prefix: string) => {
    onConvert(applyConversionPrefix(url, prefix));
    setIsOpen(false);
  };

  const isDisabled = !url?.trim() || (itemType !== undefined && itemType !== 'url');

  return (
    <div className="url-converter-menu-container" ref={menuRef}>
      <button
        type="button"
        className="url-converter-btn"
        onClick={handleButtonClick}
        disabled={isDisabled}
        title={t('urlConverter.title')}
      >
        <span className="url-converter-emoji">🔗</span>
        <span>{t('urlConverter.button')}</span>
      </button>

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
                    <div className="url-converter-option-label">
                      {t(`urlConverter.options.${option.kind}`)}
                    </div>
                    <div className="url-converter-option-prefix">{option.prefix}</div>
                    <div className="url-converter-option-description">
                      {t(`urlConverter.descriptions.${option.kind}`, { app: matchedRule.app })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="url-converter-menu-empty">
              <div className="url-converter-menu-empty-message">{t('urlConverter.noRule')}</div>
              <div className="url-converter-menu-empty-hint">{t('urlConverter.hint')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UrlConverterMenu;
