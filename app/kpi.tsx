import type { CSSProperties, ReactNode } from "react";

// One KPI tile (globals.css .kpi): a label, a figure and an optional line
// under it. The one markup for a tile — pages and calculators use this
// instead of writing the divs by hand. No hooks and no server imports, so
// server and client components both render it.
export default function Kpi({
  label,
  value,
  sub,
  hint,
  index,
  valueStyle,
  subClassName,
  subStyle,
  className,
  style,
  children,
}: {
  label: ReactNode;
  /** The figure; leave it out for a tile whose body is `children` (badges…). */
  value?: ReactNode;
  /** One line under the figure. */
  sub?: ReactNode;
  /** What a finance term means — on hover of the label, and read aloud. */
  hint?: string;
  /** Position in a staggered grid (`--i`, the 3D deck's entrance delay). */
  index?: number;
  valueStyle?: CSSProperties;
  subClassName?: string;
  subStyle?: CSSProperties;
  className?: string;
  style?: CSSProperties;
  /** Anything after the figure: more sub-lines, badges, a note. */
  children?: ReactNode;
}) {
  return (
    <div
      className={className ? `kpi ${className}` : "kpi"}
      style={index != null ? ({ ...style, "--i": index } as CSSProperties) : style}
    >
      <div className="kpi__label" title={hint}>
        {label}
      </div>
      {value !== undefined && (
        <div className="kpi__value" style={valueStyle}>
          {value}
        </div>
      )}
      {sub != null && sub !== false && sub !== "" && (
        <div className={subClassName ? `kpi__sub ${subClassName}` : "kpi__sub"} style={subStyle}>
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}

/** A further line under a tile's figure. */
export function KpiSub({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="kpi__sub" style={style}>
      {children}
    </div>
  );
}
