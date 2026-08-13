// Shared stroke-style line icons. Emoji never match a professional UI —
// these are drawn on one 24×24 grid with one stroke weight, so any two of
// them sit together as a set. Colour follows `currentColor`.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

type Props = { size?: number };

/** Target — mission, the thing we aim at. */
export function IconTarget({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

/** Stacked layers — everything the product brings together. */
export function IconLayers({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </svg>
  );
}

/** Globe — Georgia first, then everywhere. */
export function IconGlobe({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3Z" />
    </svg>
  );
}

/** People — who the product is for. */
export function IconUsers({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M15.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20" />
      <circle cx="9.2" cy="7.6" r="3.6" />
      <path d="M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.48" />
      <path d="M15.6 4.2a3.6 3.6 0 0 1 0 6.97" />
    </svg>
  );
}

/** Envelope — email. */
export function IconMail({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 7 7.36 5.15a2 2 0 0 0 2.28 0L20.5 7" />
    </svg>
  );
}

/** Speech bubble — chat / WhatsApp. */
export function IconChat({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M20.5 11.5a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.6-.45L4 20.5l1.6-4.6a7.7 7.7 0 0 1-1.1-4A7.9 7.9 0 0 1 12.5 3.6a7.9 7.9 0 0 1 8 7.9Z" />
    </svg>
  );
}

/** Shield — privacy and data protection. */
export function IconShield({ size = 22 }: Props) {
  return (
    <svg width={size} height={size} {...base}>
      <path d="M12 2.8 4.5 6v6c0 4.6 3.2 8.2 7.5 9.2 4.3-1 7.5-4.6 7.5-9.2V6L12 2.8Z" />
      <path d="m9 12 2.2 2.2L15.3 10" />
    </svg>
  );
}
