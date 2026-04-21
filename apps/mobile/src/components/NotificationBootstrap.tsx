import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { NotificationService } from "../services/NotificationService";

/**
 * Registers push notifications + foreground listeners the moment a user is
 * authenticated, regardless of role (customer / driver / admin). Rendered once
 * inside AuthProvider. Keeps NotificationService a singleton and guarantees a
 * single permission prompt per session.
 */
export default function NotificationBootstrap() {
  const { user } = useAuth();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (registeredFor.current === user.id) return;
    registeredFor.current = user.id;

    let cancelled = false;
    (async () => {
      const result = await NotificationService.registerForPushNotifications();
      if (cancelled) return;
      // Downgrade to info — these are expected runtime states (user declined,
      // or device/build doesn't support push), not warnings. Using console.warn
      // triggers the dev LogBox toast, which leaks developer plumbing into the
      // premium consumer UI.
      if (result.denied) {
        console.info("[NotificationBootstrap] Permission denied by user");
      } else if (result.unavailable) {
        console.info("[NotificationBootstrap] Push unavailable on this build");
      }
    })();

    NotificationService.setupListeners();

    return () => {
      cancelled = true;
      NotificationService.removeListeners();
    };
  }, [user?.id]);

  return null;
}
