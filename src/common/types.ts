export interface LauncherItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  icon?: string;
  args?: string;
  originalPath?: string;
  sourceFile?: 'data.txt' | 'data2.txt' | 'tempdata.txt';
  lineNumber?: number;
  isDirExpanded?: boolean;
  isEdited?: boolean;
}

export interface DataFile {
  name: string;
  content: string;
}

export interface RawDataLine {
  lineNumber: number;
  content: string;
  type: 'directive' | 'item' | 'comment' | 'empty';
  sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
}

export interface SimpleBookmarkItem {
  id: string;
  name: string;
  url: string;
  checked: boolean;
}