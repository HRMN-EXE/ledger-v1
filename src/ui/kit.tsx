// ─── Ledger UI kit ──────────────────────────────────────────────────────────
// Native equivalents of the web kit (`ui.tsx`): ring, sheet, segmented
// control, toggle, chips, buttons. Same shapes, same spacing rhythm.

import { Ionicons } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { alpha, colors, fonts, hairline, hairlineStrong, radius, shadow } from "@/theme/theme";

// ─── Text ───────────────────────────────────────────────────────────────────

type TextVariant = "display" | "title" | "body" | "label" | "caption" | "micro";

const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 26, color: colors.bone50, letterSpacing: -0.4 },
  title: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.bone50 },
  body: { fontFamily: fonts.ui, fontSize: 14, color: colors.bone100, lineHeight: 20 },
  label: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.bone300 },
  caption: { fontFamily: fonts.uiSemi, fontSize: 11, color: colors.fog400, lineHeight: 16 },
  micro: { fontFamily: fonts.uiBold, fontSize: 9.5, color: colors.fog500, letterSpacing: 1.4, textTransform: "uppercase" },
};

export function Txt({
  variant = "body",
  color,
  style,
  numberOfLines,
  children,
  onPress,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      style={[VARIANTS[variant], color ? { color } : null, style]}
    >
      {children}
    </Text>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Txt variant="micro" color={colors.fog500}>
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Txt variant="micro" color={colors.fog500} style={{ marginBottom: 6 }}>
      {children}
    </Txt>
  );
}

// ─── Ring ───────────────────────────────────────────────────────────────────

export function Ring({
  value,
  size = 64,
  stroke = 6,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.ember300} />
            <Stop offset="1" stopColor={colors.ember500} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
  accent,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accent?: string;
}) {
  const body = (
    <View style={[styles.card, accent ? { borderColor: alpha.hex(accent, 0.35) } : null, style]}>{children}</View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}>
      {body}
    </Pressable>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: hairline }, style]} />;
}

export function Chip({
  label,
  color = colors.fog400,
  bg,
  icon,
  onPress,
  style,
}: {
  label: string;
  color?: string;
  bg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg ?? alpha.hex(color, 0.12), borderColor: alpha.hex(color, 0.28) },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export function Dot({ color, size = 8, glow = false }: { color: string; size?: number; glow?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        ...(glow ? { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6 } : null),
      }}
    />
  );
}

// ─── Controls ───────────────────────────────────────────────────────────────

export function Btn({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "soft" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.ember500, fg: colors.ink950, border: "transparent" },
    ghost: { bg: "transparent", fg: colors.bone300, border: hairlineStrong },
    soft: { bg: "rgba(255,255,255,0.06)", fg: colors.bone100, border: "transparent" },
    danger: { bg: alpha.hex(colors.coral400, 0.14), fg: colors.coral400, border: alpha.hex(colors.coral400, 0.3) },
  }[variant];

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed ? { opacity: 0.8 } : null,
        disabled ? { opacity: 0.45 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={15} color={palette.fg} /> : null}
          <Text style={[styles.btnText, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  onPress,
  color = colors.fog400,
  size = 18,
  bg = "rgba(255,255,255,0.05)",
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  bg?: string;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg }, pressed ? { opacity: 0.7 } : null]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
  color?: string;
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active ? styles.segItemActive : null]}
          >
            {o.color ? <Dot color={o.color} size={6} /> : null}
            <Text style={[styles.segText, active ? { color: colors.bone50 } : null]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={on}
      onValueChange={onChange}
      trackColor={{ false: "rgba(255,255,255,0.12)", true: alpha.hex(colors.ember500, 0.7) }}
      thumbColor={on ? colors.ember500 : colors.fog400}
    />
  );
}

export function SettingRow({
  title,
  sub,
  right,
  onPress,
  icon,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const inner = (
    <View style={styles.settingRow}>
      {icon ? (
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={16} color={colors.ember400} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="label" color={colors.bone100}>
          {title}
        </Txt>
        {sub ? (
          <Txt variant="caption" color={colors.fog500} style={{ marginTop: 2 }}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.75 } : null)}>
      {inner}
    </Pressable>
  );
}

// ─── Sheet ──────────────────────────────────────────────────────────────────

export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  scroll = true,
  maxHeight = "92%",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  scroll?: boolean;
  maxHeight?: string;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <View style={[styles.sheetPanel, { maxHeight: maxHeight as ViewStyle["maxHeight"] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Txt variant="title">{title}</Txt>
              {subtitle ? (
                <Txt variant="caption" color={colors.fog500} style={{ marginTop: 2 }}>
                  {subtitle}
                </Txt>
              ) : null}
            </View>
            <IconBtn icon="close" onPress={onClose} label="Close" />
          </View>
          {scroll ? (
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={styles.sheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.sheetBody}>{children}</View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Txt variant="title" color={colors.bone300} style={{ fontSize: 15 }}>
        {title}
      </Txt>
      {sub ? (
        <Txt variant="caption" color={colors.fog500} style={{ marginTop: 6, textAlign: "center", lineHeight: 18 }}>
          {sub}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={styles.toast}>
        <Text style={styles.toastText}>{text}</Text>
      </View>
    </View>
  );
}

export function ProgressBar({ value, color = colors.ember500, height = 4 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <View style={{ width: `${v * 100}%`, height: "100%", backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function Row({
  children,
  style,
  gap = 8,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}

export function Glow({ color = colors.ember500, size = 260, top = -120, opacity = 0.08 }: { color?: string; size?: number; top?: number; opacity?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        alignSelf: "center",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alpha.hex(color, opacity),
      }}
    />
  );
}

export { colors, fonts, shadow };

const ABS_FILL = { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  ringCenter: { ...ABS_FILL, alignItems: "center", justifyContent: "center" },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.ink850,
    padding: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontFamily: fonts.uiBold, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  btnText: { fontFamily: fonts.uiBlack, fontSize: 14 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", backgroundColor: colors.ink750, borderRadius: radius.md, padding: 4, gap: 4 },
  segItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  segItemActive: { backgroundColor: colors.ink700 },
  segText: { fontFamily: fonts.uiBold, fontSize: 11.5, color: colors.fog500 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha.hex(colors.ember500, 0.12),
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...ABS_FILL, backgroundColor: "rgba(0,0,0,0.68)" },
  sheetPanel: {
    backgroundColor: colors.ink850,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderColor: hairlineStrong,
    paddingBottom: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    marginTop: 10,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sheetBody: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  empty: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: alpha.hex(colors.ink800, 0.5),
    paddingHorizontal: 22,
    paddingVertical: 30,
    alignItems: "center",
  },
  toastWrap: { position: "absolute", bottom: 116, left: 0, right: 0, alignItems: "center", zIndex: 80 },
  toast: {
    backgroundColor: colors.bone50,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    maxWidth: "90%",
  },
  toastText: { fontFamily: fonts.uiBold, fontSize: 12.5, color: colors.ink950 },
});
