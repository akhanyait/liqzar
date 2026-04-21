import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Enabled on iOS + Android. Web is a no-op. Each call is wrapped so a missing
// native module (dev client / Expo Go edge cases) never crashes the UI.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

const safe = (fn: () => Promise<unknown> | unknown) => {
  if (!enabled) return;
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === "function") {
      (r as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Silent \u2014 haptics are decorative, never load-bearing.
  }
};

export const haptics = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  selection: () => safe(() => Haptics.selectionAsync()),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
