import { LauncherItem, DataFile } from '../../common/types';

export function parseDataFiles(dataFiles: DataFile[]): {
  mainItems: LauncherItem[];
  tempItems: LauncherItem[];
} {
  const mainItems: LauncherItem[] = [];
  const tempItems: LauncherItem[] = [];
  const seenPaths = new Set<string>();

  dataFiles.forEach(file => {
    const lines = file.content.split('\n');
    const items = file.name === 'tempdata.txt' ? tempItems : mainItems;

    lines.forEach(line => {
      line = line.trim();
      
      if (shouldSkipLine(line)) {
        return;
      }

      const parts = parseCSVLine(line);
      if (parts.length < 2) {
        return;
      }

      const [name, itemPath, ...args] = parts;
      
      // Skip duplicates
      if (seenPaths.has(itemPath)) {
        return;
      }
      seenPaths.add(itemPath);

      const item: LauncherItem = {
        name,
        path: itemPath,
        type: detectItemType(itemPath),
        args: args.length > 0 ? args.join(' ') : undefined,
      };

      items.push(item);
    });
  });

  // Sort items by name
  mainItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  tempItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return { mainItems, tempItems };
}

function shouldSkipLine(line: string): boolean {
  return !line || line.startsWith('//') || line.startsWith('dir,');
}

function detectItemType(itemPath: string): LauncherItem['type'] {
  if (itemPath.includes('://')) {
    const scheme = itemPath.split('://')[0];
    const webSchemes = ['http', 'https', 'ftp'];
    return webSchemes.includes(scheme) ? 'url' : 'uri';
  }

  // Shell paths
  if (itemPath.startsWith('shell:')) {
    return 'folder';
  }

  const ext = getFileExtension(itemPath);
  
  const executableExtensions = ['.exe', '.bat', '.cmd', '.com'];
  if (executableExtensions.includes(ext)) {
    return 'app';
  }

  // Check if it's likely a directory
  if (!ext || itemPath.endsWith('/') || itemPath.endsWith('\\')) {
    return 'folder';
  }

  // Default to file
  return 'file';
}

function getFileExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot !== -1 ? path.substring(lastDot).toLowerCase() : '';
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

  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);

  return items.filter(item => {
    const itemText = item.name.toLowerCase();
    return keywords.every(keyword => itemText.includes(keyword));
  });
}