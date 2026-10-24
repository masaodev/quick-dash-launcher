import { mainI18n } from '../mainI18n.js';

/**
 * グループのあるワークスペースへ、グループを指定せずにアイテムを足そうとした（A3-157）
 *
 * 未分類は無いので、どのグループに入れるかは利用者に選ばせる（画面ではその場で選ぶメニュー、CLI では --group）
 */
export class WorkspaceGroupRequiredError extends Error {
  constructor() {
    super(mainI18n.t('workspaceErrors.groupRequired'));
    this.name = 'WorkspaceGroupRequiredError';
  }
}
