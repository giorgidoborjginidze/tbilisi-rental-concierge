// Activo app mark — the roof-A + wheel-O monogram, drawn in the theme's
// primary colour so it matches the full logo in both light and dark.
// (The favicon at app/icon.svg keeps its fixed brand-coloured plate: it
// sits in browser chrome, not on one of our pages.)
//
// With `animated`, the mark builds itself: one wall, then the other, then
// the wheel rolls in. The spokes exist only during the roll — a plain
// circle gives no sense of spinning — and fade out, so the finished mark
// is exactly the static one.
export default function AppMark({
  size = 20,
  animated = false,
}: {
  size?: number;
  animated?: boolean;
}) {
  const stroke = "var(--color-primary)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="16 16 64 64"
      role="img"
      aria-label="Activo"
      className={animated ? "mark-anim" : undefined}
      style={{ display: "block" }}
    >
      {/* Left wall, drawn from the ground up to the apex. */}
      <path
        className="mark-wall mark-wall--left"
        pathLength="100"
        d="M22 62 L48 24"
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Right wall, drawn from the apex back down. */}
      <path
        className="mark-wall mark-wall--right"
        pathLength="100"
        d="M48 24 L74 62"
        fill="none"
        stroke={stroke}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g className="mark-wheel">
        <circle cx="48" cy="63" r="10.5" fill="none" stroke={stroke} strokeWidth="6.5" />
        {animated && (
          <g
            className="mark-spokes"
            stroke={stroke}
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <line x1="48" y1="55.5" x2="48" y2="70.5" />
            <line x1="41.5" y1="59.25" x2="54.5" y2="66.75" />
            <line x1="41.5" y1="66.75" x2="54.5" y2="59.25" />
          </g>
        )}
      </g>
      <circle className="mark-hub" cx="48" cy="63" r="3" fill="#23c185" />
    </svg>
  );
}
