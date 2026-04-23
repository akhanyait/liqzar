import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { productsApi } from "../services/api";
import { spacing, borderRadius, typography } from "../theme";
import { Product } from "../types";
import { EDITORIAL_ARTICLES } from "../data/editorial";
import { supabase } from "../lib/supabase";
import { haptics } from "../utils/haptics";

type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";
const TIER_ACCENT: Record<LoyaltyTier, string> = {
  bronze: "#C27C4A",
  silver: "#B8BCC1",
  gold: "#D4AF37",
  platinum: "#E5E4E2",
};
const TIER_LABEL: Record<LoyaltyTier, string> = {
  bronze: "Bronze Member",
  silver: "Silver Member",
  gold: "Gold Member",
  platinum: "Platinum Member",
};

const { width } = Dimensions.get("window");
// Adaptive card width: 2 cards + margins visible in horizontal scroll
const CARD_MARGIN = 12;
const CARD_WIDTH = Math.floor((width - 32 - CARD_MARGIN) / 2.2);
const CARD_IMG_HEIGHT = Math.floor(CARD_WIDTH * 1.2); // ~5:6 portrait ratio

/* ── Hero banner slides — premium LSM 9-10 positioning, confident exclusivity.
   Editorial tone: gatekept without threat, aspirational without insecurity.
   Images currently point to a neutral amber-whisky fallback; swap to curated
   brand assets (bottle shots + African executive + rainbow-nation lifestyle)
   once sourced via marketing. ─────────────────────────────────────────────── */
const BANNER_SLIDES = [
  {
    id: "1",
    title: "If You Know,",
    subtitle: "You Know.",
    description:
      "The Macallan M, 2022 Annual Release. Presented in hand-crafted Lalique. For the collectors who moved past asking the price.",
    image:
      "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=1200&q=80",
    cta: "Enter The Vault",
  },
  {
    id: "2",
    title: "Africa Built This.",
    subtitle: "Every Pour, A Toast.",
    description:
      "For the builders, the backers, the visionaries shaping the continent's tomorrow — LIQZAR delivers the whisky worthy of the work, in 2–4 hours.",
    image:
      "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=1200&q=80",
    cta: "Honour The Hour",
  },
  {
    id: "3",
    title: "Fifty Years,",
    subtitle: "One Unmistakable Dram.",
    description:
      "Glenfiddich 50 — reserved for palates that have outgrown every other toast. Available to the few who have earned the pour.",
    image:
      "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=1200&q=80",
    cta: "Claim The Vintage",
  },
  {
    id: "4",
    title: "One Nation,",
    subtitle: "One Extraordinary Pour.",
    description:
      "Across every heritage, every boardroom, every triumph — South Africa's finest raise the same glass. Rarely seen. Always remembered.",
    image:
      "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=1200&q=80",
    cta: "Be Part Of The Few",
  },
];

const TRUST_ITEMS = [
  { icon: "trophy-outline", label: "Retailer of the Year" },
  { icon: "car-outline", label: "Free delivery R150+" },
  { icon: "shield-checkmark-outline", label: "Secure Checkout" },
  { icon: "gift-outline", label: "Gift Wrapping" },
];

const CATEGORIES = [
  { label: "Whisky", icon: "wine-outline" },
  { label: "Vodka", icon: "wine-outline" },
  { label: "Gin", icon: "wine-outline" },
  { label: "Wine", icon: "wine-outline" },
  { label: "Beer", icon: "beer-outline" },
  { label: "Champagne", icon: "wine-outline" },
  { label: "Cognac", icon: "wine-outline" },
  { label: "Rum", icon: "wine-outline" },
  { label: "Tequila", icon: "wine-outline" },
  { label: "Liqueurs", icon: "wine-outline" },
];

// Shop-by-Country — leads with South Africa (proudly local) then global icons.
const ORIGIN_COUNTRIES: Array<{
  id: string;
  name: string;
  flag: string;
  tagline: string;
  brands: string[];
  searchTerm: string;
  local?: boolean;
}> = [
  { id: "za", name: "South Africa", flag: "🇿🇦", tagline: "Proudly Local", brands: ["Amarula", "Inverroche", "Bain's"], searchTerm: "Amarula", local: true },
  { id: "scotland", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", tagline: "Highlands & Legacy", brands: ["Johnnie Walker", "Glenfiddich", "Macallan"], searchTerm: "Scotch" },
  { id: "ireland", name: "Ireland", flag: "🇮🇪", tagline: "Smooth & Golden", brands: ["Jameson", "Tullamore"], searchTerm: "Jameson" },
  { id: "japan", name: "Japan", flag: "🇯🇵", tagline: "Craft & Precision", brands: ["Yamazaki", "Hibiki", "Nikka"], searchTerm: "Japanese" },
  { id: "usa", name: "United States", flag: "🇺🇸", tagline: "Bourbon Country", brands: ["Jack Daniel's", "Maker's Mark"], searchTerm: "Bourbon" },
  { id: "france", name: "France", flag: "🇫🇷", tagline: "The Art of Cognac", brands: ["Hennessy", "Rémy Martin", "Moët"], searchTerm: "Hennessy" },
  { id: "mexico", name: "Mexico", flag: "🇲🇽", tagline: "Agave Heritage", brands: ["Patrón", "Don Julio"], searchTerm: "Tequila" },
  { id: "italy", name: "Italy", flag: "🇮🇹", tagline: "La Dolce Vita", brands: ["Campari", "Aperol"], searchTerm: "Campari" },
  { id: "caribbean", name: "Caribbean", flag: "🏝️", tagline: "Island Rhythm", brands: ["Appleton", "Havana Club"], searchTerm: "Rum" },
  { id: "sweden", name: "Sweden", flag: "🇸🇪", tagline: "Pure & Crisp", brands: ["Absolut", "Belvedere"], searchTerm: "Absolut" },
];

// Lightweight fade-in-up wrapper for staggered list cards.
// Uses RN Animated (not reanimated) to avoid introducing new runtime deps.
const FadeInUpCard: React.FC<{
  index: number;
  children: React.ReactNode;
}> = ({ index, children }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const delay = Math.min(index * 55, 420);
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 520,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { addItem } = useCart();
  const insets = useSafeAreaInsets();
  const { colors, gradients, shadows, isDark, toggleTheme } = useTheme();

  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [failedBanners, setFailedBanners] = useState<Record<string, true>>({});
  const markBannerFailed = useCallback((id: string) => {
    setFailedBanners((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);
  const [loyaltyTier, setLoyaltyTier] = useState<LoyaltyTier | null>(null);
  const bannerRef = useRef<FlatList>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) return;
        const { data: acct } = await supabase
          .from("loyalty_accounts")
          .select("tier")
          .eq("user_id", uid)
          .maybeSingle();
        if (!cancelled && acct?.tier) setLoyaltyTier(acct.tier as LoyaltyTier);
      } catch {
        // Silent \u2014 the chip just won't render.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pulse animation for Reorder service icon
  const reorderPulse = useRef(new Animated.Value(1)).current;

  // FAB pulsing gold glow animation
  const fabGlow = useRef(new Animated.Value(0.3)).current;

  // Ken-Burns cinematic zoom for hero banner
  const kenBurns = useRef(new Animated.Value(0)).current;

  // Editorial hero reveal (eyebrow → title → subtitle → CTA)
  const heroReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reorder pulse animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(reorderPulse, {
          toValue: 1.12,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(reorderPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();

    // FAB glow animation
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(fabGlow, {
          toValue: 0.6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(fabGlow, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();

    // Ken-Burns slow zoom loop (18s, reverses)
    const kenBurnsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(kenBurns, {
          toValue: 1,
          duration: 18000,
          useNativeDriver: true,
        }),
        Animated.timing(kenBurns, {
          toValue: 0,
          duration: 18000,
          useNativeDriver: true,
        }),
      ]),
    );
    kenBurnsLoop.start();

    // Editorial reveal on mount
    Animated.timing(heroReveal, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
      kenBurnsLoop.stop();
    };
  }, [reorderPulse, fabGlow, kenBurns, heroReveal]);

  // Auto-rotate banner
  useEffect(() => {
    bannerTimerRef.current = setInterval(() => {
      setActiveBannerIndex((prev) => {
        const next = (prev + 1) % BANNER_SLIDES.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => {
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
    };
  }, []);

  const onBannerScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (
      index !== activeBannerIndex &&
      index >= 0 &&
      index < BANNER_SLIDES.length
    ) {
      setActiveBannerIndex(index);
      if (bannerTimerRef.current) clearInterval(bannerTimerRef.current);
      bannerTimerRef.current = setInterval(() => {
        setActiveBannerIndex((prev) => {
          const next = (prev + 1) % BANNER_SLIDES.length;
          bannerRef.current?.scrollToIndex({ index: next, animated: true });
          return next;
        });
      }, 5000);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const [featured, trending, arrivals] = await Promise.all([
        productsApi.getFeaturedProducts(8),
        productsApi.getTrendingProducts(8),
        productsApi.getProducts({ limit: 8 }),
      ]);
      setFeaturedProducts(featured || []);
      setTrendingProducts(trending || []);
      setNewArrivals(arrivals || []);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, []);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate("Search", { query: searchQuery.trim() });
    }
  };

  const handleCategoryPress = (category: string) => {
    setActiveCategory(activeCategory === category ? null : category);
    navigation.navigate("Catalog", { category });
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      category: product.category,
    });
  };

  const renderProductCard = ({
    item,
    index,
  }: {
    item: Product;
    index: number;
  }) => (
    <FadeInUpCard index={index}>
    <TouchableOpacity
      style={[
        styles.productCard,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
          ...shadows.card,
        },
      ]}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("ProductDetail", { productId: item.id })
      }
      accessibilityLabel={item.name + ', R' + item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2})}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.productImageContainer,
          { backgroundColor: colors.background.elevated },
        ]}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Icon name="wine-outline" size={40} color={colors.gold.muted} />
          </View>
        )}
        {/* Gradient overlay at bottom of image */}
        <LinearGradient
          colors={["transparent", isDark ? "rgba(28,24,16,0.85)" : "rgba(255,255,255,0.85)"]}
          style={styles.productImageGradient}
        />
      </View>
      <View style={styles.productInfo}>
        <Text
          style={[styles.productName, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.productCategory, { color: colors.text.muted }]}
          numberOfLines={1}
        >
          {item.category}
        </Text>
        <View style={styles.productBottom}>
          <Text style={[styles.productPrice, { color: colors.gold.primary }]}>
            R{item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </Text>
          <TouchableOpacity
            style={[
              styles.addToCartButton,
              {
                backgroundColor: colors.gold.primary,
                shadowColor: colors.gold.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 4,
                elevation: 3,
              },
            ]}
            onPress={() => handleAddToCart(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={'Add ' + item.name + ' to cart'}
            accessibilityRole="button"
          >
            <Icon name="add" size={18} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
    </FadeInUpCard>
  );

  const renderSectionHeader = (
    title: string,
    icon: string,
    onSeeAll?: () => void,
  ) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleColumn}>
        <View style={styles.sectionTitleRow}>
          <Icon name={icon} size={20} color={colors.gold.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {title}
          </Text>
        </View>
        {/* Gold accent line under section title */}
        <View
          style={[
            styles.sectionAccentLine,
            { backgroundColor: colors.gold.primary },
          ]}
        />
      </View>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.seeAllText, { color: colors.gold.primary }]}>
            See All
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const bannerOverlayColors = isDark
    ? ["rgba(5,4,3,0.85)", "rgba(5,4,3,0.6)", "rgba(5,4,3,0.2)"]
    : ["rgba(255,255,255,0.9)", "rgba(255,255,255,0.65)", "rgba(255,255,255,0.15)"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Logo Header */}
      <View
        style={[
          styles.logoHeader,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.header.bg,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 6,
            elevation: 4,
          },
        ]}
      >
        <View style={styles.logoRow}>
          <Image
            source={require("../../assets/liqzar-logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.logoText, { color: colors.header.fg }]}>
              LIQZAR
            </Text>
            <Text style={[styles.logoTagline, { color: colors.gold.muted }]}>
              RESERVE THE FINEST.
            </Text>
            {loyaltyTier && (
              <TouchableOpacity
                onPress={() => { haptics.selection(); navigation.navigate("Loyalty"); }}
                accessibilityRole="button"
                accessibilityLabel={`${TIER_LABEL[loyaltyTier]} \u2014 view loyalty details`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={{
                  marginTop: 4,
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: `${TIER_ACCENT[loyaltyTier]}22`,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: `${TIER_ACCENT[loyaltyTier]}66`,
                }}
              >
                <Icon name="diamond-outline" size={10} color={TIER_ACCENT[loyaltyTier]} />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: TIER_ACCENT[loyaltyTier],
                  }}
                >
                  {TIER_LABEL[loyaltyTier]}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerIconButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                borderWidth: 1,
                borderColor: colors.gold.border,
              },
            ]}
            onPress={toggleTheme}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={20}
              color={colors.gold.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerIconButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                borderWidth: 1,
                borderColor: colors.gold.border,
              },
            ]}
            onPress={() => navigation.navigate("Notifications")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="notifications-outline"
              size={22}
              color={isDark ? colors.gold.light : colors.gold.dark}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.headerIconButton,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                borderWidth: 1,
                borderColor: colors.gold.border,
              },
            ]}
            onPress={() => navigation.navigate("Cart")}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              name="cart-outline"
              size={22}
              color={isDark ? colors.gold.light : colors.gold.dark}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
            progressBackgroundColor={colors.background.tertiary}
          />
        }
      >
        {/* Hero Banner Carousel */}
        <View style={styles.bannerContainer}>
          <FlatList
            ref={bannerRef}
            data={BANNER_SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onBannerScroll}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            renderItem={({ item, index }) => {
              const kenBurnsScale = kenBurns.interpolate({
                inputRange: [0, 1],
                outputRange: [1.06, 1.14],
              });
              const kenBurnsTranslate = kenBurns.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              });
              const revealOpacity = heroReveal;
              const revealTranslate = heroReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              });
              const counter = `${String(index + 1).padStart(2, "0")} / ${String(BANNER_SLIDES.length).padStart(2, "0")}`;
              const hasFailed = !!failedBanners[item.id];
              return (
                <View style={styles.bannerSlide}>
                  {hasFailed ? (
                    <LinearGradient
                      colors={["#1c1810", "#050403", "#1c1810"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.bannerImage}
                    />
                  ) : (
                    <Animated.Image
                      source={{ uri: item.image }}
                      style={[
                        styles.bannerImage,
                        {
                          transform: [
                            { scale: kenBurnsScale },
                            { translateY: kenBurnsTranslate },
                          ],
                        },
                      ]}
                      resizeMode="cover"
                      onError={() => markBannerFailed(item.id)}
                    />
                  )}
                  <LinearGradient
                    colors={["rgba(5,4,3,0)", "rgba(5,4,3,0.55)", "rgba(5,4,3,0.88)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.bannerOverlayVertical}
                  />
                  <LinearGradient
                    colors={bannerOverlayColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bannerOverlay}
                  >
                    <Animated.View
                      style={[
                        styles.bannerTextContainer,
                        {
                          opacity: revealOpacity,
                          transform: [{ translateY: revealTranslate }],
                        },
                      ]}
                    >
                      <View style={styles.bannerEyebrowRow}>
                        <View
                          style={[
                            styles.bannerEyebrowRule,
                            { backgroundColor: colors.gold.primary },
                          ]}
                        />
                        <Text
                          style={[
                            styles.bannerEyebrow,
                            { color: colors.gold.primary },
                          ]}
                        >
                          The LIQZAR Collection
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.bannerTitle,
                          { color: colors.text.primary },
                        ]}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.bannerSubtitle,
                          { color: colors.gold.primary },
                        ]}
                      >
                        {item.subtitle}
                      </Text>
                      <Text
                        style={[
                          styles.bannerDescription,
                          {
                            color: isDark
                              ? colors.gold.light
                              : colors.gold.dark,
                          },
                        ]}
                      >
                        {item.description}
                      </Text>
                      <View style={styles.bannerCtaRow}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => navigation.navigate("Catalog")}
                        >
                          <LinearGradient
                            colors={[...gradients.gold]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.bannerCta}
                          >
                            <Text style={styles.bannerCtaText}>{item.cta}</Text>
                            <Icon
                              name="arrow-forward"
                              size={16}
                              color="#050403"
                            />
                          </LinearGradient>
                        </TouchableOpacity>
                        <Text
                          style={[
                            styles.bannerCounter,
                            { color: colors.gold.light },
                          ]}
                        >
                          {counter}
                        </Text>
                      </View>
                    </Animated.View>
                  </LinearGradient>
                </View>
              );
            }}
          />
          {/* Gradient border at bottom of banner */}
          <LinearGradient
            colors={[colors.gold.primary, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bannerBottomGradient}
          />
          {/* Dots */}
          <View style={styles.bannerDots}>
            {BANNER_SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.bannerDot,
                  activeBannerIndex === index && {
                    width: 24,
                    backgroundColor: colors.gold.primary,
                    shadowColor: colors.gold.primary,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 6,
                    elevation: 4,
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* Trust Strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trustStripContent}
          style={styles.trustStrip}
        >
          {TRUST_ITEMS.map((item, index) => (
            <View
              key={index}
              style={[
                styles.trustItem,
                {
                  borderColor: colors.gold.border,
                  overflow: "hidden",
                },
              ]}
            >
              <LinearGradient
                colors={[
                  colors.gold.faint,
                  colors.transparent,
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <Icon name={item.icon} size={18} color={colors.gold.primary} />
              <Text style={[styles.trustItemText, { color: colors.gold.muted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <TouchableOpacity
            style={[
              styles.searchContainer,
              {
                backgroundColor: colors.background.tertiary,
                borderColor: searchFocused
                  ? colors.gold.primary
                  : colors.gold.border,
                borderWidth: searchFocused ? 1.5 : 1,
              },
            ]}
            activeOpacity={1}
          >
            <Icon name="search-outline" size={22} color={colors.gold.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Search premium spirits..."
              placeholderTextColor={colors.text.dim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              accessibilityLabel="Search products"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Icon name="close-circle" size={18} color={colors.gold.muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.scanButton,
                {
                  backgroundColor: colors.gold.faint,
                  borderColor: colors.gold.border,
                },
              ]}
              onPress={() => navigation.navigate("BarcodeScanner" as any)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="camera-outline" size={20} color={colors.gold.primary} />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
          style={styles.categoriesContainer}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            return (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.categoryPill,
                  {
                    borderColor: isActive
                      ? colors.gold.primary
                      : colors.gold.border,
                    backgroundColor: isActive
                      ? undefined
                      : colors.background.tertiary,
                    borderWidth: isActive ? 0 : 1,
                  },
                  isActive && {
                    shadowColor: colors.gold.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 4,
                  },
                ]}
                onPress={() => handleCategoryPress(cat.label)}
                activeOpacity={0.7}
                accessibilityLabel={'Category: ' + cat.label}
                accessibilityRole="tab"
              >
                {isActive ? (
                  <LinearGradient
                    colors={[...gradients.gold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.categoryPillGradient}
                  >
                    <Icon name={cat.icon} size={14} color="#050403" />
                    <Text style={styles.categoryPillTextActive}>
                      {cat.label}
                    </Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.categoryPillInner}>
                    <Icon name={cat.icon} size={14} color={colors.text.muted} />
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: colors.text.muted },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Featured Section */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold.primary} />
            <Text style={[styles.loadingText, { color: colors.text.muted }]}>
              Loading premium selection...
            </Text>
          </View>
        ) : (
          <>
            {featuredProducts.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader("Featured", "diamond-outline", () =>
                  navigation.navigate("Catalog", { featured: true }),
                )}
                <FlatList
                  data={featuredProducts}
                  renderItem={renderProductCard}
                  keyExtractor={(item) => `featured-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {trendingProducts.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader(
                  "Trending Now",
                  "trending-up-outline",
                  () => navigation.navigate("Catalog", { trending: true }),
                )}
                <FlatList
                  data={trendingProducts}
                  renderItem={renderProductCard}
                  keyExtractor={(item) => `trending-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}

            {/* Shop by Country — diverse origins + proudly local SA */}
            <View style={styles.section}>
              {renderSectionHeader("Shop by Country", "globe-outline", () =>
                navigation.navigate("Catalog"),
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}
              >
                {ORIGIN_COUNTRIES.map((country) => (
                  <TouchableOpacity
                    key={country.id}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate("Catalog", { search: country.searchTerm })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Shop ${country.name}`}
                    style={{
                      width: 160,
                      padding: 14,
                      borderRadius: borderRadius.lg,
                      backgroundColor: colors.background.card,
                      borderWidth: 1,
                      borderColor: country.local
                        ? colors.gold.primary
                        : colors.border,
                      shadowColor: country.local
                        ? colors.gold.primary
                        : "#000",
                      shadowOpacity: country.local ? 0.2 : 0.08,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 3,
                    }}
                  >
                    {country.local && (
                      <View
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          backgroundColor: colors.gold.primary,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: "800",
                            color: "#1c1810",
                            letterSpacing: 0.8,
                          }}
                        >
                          LOCAL
                        </Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 36, lineHeight: 42 }}>
                      {country.flag}
                    </Text>
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 15,
                        fontWeight: "700",
                        color: colors.text.primary,
                      }}
                      numberOfLines={1}
                    >
                      {country.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: colors.gold.primary,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {country.tagline}
                    </Text>
                    <Text
                      style={{
                        marginTop: 10,
                        fontSize: 11,
                        color: colors.text.muted,
                        lineHeight: 15,
                      }}
                      numberOfLines={2}
                    >
                      {country.brands.slice(0, 3).join(" · ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Sip Stories — Editorial teaser */}
            <View style={styles.section}>
              {renderSectionHeader("Sip Stories", "book-outline", () =>
                navigation.navigate("Editorial"),
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: spacing.lg,
                  gap: 12,
                }}
              >
                {EDITORIAL_ARTICLES.slice(0, 3).map((article) => (
                  <TouchableOpacity
                    key={article.slug}
                    activeOpacity={0.9}
                    onPress={() =>
                      navigation.navigate("EditorialArticle", {
                        slug: article.slug,
                      })
                    }
                    style={{
                      width: width * 0.7,
                      borderRadius: borderRadius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background.card,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      source={{ uri: article.heroImage }}
                      style={{ width: "100%", height: 140 }}
                    />
                    <View style={{ padding: spacing.md }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          letterSpacing: 2,
                          color: colors.gold.primary,
                        }}
                      >
                        {article.category.toUpperCase()}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          marginTop: 6,
                          color: colors.text.primary,
                          lineHeight: 20,
                        }}
                        numberOfLines={2}
                      >
                        {article.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          marginTop: 6,
                          color: colors.text.muted,
                          lineHeight: 17,
                        }}
                        numberOfLines={2}
                      >
                        {article.dek}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: spacing.sm,
                          gap: 6,
                        }}
                      >
                        <Icon
                          name="time-outline"
                          size={12}
                          color={colors.text.muted}
                        />
                        <Text
                          style={{ fontSize: 11, color: colors.text.muted }}
                        >
                          {article.readMinutes} min read
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {newArrivals.length > 0 && (
              <View style={styles.section}>
                {renderSectionHeader("New Arrivals", "sparkles-outline", () =>
                  navigation.navigate("Catalog"),
                )}
                <FlatList
                  data={newArrivals}
                  renderItem={renderProductCard}
                  keyExtractor={(item) => `new-${item.id}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalListContent}
                />
              </View>
            )}
          </>
        )}

        <View style={{ height: spacing.md }} />

        {/* Quick Services */}
        <View style={styles.section}>
          <View style={styles.quickServicesHeader}>
            <View style={styles.sectionTitleColumn}>
              <Text style={[styles.quickServicesTitle, { color: colors.text.primary }]}>Quick Services</Text>
              <View
                style={[
                  styles.sectionAccentLine,
                  { backgroundColor: colors.gold.primary },
                ]}
              />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 12 }}>
            {[
              { icon: "repeat-outline", label: "Reorder", color: colors.status.info, screen: "Reorder" },
              { icon: "calendar-outline", label: "Schedule", color: "#8B5CF6", screen: "ScheduleDelivery" },
              { icon: "star-outline", label: "Rewards", color: colors.status.warning, screen: "Loyalty" },
              { icon: "gift-outline", label: "Refer", color: colors.status.success, screen: "Referral" },
              { icon: "pricetag-outline", label: "Promos", color: "#EC4899", screen: "PromoCode" },
              { icon: "heart-outline", label: "Wishlist", color: colors.status.error, screen: "Wishlist" },
            ].map((svc, i) => {
              const isReorder = i === 0;
              const iconContainer = (
                <View style={{
                  width: 56, height: 56, borderRadius: 18,
                  backgroundColor: svc.color + "15",
                  justifyContent: "center", alignItems: "center",
                  borderWidth: 1, borderColor: svc.color + "30",
                  shadowColor: svc.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  elevation: 3,
                }}>
                  <Icon name={svc.icon as any} size={24} color={svc.color} />
                </View>
              );

              return (
                <TouchableOpacity
                  key={i}
                  style={{
                    alignItems: "center",
                    width: 76,
                  }}
                  onPress={() => navigation.navigate(svc.screen as any)}
                  activeOpacity={0.7}
                >
                  {isReorder ? (
                    <Animated.View style={{ transform: [{ scale: reorderPulse }] }}>
                      {iconContainer}
                    </Animated.View>
                  ) : (
                    iconContainer
                  )}
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text.muted, marginTop: 6, textAlign: "center" }}>{svc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Concierge FAB — human curator via WhatsApp */}
      <View style={[styles.fabContainer, shadows.gold]}>
        <Animated.View
          style={[
            styles.fabGlow,
            {
              backgroundColor: colors.gold.primary,
              opacity: fabGlow,
            },
          ]}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("SommelierChat")}
          accessibilityRole="button"
          accessibilityLabel="Speak with our cellar concierge"
        >
          <LinearGradient
            colors={[...gradients.goldShimmer]}
            style={styles.fab}
          >
            <Icon name="diamond-outline" size={22} color="#050403" />
            <Text style={styles.fabLabel}>CELLAR</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  logoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    zIndex: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 4,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 3,
  },
  logoTagline: {
    fontSize: 8,
    fontWeight: "500",
    letterSpacing: 2,
    marginTop: -1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerContainer: {
    width: "100%",
    height: 520,
  },
  bannerSlide: {
    width: width,
    height: 520,
    overflow: "hidden",
    backgroundColor: "#0a0705",
  },
  bannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  bannerOverlayVertical: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    paddingBottom: 48,
  },
  bannerTextContainer: {
    paddingTop: 20,
  },
  bannerEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  bannerEyebrowRule: {
    width: 28,
    height: 1.5,
    marginRight: 10,
    opacity: 0.9,
  },
  bannerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  bannerTitle: {
    fontSize: 44,
    fontWeight: "300",
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  bannerSubtitle: {
    fontSize: 30,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 14,
    letterSpacing: -0.6,
    fontStyle: "italic",
  },
  bannerDescription: {
    fontSize: 14,
    marginBottom: 22,
    opacity: 0.9,
    maxWidth: width - 64,
    lineHeight: 20,
  },
  bannerCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    gap: 8,
  },
  bannerCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#050403",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bannerCounter: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 2.5,
    opacity: 0.85,
  },
  bannerBottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.4,
  },
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    gap: 6,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  trustStrip: {
    marginBottom: spacing.md,
  },
  trustStripContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.md,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  trustItemText: {
    fontSize: 11,
    fontWeight: "600",
  },
  searchWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  scanButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
    borderWidth: 1,
  },
  categoriesContainer: {
    marginBottom: spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryPill: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  categoryPillGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    gap: 5,
  },
  categoryPillInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 5,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryPillTextActive: {
    color: "#050403",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitleColumn: {
    flexDirection: "column",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
  },
  sectionAccentLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    marginLeft: 28,
  },
  seeAllText: {
    ...typography.bodySmall,
    fontWeight: "600",
    marginTop: 2,
  },
  horizontalListContent: {
    paddingHorizontal: spacing.md,
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    marginRight: CARD_MARGIN,
    borderWidth: 1,
    overflow: "hidden",
  },
  productImageContainer: {
    width: "100%",
    height: CARD_IMG_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0d0b08",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  productImageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  productInfo: {
    padding: spacing.sm,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
    height: 36,
    lineHeight: 18,
  },
  productCategory: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  productBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  addToCartButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.md,
  },
  quickServicesHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
  },
  quickServicesTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
  },
  fabGlow: {
    position: "absolute",
    width: 74,
    height: 74,
    borderRadius: borderRadius.full,
    top: -6,
    left: -6,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  fabLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#050403",
    marginTop: -2,
    letterSpacing: 0.5,
  },
});
