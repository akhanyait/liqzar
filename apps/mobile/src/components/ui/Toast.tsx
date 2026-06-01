/**
 * Toast — In-app toast notification system.
 * Provides a ToastProvider context and useToast() hook.
 *
 * Usage:
 *   // Wrap app in ToastProvider (in App.tsx)
 *   <ToastProvider>...</ToastProvider>
 *
 *   // In any component
 *   const { showToast } = useToast();
 *   showToast({ message: "Added to cart", type: "success" });
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { View, Text, Animated, StyleSheet, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius, typography, animation } from "../../theme";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: ToastMessage) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

const TOAST_ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "close-circle",
  info: "information-circle",
  warning: "warning",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: animation.normal,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: animation.normal,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback(
    (msg: ToastMessage) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(msg);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 200,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: animation.fast,
          useNativeDriver: true,
        }),
      ]).start();
      timerRef.current = setTimeout(hideToast, msg.duration || 3000);
    },
    [translateY, opacity, hideToast],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const type = toast?.type || "info";
  const toastColor =
    type === "success"
      ? colors.status.success
      : type === "error"
        ? colors.status.error
        : type === "warning"
          ? colors.status.warning
          : colors.status.info;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            {
              top: insets.top + spacing.sm,
              backgroundColor: colors.background.elevated,
              borderLeftColor: toastColor,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <Ionicons name={TOAST_ICONS[type]} size={22} color={toastColor} />
          <Text
            style={[
              typography.bodySmall,
              styles.toastText,
              { color: colors.text.primary },
            ]}
            numberOfLines={2}
          >
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    gap: spacing.sm,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastText: {
    flex: 1,
  },
});

export default ToastProvider;
