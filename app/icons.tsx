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

type Props = { size?: number; className?: string };

/** Target — mission, the thing we aim at. */
export function IconTarget({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" />
    </svg>
  );
}

/** Stacked layers — everything the product brings together. */
export function IconLayers({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </svg>
  );
}

/** Globe — Georgia first, then everywhere. */
export function IconGlobe({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9S9.5 5.4 12 3Z" />
    </svg>
  );
}

/** People — who the product is for. */
export function IconUsers({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M15.5 20v-1.8a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.2V20" />
      <circle cx="9.2" cy="7.6" r="3.6" />
      <path d="M21 20v-1.8a3.6 3.6 0 0 0-2.7-3.48" />
      <path d="M15.6 4.2a3.6 3.6 0 0 1 0 6.97" />
    </svg>
  );
}

/** Envelope — email. */
export function IconMail({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 7 7.36 5.15a2 2 0 0 0 2.28 0L20.5 7" />
    </svg>
  );
}

/** Speech bubble — chat / WhatsApp. */
export function IconChat({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M20.5 11.5a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.6-.45L4 20.5l1.6-4.6a7.7 7.7 0 0 1-1.1-4A7.9 7.9 0 0 1 12.5 3.6a7.9 7.9 0 0 1 8 7.9Z" />
    </svg>
  );
}

/** Shield — privacy and data protection. */
export function IconShield({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 2.8 4.5 6v6c0 4.6 3.2 8.2 7.5 9.2 4.3-1 7.5-4.6 7.5-9.2V6L12 2.8Z" />
      <path d="m9 12 2.2 2.2L15.3 10" />
    </svg>
  );
}

/** Check mark — received, done. */
export function IconCheck({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Arrow right — open the details. */
export function IconArrowRight({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/** Circular arrow — start over from the beginning. */
export function IconRestart({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </svg>
  );
}

/** Two sheets — copy to the clipboard. */
export function IconCopy({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Map pin — a place, the current position. */
export function IconPin({ size = 22, className }: Props) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Small helper for the simple glyphs below: one icon = its paths. */
function glyph(paths: React.ReactNode) {
  return function Icon({ size = 22, className }: Props) {
    return (
      <svg width={size} height={size} className={className} {...base}>
        {paths}
      </svg>
    );
  };
}

/** House — a flat or a house (real-estate category, dashboard home). */
export const IconHome = glyph(
  <>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9.5h13V10" />
    <path d="M10 19.5v-5h4v5" />
  </>,
);

/** Car — a vehicle, car rental. */
export const IconCar = glyph(
  <>
    <path d="M5 16.5H3.8a.8.8 0 0 1-.8-.8v-3.2c0-.6.3-1.1.8-1.4l1.7-1 1.6-3.3A2 2 0 0 1 8.9 5.7h6.2a2 2 0 0 1 1.8 1.1l1.6 3.3 1.7 1c.5.3.8.8.8 1.4v3.2a.8.8 0 0 1-.8.8H19" />
    <path d="M9 16.5h6" />
    <circle cx="7" cy="16.8" r="2" />
    <circle cx="17" cy="16.8" r="2" />
    <path d="M5.6 10.1h12.8" />
  </>,
);

/** Box — anything else (other assets). */
export const IconBox = glyph(
  <>
    <path d="M20.5 7.8 12 3.5 3.5 7.8v8.4L12 20.5l8.5-4.3V7.8Z" />
    <path d="M3.5 7.8 12 12l8.5-4.2" />
    <path d="M12 12v8.5" />
    <path d="m7.8 5.6 8.5 4.3" />
  </>,
);

/** Sun — light theme. */
export const IconSun = glyph(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
);

/** Moon — dark theme. */
export const IconMoon = glyph(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />);

/** Key — a door code, access. */
export const IconKey = glyph(
  <>
    <circle cx="8" cy="15" r="4.5" />
    <path d="m11.2 11.8 8.3-8.3" />
    <path d="m16.5 6.5 2.5 2.5" />
    <path d="m14 9 2 2" />
  </>,
);

/** Padlock — privacy, a protected step. */
export const IconLock = glyph(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2" />
  </>,
);

/** Three lines — open the menu. */
export const IconMenu = glyph(<path d="M4 7h16M4 12h16M4 17h16" />);

/** Cross — close, remove. */
export const IconClose = glyph(<path d="M6 6l12 12M18 6 6 18" />);

/** Pencil — edit, changed by the owner. */
export const IconEdit = glyph(
  <>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </>,
);

/** Bin — delete. */
export const IconTrash = glyph(
  <>
    <path d="M4 7h16" />
    <path d="M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
    <path d="M6 7l1 12.2a1.5 1.5 0 0 0 1.5 1.3h7a1.5 1.5 0 0 0 1.5-1.3L18 7" />
    <path d="M10 11v6M14 11v6" />
  </>,
);

/** Clock — a date coming up, time running out. */
export const IconClock = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);

/** Flag — a red line crossed. */
export const IconFlag = glyph(
  <>
    <path d="M5 21V4" />
    <path d="M5 4.5h11l-2 4 2 4H5" />
  </>,
);

/** Triangle with ! — something needs the owner now. */
export const IconAlert = glyph(
  <>
    <path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4.5" />
    <path d="M12 17.2v.1" />
  </>,
);

/** Circle with i — for information. */
export const IconInfo = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <path d="M12 7.8v.1" />
  </>,
);

/** Rising line — a price that can go up, a buy. */
export const IconTrendUp = glyph(
  <>
    <path d="m3.5 17 6-6 4 4 7-7.5" />
    <path d="M15 7.5h5.5V13" />
  </>,
);

/** Falling line — a sell. */
export const IconTrendDown = glyph(
  <>
    <path d="m3.5 7 6 6 4-4 7 7.5" />
    <path d="M15 16.5h5.5V11" />
  </>,
);

/** Arrow left — back. */
export const IconArrowLeft = glyph(
  <>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </>,
);

/** Arrow up-right — opens outside Activo (WhatsApp, a listing). */
export const IconExternal = glyph(
  <>
    <path d="M7 17 17 7" />
    <path d="M8.5 7H17v8.5" />
  </>,
);

/** Chevrons — pagers and drop-downs. */
export const IconChevronLeft = glyph(<path d="m14.5 6-6 6 6 6" />);
export const IconChevronRight = glyph(<path d="m9.5 6 6 6-6 6" />);
export const IconChevronDown = glyph(<path d="m6 9.5 6 6 6-6" />);

/** Calendar — empty nights, dates. */
export const IconCalendar = glyph(
  <>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </>,
);

/** Signal with a slash — a tracker that went quiet. */
export const IconSignalOff = glyph(
  <>
    <path d="M12 18.5v.1" />
    <path d="M8.8 15.2a4.5 4.5 0 0 1 6.4 0" />
    <path d="M5.8 12.2a8.8 8.8 0 0 1 4-2.2" />
    <path d="M18.2 12.2a8.8 8.8 0 0 0-2.3-1.6" />
    <path d="M3 9a13 13 0 0 1 4-2.6" />
    <path d="M21 9a13 13 0 0 0-9-3.5" />
    <path d="m3.5 3.5 17 17" />
  </>,
);

/** Bricks — one account's data walled off from another's. */
export const IconWall = glyph(
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M3.5 9.7h17M3.5 14.3h17" />
    <path d="M9 5v4.7M15 5v4.7M12 9.7v4.6M9 14.3V19M15 14.3V19" />
  </>,
);

/** Circle with a slash — never shared, never sold. */
export const IconBan = glyph(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </>,
);

/** The line icon of an asset category: house, car, or box for the rest. */
export function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  if (category === "vehicle") return <IconCar size={size} />;
  if (category === "real_estate") return <IconHome size={size} />;
  return <IconBox size={size} />;
}
