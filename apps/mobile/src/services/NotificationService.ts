/**
 * NotificationService - Push notification management
 * Wires expo-notifications for order updates, driver assignment, etc.
 */
let Notifications: any = null;
let Device: any = null;
try {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
} catch {
  console.warn(
    "[NotificationService] Native notification modules not available in this build. Push notifications will be disabled.",
  );
}
import { Platform, Linking } from "react-native";
import { supabase } from "../lib/supabase";
import Constants from "expo-constants";

// Configure notification behavior (only if native module available)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export interface PushRegistrationResult {
  token: string | null;
  /** true when the user explicitly denied permission (or has it blocked in OS settings) */
  denied: boolean;
  /** true when expo-notifications native module is unavailable (simulator / bare build) */
  unavailable: boolean;
}

class NotificationServiceClass {
  private static instance: NotificationServiceClass;
  private pushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  static getInstance(): NotificationServiceClass {
    if (!NotificationServiceClass.instance) {
      NotificationServiceClass.instance = new NotificationServiceClass();
    }
    return NotificationServiceClass.instance;
  }

  /** Whether expo-notifications native modules are loaded and available */
  get modulesAvailable(): boolean {
    return !!Notifications && !!Device;
  }

  /**
   * Register for push notifications and save token.
   * Returns a PushRegistrationResult so callers can surface permission-denied UI
   * and prompt the user to open OS Settings.
   */
  async registerForPushNotifications(): Promise<PushRegistrationResult> {
    if (!Notifications || !Device) {
      console.warn("[NotificationService] Native modules unavailable — skipping push registration");
      return { token: null, denied: false, unavailable: true };
    }

    if (!Device.isDevice) {
      console.warn(
        "[NotificationService] Push notifications require a physical device",
      );
      return { token: null, denied: false, unavailable: true };
    }

    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      const isDenied = finalStatus === "denied";
      console.warn(
        `[NotificationService] Permission not granted (status=${finalStatus}). isDenied=${isDenied}`,
      );
      return { token: null, denied: isDenied, unavailable: false };
    }

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.error(
          "[NotificationService] Missing EAS projectId in app.config extras — push token registration will fail",
        );
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });
      this.pushToken = tokenData.data;

      // Save token to Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ push_token: this.pushToken })
          .eq("id", user.id);
      }

      // Configure Android channel
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("orders", {
          name: "Order Updates",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#D4AF37",
        });
      }

      return { token: this.pushToken, denied: false, unavailable: false };
    } catch (error) {
      console.error("[NotificationService] Token registration error:", error);
      return { token: null, denied: false, unavailable: false };
    }
  }

  /**
   * Open the OS notification settings for this app.
   * Call when the user taps a "Fix in Settings" prompt after permission denial.
   */
  async openNotificationSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error("[NotificationService] openNotificationSettings error:", error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupListeners(
    onNotification?: (notification: any) => void,
    onResponse?: (response: any) => void,
  ) {
    if (!Notifications) {
      console.warn("[NotificationService] setupListeners skipped — native modules unavailable");
      return;
    }

    try {
      // Listen for incoming notifications while app is foregrounded
      this.notificationListener = Notifications.addNotificationReceivedListener(
        (notification: any) => {
          onNotification?.(notification);
        },
      );

      // Listen for notification taps
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener((response: any) => {
          onResponse?.(response);
          // Handle deep linking based on notification data
          const data = response.notification.request.content.data;
          if (data?.orderId) {
            // Navigation to order detail would be handled by the callback
          }
        });
    } catch (error) {
      console.error("[NotificationService] setupListeners error:", error);
    }
  }

  /**
   * Remove notification listeners
   */
  removeListeners() {
    if (!Notifications) return;

    try {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener);
      }
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener);
      }
    } catch (error) {
      console.error("[NotificationService] removeListeners error:", error);
    }
  }

  /**
   * Send local notification (for real-time Supabase events)
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
  ) {
    if (!Notifications) {
      console.warn("[NotificationService] sendLocalNotification skipped — native modules unavailable");
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: "default",
        },
        trigger: null, // Immediate
      });
    } catch (error) {
      console.error("[NotificationService] sendLocalNotification error:", error);
    }
  }

  /**
   * Create notification record in database
   */
  async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ) {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
      });
      if (error) {
        console.error(`[NotificationService] createNotification DB error for user ${userId}:`, error);
      }
    } catch (error) {
      console.error("[NotificationService] createNotification error:", error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) {
        console.error(`[NotificationService] getUnreadCount error for user ${userId}:`, error);
        return 0;
      }
      return count || 0;
    } catch (error) {
      console.error("[NotificationService] getUnreadCount error:", error);
      return 0;
    }
  }
}

export const NotificationService = NotificationServiceClass.getInstance();
