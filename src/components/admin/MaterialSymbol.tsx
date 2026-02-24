import type { CSSProperties } from "react";

interface MaterialSymbolProps {
  name: string;
  size?: number;
  weight?: number;
  fill?: 0 | 1;
  grade?: number;
  opticalSize?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

export function MaterialSymbol({
  name,
  size = 20,
  weight = 500,
  fill = 0,
  grade = 0,
  opticalSize = 24,
  className,
  title,
  style,
}: MaterialSymbolProps) {
  const combinedClassName = ["material-symbol", className].filter(Boolean).join(" ");

  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={combinedClassName}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `"FILL" ${fill}, "wght" ${weight}, "GRAD" ${grade}, "opsz" ${opticalSize}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
