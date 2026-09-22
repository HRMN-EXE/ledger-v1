// ─── UI preferences (theme, sound, haptics) ─────────────────────────────────

const KEY = "ledger-ui-v1";

export type DefaultTab = "today" | "plan" | "focus" | "habits" | "stats";

export interface UiPrefs {
  theme: "dark" | "light";
  sound: boolean;
  haptics: boolean;
  motion: "full" | "reduced";
  confirmDone: boolean;
  defaultTab: DefaultTab;
  defaultFocusMin: number;
}

export const DEFAULT_PREFS: UiPrefs = {
  theme: "dark",
  sound: true,
  haptics: true,
  motion: "full",
  confirmDone: true,
  defaultTab: "today",
  defaultFocusMin: 25,
};

export function loadPrefs(): UiPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<UiPrefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: UiPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function applyTheme(theme: "dark" | "light"): void {
  if (typeof document === "undefined") return;
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

export function applyMotion(motion: "full" | "reduced"): void {
  if (typeof document === "undefined") return;
  if (motion === "reduced") document.documentElement.dataset.motion = "reduced";
  else delete document.documentElement.dataset.motion;
}
