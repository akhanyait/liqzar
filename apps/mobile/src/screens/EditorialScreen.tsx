import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography } from "../theme";
import { EDITORIAL_ARTICLES } from "../data/editorial";

/**
 * EditorialScreen — mobile mirror of /editorial.
 * Featured hero + scrollable list of remaining articles.
 */
const EditorialScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [featured, ...rest] = EDITORIAL_ARTICLES;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              styles.backBtn,
              { backgroundColor: colors.background.card },
            ]}
            accessibilityLabel="Back"
          >
            <Icon name="chevron-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.kicker}>
            <Icon name="book-outline" size={14} color={colors.gold.primary} />
            <Text style={[styles.kickerText, { color: colors.gold.primary }]}>
              SIP STORIES
            </Text>
          </View>
        </View>

        <BrandMark size="xs" />
        <Text style={[styles.h1, { color: colors.text.primary }]}>
          The LIQZAR Editorial
        </Text>
        <Text style={[styles.dek, { color: colors.text.muted }]}>
          Heritage, craft, pairings, and the quiet rituals behind the finest
          pours.
        </Text>

        {/* Featured card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate("EditorialArticle", { slug: featured.slug })
          }
          style={[
            styles.featuredCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={{ uri: featured.heroImage }}
            style={styles.featuredImage}
          />
          <View style={styles.featuredPill}>
            <Text style={styles.featuredPillText}>FEATURED</Text>
          </View>
          <View style={styles.featuredBody}>
            <Text style={[styles.category, { color: colors.gold.primary }]}>
              {featured.category.toUpperCase()}
            </Text>
            <Text style={[styles.featuredTitle, { color: colors.text.primary }]}>
              {featured.title}
            </Text>
            <Text
              style={[styles.cardDek, { color: colors.text.muted }]}
              numberOfLines={3}
            >
              {featured.dek}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: colors.text.primary }]}>
                {featured.author.name}
              </Text>
              <Text style={[styles.dot, { color: colors.text.muted }]}>·</Text>
              <Icon name="time-outline" size={12} color={colors.text.muted} />
              <Text style={[styles.meta, { color: colors.text.muted }]}>
                {featured.readMinutes} min
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* More stories */}
        <Text
          style={[styles.sectionTitle, { color: colors.text.primary }]}
        >
          More from the Editorial
        </Text>

        <View style={styles.grid}>
          {rest.map((article) => (
            <TouchableOpacity
              key={article.slug}
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate("EditorialArticle", { slug: article.slug })
              }
              style={[
                styles.card,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Image
                source={{ uri: article.heroImage }}
                style={styles.cardImage}
              />
              <View style={styles.cardBody}>
                <Text style={[styles.category, { color: colors.gold.primary }]}>
                  {article.category.toUpperCase()}
                </Text>
                <Text
                  style={[styles.cardTitle, { color: colors.text.primary }]}
                  numberOfLines={2}
                >
                  {article.title}
                </Text>
                <Text
                  style={[styles.cardDek, { color: colors.text.muted }]}
                  numberOfLines={2}
                >
                  {article.dek}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.text.primary }]}>
                    {article.author.name}
                  </Text>
                  <Text style={[styles.dot, { color: colors.text.muted }]}>
                    ·
                  </Text>
                  <Icon
                    name="time-outline"
                    size={12}
                    color={colors.text.muted}
                  />
                  <Text style={[styles.meta, { color: colors.text.muted }]}>
                    {article.readMinutes} min
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: spacing.xs,
  },
  kickerText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  h1: {
    fontSize: 30,
    fontWeight: "800",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    lineHeight: 36,
  },
  dek: {
    fontSize: 14,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  featuredCard: {
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
  },
  featuredImage: { width: "100%", height: 220 },
  featuredPill: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    backgroundColor: "#D4AF37",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  featuredPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#1c1810",
    letterSpacing: 2,
  },
  featuredBody: { padding: spacing.lg },
  featuredTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  grid: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  cardImage: { width: "100%", height: 150 },
  cardBody: { padding: spacing.md },
  category: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 21,
  },
  cardDek: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  meta: { fontSize: 11, fontWeight: "500" },
  dot: { fontSize: 11 },
});

export default EditorialScreen;
