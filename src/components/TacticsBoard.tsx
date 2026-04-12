import { useCallback, useMemo, useRef, useState } from 'react';
import type { FieldPositionConfig, FieldSize, LineupEntry, Player } from '../types';
import { FieldBackground, VIEWBOX } from './FieldCanvas';
import {
  getFieldChipMetrics,
  renderFieldPlayerLabel,
  useResponsiveFieldLayout,
} from './fieldRendering';
import { shortId } from '../utils/id';
import {
  CHIP_FILL, CHIP_STROKE,
  ARROW_COLOR, ARROW_SELECTED, ARROW_DELETE_FILL, ARROW_DELETE_STROKE,
} from './fieldColors';

interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Chip {
  playerId: string;
  name: string;
  x: number; // SVG coords
  y: number;
}

interface TacticsBoardProps {
  positions: FieldPositionConfig[];
  lineup: LineupEntry[];
  players: Player[];
  fieldSize: FieldSize;
  onClose: () => void;
}

type Interaction =
  | { kind: 'none' }
  | { kind: 'drawing'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'dragging-chip'; playerId: string; offsetX: number; offsetY: number };

export function TacticsBoard({ positions, lineup, players, fieldSize, onClose }: TacticsBoardProps) {
  const baseFW = VIEWBOX[fieldSize].w;
  const baseFH = VIEWBOX[fieldSize].h;
  const FW = baseFW;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [FH, setFH] = useState(baseFH);

  // Snapshot chips from current lineup (only positions with a player).
  // Computed from the current FH so clearAll() always snaps back to the
  // correct positions for the current stretched viewBox.
  const initialChips = useMemo<Chip[]>(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const chips: Chip[] = [];
    for (const pos of positions) {
      const entry = lineup.find((e) => e.positionId === pos.id);
      if (!entry?.playerId) continue;
      const player = playerMap.get(entry.playerId);
      if (!player) continue;
      chips.push({
        playerId: player.id,
        name: player.name,
        x: (pos.x / 100) * FW,
        y: (pos.y / 100) * FH,
      });
    }
    return chips;
  }, [positions, lineup, players, FW, FH]);

  const [chips, setChips]       = useState<Chip[]>(initialChips);
  const [arrows, setArrows]     = useState<Arrow[]>([]);
  const [selectedArrowId, setSelectedArrowId] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'none' });

  const handleFieldHeightChange = useCallback((prevFH: number, nextFH: number) => {
    const scaleY = nextFH / prevFH;
    setFH(nextFH);
    setChips((list) => list.map((c) => ({ ...c, y: c.y * scaleY })));
    setArrows((list) => list.map((a) => ({ ...a, y1: a.y1 * scaleY, y2: a.y2 * scaleY })));
  }, []);

  const layout = useResponsiveFieldLayout(baseFW, baseFH, {
    onHeightChange: handleFieldHeightChange,
  });

  // Match chip sizing to the setup/match fields and keep it based on the
  // natural field so chips don't balloon when the viewBox stretches vertically.
  const { chipRadius: chipR, fontSize } = getFieldChipMetrics(FW, baseFH);

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function handlePointerDownOnField(e: React.PointerEvent<SVGRectElement>) {
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedArrowId(null);
    setInteraction({ kind: 'drawing', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }

  function handlePointerDownOnChip(e: React.PointerEvent<SVGGElement>, chip: Chip) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedArrowId(null);
    setInteraction({
      kind: 'dragging-chip',
      playerId: chip.playerId,
      offsetX: p.x - chip.x,
      offsetY: p.y - chip.y,
    });
  }

  function handlePointerDownOnArrow(e: React.PointerEvent, arrow: Arrow) {
    e.stopPropagation();
    setSelectedArrowId((prev) => (prev === arrow.id ? null : arrow.id));
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (interaction.kind === 'none') return;
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;

    if (interaction.kind === 'drawing') {
      setInteraction({ ...interaction, x2: p.x, y2: p.y });
    } else if (interaction.kind === 'dragging-chip') {
      const nx = Math.max(chipR, Math.min(FW - chipR, p.x - interaction.offsetX));
      const ny = Math.max(chipR, Math.min(FH - chipR, p.y - interaction.offsetY));
      setChips((prev) =>
        prev.map((c) => (c.playerId === interaction.playerId ? { ...c, x: nx, y: ny } : c))
      );
    }
  }

  function handlePointerUp() {
    if (interaction.kind === 'drawing') {
      const { x1, y1, x2, y2 } = interaction;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Only commit if the drag was long enough to be intentional
      if (dist > 8) {
        setArrows((prev) => [...prev, { id: shortId(8), x1, y1, x2, y2 }]);
      }
    }
    setInteraction({ kind: 'none' });
  }

  function deleteArrow(id: string) {
    setArrows((prev) => prev.filter((a) => a.id !== id));
    setSelectedArrowId(null);
  }

  function clearAll() {
    setArrows([]);
    setChips(initialChips);
    setSelectedArrowId(null);
  }

  const previewArrow = interaction.kind === 'drawing' ? interaction : null;
  const selectedArrow = arrows.find((a) => a.id === selectedArrowId) ?? null;

  // Position of delete button for selected arrow (midpoint, offset perpendicular)
  const deleteBtn = selectedArrow
    ? {
        x: (selectedArrow.x1 + selectedArrow.x2) / 2,
        y: (selectedArrow.y1 + selectedArrow.y2) / 2,
      }
    : null;

  return (
    <div className="tactics-board-overlay" onClick={onClose}>
      <div className="tactics-board" onClick={(e) => e.stopPropagation()}>
        <div className="tactics-board__toolbar">
          <span className="tactics-board__title">Tactiekbord</span>
          <div className="tactics-board__toolbar-actions">
            <button
              className="btn btn--ghost btn--md"
              onClick={clearAll}
              disabled={arrows.length === 0 && chips.every((c, i) => {
                const init = initialChips[i];
                return init && init.playerId === c.playerId && init.x === c.x && init.y === c.y;
              })}
            >
              Wissen
            </button>
            <button className="btn btn--primary btn--md" onClick={onClose}>
              Sluiten
            </button>
          </div>
        </div>

        <div className="tactics-board__field" ref={layout.containerRef}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${FW} ${layout.FH}`}
            preserveAspectRatio="xMidYMid meet"
            className="tactics-board__svg"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <defs>
              <marker
                id="tactics-arrowhead"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW_COLOR} />
              </marker>
            </defs>

            <FieldBackground fieldSize={fieldSize} h={layout.FH} nh={baseFH} />

            {/* Transparent background rect to catch pointer events for drawing */}
            <rect
              x={0}
              y={0}
              width={FW}
              height={layout.FH}
              fill="transparent"
              onPointerDown={handlePointerDownOnField}
              style={{ touchAction: 'none' }}
            />

            {/* Committed arrows (rendered below chips so chips stay on top) */}
            {arrows.map((a) => {
              const isSelected = a.id === selectedArrowId;
              return (
                <g key={a.id}>
                  {/* Invisible wide hit area for tapping */}
                  <line
                    x1={a.x1}
                    y1={a.y1}
                    x2={a.x2}
                    y2={a.y2}
                    stroke="transparent"
                    strokeWidth={20}
                    onPointerDown={(e) => handlePointerDownOnArrow(e, a)}
                    style={{ touchAction: 'none', cursor: 'pointer' }}
                  />
                  <line
                    x1={a.x1}
                    y1={a.y1}
                    x2={a.x2}
                    y2={a.y2}
                    stroke={isSelected ? ARROW_SELECTED : ARROW_COLOR}
                    strokeWidth={isSelected ? 5 : 4}
                    strokeLinecap="round"
                    markerEnd="url(#tactics-arrowhead)"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}

            {/* Preview arrow while drawing */}
            {previewArrow && (
              <line
                x1={previewArrow.x1}
                y1={previewArrow.y1}
                x2={previewArrow.x2}
                y2={previewArrow.y2}
                stroke={ARROW_SELECTED}
                strokeWidth={4}
                strokeLinecap="round"
                markerEnd="url(#tactics-arrowhead)"
                opacity={0.8}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Player chips */}
            {chips.map((chip) => {
              return (
                <g
                  key={chip.playerId}
                  onPointerDown={(e) => handlePointerDownOnChip(e, chip)}
                  style={{ touchAction: 'none', cursor: 'grab' }}
                >
                  <circle
                    cx={chip.x}
                    cy={chip.y}
                    r={chipR}
                    fill={CHIP_FILL}
                    stroke={CHIP_STROKE}
                    strokeWidth={2.5}
                  />
                  {renderFieldPlayerLabel({
                    name: chip.name,
                    cx: chip.x,
                    cy: chip.y,
                    fontSize,
                    fontWeight: 600,
                  })}
                </g>
              );
            })}

            {/* Delete button for selected arrow */}
            {selectedArrow && deleteBtn && (
              <g
                onPointerDown={(e) => {
                  e.stopPropagation();
                  deleteArrow(selectedArrow.id);
                }}
                style={{ touchAction: 'none', cursor: 'pointer' }}
              >
                <circle
                  cx={deleteBtn.x}
                  cy={deleteBtn.y}
                  r={chipR * 0.55}
                  fill={ARROW_DELETE_FILL}
                  stroke={ARROW_DELETE_STROKE}
                  strokeWidth={2}
                />
                <text
                  x={deleteBtn.x}
                  y={deleteBtn.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={chipR * 0.8}
                  fontWeight={700}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  ×
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
