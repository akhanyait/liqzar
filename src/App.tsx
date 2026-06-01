import {
  useState,
  lazy,
  Suspense,
  memo,
  useEffect,
} from "react";
import { Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/layout/Footer";
import AgeGate from "@/components/AgeGate";
import ProtectedRoute from "@/components/ProtectedRoute";
import InAppNotificationBanner, {
  InAppNotification,
  useInAppNotifications,
} from "@/components/native/InAppNotification";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { useOrderStatusToasts } from "@/hooks/useOrderStatusToasts";
// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const CataloguePage = lazy(() => import("./pages/CataloguePage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const OrderHistoryPage = lazy(() => import("./pages/OrderHistoryPage"));
const LiveOrderTrackingPage = lazy(
  () => import("./pages/LiveOrderTrackingPage"),
);
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const SavedAddressesPage = lazy(() => import("./pages/SavedAddressesPage"));
const PaymentMethodsPage = lazy(() => import("./pages/PaymentMethodsPage"));
const LoyaltyPage = lazy(() => import("./pages/LoyaltyPage"));
const CellarClubPage = lazy(() => import("./pages/CellarClubPage"));
const CorporateAccountsPage = lazy(() => import("./pages/CorporateAccountsPage"));
const MyCellarPage = lazy(() => import("./pages/MyCellarPage"));
const ReferralPage = lazy(() => import("./pages/ReferralPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const SecurityPage = lazy(() => import("./pages/SecurityPage"));
const PreferencesPage = lazy(() => import("./pages/PreferencesPage"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const AccountDeletionPage = lazy(() => import("./pages/AccountDeletionPage"));
const BulkOrderPage = lazy(() => import("./pages/BulkOrderPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const PaymentCancelPage = lazy(() => import("./pages/PaymentCancelPage"));
const PaymentErrorPage = lazy(() => import("./pages/PaymentErrorPage"));
const PaymentReturnBridgePage = lazy(
  () => import("./pages/PaymentReturnBridgePage"),
);
const EditorialPage = lazy(() => import("./pages/EditorialPage"));
const EditorialArticle = lazy(() => import("./pages/EditorialArticle"));
const ShareTripPage = lazy(() => import("./pages/ShareTripPage"));
const DeliveryCallPage = lazy(() => import("./pages/DeliveryCallPage"));

// Lazy load admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing"));
const AdminCRM = lazy(() => import("./pages/admin/AdminCRM"));
const AdminDrivers = lazy(() => import("./pages/admin/AdminDrivers"));
const AdminLoyalty = lazy(() => import("./pages/admin/AdminLoyalty"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminAssignDeliveries = lazy(
  () => import("./pages/admin/AdminAssignDeliveries"),
);

// Lazy load driver pages
const DriverLayout = lazy(() => import("./pages/driver/DriverLayout"));
const DriverDashboard = lazy(() => import("./pages/driver/DriverDashboard"));
const DriverActive = lazy(() => import("./pages/driver/DriverActiveUber")); // Uber-style driver experience
const DriveScreen = lazy(() => import("./pages/driver/DriveScreen")); // Full-screen turn-by-turn navigation
const LiveRouteScreen = lazy(() => import("./pages/driver/LiveRouteScreen")); // AI route optimization overview
const DriverHistory = lazy(() => import("./pages/driver/DriverHistory"));
const DriverAnalytics = lazy(() => import("./pages/driver/DriverAnalytics"));
const DriverOrders = lazy(() => import("./pages/driver/DriverOrders"));
const DriverProfile = lazy(() => import("./pages/driver/DriverProfile")); // Driver profile management
const DriverVehicle = lazy(() => import("./pages/driver/DriverVehicle")); // Vehicle registration
const DriverScanItems = lazy(() => import("./pages/driver/DriverScanItems")); // Item scanning system
const DriverProofOfDelivery = lazy(
  () => import("./pages/driver/DriverProofOfDelivery"),
);
const TestOrdersPage = lazy(() => import("./pages/TestOrdersPage")); // Test order generation

// Lazy load heavy components
const SommelierChat = lazy(() => import("@/components/SommelierChat"));
const FloatingCart = lazy(() => import("@/components/native/FloatingCart"));
const LiveOrderETAWidget = lazy(
  () => import("@/components/native/LiveOrderETAWidget"),
);

// Optimized query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Web app always uses BrowserRouter. The React Native app (apps/mobile) handles
// iOS/Android routing independently via React Navigation.
const Router = BrowserRouter;

// Simple loading spinner for Suspense
const PageLoader = memo(() => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
));

const RoleGate = ({ children }: { children: React.ReactNode }) => {
  const { role, user } = useAuth();
  if (user && role && role !== "customer") {
    const dest =
      role === "admin"
        ? "/admin"
        : role === "driver"
          ? "/driver"
          : "/";
    if (dest !== "/") return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
};

// NativeRoleGate is no longer needed — the web app supports all roles.
// The React Native app (apps/mobile) enforces its own role-based navigation.

const CustomerLayout = () => {
  const { currentNotification, showNotification, dismissNotification } =
    useInAppNotifications();
  const { showNotification: showNativeNotification } = useLocalNotifications();
  const { user } = useAuth();
  useOrderStatusToasts(user?.id);

  // Demo: Show a welcome notification on mount (only once per session)
  useEffect(() => {
    const shown = sessionStorage.getItem("welcome-notification-shown");
    if (!shown && user) {
      const timer = setTimeout(() => {
        showNotification({
          title: "Welcome back! 🎉",
          message:
            "Check out our new arrivals and exclusive deals just for you.",
          type: "promo",
        });
        sessionStorage.setItem("welcome-notification-shown", "true");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, showNotification]);

  return (
    <RoleGate>
      <InAppNotificationBanner
        notification={currentNotification}
        onDismiss={dismissNotification}
      />
      <Header />
      <main className="pt-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:pt-[calc(env(safe-area-inset-top,0px)+5.75rem)] overflow-x-hidden">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/category/:id" element={<CategoryPage />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/catalogue" element={<CataloguePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/track/:orderId" element={<LiveOrderTrackingPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/gift-cards" element={<GiftCardsPage />} />
            <Route path="/bulk-order" element={<BulkOrderPage />} />
            <Route path="/addresses" element={<SavedAddressesPage />} />
            <Route path="/payments" element={<PaymentMethodsPage />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/cellar-club" element={<CellarClubPage />} />
            <Route path="/corporate" element={<CorporateAccountsPage />} />
            <Route path="/my-cellar" element={<MyCellarPage />} />
            <Route path="/referral" element={<ReferralPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/settings" element={<PreferencesPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/account-deletion" element={<AccountDeletionPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/cancel" element={<PaymentCancelPage />} />
            <Route path="/payment/error" element={<PaymentErrorPage />} />
            <Route path="/payment/return" element={<PaymentReturnBridgePage />} />
            <Route path="/editorial" element={<EditorialPage />} />
            <Route path="/editorial/:slug" element={<EditorialArticle />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <Suspense fallback={null}>
        <FloatingCart />
        <SommelierChat />
        <LiveOrderETAWidget />
      </Suspense>
      <BottomNav />
    </RoleGate>
  );
};

const App = () => {
  const [ageVerified, setAgeVerified] = useState(
    () => localStorage.getItem("liqzar-age-verified") === "true",
  );

  if (!ageVerified) {
    return <AgeGate onVerified={() => setAgeVerified(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        storageKey="liqzar-theme"
        enableSystem
      >
      <AuthProvider>
        <LanguageProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Router>
              <a href="#main-content" className="skip-link">
                Skip to main content
              </a>
              <div id="main-content" className="min-h-screen bg-background">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                      <Route path="/auth" element={<AuthPage />} />

                      {/* Public share-trip page — token-gated, no auth required */}
                      <Route path="/trip/:token" element={<ShareTripPage />} />

                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute allowedRoles={["admin"]}>
                            <AdminLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<AdminDashboard />} />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route path="products" element={<AdminProducts />} />
                        <Route path="customers" element={<AdminCustomers />} />
                        <Route path="inventory" element={<AdminInventory />} />
                        <Route path="pricing" element={<AdminPricing />} />
                        <Route path="crm" element={<AdminCRM />} />
                        <Route path="drivers" element={<AdminDrivers />} />
                        <Route
                          path="assign-deliveries"
                          element={<AdminAssignDeliveries />}
                        />
                        <Route path="loyalty" element={<AdminLoyalty />} />
                        <Route path="reports" element={<AdminReports />} />
                        <Route path="settings" element={<AdminSettings />} />
                      </Route>

                      {/* Legacy /warehouse paths now redirect to admin inventory */}
                      <Route
                        path="/warehouse/*"
                        element={<Navigate to="/admin/inventory" replace />}
                      />

                      <Route
                        path="/driver"
                        element={
                          <ProtectedRoute allowedRoles={["driver", "admin"]}>
                            <DriverLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route index element={<DriverDashboard />} />
                        <Route path="orders" element={<DriverOrders />} />
                        <Route path="analytics" element={<DriverAnalytics />} />
                        <Route path="history" element={<DriverHistory />} />
                        <Route path="profile" element={<DriverProfile />} />
                        <Route path="vehicle" element={<DriverVehicle />} />
                        <Route
                          path="scan/:orderId"
                          element={<DriverScanItems />}
                        />
                      </Route>

                      {/* Test Orders - for development */}
                      <Route
                        path="/test-orders"
                        element={
                          <ProtectedRoute
                            allowedRoles={["customer", "driver", "admin"]}
                          >
                            <TestOrdersPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Full-screen Uber-style driver active delivery - outside layout for immersive experience */}
                      <Route
                        path="/driver/active"
                        element={
                          <ProtectedRoute allowedRoles={["driver", "admin"]}>
                            <DriverActive />
                          </ProtectedRoute>
                        }
                      />

                      {/* Full-screen turn-by-turn navigation */}
                      <Route
                        path="/driver/drive"
                        element={
                          <ProtectedRoute allowedRoles={["driver", "admin"]}>
                            <DriveScreen />
                          </ProtectedRoute>
                        }
                      />

                      {/* Live route overview with AI optimization */}
                      <Route
                        path="/driver/live-route"
                        element={
                          <ProtectedRoute allowedRoles={["driver", "admin"]}>
                            <LiveRouteScreen />
                          </ProtectedRoute>
                        }
                      />

                      {/* Proof of delivery capture */}
                      <Route
                        path="/driver/proof/:orderId"
                        element={
                          <ProtectedRoute allowedRoles={["driver", "admin"]}>
                            <DriverProofOfDelivery />
                          </ProtectedRoute>
                        }
                      />

                      {/* In-app voice/video call between customer and driver */}
                      <Route
                        path="/call/:orderId"
                        element={
                          <ProtectedRoute
                            allowedRoles={["customer", "driver", "admin"]}
                          >
                            <DeliveryCallPage />
                          </ProtectedRoute>
                        }
                      />

                      <Route path="*" element={<CustomerLayout />} />
                    </Routes>
                  </Suspense>
                </div>
            </Router>
          </TooltipProvider>
        </CartProvider>
        </LanguageProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
