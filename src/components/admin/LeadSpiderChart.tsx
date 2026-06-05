import React from "react";

export type SpiderAxis = {
  key: string;
  label: string;
  value: number;
};

type LeadSpiderChartProps = {
  axes: SpiderAxis[];
  size?: number;
  stroke?: string;
  fill?: string;
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
}: LeadSpiderChartProps) {
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

  const polygonPoints = safeAxes
    .map((axis, index) => {
      const ratio = Math.max(0, Math.min(axis.value, 100)) / 100;
      const angle = baseStart + index * angleStep;
      const point = pointOnCircle(angle, radius * ratio, center);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Lead scoring spider chart">
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
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      <polygon points={polygonPoints} fill={fill} stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
