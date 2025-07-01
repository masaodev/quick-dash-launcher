export interface LauncherItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'uri';
  icon?: string;
  args?: string;
}

export interface DataFile {
  name: string;
  content: string;
}