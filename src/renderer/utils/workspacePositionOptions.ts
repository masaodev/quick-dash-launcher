import type { WorkspacePositionMode } from '@common/types';

/** ワークスペースウィンドウの表示する場所の選択肢（値と、文言 settings.workspace.<文言キー>・<文言キー>Description） */
export const WORKSPACE_POSITION_OPTIONS = [
  { value: 'displayRight', text: 'rightEdge' },
  { value: 'displayLeft', text: 'leftEdge' },
  { value: 'fixed', text: 'fixed' },
] as const satisfies ReadonlyArray<{ value: WorkspacePositionMode; text: string }>;

export type WorkspacePositionOption = (typeof WORKSPACE_POSITION_OPTIONS)[number];

/** 古い値（primaryLeft・primaryRight）も、選択肢のどれかに読み替える */
export function toWorkspacePositionOption(mode: WorkspacePositionMode): WorkspacePositionOption {
  if (mode === 'primaryLeft') return WORKSPACE_POSITION_OPTIONS[1];
  if (mode === 'primaryRight') return WORKSPACE_POSITION_OPTIONS[0];
  return WORKSPACE_POSITION_OPTIONS.find((o) => o.value === mode) ?? WORKSPACE_POSITION_OPTIONS[0];
}
