import React, { useCallback } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import type { FieldPositionConfig, LineupEntry, Player, FieldSize } from '../types';
import { matchesPreferred } from '../data/formations';
import {
  getFieldChipMetrics,
  renderFieldPlayerLabel,
  useResponsiveFieldLayout,
} from './fieldRendering';

// Viewbox per field size (proportional to real KNHB dimensions)
// Full 91.4×55 → portrait 550×840  (ratio 0.655, real 0.602 — close enough)
// 3/4  68×55   → portrait 550×700
// Half 55×45.7 → portrait 550×457  (ratio 45.7/55 = 0.831 → 550×457)
// Small 43×25  → portrait 550×945  (ratio 43/25 = 1.72 → 550×946)
// Mini 23×23   → square   600×600
export const VIEWBOX: Record<FieldSize, { w: number; h: number }> = {
  full:            { w: 550, h: 840 },
  'three-quarter': { w: 550, h: 700 },
  half:            { w: 550, h: 457 },
  small:           { w: 550, h: 946 },
  mini:            { w: 600, h: 600 },
};

/** Renders just the field SVG background (lines, goals, D-zones) for a given
 * size. Optional `h`/`nh` overrides let callers use a stretched viewBox height
 * while keeping feature sizing (circles, goals) based on the natural height. */
export function FieldBackground({
  fieldSize,
  h: hOverride,
  nh: nhOverride,
}: {
  fieldSize: FieldSize;
  h?: number;
  nh?: number;
}) {
  const natural = VIEWBOX[fieldSize];
  const w = natural.w;
  const h = hOverride ?? natural.h;
  const nh = nhOverride ?? natural.h;
  switch (fieldSize) {
    case 'full':          return <FieldFull         w={w} h={h} nh={nh} />;
    case 'three-quarter': return <FieldThreeQuarter w={w} h={h} nh={nh} />;
    case 'half':          return <FieldHalf         w={w} h={h} nh={nh} />;
    case 'small':         return <FieldSmall        w={w} h={h} nh={nh} />;
    case 'mini':          return <FieldMini         w={w} h={h} nh={nh} />;
  }
}

const LINE = 'rgba(255,255,255,0.75)';
const LW   = 2;

// ── Full field  91.4×55m — both goals, center circle ────────────────────────
// `h` is the (possibly stretched) viewBox height; `nh` is the natural height
// used for feature sizing so circles and goals don't distort when stretched.
function FieldFull({ w, h, nh }: { w: number; h: number; nh: number }) {
  const dR = nh * 0.155;
  const dW = w * 0.62;
  const cR = nh * 0.048;
  const gW = w * 0.2;
  const gH = nh * 0.018;
  return (
    <>
      <rect width={w} height={h} fill="#1a6b3a" rx={3} />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={0} y={(i * h) / 8} width={w} height={h / 8}
          fill={i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'transparent'} />
      ))}
      <rect x={1} y={1} width={w-2} height={h-2} fill="none" stroke={LINE} strokeWidth={LW*1.5} />
      {/* Center */}
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke={LINE} strokeWidth={LW} />
      <circle cx={w/2} cy={h/2} r={cR} fill="none" stroke={LINE} strokeWidth={LW} />
      <circle cx={w/2} cy={h/2} r={LW*1.5} fill={LINE} />
      {/* D zones */}
      <path d={`M${w/2-dW/2} 0 Q${w/2} ${dR*1.45} ${w/2+dW/2} 0`}
        fill="rgba(255,255,255,0.05)" stroke={LINE} strokeWidth={LW} />
      <path d={`M${w/2-dW/2} ${h} Q${w/2} ${h-dR*1.45} ${w/2+dW/2} ${h}`}
        fill="rgba(255,255,255,0.05)" stroke={LINE} strokeWidth={LW} />
      {/* Goals */}
      <rect x={w/2-gW/2} y={0} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      <rect x={w/2-gW/2} y={h-gH} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* 25-yard lines — fixed distance from the goal lines */}
      <line x1={0} y1={nh*0.25} x2={w} y2={nh*0.25} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      <line x1={0} y1={h - nh*0.25} x2={w} y2={h - nh*0.25} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      {/* Penalty spots */}
      <circle cx={w/2} cy={nh*0.085} r={LW*1.8} fill={LINE} />
      <circle cx={w/2} cy={h - nh*0.085} r={LW*1.8} fill={LINE} />
    </>
  );
}

// ── 3/4 field  68×55m — O11 9v9 — GK goal bottom, open centre-line at top ───
function FieldThreeQuarter({ w, h, nh }: { w: number; h: number; nh: number }) {
  const dR = nh * 0.18;
  const dW = w * 0.62;
  const gW = w * 0.2;
  const gH = nh * 0.02;
  return (
    <>
      <rect width={w} height={h} fill="#1a6b3a" rx={3} />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={0} y={(i * h) / 6} width={w} height={h / 6}
          fill={i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'transparent'} />
      ))}
      <rect x={1} y={1} width={w-2} height={h-2} fill="none" stroke={LINE} strokeWidth={LW*1.5} />
      {/* Bottom D + goal (GK end) */}
      <path d={`M${w/2-dW/2} ${h} Q${w/2} ${h-dR*1.45} ${w/2+dW/2} ${h}`}
        fill="rgba(255,255,255,0.05)" stroke={LINE} strokeWidth={LW} />
      <rect x={w/2-gW/2} y={h-gH} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      <circle cx={w/2} cy={h - nh*0.08} r={LW*1.8} fill={LINE} />
      {/* 25-yard line — fixed distance from the GK end */}
      <line x1={0} y1={h - nh*0.34} x2={w} y2={h - nh*0.34} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      {/* Centre-line of full field at top */}
      <text x={w/2} y={nh*0.04} textAnchor="middle" fill="rgba(255,255,255,0.35)"
        fontSize={LW*8} fontFamily="sans-serif">MIDDELLIJN</text>
    </>
  );
}

// ── Half field  55×45.7m — O10 8v8 — portrait, GK bottom, FWD top ───────────
// The full-field sidelines become the goal lines; played bottom to top.
function FieldHalf({ w, h, nh }: { w: number; h: number; nh: number }) {
  // D arc: radius 14.63m of 45.7m = 32% of height from each goal line
  const dR    = nh * 0.32;
  const dW    = w * 0.62;
  const gW    = w * 0.20;  // goal width (visual, same as full/3-4 field)
  const gH    = nh * 0.025; // goal depth visual
  const pSpot = nh * 0.14;  // penalty spot: 6.4m / 45.7m from goal line
  return (
    <>
      <rect width={w} height={h} fill="#1a6b3a" rx={3} />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={0} y={(i * h) / 6} width={w} height={h / 6}
          fill={i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'transparent'} />
      ))}
      <rect x={1} y={1} width={w-2} height={h-2} fill="none" stroke={LINE} strokeWidth={LW*1.5} />
      {/* Centre line (≈23m from each end, almost exactly h/2 for 45.7m field) */}
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      {/* Bottom D (GK end) */}
      <path d={`M${w/2-dW/2} ${h} Q${w/2} ${h-dR*1.45} ${w/2+dW/2} ${h}`}
        fill="rgba(255,255,255,0.05)" stroke={LINE} strokeWidth={LW} />
      {/* Top D (attacking end) */}
      <path d={`M${w/2-dW/2} 0 Q${w/2} ${dR*1.45} ${w/2+dW/2} 0`}
        fill="rgba(255,255,255,0.05)" stroke={LINE} strokeWidth={LW} />
      {/* Bottom goal (GK end) */}
      <rect x={w/2-gW/2} y={h-gH} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* Top goal (attacking end) */}
      <rect x={w/2-gW/2} y={0} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* Penalty spots */}
      <circle cx={w/2} cy={h - pSpot} r={LW*1.8} fill={LINE} />
      <circle cx={w/2} cy={pSpot}     r={LW*1.8} fill={LINE} />
    </>
  );
}

// ── Small field  43×25m — O9 6v6 — portrait, GK bottom, 10m scoring zone ────
function FieldSmall({ w, h, nh }: { w: number; h: number; nh: number }) {
  // 10m zone: 10/43 = 23.3% of field height from each end
  const zone = nh * (10 / 43);
  const gW   = w * 0.36;   // goal width (~9m of 25m)
  const gH   = nh * 0.015;
  return (
    <>
      <rect width={w} height={h} fill="#1a6b3a" rx={3} />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={0} y={(i * h) / 6} width={w} height={h / 6}
          fill={i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'transparent'} />
      ))}
      <rect x={1} y={1} width={w-2} height={h-2} fill="none" stroke={LINE} strokeWidth={LW*1.5} />
      {/* Bottom 10m scoring zone (GK end) */}
      <rect x={1} y={h - zone} width={w-2} height={zone - 1}
        fill="rgba(255,255,255,0.04)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* Top 10m scoring zone (attacking end) */}
      <rect x={1} y={1} width={w-2} height={zone}
        fill="rgba(255,255,255,0.04)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* Bottom goal (GK end) */}
      <rect x={w/2-gW/2} y={h-gH} width={gW} height={gH}
        fill="rgba(255,255,255,0.2)" stroke={LINE} strokeWidth={LW*0.8} />
      {/* 10m zone labels */}
      <text x={w*0.98} y={h - zone + 12} textAnchor="end"
        fill="rgba(255,255,255,0.4)" fontSize={LW*7} fontFamily="sans-serif">10m zone</text>
      <text x={w*0.98} y={zone - 4} textAnchor="end"
        fill="rgba(255,255,255,0.4)" fontSize={LW*7} fontFamily="sans-serif">10m zone</text>
      {/* Centre dot */}
      <circle cx={w/2} cy={h/2} r={LW*2} fill={LINE} />
    </>
  );
}

// ── Mini field  23×23m — O8 3v3 — square, 3 goals per back line, no GK ──────
function FieldMini({ w, h, nh }: { w: number; h: number; nh: number }) {
  // 3 goals per line: 3.5m | 2m | 5m | 2m | 5m | 2m | 3.5m = 23m
  // Goal centers at 4.5/23 = 19.6%, 11.5/23 = 50%, 18.5/23 = 80.4%
  const goalCenters = [w * 0.196, w * 0.5, w * 0.804];
  const goalW = w * (2 / 23); // 2m goal width
  const goalD = nh * 0.028;   // visual goal depth
  return (
    <>
      <rect width={w} height={h} fill="#1a6b3a" rx={3} />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={(i * w) / 6} y={0} width={w / 6} height={h}
          fill={i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'transparent'} />
      ))}
      <rect x={1} y={1} width={w-2} height={h-2} fill="none" stroke={LINE} strokeWidth={LW*1.5} />
      {/* Centre cross */}
      <line x1={0} y1={h/2} x2={w} y2={h/2} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      <line x1={w/2} y1={0} x2={w/2} y2={h} stroke={LINE} strokeWidth={LW*0.7} strokeDasharray="8 6" />
      <circle cx={w/2} cy={h/2} r={LW*2} fill={LINE} />
      {/* 3 goals at TOP */}
      {goalCenters.map((cx, i) => (
        <rect key={`t${i}`} x={cx - goalW/2} y={0} width={goalW} height={goalD}
          fill="rgba(255,255,255,0.25)" stroke={LINE} strokeWidth={LW*0.8} />
      ))}
      {/* 3 goals at BOTTOM */}
      {goalCenters.map((cx, i) => (
        <rect key={`b${i}`} x={cx - goalW/2} y={h - goalD} width={goalW} height={goalD}
          fill="rgba(255,255,255,0.25)" stroke={LINE} strokeWidth={LW*0.8} />
      ))}
    </>
  );
}

// ── Position node — droppable + optionally draggable ─────────────────────────
interface PosZoneProps {
  config: FieldPositionConfig;
  entry: LineupEntry;
  player: Player | null;
  fieldW: number;
  fieldH: number;
  naturalH: number;
  subCount?: number;
  disableDrag?: boolean;
  isSubstitutionTarget?: boolean;
  isPreferredPosition?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

function PositionDropZone({
  config, entry, player, fieldW, fieldH, naturalH,
  subCount = 0,
  disableDrag = false,
  isSubstitutionTarget = false,
  isPreferredPosition = false,
  isSelected = false,
  onClick,
}: PosZoneProps) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `position-${config.id}`,
    data: { positionId: config.id, isPosition: true, currentPlayerId: entry.playerId },
  });
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({
    id: `field-${config.id}`,
    data: { playerId: entry.playerId, isOnField: true, sourcePositionId: config.id },
    disabled: disableDrag || !entry.playerId,
  });
  const setRef = useCallback(
    (node: HTMLDivElement | null) => { setDropRef(node); setDragRef(node); },
    [setDropRef, setDragRef]
  );

  // Size chips based on natural (non-stretched) field dimensions so they stay
  // consistent regardless of vertical stretching on narrow screens.
  const { chipRadius: r, fontSize } = getFieldChipMetrics(fieldW, naturalH);
  const cx    = (config.x / 100) * fieldW;
  const cy    = (config.y / 100) * fieldH;
  const foPx  = r * 2 + 12;

  const fill = isDragging
    ? 'rgba(255,255,255,0.06)'
    : isSelected
    ? '#1565c0'
    : isOver
    ? 'rgba(96,165,250,0.55)'
    : isSubstitutionTarget
    ? '#ff6b35'
    : player
    ? '#1565c0'
    : isPreferredPosition
    ? 'rgba(13,58,140,0.75)'
    : 'rgba(255,255,255,0.28)';

  const stroke = isSelected
    ? '#93c5fd'
    : isOver
    ? '#93c5fd'
    : isSubstitutionTarget
    ? '#ff6b35'
    : isPreferredPosition
    ? '#93c5fd'
    : player
    ? '#93c5fd'
    : 'rgba(255,255,255,0.35)';

  const strokeW = isSelected || isOver || isSubstitutionTarget ? 3
    : isPreferredPosition ? 2.5
    : 2;

  return (
    <g>
      {isSelected && (
        <circle cx={cx} cy={cy} r={r + 4}
          fill="none"
          stroke="#93c5fd" strokeWidth={6} opacity={0.35}
          filter="url(#glow-selected)"
        />
      )}
      <circle cx={cx} cy={cy} r={r}
        fill={fill} fillOpacity={isDragging ? 0.15 : 1}
        stroke={stroke} strokeWidth={strokeW}
        />

      {/* Preferred ring on occupied positions — hide during drag */}
      {isPreferredPosition && (
        <circle cx={cx} cy={cy} r={r + 5}
          fill="none" stroke="#93c5fd" strokeWidth={2} strokeDasharray="6 3" opacity={0.9} />
      )}
      {/* Substitution count badge, matching the bench pattern in a single badge */}
      {subCount > 0 && player && (
        <>
          <circle cx={cx + r * 0.72} cy={cy - r * 0.72} r={r * 0.48}
            fill="#0d3a8c" stroke="#60a5fa" strokeWidth={1.5} />
          <text x={cx + r * 0.72} y={cy - r * 0.72}
            textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={r * 0.3} fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>
            {`${subCount}↕`}
          </text>
        </>
      )}

      {player ? (
        renderFieldPlayerLabel({ name: player.name, cx, cy, fontSize })
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fill={isPreferredPosition ? '#93c5fd' : 'rgba(255,255,255,0.6)'}
          fontSize={fontSize} fontWeight="bold"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {config.label}
        </text>
      )}

      <foreignObject x={cx - foPx/2} y={cy - foPx/2} width={foPx} height={foPx}
        style={{ overflow: 'visible', pointerEvents: 'all' }}>
        <div
          // @ts-expect-error xmlns required
          xmlns="http://www.w3.org/1999/xhtml"
          ref={setRef}
          style={{
            width: '100%', height: '100%', borderRadius: '50%',
            cursor: onClick ? 'pointer' : (!disableDrag && entry.playerId) ? (isDragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
          }}
          {...(!disableDrag && entry.playerId ? listeners : {})}
          {...(!disableDrag && entry.playerId ? attributes : {})}
          onClick={onClick}
        />
      </foreignObject>
    </g>
  );
}

// ── Public component ─────────────────────────────────────────────────────────
interface FieldCanvasProps {
  positions: FieldPositionConfig[];
  lineup: LineupEntry[];
  players: Player[];
  fieldSize: FieldSize;
  subCounts?: Map<string, number>;
  disableDrag?: boolean;
  substitutionTargetId?: string | null;
  preferredPositionLabels?: string[];
  className?: string;
  selectedPositionId?: string | null;
  onPositionClick?: (positionId: string, playerId: string | null) => void;
  onTacticsClick?: () => void;
}

export function FieldCanvas({
  positions, lineup, players, fieldSize,
  subCounts,
  disableDrag = false,
  substitutionTargetId = null,
  preferredPositionLabels = [],
  className = '',
  selectedPositionId = null,
  onPositionClick,
  onTacticsClick,
}: FieldCanvasProps) {
  const { w: baseFW, h: baseFH } = VIEWBOX[fieldSize];
  const FW = baseFW;
  const layout = useResponsiveFieldLayout(baseFW, baseFH);
  const FH = layout.FH;

  const playerMap = React.useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  return (
    <div ref={layout.containerRef} className={`field-canvas ${className}`}>
      {onTacticsClick && (
        <button
          type="button"
          className="match-day__tactics-btn"
          title="Tactiekbord"
          onClick={onTacticsClick}
          style={{ top: layout.offsetY + 8, right: layout.offsetX + 8 }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="M8 10 L14 14" />
            <path d="M11 13 L14 14 L13 11" />
          </svg>
        </button>
      )}
      <svg viewBox={`0 0 ${FW} ${FH}`} preserveAspectRatio="xMidYMid meet"
        className="field-canvas__svg" style={{ width: '100%' }}>
        <defs>
          <filter id="glow-selected" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <FieldBackground fieldSize={fieldSize} h={FH} nh={baseFH} />
        {positions.map((pos) => {
          const entry = lineup.find((e) => e.positionId === pos.id);
          if (!entry) return null;
          const player = entry.playerId ? playerMap.get(entry.playerId) ?? null : null;
          return (
            <PositionDropZone
              key={pos.id}
              config={pos} entry={entry} player={player}
              fieldW={FW} fieldH={FH} naturalH={baseFH}
              subCount={entry.playerId ? (subCounts?.get(entry.playerId) ?? 0) : 0}
              disableDrag={disableDrag}
              isSubstitutionTarget={substitutionTargetId === pos.id}
              isPreferredPosition={matchesPreferred(pos.label, preferredPositionLabels)}
              isSelected={selectedPositionId === pos.id}
              onClick={onPositionClick ? () => onPositionClick(pos.id, entry.playerId) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
