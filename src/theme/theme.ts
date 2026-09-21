// ─── Ledger design tokens (ported 1:1 from the web theme) ───────────────────
// The web app used Tailwind @theme tokens; here they are plain values so the
// whole look survives on native without a build-time CSS pipeline.

export const colors = {
  ink950: "#060708",
  ink900: "#0e0f12",
  ink850: "#141519",
  ink800: "#191b20",
  ink750: "#1f2127",
  ink700: "#262931",

  bone50: "#f5f2ea",
  bone100: "#ece9e0",
  bone300: "#cfccc2",

  fog400: "#909299",
  fog500: "#6f7178",
  fog600: "#54565d",

  ember300: "#ffb238",
  ember400: "#ff8a3d",
  ember500: "#ff6a2b",
  ember600: "#e8531a",

  mint400: "#6fd6a8",
  mint500: "#46c28c",
  gold400: "#e5b23e",
  lilac400: "#b79cff",
  sky400: "#7ab8ff",
  coral400: "#ff7a6b",

  white: "#ffffff",
  black: "#000000",
} as const;

export const alpha = {
  /** rgba() helper — RN has no `white/5` shorthand. */
  hex: (hex: string, a: number): string => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },
};

/** Hairline borders used across cards (`border-white/5` in the web build). */
export const hairline = "rgba(255, 255, 255, 0.06)";
export const hairlineStrong = "rgba(255, 255, 255, 0.12)";

export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
  displaySemi: "SpaceGrotesk_600SemiBold",
  ui: "Manrope_500Medium",
  uiRegular: "Manrope_400Regular",
  uiSemi: "Manrope_600SemiBold",
  uiBold: "Manrope_700Bold",
  uiBlack: "Manrope_800ExtraBold",
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

export const space = (n: number) => n * 4;

/** Semantic surfaces so screens read tersely. */
export const surfaces = {
  screen: colors.ink950,
  card: colors.ink850,
  cardRaised: colors.ink800,
  input: colors.ink750,
  nav: colors.ink900,
};

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  float: {
    shadowColor: colors.ember500,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

// ─── Tag / priority / habit palettes (was Tailwind class strings) ───────────

export interface ColorPair {
  /** Foreground / icon colour */
  text: string;
  /** Soft background chip colour */
  soft: string;
  /** Solid dot colour */
  dot: string;
}

const pair = (hex: string): ColorPair => ({
  text: hex,
  soft: alpha.hex(hex, 0.14),
  dot: hex,
});

export const TAG_COLORS: Record<string, ColorPair> = {
  work: pair(colors.sky400),
  personal: pair(colors.lilac400),
  health: pair(colors.mint400),
  learning: pair(colors.gold400),
  home: pair(colors.coral400),
  ember: pair(colors.ember400),
  sky: pair(colors.sky400),
  lilac: pair(colors.lilac400),
  mint: pair(colors.mint400),
  gold: pair(colors.gold400),
  coral: pair(colors.coral400),
};

export const FALLBACK_TAG: ColorPair = {
  text: colors.fog400,
  soft: "rgba(255,255,255,0.05)",
  dot: colors.fog500,
};

export const TAG_META: Record<string, { label: string; color: ColorPair }> = {
  work: { label: "Work", color: TAG_COLORS.work },
  personal: { label: "Personal", color: TAG_COLORS.personal },
  health: { label: "Health", color: TAG_COLORS.health },
  learning: { label: "Learning", color: TAG_COLORS.learning },
  home: { label: "Home", color: TAG_COLORS.home },
};

export const PRIORITY_META: Record<
  1 | 2 | 3,
  { label: string; color: ColorPair; ring: string }
> = {
  1: { label: "Must", color: pair(colors.ember500), ring: colors.ember500 },
  2: { label: "Should", color: pair(colors.gold400), ring: colors.gold400 },
  3: { label: "Could", color: pair(colors.fog400), ring: colors.fog500 },
};

export const HABIT_COLORS: Record<string, ColorPair> = {
  ember: pair(colors.ember500),
  mint: pair(colors.mint500),
  gold: pair(colors.gold400),
  lilac: pair(colors.lilac400),
  sky: pair(colors.sky400),
};

/** Streak status → accent colour, mirrors the web badges. */
export const STATUS_ACCENT: Record<string, string> = {
  SAFE: colors.mint400,
  AT_RISK: colors.gold400,
  FINAL_WARNING: colors.coral400,
  VACATION: colors.sky400,
  INACTIVE: colors.fog400,
  INACTIVE_WARNING: colors.gold400,
  PROTECTED: colors.lilac400,
};
