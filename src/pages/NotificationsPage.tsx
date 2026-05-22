import {
  Bell,
  BellOff,
  Package,
  Truck,
  Gift,
  AlertCircle,
  CheckCircle,
  Tag,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isThisWeek,
} from "date-fns";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/context/AuthContext";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import type { Notification } from "@/hooks/useNotifications";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";

/* ── Icon + colour maps ── */
const iconMap: Record<string, React.ElementType> = {
  order: Package,
  delivery: Truck,
  promo: Gift,
  alert: AlertCircle,
  success: CheckCircle,
  promotion: Tag,
  ai: Sparkles,
  default: Bell,
};

const bgMap: Record<string, string> = {
  order: "bg-blue-500/15 text-blue-500",
  delivery: "bg-emerald-500/15 text-emerald-500",
  promo: "bg-purple-500/15 text-purple-500",
  alert: "bg-amber-500/15 text-amber-500",
  success: "bg-green-500/15 text-green-500",
  promotion: "bg-pink-500/15 text-pink-500",
  ai: "bg-primary/15 text-primary",
  default: "bg-primary/15 text-primary",
};

/* ── Group notifications by recency ── */
function groupByDate(notifications: Notification[]) {
  const groups: { label: string; items: Notification[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];
  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (isToday(d)) groups[0].items.push(n);
    else if (isYesterday(d)) groups[1].items.push(n);
    else if (isThisWeek(d)) groups[2].items.push(n);
    else groups[3].items.push(n);
  }
  return groups.filter((g) => g.items.length > 0);
}

/* ── Notification card ── */
const NotificationItem = ({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) => {
  const Icon = iconMap[notification.type] ?? iconMap.default;
  const iconClass = bgMap[notification.type] ?? bgMap.default;
  const isUnread = !notification.is_read;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.25 }}
      onClick={() => isUnread && onRead(notification.id)}
      className={[
        "w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isUnread
          ? "bg-card border border-border shadow-sm hover:bg-secondary/50 relative overflow-hidden"
          : "bg-secondary/40 hover:bg-secondary/60",
      ].join(" ")}
    >
      {/* Left unread accent bar */}
      {isUnread && (
        <span
          className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary"
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      <span
        className={`w-10 h-10 rounded-xl ${iconClass} flex items-center justify-center flex-shrink-0 mt-0.5`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={`font-semibold text-sm leading-snug ${
              isUnread ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {notification.title}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isUnread && (
              <span
                className="w-2 h-2 rounded-full bg-primary flex-shrink-0"
                aria-label="Unread"
              />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-medium">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>

      {/* Chevron cue for actionable items */}
      {isUnread && (
        <ChevronRight
          className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5 self-center"
          aria-hidden
        />
      )}
    </motion.button>
  );
};

/* ── Date group header ── */
const GroupHeader = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 px-1 pt-2 pb-1">
    <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
      {label}
    </span>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

/* ── Permission banner ── */
const PermissionBanner = ({
  onRequest,
  status,
}: {
  onRequest: () => void;
  status: NotificationPermission | null;
}) => {
  if (status === "denied") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
        <BellOff
          className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
          strokeWidth={1.75}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Notifications blocked
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Push notifications are blocked in your browser settings. To receive
            order updates, enable notifications for this site in your browser
            settings.
          </p>
        </div>
      </div>
    );
  }
  if (status === "default") {
    return (
      <button
        onClick={onRequest}
        className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/8 border border-primary/20 mb-4 text-left hover:bg-primary/12 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
      >
        <Bell
          className="w-5 h-5 text-primary flex-shrink-0"
          strokeWidth={1.75}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Enable push notifications
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get real-time updates on your orders and deliveries.
          </p>
        </div>
        <ChevronRight
          className="w-4 h-4 text-primary flex-shrink-0"
          aria-hidden
        />
      </button>
    );
  }
  return null;
};

/* ── Skeleton loader ── */
const NotificationSkeleton = () => (
  <div className="flex items-start gap-3 p-4">
    <div className="w-10 h-10 rounded-xl bg-muted skeleton-shimmer flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-2/3 rounded bg-muted skeleton-shimmer" />
      <div className="h-3 w-full rounded bg-muted skeleton-shimmer" />
      <div className="h-2.5 w-1/4 rounded bg-muted skeleton-shimmer" />
    </div>
  </div>
);

/* ── Empty state ── */
const EmptyState = () => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mb-5">
      <Bell className="w-9 h-9 text-muted-foreground/50" strokeWidth={1.25} />
    </div>
    <h3 className="font-bold text-lg text-foreground">All caught up!</h3>
    <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
      You have no notifications right now. Order updates and promotions will
      appear here.
    </p>
  </motion.div>
);

/* ── Page ── */
const NotificationsPage = () => {
  const { user } = useAuth();
  const { data: notifications, isLoading } = useNotifications(user?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead(user?.id);
  const { permissionStatus, hasPermission } = useLocalNotifications();

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  const groups = useMemo(
    () => groupByDate(notifications ?? []),
    [notifications],
  );

  const handleRequestPermission = () => {
    if (!("Notification" in window)) return;
    Notification.requestPermission();
  };

  return (
    <div className="pb-28 bg-background min-h-screen overflow-x-hidden">
      {/* Header */}
      <div className="bg-header border-b border-amber-500/10 pt-safe-top">
        <div className="container flex items-center gap-3 h-14 px-4">
          <BackButton />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-header-foreground font-display tracking-wide truncate">
              Notifications
            </h1>
            <p className="text-[11px] text-header-foreground/60 mt-0.5">
              {isLoading
                ? "Loading…"
                : unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && !isLoading && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-[11px] font-semibold text-primary px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50 whitespace-nowrap"
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="container px-4 pt-4">
        {/* Permission banner */}
        {!hasPermission && (
          <PermissionBanner
            status={permissionStatus}
            onRequest={handleRequestPermission}
          />
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          /* Grouped notification list */
          <AnimatePresence mode="popLayout">
            <div className="space-y-1">
              {groups.map((group) => (
                <div key={group.label}>
                  <GroupHeader label={group.label} />
                  <div className="space-y-1.5">
                    {group.items.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={(id) => markRead.mutate(id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AnimatePresence>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
