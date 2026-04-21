import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { productsApi } from "../services/api";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Product } from "../types";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialQuery = route.params?.query || "";
  const { colors, gradients, shadows, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadRecentSearches();
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem('recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveSearch = async (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 10);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving search:', error);
    }
  };

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSearchPerformed(false);
      return;
    }

    setLoading(true);
    setSearchPerformed(true);

    try {
      const data = await productsApi.getProducts({ search: query, limit: 50 });
      setResults(data || []);
      saveSearch(query.trim());
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [recentSearches]);

  const handleTextChange = (text: string) => {
    setSearchQuery(text);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length >= 2) {
      searchTimeout.current = setTimeout(() => {
        performSearch(text);
      }, 500);
    } else {
      setResults([]);
      setSearchPerformed(false);
    }
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    performSearch(searchQuery);
  };

  const handleRecentSearch = (query: string) => {
    setSearchQuery(query);
    performSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults([]);
    setSearchPerformed(false);
    inputRef.current?.focus();
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recent_searches');
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}
      onPress={() =>
        navigation.navigate("ProductDetail", { productId: item.id })
      }
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.image_url }}
        style={[styles.productImage, { backgroundColor: colors.background.elevated }]}
        resizeMode="contain"
      />
      <View style={styles.productInfo}>
        <Text style={[styles.productCategory, { color: colors.gold.primary }]}>{item.category}</Text>
        <Text style={[styles.productName, { color: colors.text.primary }]} numberOfLines={2}>
          {item.name}
        </Text>
        {item.bottle_size && (
          <Text style={[styles.productSize, { color: colors.text.muted }]}>{item.bottle_size}</Text>
        )}
        <Text style={[styles.productPrice, { color: colors.gold.light }]}>R{item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.text.dim} />
    </TouchableOpacity>
  );

  const showRecentSearches = !searchPerformed && !searchQuery.trim();

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Search Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.background.tertiary, borderBottomColor: colors.gold.border }]}>
        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: colors.background.secondary, borderColor: colors.gold.border },
            isFocused && [{ borderColor: colors.gold.primary }, shadows.goldSubtle],
          ]}
        >
          <Icon
            name="search-outline"
            size={22}
            color={isFocused ? colors.gold.primary : colors.text.muted}
          />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search for spirits, wines, beers..."
            placeholderTextColor={colors.text.dim}
            value={searchQuery}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            autoFocus={!initialQuery}
            selectionColor={colors.gold.primary}
          />
          {searchQuery !== "" && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close-circle" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          )}
          <View style={[styles.micDivider, { backgroundColor: colors.gold.border }]} />
          <TouchableOpacity
            style={[styles.micButton, { opacity: 0.5 }]}
            disabled={true}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Voice search"
            accessibilityHint="Voice search coming soon"
            accessibilityState={{ disabled: true }}
          >
            <Icon name="mic-outline" size={22} color={colors.text.dim} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={[styles.loadingText, { color: colors.text.muted }]}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searchPerformed ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.emptyIconWrapper, { backgroundColor: colors.gold.faint }]}>
                  <Icon
                    name="search-outline"
                    size={48}
                    color={colors.gold.dark}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No results found</Text>
                <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                  Try a different search term or browse our catalog
                </Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() =>
                    navigation.navigate("MainTabs", { screen: "Catalog" })
                  }
                >
                  <LinearGradient
                    colors={[...gradients.gold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.browseButtonGradient}
                  >
                    <Text style={[styles.browseButtonText, { color: colors.text.inverse }]}>Browse Catalog</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : showRecentSearches ? (
              <View style={styles.recentContainer}>
                {recentSearches.length > 0 && (
                  <>
                    <View style={styles.recentHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Icon
                          name="time-outline"
                          size={20}
                          color={colors.gold.muted}
                        />
                        <Text style={[styles.recentTitle, { color: colors.gold.muted }]}>Recent Searches</Text>
                      </View>
                      <TouchableOpacity onPress={clearRecentSearches}>
                        <Text style={{ fontSize: 12, color: colors.text.dim }}>Clear All</Text>
                      </TouchableOpacity>
                    </View>
                    {recentSearches.map((term, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.recentItem, { borderBottomColor: colors.gold.border }]}
                        onPress={() => handleRecentSearch(term)}
                      >
                        <Icon
                          name="search-outline"
                          size={18}
                          color={colors.text.dim}
                        />
                        <Text style={[styles.recentText, { color: colors.text.secondary }]}>{term}</Text>
                        <Icon
                          name="arrow-forward-outline"
                          size={16}
                          color={colors.text.dim}
                        />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Initial Empty State */}
                <View style={styles.initialEmptyState}>
                  <Icon
                    name="wine-outline"
                    size={60}
                    color={colors.gold.dark}
                  />
                  <Text style={[styles.initialEmptyText, { color: colors.text.muted }]}>
                    Search for spirits, wines, beers and more...
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.resultsCount, { color: colors.text.muted }]}>
                {results.length} result{results.length !== 1 ? "s" : ""} found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    height: 52,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    height: "100%",
  },
  micDivider: {
    width: 1,
    height: 24,
  },
  micButton: {
    paddingLeft: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  resultsCount: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.sm,
  },
  productInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  productCategory: {
    ...typography.caption,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  productName: {
    ...typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  productSize: {
    ...typography.caption,
    marginBottom: 4,
  },
  productPrice: {
    ...typography.body,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  browseButton: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  browseButtonGradient: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  browseButtonText: {
    ...typography.button,
  },
  recentContainer: {
    paddingTop: spacing.sm,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  recentTitle: {
    ...typography.label,
    fontSize: 13,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  recentText: {
    ...typography.body,
    flex: 1,
  },
  initialEmptyState: {
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  initialEmptyText: {
    ...typography.bodySmall,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
