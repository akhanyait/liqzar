import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { NotificationService } from "../services/NotificationService";
import { spacing, borderRadius, typography } from "../theme";

interface Notification {
  id: string;
  type: "order_update" | "promotion" | "system";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  order_update: "receipt-outline",
  promotion: "pricetag-outline",
  system: "information-circle-outline",
};

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // G12: native module availability banner
  const pushUnavailable = !NotificationService.modulesAvailable;

  useEffect(() => {
    loadNotifications();
  }, []);

  // G13: Realtime subscription — keeps notification list and badge count live
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      if (user?.id) {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setNotifications(data as Notification[]);
        } else {
          setNotifications([]);
        }
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, []);

  const markAsRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );

    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.type === "order_update" && notification.data?.orderId) {
      (navigation as any).navigate("OrderDetail", {
        orderId: notification.data.orderId,
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    return NOTIFICATION_ICONS[type] || "notifications-outline";
  };

  const getIconBackgroundColor = (type: string) => {
    switch (type) {
      case "order_update":
        return "rgba(16, 185, 129, 0.15)";
      case "promotion":
        return "rgba(212, 175, 55, 0.15)";
      case "system":
        return "rgba(59, 130, 246, 0.15)";
      default:
        return colors.gold.faint;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case "order_update":
        return colors.status.success;
      case "promotion":
        return colors.gold.primary;
      case "system":
        return colors.status.info;
      default:
        return colors.gold.primary;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.is_read && styles.notificationCardUnread,
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      {/* Unread Indicator */}
      {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: colors.gold.primary }]} />}

      {/* Icon */}
      <View
        style={[
          styles.notificationIcon,
          { backgroundColor: getIconBackgroundColor(item.type) },
        ]}
      >
        <Icon
          name={getNotificationIcon(item.type)}
          size={22}
          color={getIconColor(item.type)}
        />
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[
              styles.notificationTitle,
              { color: colors.text.muted },
              !item.is_read && [styles.notificationTitleUnread, { color: colors.text.primary }],
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={[styles.notificationTime, { color: colors.text.dim }]}>
            {getTimeAgo(item.created_at)}
          </Text>
        </View>
        <Text
          style={[
            styles.notificationMessage,
            { color: colors.text.dim },
            !item.is_read && { color: colors.text.muted },
          ]}
          numberOfLines={2}
        >
          {item.message}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.gold.faint }]}>
        <Icon
          name="notifications-outline"
          size={48}
          color={colors.gold.muted}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No notifications yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
        When you receive notifications about orders, promotions, and updates,
        they will appear here.
      </Text>
    </View>
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background.card, borderBottomColor: colors.gold.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <BrandMark size="xs" />
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Notifications</Text>
        </View>
        {unreadCount > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: colors.gold.primary }]}>
            <Text style={[styles.unreadBadgeText, { color: colors.text.inverse }]}>{unreadCount}</Text>
          </View>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      {/* G12: Push notifications unavailable banner */}
      {pushUnavailable && (
        <View
          style={{
            backgroundColor: isDark ? "#1C1917" : "#FEF3C7",
            borderBottomWidth: 1,
            borderBottomColor: "#FDE68A",
            paddingVertical: 8,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
          accessibilityRole="alert"
        >
          <Icon name="warning-outline" size={16} color="#92400E" />
          <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 }}>
            Push notifications unavailable in this build.
            You can still view in-app notifications here.
          </Text>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.gold.border }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    ...typography.h3,
  },
  headerRight: {
    width: 40,
  },
  unreadBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
  },
  unreadBadgeText: {
    ...typography.caption,
    fontWeight: "700",
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
  },
  separator: {
    height: 1,
    marginHorizontal: spacing.md,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    position: "relative",
  },
  notificationCardUnread: {
    backgroundColor: "rgba(212,175,55,0.04)",
  },
  unreadDot: {
    position: "absolute",
    top: spacing.md + 2,
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notificationTitle: {
    ...typography.bodySmall,
    fontWeight: "600",
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationTitleUnread: {
    fontWeight: "700",
  },
  notificationTime: {
    ...typography.caption,
  },
  notificationMessage: {
    ...typography.bodySmall,
    lineHeight: 20,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
  },
});
