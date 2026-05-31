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
  /** Write current diagnostic status to the user's profile so we can query it from Supabase. */
  private async logStatus(message: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            push_registration_status: message,
            push_registration_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    } catch {
      /* never throw from diagnostics */
    }
  }

  async registerForPushNotifications(): Promise<PushRegistrationResult> {
    console.log("[NotificationService] STEP 1: starting registration...");
    await this.logStatus("STEP 1: starting registration");

    if (!Notifications || !Device) {
      console.warn("[NotificationService] STEP 1 FAIL: native modules unavailable");
      await this.logStatus("STEP 1 FAIL: native modules unavailable");
      return { token: null, denied: false, unavailable: true };
    }
    console.log("[NotificationService] STEP 1 OK: native modules loaded");

    if (!Device.isDevice) {
      console.warn("[NotificationService] STEP 2 FAIL: not a physical device");
      await this.logStatus("STEP 2 FAIL: not a physical device");
      return { token: null, denied: false, unavailable: true };
    }
    console.log("[NotificationService] STEP 2 OK: physical device");

    // Check existing permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    console.log(`[NotificationService] STEP 3: existing permission status = ${existingStatus}`);

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log(`[NotificationService] STEP 3: after request = ${status}`);
    }

    if (finalStatus !== "granted") {
      const isDenied = finalStatus === "denied";
      console.warn(`[NotificationService] STEP 3 FAIL: permission ${finalStatus}`);
      await this.logStatus(`STEP 3 FAIL: permission=${finalStatus}`);
      return { token: null, denied: isDenied, unavailable: false };
    }
    console.log("[NotificationService] STEP 3 OK: permission granted");
    await this.logStatus("STEP 3 OK: permission granted, fetching token...");

    // Get Expo push token
    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      console.log(`[NotificationService] STEP 4: projectId = ${projectId}`);
      if (!projectId) {
        console.error("[NotificationService] STEP 4 FAIL: missing EAS projectId");
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });
      this.pushToken = tokenData.data;
      console.log(
        `[NotificationService] STEP 4 OK: token = ${(this.pushToken ?? "").slice(0, 30)}...`,
      );
      await this.logStatus(
        `STEP 4 OK: token=${(this.pushToken ?? "").slice(0, 30)}...`,
      );

      // Save token to Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log(`[NotificationService] STEP 5: user.id = ${user?.id ?? "null"}`);
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .update({
            push_token: this.pushToken,
            push_registration_status: `STEP 5 OK: token saved at ${new Date().toISOString()}`,
            push_registration_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select();
        if (error) {
          console.error(
            `[NotificationService] STEP 5 FAIL: Supabase update error:`,
            error,
          );
          await this.logStatus(`STEP 5 FAIL: ${error.message}`);
        } else {
          console.log(
            `[NotificationService] STEP 5 OK: updated ${data?.length ?? 0} profile rows`,
          );
          if (!data || data.length === 0) {
            console.warn(
              `[NotificationService] STEP 5 WARN: 0 rows matched id=${user.id} — profile row missing in DB`,
            );
            await this.logStatus(`STEP 5 WARN: 0 rows matched id=${user.id}`);
          }
        }
      } else {
        console.error("[NotificationService] STEP 5 FAIL: no authenticated user");
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
    } catch (error: any) {
      console.error("[NotificationService] Token registration error:", error);
      await this.logStatus(`STEP 4 FAIL: ${error?.message ?? String(error)}`);
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
