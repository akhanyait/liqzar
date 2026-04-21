/**
 * useLocalNotifications.ts
 * Uses the Web Notifications API (no Capacitor dependency).
 * On iOS Safari the Notifications API is limited to PWA home-screen installs;
 * full push notifications for mobile use the React Native app (apps/mobile).
 */

import { useCallback, useEffect, useState } from "react";

export const useLocalNotifications = () => {
  const [permissionStatus, setPermissionStatus] = useState<
    NotificationPermission | null
  >(null);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermissionStatus(Notification.permission);

    if (Notification.permission === "default") {
      Notification.requestPermission().then((status) => {
        setPermissionStatus(status);
      });
    }
  }, []);

  const scheduleNotification = useCallback(
    async ({
      title,
      body,
    }: {
      title: string;
      body: string;
      id?: number;
      schedule?: { at: Date };
    }) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      try {
        new Notification(title, {
          body,
          icon: "/liqzar-logo.png",
          badge: "/liqzar-logo.png",
        });
      } catch (error) {
        console.error("Error showing notification:", error);
      }
    },
    [],
  );

  const showNotification = useCallback(
    async (title: string, body: string) => {
      await scheduleNotification({ title, body });
    },
    [scheduleNotification],
  );

  // Web Notifications API does not support cancel by id — no-op for compatibility
  const cancelNotification = useCallback(async (_id: number) => {}, []);
  const cancelAllNotifications = useCallback(async () => {}, []);

  return {
    permissionStatus,
    hasPermission: permissionStatus === "granted",
    scheduleNotification,
    showNotification,
    cancelNotification,
    cancelAllNotifications,
  };
};
