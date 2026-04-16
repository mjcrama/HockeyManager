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
  OPPONENT_FILL, OPPONENT_STROKE,
  SHAPE_LINE_COLOR, SHAPE_LINE_SEL,
  SHAPE_ZONE_STROKE, SHAPE_ZONE_SEL, SHAPE_ZONE_FILL, SHAPE_ZONE_FILL_SEL,
} from './fieldColors';

type Tool = 'arrow' | 'line' | 'rect' | 'circle' | 'opponent' | 'ball';
type ShapeKind = 'arrow' | 'line' | 'rect' | 'circle';

interface Shape {
  id: string;
  kind: ShapeKind;
  x1: number; y1: number; x2: number; y2: number;
}

interface PlayerChip {
  playerId: string;
  name: string;
  x: number;
  y: number;
}

interface OpponentChip {
  id: string;
  x: number;
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
  | { kind: 'dragging-player'; playerId: string; offsetX: number; offsetY: number }
  | { kind: 'dragging-opponent'; id: string; offsetX: number; offsetY: number }
  | { kind: 'dragging-ball'; offsetX: number; offsetY: number }
  | { kind: 'dragging-shape'; shapeId: string; startX: number; startY: number; origX1: number; origY1: number; origX2: number; origY2: number; hasMoved: boolean }
  | { kind: 'resizing-shape'; shapeId: string; anchorX: number; anchorY: number }
  | { kind: 'resizing-endpoint'; shapeId: string; endpoint: 'start' | 'end' };

export function TacticsBoard({ positions, lineup, players, fieldSize, onClose }: TacticsBoardProps) {
  const baseFW = VIEWBOX[fieldSize].w;
  const baseFH = VIEWBOX[fieldSize].h;
  const FW = baseFW;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [FH, setFH] = useState(baseFH);

  const initialChips = useMemo<PlayerChip[]>(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const chips: PlayerChip[] = [];
    for (const pos of positions) {
      const entry = lineup.find((e) => e.positionId === pos.id);
      if (!entry?.playerId) continue;
      const player = playerMap.get(entry.playerId);
      if (!player) continue;
      chips.push({ playerId: player.id, name: player.name, x: (pos.x / 100) * FW, y: (pos.y / 100) * FH });
    }
    return chips;
  }, [positions, lineup, players, FW, FH]);

  const [tool, setTool]                       = useState<Tool>('arrow');
  const [playerChips, setPlayerChips]         = useState<PlayerChip[]>(initialChips);
  const [shapes, setShapes]                   = useState<Shape[]>([]);
  const [opponentChips, setOpponentChips]     = useState<OpponentChip[]>([]);
  const [ball, setBall]                       = useState<{ x: number; y: number } | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [interaction, setInteraction]         = useState<Interaction>({ kind: 'none' });

  const handleFieldHeightChange = useCallback((prevFH: number, nextFH: number) => {
    const s = nextFH / prevFH;
    setFH(nextFH);
    setPlayerChips((list) => list.map((c) => ({ ...c, y: c.y * s })));
    setShapes((list) => list.map((a) => ({ ...a, y1: a.y1 * s, y2: a.y2 * s })));
    setOpponentChips((list) => list.map((c) => ({ ...c, y: c.y * s })));
    setBall((b) => b ? { ...b, y: b.y * s } : null);
  }, []);

  const layout = useResponsiveFieldLayout(baseFW, baseFH, { onHeightChange: handleFieldHeightChange });
  const { chipRadius: chipR, fontSize } = getFieldChipMetrics(FW, layout.FH);

  function clientToSvg(cx: number, cy: number) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    return pt.matrixTransform(ctm.inverse());
  }

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  // ── Pointer handlers ──────────────────────────────────────────────────────

  function handlePointerDownOnField(e: React.PointerEvent<SVGRectElement>) {
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    setSelectedShapeId(null);

    if (tool === 'arrow' || tool === 'line' || tool === 'rect' || tool === 'circle') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setInteraction({ kind: 'drawing', x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (tool === 'opponent') {
      const id = shortId(8);
      setOpponentChips((prev) => [...prev, { id, x: p.x, y: p.y }]);
      e.currentTarget.setPointerCapture(e.pointerId);
      setInteraction({ kind: 'dragging-opponent', id, offsetX: 0, offsetY: 0 });
    } else if (tool === 'ball') {
      setBall({ x: p.x, y: p.y });
      e.currentTarget.setPointerCapture(e.pointerId);
      setInteraction({ kind: 'dragging-ball', offsetX: 0, offsetY: 0 });
    }
  }

  function handlePointerDownOnPlayer(e: React.PointerEvent<SVGGElement>, chip: PlayerChip) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedShapeId(null);
    setInteraction({ kind: 'dragging-player', playerId: chip.playerId, offsetX: p.x - chip.x, offsetY: p.y - chip.y });
  }

  function handlePointerDownOnOpponent(e: React.PointerEvent<SVGGElement>, chip: OpponentChip) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedShapeId(null);
    setInteraction({ kind: 'dragging-opponent', id: chip.id, offsetX: p.x - chip.x, offsetY: p.y - chip.y });
  }

  function handlePointerDownOnBall(e: React.PointerEvent<SVGGElement>) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p || !ball) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedShapeId(null);
    setInteraction({ kind: 'dragging-ball', offsetX: p.x - ball.x, offsetY: p.y - ball.y });
  }

  function handlePointerDownOnEndpoint(e: React.PointerEvent<SVGCircleElement>, shape: Shape, endpoint: 'start' | 'end') {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setInteraction({ kind: 'resizing-endpoint', shapeId: shape.id, endpoint });
  }

  function handlePointerDownOnCorner(e: React.PointerEvent<SVGCircleElement>, shape: Shape, anchorX: number, anchorY: number) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setInteraction({ kind: 'resizing-shape', shapeId: shape.id, anchorX, anchorY });
  }

  function handlePointerDownOnShape(e: React.PointerEvent, shape: Shape) {
    e.stopPropagation();
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setInteraction({
      kind: 'dragging-shape',
      shapeId: shape.id,
      startX: p.x, startY: p.y,
      origX1: shape.x1, origY1: shape.y1,
      origX2: shape.x2, origY2: shape.y2,
      hasMoved: false,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (interaction.kind === 'none') return;
    const p = clientToSvg(e.clientX, e.clientY);
    if (!p) return;

    if (interaction.kind === 'drawing') {
      setInteraction({ ...interaction, x2: p.x, y2: p.y });

    } else if (interaction.kind === 'dragging-player') {
      const nx = clamp(p.x - interaction.offsetX, chipR, FW - chipR);
      const ny = clamp(p.y - interaction.offsetY, chipR, FH - chipR);
      setPlayerChips((prev) => prev.map((c) => c.playerId === interaction.playerId ? { ...c, x: nx, y: ny } : c));

    } else if (interaction.kind === 'dragging-opponent') {
      const nx = clamp(p.x - interaction.offsetX, chipR, FW - chipR);
      const ny = clamp(p.y - interaction.offsetY, chipR, FH - chipR);
      setOpponentChips((prev) => prev.map((c) => c.id === interaction.id ? { ...c, x: nx, y: ny } : c));

    } else if (interaction.kind === 'dragging-ball') {
      const r = chipR * 0.6;
      setBall({ x: clamp(p.x - interaction.offsetX, r, FW - r), y: clamp(p.y - interaction.offsetY, r, FH - r) });

    } else if (interaction.kind === 'resizing-endpoint') {
      setShapes((prev) => prev.map((s) =>
        s.id === interaction.shapeId
          ? interaction.endpoint === 'start'
            ? { ...s, x1: p.x, y1: p.y }
            : { ...s, x2: p.x, y2: p.y }
          : s
      ));

    } else if (interaction.kind === 'resizing-shape') {
      setShapes((prev) => prev.map((s) =>
        s.id === interaction.shapeId
          ? { ...s, x1: interaction.anchorX, y1: interaction.anchorY, x2: p.x, y2: p.y }
          : s
      ));

    } else if (interaction.kind === 'dragging-shape') {
      const dx = p.x - interaction.startX;
      const dy = p.y - interaction.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 5 || interaction.hasMoved) {
        setShapes((prev) => prev.map((s) =>
          s.id === interaction.shapeId
            ? { ...s, x1: interaction.origX1 + dx, y1: interaction.origY1 + dy, x2: interaction.origX2 + dx, y2: interaction.origY2 + dy }
            : s
        ));
        if (!interaction.hasMoved) setInteraction({ ...interaction, hasMoved: true });
      }
    }
  }

  function handlePointerUp() {
    if (interaction.kind === 'drawing') {
      const { x1, y1, x2, y2 } = interaction;
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        const kind = tool as ShapeKind;
        setShapes((prev) => [...prev, { id: shortId(8), kind, x1, y1, x2, y2 }]);
      }
    } else if (interaction.kind === 'dragging-shape' && !interaction.hasMoved) {
      setSelectedShapeId((prev) => (prev === interaction.shapeId ? null : interaction.shapeId));
    }
    setInteraction({ kind: 'none' });
  }

  function deleteShape(id: string) {
    setShapes((prev) => prev.filter((s) => s.id !== id));
    setSelectedShapeId(null);
  }

  function deleteOpponent(id: string) {
    setOpponentChips((prev) => prev.filter((c) => c.id !== id));
  }

  function clearAll() {
    setShapes([]);
    setPlayerChips(initialChips);
    setOpponentChips([]);
    setBall(null);
    setSelectedShapeId(null);
    setInteraction({ kind: 'none' });
  }

  // ── Derived render values ─────────────────────────────────────────────────

  const previewShape   = interaction.kind === 'drawing' ? interaction : null;
  const selectedShape  = shapes.find((s) => s.id === selectedShapeId) ?? null;
  const deleteBtn      = selectedShape
    ? { x: (selectedShape.x1 + selectedShape.x2) / 2, y: (selectedShape.y1 + selectedShape.y2) / 2 }
    : null;

  const isClean =
    shapes.length === 0 && opponentChips.length === 0 && ball === null &&
    playerChips.every((c, i) => {
      const init = initialChips[i];
      return init && init.playerId === c.playerId && init.x === c.x && init.y === c.y;
    });

  // ── Shape renderers ───────────────────────────────────────────────────────

  function renderShape(s: Shape, isSelected: boolean) {
    const { x1, y1, x2, y2 } = s;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

    if (s.kind === 'arrow') {
      return (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={isSelected ? ARROW_SELECTED : ARROW_COLOR}
          strokeWidth={isSelected ? 5 : 4}
          strokeLinecap="round"
          markerEnd="url(#tactics-arrowhead)"
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    if (s.kind === 'line') {
      return (
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={isSelected ? SHAPE_LINE_SEL : SHAPE_LINE_COLOR}
          strokeWidth={isSelected ? 5 : 3.5}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    if (s.kind === 'rect') {
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
      return (
        <rect
          x={rx} y={ry} width={rw} height={rh}
          fill={isSelected ? SHAPE_ZONE_FILL_SEL : SHAPE_ZONE_FILL}
          stroke={isSelected ? SHAPE_ZONE_SEL : SHAPE_ZONE_STROKE}
          strokeWidth={isSelected ? 3 : 2.5}
          strokeDasharray="8 5"
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    if (s.kind === 'circle') {
      return (
        <ellipse
          cx={mx} cy={my}
          rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2}
          fill={isSelected ? SHAPE_ZONE_FILL_SEL : SHAPE_ZONE_FILL}
          stroke={isSelected ? SHAPE_ZONE_SEL : SHAPE_ZONE_STROKE}
          strokeWidth={isSelected ? 3 : 2.5}
          strokeDasharray="8 5"
          style={{ pointerEvents: 'none' }}
        />
      );
    }
    return null;
  }

  function renderShapeHitArea(s: Shape) {
    const { x1, y1, x2, y2 } = s;
    const shared = {
      onPointerDown: (e: React.PointerEvent) => handlePointerDownOnShape(e, s),
      style: { touchAction: 'none' as const, cursor: 'grab' as const },
    };

    if (s.kind === 'arrow' || s.kind === 'line') {
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={20} {...shared} />;
    }
    if (s.kind === 'rect') {
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
      return <rect x={rx} y={ry} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="transparent" stroke="transparent" strokeWidth={12} {...shared} />;
    }
    if (s.kind === 'circle') {
      return <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} fill="transparent" stroke="transparent" strokeWidth={12} {...shared} />;
    }
    return null;
  }

  function renderPreview(p: { x1: number; y1: number; x2: number; y2: number }) {
    const { x1, y1, x2, y2 } = p;
    const common = { opacity: 0.75, style: { pointerEvents: 'none' as const } };

    if (tool === 'arrow') {
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ARROW_SELECTED} strokeWidth={4} strokeLinecap="round" markerEnd="url(#tactics-arrowhead)" {...common} />;
    }
    if (tool === 'line') {
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={SHAPE_LINE_SEL} strokeWidth={3.5} strokeLinecap="round" {...common} />;
    }
    if (tool === 'rect') {
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
      return <rect x={rx} y={ry} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill={SHAPE_ZONE_FILL} stroke={SHAPE_ZONE_SEL} strokeWidth={2.5} strokeDasharray="8 5" {...common} />;
    }
    if (tool === 'circle') {
      return <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} fill={SHAPE_ZONE_FILL} stroke={SHAPE_ZONE_SEL} strokeWidth={2.5} strokeDasharray="8 5" {...common} />;
    }
    return null;
  }

  function renderCornerHandles(s: Shape) {
    const x1 = Math.min(s.x1, s.x2), y1 = Math.min(s.y1, s.y2);
    const x2 = Math.max(s.x1, s.x2), y2 = Math.max(s.y1, s.y2);
    const r = chipR * 0.18;
    const corners = [
      { x: x1, y: y1, ax: x2, ay: y2, cursor: 'nwse-resize' },
      { x: x2, y: y1, ax: x1, ay: y2, cursor: 'nesw-resize' },
      { x: x1, y: y2, ax: x2, ay: y1, cursor: 'nesw-resize' },
      { x: x2, y: y2, ax: x1, ay: y1, cursor: 'nwse-resize' },
    ];
    return corners.map((c, i) => (
      <g key={i} onPointerDown={(e) => handlePointerDownOnCorner(e as React.PointerEvent<SVGCircleElement>, s, c.ax, c.ay)} style={{ touchAction: 'none', cursor: c.cursor as React.CSSProperties['cursor'] }}>
        {/* Large invisible hit area */}
        <circle cx={c.x} cy={c.y} r={chipR * 0.5} fill="transparent" />
        {/* Small visible dot */}
        <circle cx={c.x} cy={c.y} r={r} fill="white" stroke="#333" strokeWidth={1} style={{ pointerEvents: 'none' }} />
      </g>
    ));
  }

  function renderEndpointHandles(s: Shape) {
    const r = chipR * 0.18;
    const endpoints = [
      { x: s.x1, y: s.y1, ep: 'start' as const },
      { x: s.x2, y: s.y2, ep: 'end' as const },
    ];
    return endpoints.map(({ x, y, ep }) => (
      <g key={ep} onPointerDown={(e) => handlePointerDownOnEndpoint(e as React.PointerEvent<SVGCircleElement>, s, ep)} style={{ touchAction: 'none', cursor: 'crosshair' }}>
        <circle cx={x} cy={y} r={chipR * 0.5} fill="transparent" />
        <circle cx={x} cy={y} r={r} fill="white" stroke="#333" strokeWidth={1} style={{ pointerEvents: 'none' }} />
      </g>
    ));
  }

  const fieldCursor = (tool === 'arrow' || tool === 'line' || tool === 'rect' || tool === 'circle') ? 'crosshair' : 'copy';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="tactics-board-overlay" onClick={onClose}>
      <div className="tactics-board" onClick={(e) => e.stopPropagation()}>

        <div className="tactics-board__toolbar">
          <span className="tactics-board__title">Tactiekbord</span>
          <div className="tactics-board__toolbar-actions">
            <button className="btn btn--ghost btn--md" onClick={clearAll} disabled={isClean}>
              Wissen
            </button>
            <button className="btn btn--primary btn--md" onClick={onClose}>
              Sluiten
            </button>
          </div>
        </div>

        <div className="tactics-board__content">

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
                <marker id="tactics-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW_COLOR} />
                </marker>
              </defs>

              <FieldBackground fieldSize={fieldSize} h={layout.FH} nh={baseFH} />

              {/* Transparent rect: catches field clicks */}
              <rect
                x={0} y={0} width={FW} height={layout.FH}
                fill="transparent"
                onPointerDown={handlePointerDownOnField}
                style={{ touchAction: 'none', cursor: fieldCursor }}
              />

              {/* Committed shapes — hit area first, then visual on top */}
              {shapes.map((s) => (
                <g key={s.id}>
                  {renderShapeHitArea(s)}
                  {renderShape(s, s.id === selectedShapeId)}
                </g>
              ))}

              {/* Preview while drawing */}
              {previewShape && renderPreview(previewShape)}

              {/* Opponent chips */}
              {opponentChips.map((chip, i) => (
                <g key={chip.id} onPointerDown={(e) => handlePointerDownOnOpponent(e, chip)} style={{ touchAction: 'none', cursor: 'grab' }}>
                  <circle cx={chip.x} cy={chip.y} r={chipR} fill={OPPONENT_FILL} stroke={OPPONENT_STROKE} strokeWidth={2.5} />
                  <text x={chip.x} y={chip.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={fontSize} fontWeight={600} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {i + 1}
                  </text>
                  {/* Delete badge */}
                  <g onPointerDown={(e) => { e.stopPropagation(); deleteOpponent(chip.id); }} style={{ touchAction: 'none', cursor: 'pointer' }}>
                    <circle cx={chip.x + chipR * 0.7} cy={chip.y - chipR * 0.7} r={chipR * 0.38} fill={ARROW_DELETE_FILL} stroke={ARROW_DELETE_STROKE} strokeWidth={1.5} />
                    <text x={chip.x + chipR * 0.7} y={chip.y - chipR * 0.7} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={chipR * 0.55} fontWeight={700} style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
                  </g>
                </g>
              ))}

              {/* Player chips */}
              {playerChips.map((chip) => (
                <g key={chip.playerId} onPointerDown={(e) => handlePointerDownOnPlayer(e, chip)} style={{ touchAction: 'none', cursor: 'grab' }}>
                  <circle cx={chip.x} cy={chip.y} r={chipR} fill={CHIP_FILL} stroke={CHIP_STROKE} strokeWidth={2.5} />
                  {renderFieldPlayerLabel({ name: chip.name, cx: chip.x, cy: chip.y, fontSize, fontWeight: 600 })}
                </g>
              ))}

              {/* Ball — on top of players */}
              {ball && (
                <g onPointerDown={handlePointerDownOnBall} style={{ touchAction: 'none', cursor: 'grab' }}>
                  <circle cx={ball.x} cy={ball.y} r={chipR * 0.6} fill="white" stroke="#222" strokeWidth={2} />
                  <circle cx={ball.x} cy={ball.y} r={chipR * 0.22} fill="#333" />
                </g>
              )}

              {/* Endpoint handles for selected arrow/line */}
              {selectedShape && (selectedShape.kind === 'arrow' || selectedShape.kind === 'line') && renderEndpointHandles(selectedShape)}

              {/* Corner resize handles for selected rect/circle */}
              {selectedShape && (selectedShape.kind === 'rect' || selectedShape.kind === 'circle') && renderCornerHandles(selectedShape)}

              {/* Delete button for selected shape */}
              {selectedShape && deleteBtn && (
                <g onPointerDown={(e) => { e.stopPropagation(); deleteShape(selectedShape.id); }} style={{ touchAction: 'none', cursor: 'pointer' }}>
                  <circle cx={deleteBtn.x} cy={deleteBtn.y} r={chipR * 0.55} fill={ARROW_DELETE_FILL} stroke={ARROW_DELETE_STROKE} strokeWidth={2} />
                  <text x={deleteBtn.x} y={deleteBtn.y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={chipR * 0.8} fontWeight={700} style={{ pointerEvents: 'none', userSelect: 'none' }}>×</text>
                </g>
              )}
            </svg>
          </div>

          {/* Tool selector */}
          <div className="tactics-board__tools">
            <ToolBtn active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Pijl tekenen" label="Pijl">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="19" x2="19" y2="5"/>
                <polyline points="11 5 19 5 19 13"/>
              </svg>
            </ToolBtn>

            <ToolBtn active={tool === 'line'} onClick={() => setTool('line')} title="Lijn tekenen" label="Lijn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="19" x2="19" y2="5"/>
              </svg>
            </ToolBtn>

            <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')} title="Rechthoek tekenen" label="Vak">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="1.5"/>
              </svg>
            </ToolBtn>

            <ToolBtn active={tool === 'circle'} onClick={() => setTool('circle')} title="Cirkel tekenen" label="Cirkel">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="9"/>
              </svg>
            </ToolBtn>

            <div className="tactics-board__tools-divider" />

            <ToolBtn active={tool === 'opponent'} onClick={() => setTool('opponent')} title="Tegenstander plaatsen" label="Tegen-stander">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <circle cx="12" cy="12" r="10" fill={OPPONENT_FILL} stroke={OPPONENT_STROKE} strokeWidth="1.5"/>
                <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">T</text>
              </svg>
            </ToolBtn>

            <ToolBtn active={tool === 'ball'} onClick={() => setTool('ball')} title="Bal plaatsen" label="Bal">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <circle cx="12" cy="12" r="10" fill="white" stroke="#666" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="3.5" fill="#222"/>
              </svg>
            </ToolBtn>
          </div>

        </div>
      </div>
    </div>
  );
}

function ToolBtn({ active, onClick, title, label, children }: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`tactics-board__tool${active ? ' tactics-board__tool--active' : ''}`}
      onClick={onClick}
      title={title}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
