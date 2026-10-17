/**
 * ウィンドウ位置の図（ミニマップ）
 *
 * 今つながっている画面を実物の大きさと並びのまま縮め、記録したウィンドウ位置を重ねて描く。
 * 言葉（📍 画面 1・右寄り …）の横に添えて使い、マウスを乗せる（キーボードで選ぶ）と大きな図を出す。
 * 大きな図はモーダルやスクロールする一覧の外にはみ出してよいよう、body に出す。
 * 画面仕様: docs/screens/register-modal.md#ウィンドウ位置の図
 */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { WindowInfo } from '@common/types';
import type { ScreenArea } from '@common/utils/placementLabel';
import {
  computeMinimapLayout,
  hasPlacementRect,
  type MapPlacementInput,
} from '@common/utils/placementMap';
import { placementFromWindow } from '@common/utils/setWindowMatching';

import { windowPlacementText } from '../utils/setEditing';

import '../styles/components/PlacementMinimap.css';

/** 大きさ。tiny＝一覧の 1 行、small＝編集画面の欄、medium＝セット全体、large＝マウスを乗せたとき */
export type MinimapSize = 'tiny' | 'small' | 'medium' | 'large';

/** 図の大きさの上限。tiny と large の幅は variables.css の --minimap-tiny-width・--minimap-large-width と同じ値にする */
const SIZES: Record<MinimapSize, { width: number; height: number }> = {
  tiny: { width: 56, height: 28 },
  small: { width: 200, height: 80 },
  medium: { width: 360, height: 150 },
  large: { width: 420, height: 200 },
};

interface MinimapSvgProps {
  screens: readonly ScreenArea[];
  placements: readonly MapPlacementInput[];
  size: MinimapSize;
  /** この番号（placements の添字）のウィンドウだけを濃く描く */
  highlight?: number | null;
  label: string;
}

/** 図そのもの（SVG） */
export const MinimapSvg: React.FC<MinimapSvgProps> = ({
  screens,
  placements,
  size,
  highlight,
  label,
}) => {
  const tiny = size === 'tiny';
  // 一覧の極小の図は行をそろえるため決まった大きさ、それ以外は中身の縦横比に合わせて縮める
  const layout = computeMinimapLayout(
    screens,
    placements,
    SIZES[size].width,
    SIZES[size].height,
    tiny ? 1 : 3,
    !tiny
  );
  if (!layout) return null;
  const { width, height } = layout;
  const showScreenNumbers = !tiny && layout.screens.length > 1;
  return (
    <svg
      className={`placement-minimap placement-minimap-${size}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {layout.screens.map((s) => (
        <g key={s.number}>
          <rect
            className={`pm-screen${s.active ? ' pm-screen-active' : ''}`}
            x={s.x}
            y={s.y}
            width={s.width}
            height={s.height}
            rx={tiny ? 0.5 : 1.5}
          />
          {s.outside.map((o, i) => (
            <rect
              key={i}
              className="pm-outside"
              x={o.x}
              y={o.y}
              width={o.width}
              height={o.height}
            />
          ))}
          {showScreenNumbers && (
            <text
              className="pm-screen-number"
              x={s.x + 3}
              y={s.y + 3}
              fontSize={Math.max(9, Math.min(14, Math.min(s.width, s.height) * 0.3))}
              dominantBaseline="hanging"
            >
              {s.number}
            </text>
          )}
        </g>
      ))}
      {layout.windows.map((w) => {
        const dim = highlight !== undefined && highlight !== null && highlight !== w.index;
        const cls = w.offscreen
          ? 'pm-window pm-window-offscreen'
          : w.variant === 'before'
            ? 'pm-window pm-window-before'
            : 'pm-window';
        return (
          <g key={w.index} className={dim ? 'pm-dim' : undefined}>
            <rect className={cls} x={w.x} y={w.y} width={w.width} height={w.height} />
            {!tiny && !w.offscreen && w.variant === 'current' && (
              <rect
                className="pm-titlebar"
                x={w.x}
                y={w.y}
                width={w.width}
                height={Math.min(3, w.height)}
              />
            )}
            {w.tag && !tiny && (
              <text
                className="pm-window-number"
                x={w.x + w.width / 2}
                y={w.y + w.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {w.tag}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

interface PlacementMinimapProps extends Omit<MinimapSvgProps, 'size'> {
  size: Exclude<MinimapSize, 'large'>;
  /** マウスを乗せたとき大きな図の下に添える言葉 */
  caption?: string;
}

/**
 * 図と、マウスを乗せたときの大きな図
 *
 * 画面の情報が取れていないときは何も出さない（言葉だけになる）
 */
const PlacementMinimap: React.FC<PlacementMinimapProps> = ({ caption, ...props }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 大きな図は、下に収まらなければ上に、左右は画面の中に収める
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const p = popRef.current.getBoundingClientRect();
    const margin = 6;
    const below = t.bottom + margin;
    const top =
      below + p.height <= window.innerHeight ? below : Math.max(margin, t.top - margin - p.height);
    const left = Math.min(Math.max(margin, t.left), window.innerWidth - p.width - margin);
    setPos({ left, top });
  }, [open]);

  // 出したままスクロール・ドラッグすると、大きな図だけが元の場所に残るので閉じる
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const options = { capture: true, passive: true };
    window.addEventListener('scroll', close, options);
    window.addEventListener('wheel', close, options);
    window.addEventListener('dragstart', close, options);
    return () => {
      window.removeEventListener('scroll', close, options);
      window.removeEventListener('wheel', close, options);
      window.removeEventListener('dragstart', close, options);
    };
  }, [open]);

  if (props.screens.length === 0) return null;
  return (
    <span
      ref={triggerRef}
      className="placement-minimap-trigger"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <MinimapSvg {...props} />
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="placement-minimap-popover"
            style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
            role="tooltip"
          >
            <MinimapSvg {...props} size="large" />
            {caption && <div className="placement-minimap-caption">{caption}</div>}
          </div>,
          document.body
        )}
    </span>
  );
};

/** 開いているウィンドウの今の位置の極小の図（ウィンドウを追加・ウィンドウを選ぶの 2 段目） */
export const WindowMinimap: React.FC<{
  window: WindowInfo;
  screens: readonly ScreenArea[];
  desktopCount: number;
  /** 仮想デスクトップの名前（隣の言葉と同じく、大きな図の言葉にも添える） */
  desktopNames?: Readonly<Record<number, string | undefined>>;
}> = ({ window: w, screens, desktopCount, desktopNames }) => {
  const text = windowPlacementText(w, screens, desktopCount, desktopNames);
  return (
    <PlacementMinimap
      screens={screens}
      placements={[{ placement: placementFromWindow(w, desktopCount) }]}
      size="tiny"
      label={text}
      caption={text}
    />
  );
};

/** セット全体の図の操作（行にマウスが乗ったとき、その行の位置だけを濃くする） */
export interface SetPlacementMapHandle {
  /** placements の添字。null か、位置の無い行なら強調を外す */
  highlight: (index: number | null) => void;
}

/**
 * セット全体の図（行の一覧の上）
 *
 * 強調する行はこの中だけで持ち、行の一覧（親）を描き直さない。行が増減・並べ替わる（placements が変わる）と
 * 強調は外れる（消した行に乗せたままだと mouseleave が来ないため）
 */
export const SetPlacementMap = forwardRef<
  SetPlacementMapHandle,
  { screens: readonly ScreenArea[]; placements: readonly MapPlacementInput[]; label: string }
>(({ screens, placements, label }, ref) => {
  const [hovered, setHovered] = useState<{
    placements: readonly MapPlacementInput[];
    index: number;
  } | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      highlight: (index) =>
        setHovered(
          index !== null && hasPlacementRect(placements[index]?.placement)
            ? { placements, index }
            : null
        ),
    }),
    [placements]
  );
  const highlight = hovered && hovered.placements === placements ? hovered.index : null;
  return (
    <MinimapSvg
      screens={screens}
      placements={placements}
      size="medium"
      highlight={highlight}
      label={label}
    />
  );
});
SetPlacementMap.displayName = 'SetPlacementMap';

export default PlacementMinimap;
