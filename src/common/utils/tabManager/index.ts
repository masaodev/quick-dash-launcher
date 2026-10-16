// エクスポート
export { FileNameGenerator } from './fileNameGenerator';
export { TabValidator } from './tabValidator';
export type { ValidationResult } from './tabValidator';
export { TabStateCalculator } from './tabStateCalculator';
export type { SavedTabState, PendingFileOperations, FileDeletionType } from './tabStateCalculator';
export * as TabStructureEdits from './tabStructureEdits';
export type { TabStructure, TabStructureEdit, MoveDirection } from './tabStructureEdits';
export { setTabManagerTranslator } from './translate';
export type { TabManagerTranslate } from './translate';
