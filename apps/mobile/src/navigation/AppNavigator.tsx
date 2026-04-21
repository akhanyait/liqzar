import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { spacing } from "../theme";
import { supabase } from "../lib/supabase";

// Auth Screens
import LoginScreen from "../screens/auth/LoginScreen";
import SignUpScreen from "../screens/auth/SignUpScreen";

// Customer Screens
import HomeScreen from "../screens/HomeScreen";
import CatalogScreen from "../screens/CatalogScreen";
import ProductDetailScreen from "../screens/ProductDetailScreen";
import CartScreen from "../screens/CartScreen";
import CheckoutScreen from "../screens/CheckoutScreen";
import ProfileScreen from "../screens/ProfileScreen";
import OrderHistoryScreen from "../screens/OrderHistoryScreen";
import OrderDetailScreen from "../screens/OrderDetailScreen";
import SearchScreen from "../screens/SearchScreen";
import WishlistScreen from "../screens/WishlistScreen";
import SavedAddressesScreen from "../screens/SavedAddressesScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import OrderTrackingScreen from "../screens/OrderTrackingScreen";
import SommelierChatScreen from "../screens/SommelierChatScreen";
import BarcodeScannerScreen from "../screens/BarcodeScannerScreen";
import CustomerRatingScreen from "../screens/CustomerRatingScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import PromoCodeScreen from "../screens/PromoCodeScreen";
import ReorderScreen from "../screens/ReorderScreen";
import ScheduleDeliveryScreen from "../screens/ScheduleDeliveryScreen";
import LoyaltyScreen from "../screens/LoyaltyScreen";
import ReferralScreen from "../screens/ReferralScreen";
import CustomerDeliveryPin from "../screens/customer/CustomerDeliveryPin";
import DisputeScreen from "../screens/DisputeScreen";
import EditorialScreen from "../screens/EditorialScreen";
import EditorialArticleScreen from "../screens/EditorialArticleScreen";
import DeliveryChatScreen from "../screens/DeliveryChatScreen";
import DeliveryCallScreen from "../screens/DeliveryCallScreen";

// Driver Screens
import DriverDashboard from "../screens/driver/DriverDashboard";
import DriverDeliveryDetail from "../screens/driver/DriverDeliveryDetail";
import DriverEarnings from "../screens/driver/DriverEarnings";
import DriverDepotPickup from "../screens/driver/DriverDepotPickup";
import DriverScanVerify from "../screens/driver/DriverScanVerify";
import DriverNavigation from "../screens/driver/DriverNavigation";
import DriverMenu from "../screens/driver/DriverMenu";
import DriverAIAssistant from "../screens/driver/DriverAIAssistant";
import DriverChat from "../screens/driver/DriverChat";
import DriverSettings from "../screens/driver/DriverSettings";
import DriverRatings from "../screens/driver/DriverRatings";
import DriverSupport from "../screens/driver/DriverSupport";
import DriverAIItemVerify from "../screens/driver/DriverAIItemVerify";
import DriverPhotoProof from "../screens/driver/DriverPhotoProof";
import DriverHeatMap from "../screens/driver/DriverHeatMap";
import DriverTripSummary from "../screens/driver/DriverTripSummary";
import DriverDeliveryPinVerify from "../screens/driver/DriverDeliveryPinVerify";
import ReturnToStoreScreen from "../screens/ReturnToStoreScreen";

// Admin Screens
import AdminDashboard from "../screens/admin/AdminDashboard";
import AdminOrderManagement from "../screens/admin/AdminOrderManagement";
import AdminOrderDetail from "../screens/admin/AdminOrderDetail";
import AdminProductManagement from "../screens/admin/AdminProductManagement";
import AdminStockControl from "../screens/admin/AdminStockControl";
import AdminDriverManagement from "../screens/admin/AdminDriverManagement";
import AdminReports from "../screens/admin/AdminReports";
import AdminSettings from "../screens/admin/AdminSettings";
import AdminCustomerManagement from "../screens/admin/AdminCustomerManagement";
import AdminPromoManagement from "../screens/admin/AdminPromoManagement";
import AdminZoneManagement from "../screens/admin/AdminZoneManagement";
import AdminAuditLogScreen from "../screens/AdminAuditLogScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Shared Tab Bar ───

function RoleTabBar({ state, descriptors, navigation, iconMap }: any) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.tabBar,
        {
          paddingBottom: insets.bottom || 8,
          backgroundColor: isDark ? "rgba(30,32,40,0.95)" : "rgba(255,255,255,0.97)",
          borderTopColor: isDark ? "rgba(212,175,55,0.08)" : "rgba(184,150,46,0.08)",
          ...Platform.select({
            ios: {
              shadowColor: isDark ? "#000" : "rgba(0,0,0,0.15)",
              shadowOffset: { width: 0, height: -3 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
            },
            android: {
              elevation: 12,
            },
          }),
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        const icons = iconMap[route.name] || { active: "ellipse", inactive: "ellipse-outline" };
        const iconName = isFocused ? icons.active : icons.inactive;
        const label = options.tabBarLabel ?? route.name;

        return (
          <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
            <View style={{ alignItems: "center" }}>
              <View style={{ position: "relative" }}>
                {isFocused ? (
                  <View style={[styles.activeIconBg, { backgroundColor: isDark ? "rgba(212,175,55,0.12)" : "rgba(212,175,55,0.10)" }]}>
                    <Icon name={iconName} size={26} color={colors.gold.primary} />
                  </View>
                ) : (
                  <View style={styles.inactiveIconWrap}>
                    <Icon name={iconName} size={24} color={colors.text.dim} />
                  </View>
                )}
                {route.name === "Cart" && <CartBadgeInTab />}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? colors.gold.primary : colors.text.dim,
                    fontWeight: isFocused ? "700" : "400",
                  },
                ]}
              >
                {label}
              </Text>
              {isFocused && <View style={[styles.activeIndicator, { backgroundColor: colors.gold.primary }]} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CartBadgeInTab() {
  const { colors } = useTheme();
  const { itemCount } = useCart();
  if (itemCount === 0) return null;
  const isWide = itemCount > 9;
  return (
    <View style={[styles.badge, { backgroundColor: colors.status.error, borderColor: colors.header.bg }, isWide && { paddingHorizontal: 4 }]}>
      <Text style={[styles.badgeText, { color: colors.white }]}>{itemCount > 99 ? "99+" : itemCount}</Text>
    </View>
  );
}

// ─── Customer Tabs ───

const CUSTOMER_ICONS: Record<string, { active: string; inactive: string }> = {
  Home: { active: "home", inactive: "home-outline" },
  Catalog: { active: "grid", inactive: "grid-outline" },
  Cart: { active: "cart", inactive: "cart-outline" },
  Profile: { active: "person", inactive: "person-outline" },
};

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <RoleTabBar {...props} iconMap={CUSTOMER_ICONS} />}
      screenOptions={{ headerStyle: { backgroundColor: colors.header.bg }, headerTintColor: colors.header.fg, headerTitleStyle: { fontWeight: "600" } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, tabBarLabel: "Home" }} />
      <Tab.Screen name="Catalog" component={CatalogScreen} options={{ headerShown: false, tabBarLabel: "Browse" }} />
      <Tab.Screen name="Cart" component={CartScreen} options={{ headerShown: false, tabBarLabel: "Cart" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false, tabBarLabel: "Account" }} />
    </Tab.Navigator>
  );
}

// ─── Admin Tabs ───

const ADMIN_ICONS: Record<string, { active: string; inactive: string }> = {
  AdminDashboard: { active: "grid", inactive: "grid-outline" },
  AdminOrders: { active: "receipt", inactive: "receipt-outline" },
  AdminStock: { active: "cube", inactive: "cube-outline" },
  AdminDrivers: { active: "car", inactive: "car-outline" },
  AdminMore: { active: "menu", inactive: "menu-outline" },
};

function AdminTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      tabBar={(props) => <RoleTabBar {...props} iconMap={ADMIN_ICONS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="AdminDashboard" component={AdminDashboard} options={{ tabBarLabel: "Dashboard" }} />
      <Tab.Screen name="AdminOrders" component={AdminOrderManagement} options={{ tabBarLabel: "Orders" }} />
      <Tab.Screen name="AdminStock" component={AdminStockControl} options={{ tabBarLabel: "Stock" }} />
      <Tab.Screen name="AdminDrivers" component={AdminDriverManagement} options={{ tabBarLabel: "Drivers" }} />
      <Tab.Screen name="AdminMore" component={AdminSettings} options={{ tabBarLabel: "More" }} />
    </Tab.Navigator>
  );
}

// ─── Stacks ───

function AuthStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{ headerShown: true, title: "Create Account", headerStyle: { backgroundColor: colors.header.bg }, headerTintColor: colors.header.fg }}
      />
    </Stack.Navigator>
  );
}

function AppStack() {
  const { colors } = useTheme();
  const so = { headerStyle: { backgroundColor: colors.header.bg }, headerTintColor: colors.header.fg, headerTitleStyle: { fontWeight: "600" as const }, contentStyle: { backgroundColor: colors.background.primary }, headerBackTitleVisible: false, headerBackTitle: "" };
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: "Product Details" }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} options={{ title: "My Orders" }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order Details" }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Wishlist" }} />
      <Stack.Screen name="SavedAddresses" component={SavedAddressesScreen} options={{ title: "Addresses" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="SommelierChat" component={SommelierChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CustomerRating" component={CustomerRatingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PromoCode" component={PromoCodeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Reorder" component={ReorderScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ScheduleDelivery" component={ScheduleDeliveryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CustomerDeliveryPin" component={CustomerDeliveryPin} options={{ headerShown: false }} />
      <Stack.Screen name="Dispute" component={DisputeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Editorial" component={EditorialScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditorialArticle" component={EditorialArticleScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryChat" component={DeliveryChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryCall" component={DeliveryCallScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function DriverStack() {
  const { colors } = useTheme();
  const so = { headerStyle: { backgroundColor: colors.header.bg }, headerTintColor: colors.header.fg, headerTitleStyle: { fontWeight: "600" as const }, contentStyle: { backgroundColor: colors.background.primary }, headerBackTitleVisible: false, headerBackTitle: "" };
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="DriverDashboard" component={DriverDashboard} options={{ headerShown: false }} />
      <Stack.Screen name="DriverDeliveryDetail" component={DriverDeliveryDetail} options={{ headerShown: false }} />
      <Stack.Screen name="DriverEarnings" component={DriverEarnings} options={{ headerShown: false }} />
      <Stack.Screen name="DriverDepotPickup" component={DriverDepotPickup} options={{ headerShown: false }} />
      <Stack.Screen name="DriverScanVerify" component={DriverScanVerify} options={{ headerShown: false }} />
      <Stack.Screen name="DriverNavigation" component={DriverNavigation} options={{ headerShown: false }} />
      <Stack.Screen name="DriverMenu" component={DriverMenu} options={{ headerShown: false }} />
      <Stack.Screen name="DriverAIAssistant" component={DriverAIAssistant} options={{ headerShown: false }} />
      <Stack.Screen name="DriverChat" component={DriverChat} options={{ headerShown: false }} />
      <Stack.Screen name="DriverSettings" component={DriverSettings} options={{ headerShown: false }} />
      <Stack.Screen name="DriverRatings" component={DriverRatings} options={{ headerShown: false }} />
      <Stack.Screen name="DriverSupport" component={DriverSupport} options={{ headerShown: false }} />
      <Stack.Screen name="DriverAIItemVerify" component={DriverAIItemVerify} options={{ headerShown: false }} />
      <Stack.Screen name="DriverPhotoProof" component={DriverPhotoProof} options={{ headerShown: false }} />
      <Stack.Screen name="DriverHeatMap" component={DriverHeatMap} options={{ headerShown: false }} />
      <Stack.Screen name="DriverTripSummary" component={DriverTripSummary} options={{ headerShown: false }} />
      <Stack.Screen name="DriverDeliveryPinVerify" component={DriverDeliveryPinVerify} options={{ headerShown: false }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryChat" component={DeliveryChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DeliveryCall" component={DeliveryCallScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ReturnToStore" component={ReturnToStoreScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  const { colors } = useTheme();
  const so = { headerShown: false as const, contentStyle: { backgroundColor: colors.background.primary } };
  return (
    <Stack.Navigator screenOptions={so}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} />
      <Stack.Screen name="AdminOrderDetail" component={AdminOrderDetail} />
      <Stack.Screen name="AdminProductManagement" component={AdminProductManagement} />
      <Stack.Screen name="AdminReports" component={AdminReports} />
      <Stack.Screen name="AdminSettings" component={AdminSettings} />
      <Stack.Screen name="AdminCustomerManagement" component={AdminCustomerManagement} />
      <Stack.Screen name="AdminPromoManagement" component={AdminPromoManagement} />
      <Stack.Screen name="AdminZoneManagement" component={AdminZoneManagement} />
      <Stack.Screen name="AdminAuditLog" component={AdminAuditLogScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

// ─── Driver Verification Gate ───
// Blocks unverified driver accounts from accessing the driver app.
// Fetches is_verified from the drivers table on mount; shows a pending screen
// until admin approves the driver account.

function PendingVerificationScreen() {
  const { colors, gradients } = useTheme();
  const { signOut } = useAuth();

  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.gold.faint,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Icon name="shield-checkmark-outline" size={40} color={colors.gold.primary} />
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "700",
          color: colors.text.primary,
          textAlign: "center",
          marginBottom: 12,
        }}
      >
        Verification Pending
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: colors.text.muted,
          textAlign: "center",
          lineHeight: 22,
          paddingHorizontal: 32,
          marginBottom: 32,
        }}
      >
        Your driver account is being reviewed. You will be notified once approved and can start accepting deliveries.
      </Text>
      <TouchableOpacity
        onPress={signOut}
        accessibilityLabel="Sign out"
        style={{
          paddingHorizontal: 32,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.gold.border,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ color: colors.text.muted, fontSize: 15, fontWeight: "600" }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function DriverVerificationGate() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [verifiedState, setVerifiedState] = useState<"loading" | "verified" | "pending">("loading");

  useEffect(() => {
    if (!user?.id) return;

    supabase
      .from("driver_profiles")
      .select("is_verified")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          // Driver row not found yet (new account) — treat as pending
          console.warn("[DriverVerificationGate] drivers row not found for user:", user.id, error.message);
          setVerifiedState("pending");
          return;
        }
        setVerifiedState(data?.is_verified ? "verified" : "pending");
      });
  }, [user?.id]);

  if (verifiedState === "loading") {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.gold.muted }]}>Checking account...</Text>
      </View>
    );
  }

  if (verifiedState === "pending") {
    return <PendingVerificationScreen />;
  }

  return <DriverStack />;
}

// ─── Root ───

export default function AppNavigator() {
  const { user, role, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.gold.muted }]}>Loading...</Text>
      </View>
    );
  }

  const getStack = () => {
    if (!user) return <AuthStack />;
    switch (role) {
      case "admin":
        return <AdminStack />;
      case "driver":
        return <DriverVerificationGate />;
      default:
        return <AppStack />;
    }
  };

  return <NavigationContainer>{getStack()}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 16, marginTop: 12 },
  badge: { position: "absolute", right: -10, top: -4, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  badgeText: { fontSize: 10, fontWeight: "bold", textAlign: "center" },
  tabBar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 11, marginTop: 4 },
  activeIndicator: { width: 20, height: 3, borderRadius: 1.5, marginTop: 4 },
  activeIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  inactiveIconWrap: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
});
