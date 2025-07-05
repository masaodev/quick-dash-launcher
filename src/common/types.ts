export interface LauncherItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  icon?: string;
  args?: string;
  originalPath?: string;
}

export interface DataFile {
  name: string;
  content: string;
}