import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import type { AdminAuditLog } from "../types";

const ACTION_ICONS: Record<string, string> = {
  status_change: "swap-horizontal-outline",
  cancel_order: "close-circle-outline",
  refund: "card-outline",
  assign_driver: "person-outline",
  update_product: "pricetag-outline",
  create_promo: "gift-outline",
  resolve_dispute: "checkmark-circle-outline",
  zone_update: "map-outline",
};

const TARGET_COLORS: Record<string, string> = {
  order: "#3B82F6",
  product: "#8B5CF6",
  driver: "#F59E0B",
  customer: "#10B981",
  promo: "#EC4899",
  zone: "#06B6D4",
  dispute: "#EF4444",
};

export default function AdminAuditLogScreen() {
  const { colors, gradients, shadows } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 30;

  const fetchLogs = useCallback(async (pageNum: number, append = false) => {
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const results = data || [];
      if (results.length < PAGE_SIZE) setHasMore(false);

      if (append) {
        setLogs((prev) => [...prev, ...results]);
      } else {
        setLogs(results);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    fetchLogs(0);
  }, [fetchLogs]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  }, [page, hasMore, loading, fetchLogs]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderLogItem = ({ item }: { item: AdminAuditLog }) => {
    const targetColor = TARGET_COLORS[item.target_type] || colors.gold.primary;
    const actionIcon = ACTION_ICONS[item.action] || "document-text-outline";

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
          },
        ]}
      >
        <View style={styles.cardRow}>
          <View
            style={[styles.actionIcon, { backgroundColor: targetColor + "18" }]}
          >
            <Icon name={actionIcon} size={18} color={targetColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.actionHeader}>
              <Text style={[styles.actionText, { color: colors.text.primary }]}>
                {item.action.replace(/_/g, " ")}
              </Text>
              <View
                style={[
                  styles.targetBadge,
                  { backgroundColor: targetColor + "20" },
                ]}
              >
                <Text style={[styles.targetText, { color: targetColor }]}>
                  {item.target_type}
                </Text>
              </View>
            </View>
            <Text style={[styles.adminName, { color: colors.text.muted }]}>
              by {item.admin_name || item.admin_id?.slice(0, 8) || "System"}
            </Text>
            {item.target_id && (
              <Text style={[styles.targetId, { color: colors.text.dim }]}>
                Target: {item.target_id.slice(0, 12)}...
              </Text>
            )}
            {item.metadata && typeof item.metadata === "object" && (
              <View
                style={[
                  styles.metadataBox,
                  {
                    backgroundColor: colors.background.primary,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                {Object.entries(item.metadata as Record<string, unknown>)
                  .slice(0, 3)
                  .map(([key, val]) => (
                    <Text
                      key={key}
                      style={[styles.metadataText, { color: colors.text.dim }]}
                      numberOfLines={1}
                    >
                      {key}: {String(val)}
                    </Text>
                  ))}
              </View>
            )}
          </View>
          <Text style={[styles.timestamp, { color: colors.text.dim }]}>
            {formatTimestamp(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: colors.gold.faint },
        ]}
      >
        <Icon
          name="document-text-outline"
          size={48}
          color={colors.gold.muted}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        No Audit Logs
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
        Admin actions will appear here.
      </Text>
    </View>
  );

  if (loading && logs.length === 0) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>
          Loading audit logs...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background.primary }]}
    >
      <LinearGradient
        colors={[...gradients.header]}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <BrandMark size="xs" />
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Audit Log
          </Text>
        </View>
        <View style={{ width: 32 }}>
          <Text style={[styles.countBadge, { color: colors.gold.primary }]}>
            {logs.length}
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={
          hasMore && logs.length > 0 ? (
            <ActivityIndicator
              size="small"
              color={colors.gold.primary}
              style={{ paddingVertical: spacing.lg }}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: spacing.sm, ...typography.body },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h3, fontWeight: "700" },
  countBadge: { ...typography.caption, fontWeight: "700", textAlign: "right" },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: "row", gap: spacing.sm },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  actionText: {
    ...typography.body,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  targetBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  targetText: { ...typography.caption, fontWeight: "600" },
  adminName: { ...typography.caption, marginBottom: 2 },
  targetId: { ...typography.caption },
  metadataBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metadataText: { ...typography.caption },
  timestamp: { ...typography.caption },
  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, textAlign: "center" },
});
