import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SpiderAxis = {
  key: string;
  label: string;
  value: number;
  displayValue?: string;
  interactive?: boolean;
  clickable?: boolean;
};

type LeadSpiderChartProps = {
  axes: SpiderAxis[];
  size?: number;
  stroke?: string;
  fill?: string;
  maxValue?: number;
  showValues?: boolean;
  interactive?: boolean;
  onAxisChange?: (axisKey: string, nextValue: number) => void;
  onLabelClick?: (axisKey: string) => void;
};

function pointOnCircle(angleRad: number, radius: number, center: number) {
  return {
    x: center + Math.cos(angleRad) * radius,
    y: center + Math.sin(angleRad) * radius,
  };
}

export function LeadSpiderChart({
  axes,
  size = 240,
  stroke = "#2563eb",
  fill = "rgba(37,99,235,0.18)",
  maxValue = 100,
  showValues = false,
  interactive = false,
  onAxisChange,
  onLabelClick,
}: LeadSpiderChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragAxisKey, setDragAxisKey] = useState<string | null>(null);

  const safeAxes = axes.length >= 3 ? axes : [];
  const center = size / 2;
  const radius = size * 0.34;
  const ringCount = 4;

  if (safeAxes.length < 3) {
    return null;
  }

  const angleStep = (Math.PI * 2) / safeAxes.length;
  const baseStart = -Math.PI / 2;

  const rings = Array.from({ length: ringCount }, (_, index) => (index + 1) / ringCount);

  const axisAngles = useMemo(() => {
    return new Map(
      safeAxes.map((axis, index) => [axis.key, baseStart + index * angleStep])
    );
  }, [safeAxes, baseStart, angleStep]);

  const clampRatio = (value: number) => Math.max(0, Math.min(value, 1));
  const clampValue = (value: number) => Math.max(0, Math.min(value, maxValue));

  const getAxisPoint = useCallback(
    (value: number, angle: number) => {
      const ratio = maxValue <= 0 ? 0 : clampRatio(clampValue(value) / maxValue);
      return pointOnCircle(angle, radius * ratio, center);
    },
    [center, maxValue, radius]
  );

  const emitPointerValue = useCallback(
    (axisKey: string, clientX: number, clientY: number) => {
      if (!onAxisChange) return;
      const svg = svgRef.current;
      const angle = axisAngles.get(axisKey);
      if (!svg || angle === undefined) return;

      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const x = ((clientX - rect.left) / rect.width) * size;
      const y = ((clientY - rect.top) / rect.height) * size;
      const dx = x - center;
      const dy = y - center;

      const projection = dx * Math.cos(angle) + dy * Math.sin(angle);
      const ratio = clampRatio(radius <= 0 ? 0 : projection / radius);
      onAxisChange(axisKey, clampValue(ratio * maxValue));
    },
    [axisAngles, center, clampValue, clampRatio, maxValue, onAxisChange, radius, size]
  );

  useEffect(() => {
    if (!dragAxisKey) return;

    const onPointerMove = (event: PointerEvent) => {
      emitPointerValue(dragAxisKey, event.clientX, event.clientY);
    };

    const onPointerUp = () => {
      setDragAxisKey(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragAxisKey, emitPointerValue]);

  const polygonPoints = safeAxes
    .map((axis, index) => {
      const angle = baseStart + index * angleStep;
      const point = getAxisPoint(axis.value, angle);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Lead scoring spider chart"
      style={{ touchAction: interactive ? "none" : "auto" }}
    >
      {rings.map((ringRatio) => {
        const ringPoints = safeAxes
          .map((_, index) => {
            const angle = baseStart + index * angleStep;
            const point = pointOnCircle(angle, radius * ringRatio, center);
            return `${point.x},${point.y}`;
          })
          .join(" ");

        return (
          <polygon
            key={`ring_${ringRatio}`}
            points={ringPoints}
            fill="none"
            stroke="var(--border-color)"
            strokeWidth={1}
          />
        );
      })}

      {safeAxes.map((axis, index) => {
        const angle = baseStart + index * angleStep;
        const end = pointOnCircle(angle, radius, center);
        const labelPoint = pointOnCircle(angle, radius + 16, center);
        const isGhost = axis.key.includes("_ghost_");
        const canClickLabel = !!onLabelClick && !isGhost && axis.clickable !== false;
        const canDragAxis = interactive && !!onAxisChange && !isGhost && axis.interactive !== false;
        const valuePoint = getAxisPoint(axis.value, angle);
        const valueText = axis.displayValue ?? `${Math.round(axis.value)}`;
        const badgeWidth = Math.max(18, valueText.length * 6 + 8);

        return (
          <g key={`axis_${axis.key}`}>
            <line
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="var(--border-color)"
              strokeWidth={1}
            />
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              fontSize={10}
              textAnchor={Math.abs(labelPoint.x - center) < 8 ? "middle" : labelPoint.x > center ? "start" : "end"}
              dominantBaseline="middle"
              fill="var(--text-secondary)"
              style={{ cursor: canClickLabel ? "pointer" : "default" }}
              onClick={() => {
                if (!canClickLabel) return;
                onLabelClick(axis.key);
              }}
            >
              {axis.label}
            </text>

            {showValues && !isGhost ? (
              <g
                style={{ cursor: canDragAxis ? "ns-resize" : "default" }}
                onPointerDown={(event) => {
                  if (!canDragAxis) return;
                  event.preventDefault();
                  setDragAxisKey(axis.key);
                  emitPointerValue(axis.key, event.clientX, event.clientY);
                }}
              >
                <circle
                  cx={valuePoint.x}
                  cy={valuePoint.y}
                  r={canDragAxis ? 7 : 5}
                  fill={stroke}
                  stroke="white"
                  strokeWidth={1.5}
                />
                <rect
                  x={valuePoint.x - badgeWidth / 2}
                  y={valuePoint.y - 20}
                  width={badgeWidth}
                  height={14}
                  rx={7}
                  fill="var(--card-bg)"
                  stroke="var(--border-color)"
                  strokeWidth={1}
                />
                <text
                  x={valuePoint.x}
                  y={valuePoint.y - 13}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill="var(--text-primary)"
                  pointerEvents="none"
                >
                  {valueText}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      <polygon points={polygonPoints} fill={fill} stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
