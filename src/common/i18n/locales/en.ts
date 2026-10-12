import type { LocaleMessages } from '../messages';

/**
 * 英語の辞書（ja.ts の訳）
 *
 * キーの形は ja.ts と同じでなければ型エラーになる（足りない・余分なキーを止める）。
 * 書き方は Microsoft Writing Style Guide に合わせる（sentence case など。docs/architecture/glossary.md）。
 */
export const en: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    clear: 'Clear',
    copy: '📋 Copy',
    details: 'Details',
    showDetails: 'Show details',
    loading: 'Loading...',
    unknownError: 'Unknown error',
    unknownReason: 'unknown reason',
    listSeparator: ', ',
    withReason: '{{name}} ({{reason}})',
    itemCount_one: '{{count}} item',
    itemCount_other: '{{count}} items',
    alertTitle: {
      error: 'Error',
      warning: 'Warning',
      success: 'Success',
      info: 'Information',
    },
  },
  launcher: {
    search: {
      placeholder: 'Search...',
      clear: 'Clear search',
      modeNormal: 'Normal search',
      modeWindow: '🪟 Window search',
      refreshWindows: 'Refresh',
      reloadData: 'Reload data',
      toggleMode: 'Switch mode',
    },
    loading: {
      windows: 'Refreshing windows',
      data: 'Reloading data',
    },
    selectedCount_one: '{{count}} selected',
    selectedCount_other: '{{count}} selected',
    closeConfirm: {
      message_one: 'Close {{count}} window?',
      message_other: 'Close {{count}} windows?',
      close: 'Close',
      cancel: 'Cancel',
    },
    dropToAdd: 'Drop a file or URL to add it',
    dropPathUnavailable: "Couldn't get the file path.\nDrag the file directly from File Explorer.",
    hints: {
      closeMarked: 'Close {{count}}',
      showMarkedOnAllDesktops: 'Show {{count}} on all desktops / undo',
      clearSelection: 'Clear selection',
      moveToDesktop: 'Move to virtual desktop',
      closeWindow: 'Close window',
      showOnAllDesktops: 'Show on all desktops / undo',
      selectMultiple: 'Select multiple',
      edit: 'Edit',
      openContainingFolder: 'Open containing folder',
      searchHistory: 'Search history',
      switchTab: 'Switch tab',
    },
    pinMode: {
      normal: 'Normal → Always on top',
      alwaysOnTop: 'Always on top → Stay visible',
      stayVisible: 'Stay visible → Normal',
    },
    refreshMenu: {
      title: 'Reload and fetch',
      reloadData: '📋 Reload data',
      fetchIconsCurrentTab: '🎨 Fetch icons (current tab)',
      fetchIconsAllTabs: '🎨 Fetch icons (all tabs)',
      importBookmarks: '🔖 Import bookmarks',
      reloadAll: '🔄 Full reload',
    },
    registerMenu: {
      title: 'Add item',
      quickAdd: '📄 Add item',
      addBookmarks: '🔖 Add browser bookmarks',
      addApps: '💻 Add installed apps',
    },
    settingsMenu: {
      title: 'Settings',
      settings: '⚙️ Settings',
      itemManager: '✏️ Item Manager (Ctrl+E)',
      toggleWorkspace: '🗂️ Show workspace (Ctrl+W)',
      quit: '🚪 Exit',
    },
    desktopTabs: {
      all: 'All',
      onAllDesktops: 'All desktops',
      current: '{{name}} (current)',
      allTooltip: 'Windows on every desktop',
      onAllDesktopsTooltip: 'Windows shown on all desktops',
      desktopTooltip: 'Windows on desktop {{number}}',
      namedDesktopTooltip: 'Windows on desktop {{number}} ("{{name}}")',
    },
    list: {
      selected: 'Selected',
      groupCount_one: ' ({{count}} item)',
      groupCount_other: ' ({{count}} items)',
      windowSearchBadge: 'Window search: {{title}}',
      showNote: 'Show note',
    },
    missingIcons: {
      label: 'Icons not fetched:',
      fetch: 'Fetch',
      fetchTooltip: 'Fetch icons',
    },
    iconProgress: {
      complete: 'Icons fetched',
      phase: 'Step {{current}}/{{total}}: {{name}}',
      phaseNames: {
        favicon: 'Fetching favicons',
        icon: 'Extracting icons',
        other: 'Processing',
      },
      succeeded: 'Succeeded: {{count}}',
      failed: 'Errors: {{count}}',
      total: 'Total: {{count}}',
      elapsed: 'Elapsed: {{time}}',
      remaining: 'Remaining: {{time}}',
      processing: 'Processing:',
      calculating: 'Calculating...',
      seconds: '{{seconds}} s',
      aboutSeconds: 'About {{seconds}} s',
      aboutMinutes: 'About {{minutes}} min {{seconds}} s',
    },
    iconResults: {
      title: 'Icon fetch results',
      succeeded: 'Succeeded:',
      failed: 'Errors:',
      total: 'Total:',
      filterAll: 'All ({{count}})',
      filterSucceeded: 'Succeeded ({{count}})',
      filterFailed: 'Errors ({{count}})',
      empty: 'No results',
    },
    tooltip: {
      dataFile: 'Data file: {{value}}',
      id: 'ID: {{value}}',
      expandedFromId: 'Imported from ID: {{value}}',
      lineNumber: 'Line: {{value}}',
      expandedFrom: 'Imported from: {{value}}',
      expandedOptions: 'Options: {{value}}',
      windowTitle: 'Window title: {{value}}',
      processName: 'Process name: {{value}}',
      executablePath: 'Executable path: {{value}}',
      windowState: 'State: {{value}}',
      windowStates: {
        minimized: 'Minimized',
        maximized: 'Maximized',
        normal: 'Normal',
      },
      position: 'Position: ({{x}}, {{y}})',
      size: 'Size: {{width}}x{{height}}',
      processId: 'Process ID: {{value}}',
      group: 'Group: {{value}}',
      virtualDesktop: 'Virtual desktop: {{value}}',
      noActivate: "Activate: don't",
      clipboardFormats: 'Formats: {{value}}',
      clipboardFormatNames: {
        text: 'Text',
        html: 'HTML',
        rtf: 'RTF',
        image: 'Image',
        file: 'File',
      },
      preview: 'Preview: {{value}}',
      savedAt: 'Saved: {{value}}',
    },
    messages: {
      itemAdded: 'Item added',
      itemUpdated: 'Item updated',
      itemDeleted: 'Item deleted',
      openFailed: "Couldn't open the item: {{reason}}",
      activateWindowFailed: "Couldn't switch to the window",
      noBookmarkRules: 'No bookmark import rules are turned on',
      addToWorkspaceFailed: "Couldn't add to the workspace",
      windowAddedWithPosition:
        'Finds the window by title and process name, then restores its saved position and brings it to the front',
      windowAdded:
        'Finds the window by title and process name and brings it to the front (you can edit the title)',
      dataFilesCreateFailed: "Couldn't create the data files for tabs: {{files}}",
      virtualDesktopUnsupported: "Virtual desktops aren't supported on this PC.",
      noContainingFolder: "This item doesn't have a containing folder",
      noContainingFolderNamed: '"{{name}}" doesn\'t have a containing folder',
    },
    itemActions: {
      targets: {
        path: 'path',
        parentPath: 'containing folder path',
        shortcutPath: 'shortcut path',
        shortcutParentPath: "shortcut's containing folder path",
      },
      copied: 'Copied the {{target}}',
      copyFailed: "Couldn't copy the {{target}}",
      noContainingFolderForUrl: "URLs and custom URIs don't have a containing folder",
      parentPathUnavailable: "Couldn't get the containing folder path",
      shortcutPathNotFound: "Couldn't find the shortcut path",
      shortcutParentPathUnavailable: "Couldn't get the shortcut's containing folder path",
      openContainingFolderFailed: "Couldn't open the containing folder",
      openShortcutContainingFolderFailed: "Couldn't open the shortcut's containing folder",
    },
    windowActions: {
      windowCount_one: '{{count}} window',
      windowCount_other: '{{count}} windows',
      failedWithReason: '{{label}}: {{reason}}',
      partlyFailed_one: ' ({{count}} failed)',
      partlyFailed_other: ' ({{count}} failed)',
      closeFailed: "Couldn't close the window",
      closed: 'Closed',
      showOnAllDesktopsFailed: "Couldn't show the window on all desktops",
      stopShowingOnAllDesktopsFailed: "Couldn't stop showing the window on all desktops",
      shownOnAllDesktops: 'Now shown on all desktops',
      stoppedShowingOnAllDesktops: 'No longer shown on all desktops',
      moveFailed: "Couldn't move the window",
      movedOneToDesktop: 'Moved to desktop {{desktop}}',
      movedManyToDesktop_one: 'Moved {{count}} window to desktop {{desktop}}',
      movedManyToDesktop_other: 'Moved {{count}} windows to desktop {{desktop}}',
      moved_one: 'Moved {{count}} window',
      moved_other: 'Moved {{count}} windows',
    },
  },
  bookmarkImport: {
    summary: 'Bookmark import: {{imported}} added, {{deleted}} deleted',
    manualDuplicates: ', {{count}} already added manually',
    partlyFailed: ' (some errors)',
    title: 'Bookmark import',
    added: '{{count}} added',
    deleted: ', {{count}} deleted',
    browserNotFound: "Couldn't find the browser {{browser}} or the selected profiles",
    failed: 'An error occurred during automatic bookmark import',
    dataFileCorrupted: 'Stopped the import because the data file may be corrupted: {{file}}',
  },
  firstLaunch: {
    title: 'Welcome to QuickDashLauncher',
    description: "Let's set up a few things first.",
    hotkeyLabel: 'Launch hotkey',
    hotkeyDescription: 'The keys that open the launcher (default: Alt+Space).',
    hotkeyHint: 'Combine a modifier key (Ctrl, Alt, Shift, and so on) with another key.',
    hotkeyExample: 'For example: Alt+Space, Ctrl+Alt+W, or Ctrl+Shift+L',
    windowSearchHotkeyLabel: 'Window search hotkey',
    windowSearchHotkeyDescription:
      'The keys that open the launcher directly in window search (default: Ctrl+Alt+Space).',
    windowSearchHotkeyHint:
      "If you don't need it, select Clear to remove it. You can change it later.",
    notSet: 'Not set',
    autoLaunch: 'Start with Windows',
    autoLaunchHint: 'Starts QuickDashLauncher when you sign in to Windows.',
    complete: 'Finish setup',
    saveFailed: "Couldn't save the settings.",
    defaultTabName: 'Main',
  },
  hotkeyInput: {
    placeholder: 'Enter a hotkey...',
    pressKeys: 'Press keys...',
    recording: 'Recording...',
    validationFailed: "Couldn't check the hotkey",
  },
  splash: {
    subtitle: 'Get to your apps, files, and sites fast',
    starting: 'Starting',
    loadingSettings: 'Loading settings',
    preparing: 'Getting ready',
    ready: 'Ready',
  },
  menu: {
    copyPath: '📋 Copy path',
    copyParentPath: '📋 Copy containing folder path',
    openParentFolder: '📂 Open containing folder',
    copyShortcutPath: '📋 Copy shortcut path',
    copyShortcutParentPath: "📋 Copy shortcut's containing folder path",
    openShortcutParentFolder: "📂 Open shortcut's containing folder",
    edit: '✏️ Edit',
    showNote: '📝 Show note',
    addToWorkspace: '⭐ Add to workspace',
    admin: {
      duplicate: '📋 Duplicate',
      duplicateRows_one: '📋 Duplicate ({{count}} row)',
      duplicateRows_other: '📋 Duplicate ({{count}} rows)',
      editDetails: '✏️ Edit details',
      delete: '🗑️ Delete',
      deleteRows_one: '🗑️ Delete ({{count}} row)',
      deleteRows_other: '🗑️ Delete ({{count}} rows)',
    },
    workspaceItem: {
      rename: '✏️ Rename',
      open: '▶️ Open',
      edit: '🔧 Edit',
      moveToWorkspace: '📁 Move to workspace',
      removeFromGroup: '📤 Remove from group',
      remove: '🗑️ Remove from workspace',
    },
    workspaceGroup: {
      copyAsText: '📋 Copy as text',
      restore: '📤 Restore to workspace',
      deleteFromArchive: '🗑️ Delete from archive',
      addSubgroup: '📂 Add subgroup',
      rename: '✏️ Rename group',
      changeColor: '🎨 Change color',
      archive: '📦 Archive group',
      delete: '🗑️ Delete group',
    },
    tab: {
      rename: '✏️ Rename',
      delete: '🗑️ Delete',
    },
    window: {
      activate: '▶️ Switch to',
      addToWorkspaceWithPosition: '⭐ Add to workspace with position and size',
      moveToDesktop: '🖥️ Move to virtual desktop',
      desktop: '🖥️ Desktop {{number}}',
      currentDesktop: '✓ Desktop {{number}} (current)',
      showOnAllDesktops: '📌 Show on all desktops',
      stopShowingOnAllDesktops: '📌 Stop showing on all desktops',
      close: '❌ Close window',
      count_one: '{{count}} window',
      count_other: '{{count}} windows',
      closeCount_one: '❌ Close {{count}} window',
      closeCount_other: '❌ Close {{count}} windows',
    },
  },
  tray: {
    show: 'Show',
    showAtCenter: 'Show at screen center',
    settings: 'Settings...',
    openSettingsFolder: 'Open settings folder',
    help: 'Help',
    restart: 'Restart',
    quit: 'Exit',
    devRestart: {
      title: 'Restart (development mode)',
      message: "Automatic restart isn't supported in development mode",
      detail:
        'After the app exits, run this command in a terminal:\n\n  npm run dev\n\nExit the app now?',
      quit: 'Exit',
    },
  },
  toast: {
    actions: {
      url: 'Opening URL...',
      app: 'Starting app...',
      file: 'Opening file...',
      folder: 'Opening folder...',
      customUri: 'Opening...',
      windowOperation: 'Running window action',
      layout: 'Applying window layout',
      windowActivate: 'Switched to the window',
      windowClose: 'Window closed',
      windowPin: 'Now shown on all desktops',
      windowUnpin: 'No longer shown on all desktops',
      workspaceAdd: 'Added to workspace',
      clipboard: 'Restoring to clipboard...',
      default: 'Opening...',
    },
    groupOpening_one: 'Opening {{count}} item',
    groupOpening_other: 'Opening {{count}} items',
    groupMore_one: '{{names}}... and {{count}} more',
    groupMore_other: '{{names}}... and {{count}} more',
  },
  hotkey: {
    invalid: {
      missing: 'No hotkey is set',
      format: "The hotkey isn't in a valid format",
      needKey: 'Add one regular key along with the modifier keys',
      needModifier: 'Add a modifier key (Ctrl, Alt, Shift, and so on)',
      oneKey: 'Use only one regular key',
    },
    launchLabel: 'launch hotkey',
    windowSearchLabel: 'window search hotkey',
    mayBeInUse: 'another app may be using it',
    notSet: 'not set',
    registerFailed:
      'Couldn\'t register the {{label}} "{{desired}}" ({{reason}}). Keeping "{{current}}".',
  },
  cli: {
    help: {
      main: `Usage: qdl <command> [arguments]

QuickDashLauncher CLI. Sends requests to the running QuickDashLauncher app, and starts the app if it isn't running.

Commands:
  launcher item list|add|update|remove     Items in the launcher (qdl launcher --help)
  workspace list                           List workspaces
  workspace item list|add|update|remove    Items in workspaces (qdl workspace --help)
  workspace group list|add|update|remove   Groups in workspaces
  check                                    Show the result of the last load (invalid entries, new IDs, outside changes) without reloading
  reload                                   Reload the settings files (same as F5 in the launcher)
  status                                   Show the app version, the settings folder, and more
  help                                     Show this help

Output: On success, JSON on standard output. On failure, {"error": {"code", "message", "candidates"?}} on
standard output and a description on standard error. code is usage / not_found / ambiguous / invalid / conflict / unavailable / internal.
Commands that write accept --dry-run to check the result without writing.

Exit codes: 0 success / 1 failure / 2 wrong command or target / 3 can't connect to the app / 4 CLI and app versions don't match
`,
      launcher: `Usage: qdl launcher item <action> [arguments]

Works with the items in the launcher (datafiles/data*.json).

Actions:
  list                     List items (--file <data2.json> | --tab <tab name>, --grep <text>)
  add                      Add an item (--name and --path are required. --args --memo, --file | --tab,
                           --type item|dir|group|window, --set key=value, --dry-run)
  update <id or name>      Change an item (--name --path --args --memo --set key=value --unset key --dry-run)
  remove <id or name>      Delete an item (--dry-run)

A relative --path is resolved from the folder where you run qdl. For --type dir|group|window, pass the
required fields with --set (for example --set itemNames='["Notes","Browser"]', --set windowTitle=Notepad).
`,
      workspace: `Usage: qdl workspace <target> <action> [arguments]

Works with workspaces (workspace.json).

  qdl workspace list                          List workspaces
  qdl workspace item list                     List items (--workspace --group --grep)
  qdl workspace item add                      Add an item (--name and --path are required. --args --memo --group
                                              --workspace --position <0-based> --set key=value --dry-run)
  qdl workspace item update <id or name>      Change an item (--name --path --args --memo --set --unset,
                                              --group <group> ("" for ungrouped) --workspace --position --dry-run)
  qdl workspace item remove <id or name>      Delete an item (--dry-run)
  qdl workspace group list                    List groups (--workspace --grep)
  qdl workspace group add                     Add a group (--name is required. --color --parent --workspace --dry-run)
  qdl workspace group update <id or name>     Change a group (--name --color --parent <parent> ("" for top level) --dry-run)
  qdl workspace group remove <id or name>     Delete an empty group (--dry-run)

--group, --parent, and --workspace take an id or an exact display name. --color is primary, success, danger,
warning, info, secondary, purple, teal, pink, indigo, orange, cyan, or #rrggbb. Groups can be nested two levels deep.
`,
      seeHelp: 'Run qdl help to see how to use it',
    },
    args: {
      missingValue: '--{{name}} needs a value',
      setFormat: 'Write --set as key=value: {{value}}',
      noValue: "--{{name}} doesn't take a value",
      duplicate: '--{{name}} is specified twice',
      unknownOption: 'Unknown option: --{{name}}',
      notInteger: '--{{name}} must be an integer: {{value}}',
      missingArg: 'Specify {{name}}',
      extraArgs: 'Too many arguments: {{args}}',
      idOrName: '<id or name>',
      idOrGroupName: '<id or name>',
    },
    errors: {
      relativePath: "Can't resolve the relative path (the current folder is unknown): {{value}}",
      setNotJson: "Can't read the --set value as JSON: {{value}}",
      setProtected: "--set can't change {{key}}",
      unsetProtected: "--unset can't remove {{key}}",
      fieldMissing: '{{key}} is missing (pass it with {{how}})',
      fieldInvalid: '{{key}} has an invalid value (use {{expected}})',
      invalidContent: 'The content is invalid: {{reason}}',
      unknownFields:
        'Fields not allowed for type {{type}}: {{fields}} (see the settings file format in the docs)',
      notFound: 'Couldn\'t find the {{what}} "{{key}}" (use the id or the exact display name)',
      ambiguous: '{{count}} matches for the {{what}} "{{key}}". Use the id',
      unknownCommand: 'Unknown command: {{command}}',
      unknownLauncherNoun: 'Unknown command: launcher {{noun}} (only launcher item)',
      unknownVerb: 'Unknown action: {{command}}',
      missingVerb: 'Specify an action (list / add / update / remove)',
      missingWorkspaceNoun: 'After workspace, specify list, item, or group',
      badJson: "Can't read the request as JSON",
      badShape: 'The request is malformed',
      versionMismatch:
        "The CLI and QuickDashLauncher versions don't match (CLI: {{cli}}, app: {{app}}). Use the qdl that comes with the same version of QuickDashLauncher",
      badArgv: 'The argv in the request is invalid',
      tooLarge: 'The request is too large',
      failed: 'The request failed: {{message}}',
      invalidItem: 'Invalid item',
      fileAndTab: 'Specify either --file or --tab, not both',
      noDataFile: "The data file {{file}} doesn't exist (existing: {{files}})",
      noTab: 'There\'s no tab "{{tab}}" (existing: {{tabs}})',
      noTabSimple: 'There\'s no tab "{{tab}}"',
      tabHasNoFile: 'The tab "{{tab}}" has no data file',
      badType: '--type must be one of {{types}}: {{type}}',
      dirHasNoName: "Folder imports (dir) don't have a display name",
      needName: 'Specify --name',
      needPath: 'Specify --path',
      argsOnlyItem: '--args can be used only with regular items (item)',
      typeNotEditable: "Items of type {{type}} can't be changed from the CLI (use the app instead)",
      needChanges: 'Specify what to change ({{options}})',
      noPath: "Type {{type}} doesn't have --path",
      noWorkspace: 'There are no workspaces',
      badColor: '--color is invalid: {{color}} (see qdl workspace --help for the list)',
      emptyName: '--name is empty',
      groupNotEmpty:
        'The group "{{name}}" isn\'t empty ({{items}} items, {{subgroups}} subgroups). Move or delete its contents first',
    },
    targets: {
      launcherItem: 'launcher item',
      workspace: 'workspace',
      group: 'group',
      workspaceItem: 'workspace item',
    },
    changed: {
      launcherAdded: 'CLI: Added "{{name}}" to the launcher',
      launcherUpdated: 'CLI: Changed "{{name}}" in the launcher',
      launcherRemoved: 'CLI: Deleted "{{name}}" from the launcher',
      workspaceItemAdded: 'CLI: Added "{{name}}" to the workspace',
      workspaceItemUpdated: 'CLI: Changed "{{name}}" in the workspace',
      workspaceItemRemoved: 'CLI: Deleted "{{name}}" from the workspace',
      groupAdded: 'CLI: Added the group "{{name}}" to the workspace',
      groupUpdated: 'CLI: Changed the group "{{name}}" in the workspace',
      groupRemoved: 'CLI: Deleted the group "{{name}}" from the workspace',
    },
    enabled: 'QuickDashLauncher CLI is turned on. Use qdl from a new terminal window.',
    disabled: 'QuickDashLauncher CLI is turned off (qdl was removed from PATH).',
  },
  display: {
    label: 'Display {{number}}',
    primary: 'Display {{number}} (primary)',
  },
  items: {
    containingFolderNotFound: "Couldn't find the containing folder",
  },
  layout: {
    cancelled: 'Canceled',
    timedOut: 'Timed out waiting for the window to appear',
    windowNotFound: "Couldn't find the window",
  },
  dataFile: {
    invalidName: 'The data file name is invalid',
    alreadyExists: 'The file already exists',
    createFailed: "Couldn't create the file: {{error}}",
    cannotDeleteMain: "The main data file can't be deleted",
    deleteFailed: "Couldn't delete the file: {{error}}",
  },
  settings: {
    language: {
      heading: 'Language',
      label: 'Display language:',
      description:
        'The language used in QuickDashLauncher. Changes apply right away to all open windows.',
      options: {
        auto: 'Automatic (match the Windows display language)',
        ja: '日本語',
        en: 'English',
      },
    },
  },
};
