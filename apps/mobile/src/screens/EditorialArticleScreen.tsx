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
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography } from "../theme";
import { getEditorialBySlug, getRelatedEditorial } from "../data/editorial";

const { width } = Dimensions.get("window");

/**
 * EditorialArticleScreen — mobile mirror of /editorial/:slug.
 * Hero + prose + optional pull-quote + shop CTA + related strip.
 */
const EditorialArticleScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug as string | undefined;
  const article = slug ? getEditorialBySlug(slug) : undefined;

  if (!article) {
    return (
      <SafeAreaView
        style={[
          styles.safe,
          { backgroundColor: colors.background.primary, padding: spacing.xl },
        ]}
      >
        <Text style={{ color: colors.text.primary }}>Story not found.</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Editorial")}>
          <Text style={{ color: colors.primary, marginTop: spacing.md }}>
            Back to Editorial
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const related = getRelatedEditorial(article.slug, 3);
  const published = new Date(article.publishedAt).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: article.heroImage }} style={styles.hero} />
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={styles.heroTopBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.heroBackBtn}
              accessibilityLabel="Back"
            >
              <Icon name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Meta */}
        <View style={styles.metaBlock}>
          <View
            style={[styles.categoryPill, { backgroundColor: colors.primary + "22" }]}
          >
            <Text style={[styles.categoryPillText, { color: colors.primary }]}>
              {article.category.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {article.title}
          </Text>
          <Text style={[styles.dek, { color: colors.text.muted }]}>
            {article.dek}
          </Text>
          <View style={styles.authorRow}>
            <Text style={[styles.authorName, { color: colors.text.primary }]}>
              {article.author.name}
            </Text>
            <Text style={[styles.authorRole, { color: colors.text.muted }]}>
              {"  "}
              {article.author.role}
            </Text>
          </View>
          <View style={styles.smallMetaRow}>
            <Text style={[styles.smallMeta, { color: colors.text.muted }]}>
              {published}
            </Text>
            <Text style={[styles.smallMeta, { color: colors.text.muted }]}>
              {"  ·  "}
            </Text>
            <Icon name="time-outline" size={12} color={colors.text.muted} />
            <Text style={[styles.smallMeta, { color: colors.text.muted }]}>
              {" "}
              {article.readMinutes} min read
            </Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {article.body.map((p, i) => (
            <Text
              key={i}
              style={[
                styles.paragraph,
                { color: colors.text.primary + "EE" },
                i === 0 ? styles.firstParagraph : null,
              ]}
            >
              {p}
            </Text>
          ))}

          {!!article.pullQuote && (
            <View
              style={[styles.pullQuote, { borderLeftColor: colors.primary }]}
            >
              <Text
                style={[styles.pullQuoteText, { color: colors.text.primary }]}
              >
                “{article.pullQuote}”
              </Text>
            </View>
          )}

          {article.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {article.tags.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.tag,
                    { backgroundColor: colors.background.card },
                  ]}
                >
                  <Text style={[styles.tagText, { color: colors.text.primary }]}>
                    {t}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {!!article.relatedSearchTerm && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                navigation.navigate("Search", {
                  initialQuery: article.relatedSearchTerm,
                })
              }
              style={styles.shopCta}
            >
              <LinearGradient
                colors={["#D4AF37", "#B8962E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.shopCtaGrad}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.shopCtaKicker}>CONTINUE THE STORY</Text>
                  <Text style={styles.shopCtaTitle}>
                    {article.relatedSearchLabel || "Shop the range"}
                  </Text>
                </View>
                <Icon name="arrow-forward" size={22} color="#1c1810" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Related */}
        {related.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text.primary, paddingHorizontal: spacing.lg },
              ]}
            >
              More Stories
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}
            >
              {related.map((r) => (
                <TouchableOpacity
                  key={r.slug}
                  activeOpacity={0.9}
                  onPress={() =>
                    navigation.replace("EditorialArticle", { slug: r.slug })
                  }
                  style={[
                    styles.relatedCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Image
                    source={{ uri: r.heroImage }}
                    style={styles.relatedImage}
                  />
                  <View style={{ padding: spacing.md }}>
                    <Text
                      style={[styles.category, { color: colors.primary }]}
                    >
                      {r.category.toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.relatedTitle,
                        { color: colors.text.primary },
                      ]}
                      numberOfLines={2}
                    >
                      {r.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  heroWrap: { position: "relative", width: "100%", height: 280 },
  hero: { width: "100%", height: "100%" },
  heroTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    padding: spacing.md,
  },
  heroBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: spacing.sm,
    lineHeight: 34,
  },
  dek: {
    fontSize: 15,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  authorRow: {
    flexDirection: "row",
    marginTop: spacing.md,
    alignItems: "baseline",
  },
  authorName: { fontSize: 13, fontWeight: "700" },
  authorRole: { fontSize: 13 },
  smallMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  smallMeta: { fontSize: 12 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  paragraph: {
    fontSize: 16,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  firstParagraph: { fontSize: 17 },
  pullQuote: {
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    marginVertical: spacing.lg,
  },
  pullQuoteText: {
    fontSize: 20,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 28,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: spacing.lg,
  },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 11, fontWeight: "500" },
  shopCta: { marginTop: spacing.xl, borderRadius: borderRadius.lg },
  shopCtaGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  shopCtaKicker: {
    fontSize: 10,
    fontWeight: "900",
    color: "#1c1810",
    letterSpacing: 2,
    opacity: 0.8,
  },
  shopCtaTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1c1810",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  category: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  relatedCard: {
    width: width * 0.7,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  relatedImage: { width: "100%", height: 130 },
  relatedTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
});

export default EditorialArticleScreen;
