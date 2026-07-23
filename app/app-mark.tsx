// Activo app mark — the square monogram used as the app/favicon icon
// (roof-A + wheel-O). Fixed brand colors so it reads the same in any theme.
export default function AppMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Activo"
      style={{ display: "block" }}
    >
      <rect x="2" y="2" width="92" height="92" rx="22" fill="#4f46e5" />
      <path
        d="M22 62 L48 24 L74 62"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="63" r="10.5" fill="none" stroke="#ffffff" strokeWidth="6.5" />
      <circle cx="48" cy="63" r="3" fill="#23c185" />
    </svg>
  );
}
