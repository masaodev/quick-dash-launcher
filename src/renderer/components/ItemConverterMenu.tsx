import { useTranslation } from 'react-i18next';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { getConversionGroups, isSupportedBrowser } from '@common/itemConversions';
import type { ConversionCandidate, DefaultBrowser } from '@common/itemConversions';

import { useToast } from '../hooks/useToast';

import { Button } from './ui';

/** 既定のブラウザは起動中に変わることがまれなので、画面を開くたびに問い合わせず 1 回だけ聞く */
let defaultBrowserPromise: Promise<DefaultBrowser | null> | undefined;

function loadDefaultBrowser(): Promise<DefaultBrowser | null> {
  defaultBrowserPromise ??= window.electronAPI.getDefaultBrowser().catch(() => null);
  return defaultBrowserPromise;
}

interface ItemConverterMenuProps {
  path: string;
  args?: string;
  /** 選んだ候補のパスと引数で書き換える */
  onConvert: (converted: { path: string; args: string }) => void;
}

/** 候補の行に出す、変換後の書き方（exe はファイル名だけにして短くする） */
function candidatePreview(candidate: ConversionCandidate): string {
  switch (candidate.kind) {
    case 'toUrl':
      return candidate.path;
    case 'browser':
      return `${candidate.path.split('\\').pop()} ${candidate.args}`;
    case 'office':
      return candidate.option.prefix;
  }
}

/**
 * パス欄の横の「変換」ボタン。いまのパス・引数から別の開き方の書き方への変換の候補を出し、選ぶと書き換える。
 * 入力補助なので、開き方を状態としては持たない（いまの書き方は候補から外すだけ）
 */
const ItemConverterMenu: React.FC<ItemConverterMenuProps> = ({ path, args, onConvert }) => {
  const { t } = useTranslation();
  const { showSuccess } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [defaultBrowser, setDefaultBrowser] = useState<DefaultBrowser | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadDefaultBrowser().then((browser) => {
      if (!cancelled) setDefaultBrowser(browser);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const supportedBrowser = isSupportedBrowser(defaultBrowser) ? defaultBrowser : null;
  const groups = useMemo(
    () => getConversionGroups(path, args, supportedBrowser),
    [path, args, supportedBrowser]
  );

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

  const isDisabled = groups.length === 0;

  const disabledReason =
    defaultBrowser && !supportedBrowser && /^https?:\/\//i.test(path.trim())
      ? t('itemConverter.unsupportedBrowser', { name: defaultBrowser.name })
      : t('itemConverter.noCandidates');

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const optionLabel = (candidate: ConversionCandidate): string => {
    switch (candidate.kind) {
      case 'toUrl':
        return t('itemConverter.options.toUrl');
      case 'browser':
        return candidate.mode === 'private'
          ? t(`itemConverter.options.${candidate.privateName}`)
          : t(`itemConverter.options.${candidate.mode}`);
      case 'office':
        return t(`itemConverter.options.${candidate.option.kind}`);
    }
  };

  const optionDescription = (candidate: ConversionCandidate): string | undefined => {
    switch (candidate.kind) {
      case 'toUrl':
        return t('itemConverter.descriptions.toUrl');
      case 'browser':
        return candidate.mode === 'appWindow'
          ? t('itemConverter.descriptions.appWindow')
          : undefined;
      case 'office':
        return t(`itemConverter.descriptions.${candidate.option.kind}`, {
          app: candidate.rule.app,
        });
    }
  };

  const convertedMessage = (candidate: ConversionCandidate): string => {
    switch (candidate.kind) {
      case 'toUrl':
        return t('itemConverter.converted.toUrl');
      case 'browser':
        return t('itemConverter.converted.browser', { name: candidate.browserName });
      case 'office':
        return t('itemConverter.converted.office', { app: candidate.rule.app });
    }
  };

  const handleOptionClick = (candidate: ConversionCandidate) => {
    onConvert({ path: candidate.path, args: candidate.args });
    showSuccess(convertedMessage(candidate));
    setIsOpen(false);
  };

  return (
    <div className="item-converter-menu-container" ref={menuRef}>
      <Button
        variant="secondary"
        size="sm"
        type="button"
        className="item-converter-btn"
        onClick={handleButtonClick}
        disabled={isDisabled}
        title={isDisabled ? disabledReason : t('itemConverter.title')}
      >
        {t('itemConverter.button')} ▾
      </Button>

      {isOpen && !isDisabled && (
        <div className="item-converter-menu">
          <div className="item-converter-menu-options">
            {groups.map((group, groupIndex) => (
              <React.Fragment key={groupIndex}>
                <div className="item-converter-menu-header">
                  {group.kind === 'url'
                    ? t('itemConverter.groups.url')
                    : group.kind === 'browser'
                      ? t('itemConverter.groups.browser', { name: group.title ?? '' })
                      : group.title}
                </div>
                {group.candidates.map((candidate, index) => {
                  const description = optionDescription(candidate);
                  return (
                    <div
                      key={index}
                      className="item-converter-option"
                      onClick={() => handleOptionClick(candidate)}
                    >
                      <div className="item-converter-option-label">{optionLabel(candidate)}</div>
                      <div className="item-converter-option-prefix">
                        {candidatePreview(candidate)}
                      </div>
                      {description && (
                        <div className="item-converter-option-description">{description}</div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemConverterMenu;
