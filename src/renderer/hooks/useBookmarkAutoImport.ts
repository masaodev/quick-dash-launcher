import { useState, useEffect, useCallback } from 'react';
import type {
  BookmarkAutoImportSettings,
  BookmarkAutoImportRule,
  BookmarkAutoImportResult,
  BookmarkWithFolder,
} from '@common/types/bookmarkAutoImport';
import { DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS } from '@common/types/bookmarkAutoImport';

export function useBookmarkAutoImport() {
  const [settings, setSettings] = useState<BookmarkAutoImportSettings>(
    DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);
  const [executingRuleId, setExecutingRuleId] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const loaded = await window.electronAPI.bookmarkAutoImportAPI.getSettings();
      setSettings(loaded || DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS);
    } catch (error) {
      console.error('自動取込設定の読み込みに失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async (newSettings: BookmarkAutoImportSettings) => {
    try {
      await window.electronAPI.bookmarkAutoImportAPI.saveSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('自動取込設定の保存に失敗:', error);
      throw error;
    }
  }, []);

  const toggleAutoRunOnStartup = useCallback(async () => {
    const newSettings = {
      ...settings,
      autoRunOnStartup: !settings.autoRunOnStartup,
    };
    await saveSettings(newSettings);
  }, [settings, saveSettings]);

  const toggleRuleEnabled = useCallback(
    async (ruleId: string) => {
      const newRules = settings.rules.map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled, updatedAt: Date.now() } : r
      );
      await saveSettings({ ...settings, rules: newRules });
    },
    [settings, saveSettings]
  );

  const addRule = useCallback(
    async (rule: BookmarkAutoImportRule) => {
      const newSettings = {
        ...settings,
        rules: [...settings.rules, rule],
      };
      await saveSettings(newSettings);
    },
    [settings, saveSettings]
  );

  const updateRule = useCallback(
    async (rule: BookmarkAutoImportRule) => {
      const newRules = settings.rules.map((r) => (r.id === rule.id ? rule : r));
      await saveSettings({ ...settings, rules: newRules });
    },
    [settings, saveSettings]
  );

  const deleteRule = useCallback(
    async (ruleId: string, deleteItems: boolean = false) => {
      if (deleteItems) {
        const rule = settings.rules.find((r) => r.id === ruleId);
        if (rule) {
          await window.electronAPI.bookmarkAutoImportAPI.deleteRuleItems(ruleId, rule.targetFile);
        }
      }
      const newRules = settings.rules.filter((r) => r.id !== ruleId);
      await saveSettings({ ...settings, rules: newRules });
    },
    [settings, saveSettings]
  );

  const executeRule = useCallback(
    async (rule: BookmarkAutoImportRule): Promise<BookmarkAutoImportResult> => {
      setExecutingRuleId(rule.id);
      try {
        const result = await window.electronAPI.bookmarkAutoImportAPI.executeRule(rule);
        await loadSettings();
        return result;
      } finally {
        setExecutingRuleId(null);
      }
    },
    [loadSettings]
  );

  const executeAllRules = useCallback(async (): Promise<BookmarkAutoImportResult[]> => {
    setExecutingRuleId('all');
    try {
      const results = await window.electronAPI.bookmarkAutoImportAPI.executeAll();
      await loadSettings();
      return results;
    } finally {
      setExecutingRuleId(null);
    }
  }, [loadSettings]);

  const previewRule = useCallback(
    (rule: BookmarkAutoImportRule): Promise<BookmarkWithFolder[]> =>
      window.electronAPI.bookmarkAutoImportAPI.previewRule(rule),
    []
  );

  return {
    settings,
    isLoading,
    executingRuleId,
    toggleAutoRunOnStartup,
    toggleRuleEnabled,
    addRule,
    updateRule,
    deleteRule,
    executeRule,
    executeAllRules,
    previewRule,
  };
}
