import { useLayoutEffect, useRef, useState } from 'react';

interface FieldLayout {
  FH: number;
  offsetX: number;
  offsetY: number;
  containerWidth: number;
}

interface UseResponsiveFieldLayoutOptions {
  onHeightChange?: (prevFH: number, nextFH: number) => void;
}

export function useResponsiveFieldLayout(
  baseFW: number,
  baseFH: number,
  options: UseResponsiveFieldLayoutOptions = {},
) {
  const { onHeightChange } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const prevFHRef = useRef(baseFH);
  const [layout, setLayout] = useState<FieldLayout>({ FH: baseFH, offsetX: 0, offsetY: 0, containerWidth: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const ratio = rect.height / rect.width;
      const FH = Math.max(baseFH, baseFW * ratio);
      const scale = Math.min(rect.width / baseFW, rect.height / FH);
      const renderedW = baseFW * scale;
      const renderedH = FH * scale;
      const offsetX = Math.max(0, (rect.width - renderedW) / 2);
      const offsetY = Math.max(0, (rect.height - renderedH) / 2);
      const prevFH = prevFHRef.current;

      if (Math.abs(prevFH - FH) >= 0.5) {
        prevFHRef.current = FH;
        onHeightChange?.(prevFH, FH);
      }

      setLayout((prev) => {
        if (
          Math.abs(prev.FH - FH) < 0.5 &&
          Math.abs(prev.offsetX - offsetX) < 0.5 &&
          Math.abs(prev.offsetY - offsetY) < 0.5 &&
          Math.abs(prev.containerWidth - rect.width) < 0.5
        ) return prev;
        return { FH, offsetX, offsetY, containerWidth: rect.width };
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseFW, baseFH, onHeightChange]);

  return { containerRef, ...layout };
}

export function getFieldChipMetrics(
  _fieldW: number,
  fieldH: number,
) {
  // Preserve the mobile proportions from the stretched half-field reference:
  // r = 37.474 at H = 719.1176  =>  ~5.21% of the rendered field height.
  const chipRadius = fieldH * 0.05211;
  const fontSize = fieldH * 0.01708;

  return {
    sizeBase: fieldH,
    chipRadius,
    fontSize,
  };
}

interface RenderFieldPlayerLabelOptions {
  name: string;
  cx: number;
  cy: number;
  fontSize: number;
  fill?: string;
  fontWeight?: number | string;
}

export function renderFieldPlayerLabel({
  name,
  cx,
  cy,
  fontSize,
  fill = 'white',
  fontWeight,
}: RenderFieldPlayerLabelOptions) {
  const parts = name.split(' ');
  const fs = fontSize * 0.84;
  const lh = fs * 1.2;
  const style = { pointerEvents: 'none' as const, userSelect: 'none' as const };

  if (parts.length === 1) {
    const display = name.length > 9 ? name.substring(0, 8) + '…' : name;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={fill}
        fontSize={fs}
        fontWeight={fontWeight}
        style={style}
      >
        {display}
      </text>
    );
  }

  const line1 = parts[0].length > 8 ? parts[0].substring(0, 7) + '…' : parts[0];
  const rest = parts.slice(1).join(' ');
  const line2 = rest.length > 8 ? rest.substring(0, 7) + '…' : rest;

  return (
    <text textAnchor="middle" fill={fill} fontSize={fs} fontWeight={fontWeight} style={style}>
      <tspan x={cx} y={cy - lh * 0.5} dominantBaseline="middle">{line1}</tspan>
      <tspan x={cx} y={cy + lh * 0.5} dominantBaseline="middle">{line2}</tspan>
    </text>
  );
}
