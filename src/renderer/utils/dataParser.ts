import { LauncherItem, DataFile } from '../../common/types';

export function parseDataFiles(dataFiles: DataFile[]): {
  mainItems: LauncherItem[];
  tempItems: LauncherItem[];
} {
  const mainItems: LauncherItem[] = [];
  const tempItems: LauncherItem[] = [];
  const seenPaths = new Set<string>();

  dataFiles.forEach((file) => {
    const lines = file.content.split('\n');
    const items = file.name === 'tempdata.txt' ? tempItems : mainItems;
    const sourceFile = file.name as 'data.txt' | 'data2.txt' | 'tempdata.txt';

    lines.forEach((line, index) => {
      line = line.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('//')) {
        return;
      }

      // Skip dir directives (already processed in main process)
      if (line.startsWith('dir,')) {
        return;
      }

      const parts = parseCSVLine(line);
      if (parts.length < 2) {
        return;
      }

      const [name, itemPath, argsField, originalPathField] = parts;

      // Skip duplicates - check path + args combination
      const uniqueKey = argsField ? `${itemPath}|${argsField}` : itemPath;
      if (seenPaths.has(uniqueKey)) {
        return;
      }
      seenPaths.add(uniqueKey);

      const item: LauncherItem = {
        name,
        path: itemPath,
        type: detectItemType(itemPath),
        args: argsField && argsField.trim() ? argsField : undefined,
        originalPath: originalPathField && originalPathField.trim() ? originalPathField : undefined,
        sourceFile,
        lineNumber: index + 1,
        isDirExpanded: false,
        isEdited: false,
      };

      items.push(item);
    });
  });

  // Sort items by name
  mainItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  tempItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return { mainItems, tempItems };
}

function detectItemType(itemPath: string): LauncherItem['type'] {
  // URLs
  if (itemPath.includes('://')) {
    // Check for custom URI schemes
    const scheme = itemPath.split('://')[0];
    if (!['http', 'https', 'ftp'].includes(scheme)) {
      return 'customUri';
    }
    return 'url';
  }

  // Shell paths
  if (itemPath.startsWith('shell:')) {
    return 'folder';
  }

  // File extensions
  const lastDot = itemPath.lastIndexOf('.');
  const ext = lastDot !== -1 ? itemPath.substring(lastDot).toLowerCase() : '';

  // Executables and shortcuts
  if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.com' || ext === '.lnk') {
    return 'app';
  }

  // Check if it's likely a directory
  if (!ext || itemPath.endsWith('/') || itemPath.endsWith('\\')) {
    return 'folder';
  }

  // Default to file
  return 'file';
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  if (current || inQuotes) {
    result.push(current.trim());
  }

  return result;
}

export function filterItems(items: LauncherItem[], query: string): LauncherItem[] {
  if (!query) {
    return items;
  }

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return items.filter((item) => {
    const itemText = item.name.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });
}
