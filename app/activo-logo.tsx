// Activo logo — roof-A + outlined "ctiv" + wheel-O. The letters are
// converted to paths (Liberation/Arial-metric bold), so the lockup is
// pixel-identical on every device. Colors follow the theme via CSS vars.
//
// With `animated`, the lockup builds itself: one wall, then the other,
// the window drops in, the letters fade up and the wheel rolls in from
// the right (from the left it would cross the letters). Its spokes show
// only while it rolls, then fade — a plain circle reads as motionless.
export default function ActivoLogo({
  height = 26,
  animated = false,
}: {
  height?: number;
  animated?: boolean;
}) {
  const stroke = "var(--color-primary)";
  return (
    <svg
      height={height}
      viewBox="8 10 152 52"
      role="img"
      aria-label="Activo"
      className={animated ? "mark-anim" : undefined}
      style={
        {
          display: "block",
          width: "auto",
          // Where the wheel spins and where it rolls in from.
          "--wheel-origin": "147.3px 45.1px",
          "--roll-from": "52px",
          "--roll-spin": "430deg",
        } as React.CSSProperties
      }
    >
      {/* roof A (real estate) — split so each wall can build in turn */}
      <path
        className="mark-wall mark-wall--left"
        pathLength="100"
        d="M14 56 L38 18"
        fill="none"
        stroke={stroke}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        className="mark-wall mark-wall--right"
        pathLength="100"
        d="M38 18 L62 56"
        fill="none"
        stroke={stroke}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <rect className="mark-window" x="31" y="42" width="14" height="14" rx="3" fill="var(--brand-mint, #3fc6a5)" />
      {/* ctiv (outlined) */}
      <path className="mark-letters" fill="currentColor" d="M79.18 56.41Q74.14 56.41 71.39 53.41Q68.64 50.40 68.64 45.03Q68.64 39.53 71.41 36.47Q74.18 33.40 79.26 33.40Q83.18 33.40 85.74 35.37Q88.31 37.34 88.96 40.80L83.16 41.09Q82.91 39.39 81.93 38.37Q80.95 37.36 79.14 37.36Q74.69 37.36 74.69 44.80Q74.69 52.47 79.22 52.47Q80.86 52.47 81.97 51.44Q83.08 50.40 83.34 48.35L89.13 48.62Q88.82 50.89 87.50 52.68Q86.17 54.46 84.02 55.44Q81.87 56.41 79.18 56.41M97.77 56.37Q95.23 56.37 93.85 54.98Q92.48 53.60 92.48 50.79L92.48 37.71L89.67 37.71L89.67 33.81L92.77 33.81L94.57 28.60L98.18 28.60L98.18 33.81L102.39 33.81L102.39 37.71L98.18 37.71L98.18 49.23Q98.18 50.85 98.80 51.62Q99.41 52.39 100.70 52.39Q101.38 52.39 102.63 52.10L102.63 55.67Q100.50 56.37 97.77 56.37M110.64 29.81L104.88 29.81L104.88 25.57L110.64 25.57L110.64 29.81M110.64 56L104.88 56L104.88 33.81L110.64 33.81M135.59 33.81L127.40 56L120.51 56L112.58 33.81L118.67 33.81L122.54 46.22Q122.85 47.24 124 51.34Q124.21 50.50 124.84 48.39Q125.48 46.28 129.56 33.81" />
      {/* wheel O (vehicles) */}
      <g className="mark-wheel">
        <circle cx="147.3" cy="45.1" r="7.5" fill="none" stroke={stroke} strokeWidth="7.2" />
        {animated && (
          <g className="mark-spokes" stroke={stroke} strokeWidth="2" strokeLinecap="round">
            <line x1="147.3" y1="39.9" x2="147.3" y2="50.3" />
            <line x1="142.8" y1="42.5" x2="151.8" y2="47.7" />
            <line x1="142.8" y1="47.7" x2="151.8" y2="42.5" />
          </g>
        )}
      </g>
      <circle className="mark-hub" cx="147.3" cy="45.1" r="2.1" fill="var(--brand-mint, #3fc6a5)" />
    </svg>
  );
}
