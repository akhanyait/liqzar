I have now read all screens across all roles. Here is the comprehensive LIQZAR Business Requirements and Features Document.

---

# LIQZAR Mobile App -- Complete Business Requirements & Features Document

## 1. APPLICATION OVERVIEW

**Application Name:** LIQZAR (branded as "LIQZAR" throughout, previously "LIQZAR" in backend references)
**Platform:** React Native + Expo (iOS & Android)
**Backend:** Supabase (PostgreSQL, real-time subscriptions, auth, storage, RPC functions)
**Target Market:** South Africa (ZAR currency, +27 phone codes, 15% VAT, SA provincial addresses, 18+ age gate required by law)
**App Category:** On-demand alcohol delivery marketplace with multi-role support
**Design Language:** Premium luxury aesthetic -- black/gold (dark mode) and cream/gold (light mode) with gradients, blur effects, and haptic feedback

**Supabase Instance:** `https://emmipyyfcrwkjogepscg.supabase.co`
**API Base URL:** `https://api.liqzar.co.za`

---

## 2. USER ROLES

The application supports four distinct user roles, each with its own navigation stack and feature set:

| Role | Description | Test Phone | Test OTP |
|---|---|---|---|
| **Customer** | End-user who browses, orders, and tracks deliveries | 0790771591 | 123456 |
| **Driver** | Delivery personnel who picks up and delivers orders | 0621532030 | 123456 |
| **Admin** | Business administrator with full platform management capabilities | 0790771567 | 123456 |
| **Warehouse** | Warehouse staff managing inventory, picking, packing, and dispatch | 0780790771 | 123456 |

Role type: `AppRole = "admin" | "customer" | "warehouse" | "driver"`

---

## 3. AUTHENTICATION SYSTEM

**Source files:**
- `/apps/mobile/src/contexts/AuthContext.tsx`
- `/apps/mobile/src/screens/auth/LoginScreen.tsx`
- `/apps/mobile/src/screens/auth/SignUpScreen.tsx`
- `/apps/mobile/src/components/AgeGate.tsx`
- `/apps/mobile/src/services/storage.ts`

### 3.1 Login Methods
- **Phone-based OTP login (primary):** User enters SA phone number with +27 country code, receives 6-digit OTP, enters it to authenticate.
- **Email/password login (secondary):** Available via "Sign in with email" which navigates to sign-up screen.
- **Quick Login (dev/demo):** 4 role cards (Customer, Driver, Admin, Warehouse) for one-tap sign-in using hardcoded test phone numbers.

### 3.2 Sign-Up
- Fields: Full Name, Email, Password (minimum 6 characters)
- Email validation, password visibility toggle
- Creates Supabase auth user with `full_name` in metadata
- 18+ age disclaimer at registration

### 3.3 Age Verification Gate
- Full-screen premium UI gate with LIQZAR branding
- "Are you 18 or older?" prompt
- "Yes, I'm 18+" button (gold gradient) proceeds to app
- "No, I'm under 18" button redirects to Google (exits app context)
- Legal text: "Not for sale to persons under the age of 18" / "Drink Responsibly"
- Additional age verification checkbox at checkout

### 3.4 Session Management
- **SecureAuthStorage:** Uses `expo-secure-store` as primary, with `AsyncStorage` fallback
- Auto-refresh tokens enabled
- Session persistence enabled
- Functions: `signIn`, `signInWithPhone`, `signUp`, `signOut`, `resetPassword`

### 3.5 Login Screen UI Features
- Hero banner with Unsplash cocktail image and gradient overlay
- Pulsing gold logo glow animation
- Theme toggle (dark/light) available on login screen
- Animated entry (fade + slide up)
- Terms of Service footer

---

## 4. NAVIGATION ARCHITECTURE

**Source file:** `/apps/mobile/src/navigation/AppNavigator.tsx`

### 4.1 Role-Based Routing
```
switch(role) {
  case "admin": AdminStack
  case "warehouse": WarehouseStack
  case "driver": DriverStack
  default: AppStack (customer)
}
```

### 4.2 Customer Navigation (AppStack)
- **Bottom Tab Bar with 4 tabs:** Home, Catalog (Browse), Cart (with badge), Profile
- **Stack screens (accessible from tabs):** ProductDetail, Search, BarcodeScanner, Checkout, OrderHistory, OrderDetail, OrderTracking, Wishlist, SavedAddresses, Notifications, SommelierChat, EditProfile, PromoCode, Reorder, ScheduleDelivery, LoyaltyRewards, ReferAndEarn, CustomerRating, CustomerDeliveryPin

### 4.3 Admin Navigation (AdminStack)
- **Bottom Tab Bar with 5 tabs:** Dashboard, Orders, Stock, Drivers, More
- **Stack screens:** AdminOrderManagement, AdminOrderDetail, AdminProductManagement, AdminStockControl, AdminDriverManagement, AdminReports, AdminSettings, AdminCustomerManagement, AdminPromoManagement, AdminZoneManagement

### 4.4 Warehouse Navigation (WarehouseStack)
- **Bottom Tab Bar with 4 tabs:** Dashboard, Tasks, Stock, Receive
- **Stack screens:** WarehouseTaskList, WarehouseTaskDetail, WarehouseStockView, WarehouseReceiving, WarehouseQualityCheck, WarehouseReturns, WarehouseAIPredictions, WarehouseDepotRelease

### 4.5 Driver Navigation (DriverStack)
- **No bottom tab bar** -- purely stack-based navigation with 17 screens
- Screens: DriverDashboard, DriverDeliveryDetail, DriverEarnings, DriverDepotPickup, DriverScanVerify, DriverNavigation, DriverMenu, DriverAIAssistant, DriverChat, DriverSettings, DriverRatings, DriverSupport, DriverAIItemVerify, DriverPhotoProof, DriverHeatMap, DriverTripSummary, DriverDeliveryPinVerify

### 4.6 Custom Tab Bar
- `RoleTabBar` component with gold active indicator
- Cart badge showing item count on Cart tab
- Premium gold accent styling

---

## 5. CUSTOMER FEATURES

### 5.1 Home Screen
**File:** `/apps/mobile/src/screens/HomeScreen.tsx` (870+ lines)

- LIQZAR logo header with theme toggle, notifications icon, and cart icon (with badge)
- **Auto-rotating hero carousel** (3 slides): Premium Spirits, Gift Hampers, Happy Hour with gold gradient text
- **Trust strip:** "Retailer of the Year", "Free delivery R150+", "Secure Checkout", "Gift Wrapping"
- **Search bar** with barcode scanner button
- **Category pills:** Whisky, Vodka, Gin, Wine, Beer, Champagne, Cognac, Rum, Tequila, Liqueurs (horizontal scroll)
- **Product sections:** Featured Products, Trending Now, New Arrivals (horizontal FlatLists with product cards)
- **Quick Services grid:** Reorder (with pulsing animation), Schedule Delivery, Rewards, Refer Friends, Promos, Wishlist
- **AI Sommelier FAB** (floating action button) with pulsing gold glow animation
- Pull-to-refresh support

### 5.2 Product Catalog / Browse
**File:** `/apps/mobile/src/screens/CatalogScreen.tsx`

- 11 category filter chips with icons (All, Whisky, Vodka, Gin, Wine, Beer, Champagne, Cognac, Rum, Tequila, Liqueurs)
- Full-text search with debounced query sent to Supabase (`ilike` query)
- Barcode scan button in search bar
- 2-column product grid with images, names, categories, prices
- Add to cart directly from grid via "+" button
- Empty state with "Browse All Products" reset CTA
- Pull-to-refresh

### 5.3 Product Detail
**File:** `/apps/mobile/src/screens/ProductDetailScreen.tsx`

- Full-screen hero product image with gradient overlay
- BlurView back button (expo-blur)
- "Premium" badge for featured products
- Category pill, product name, star rating with review count, price in ZAR
- Expandable description card
- Details grid: Bottle Size, Country of Origin, ABV (Alcohol By Volume)
- Stock status indicator (in stock / out of stock)
- **Bottom bar:** Quantity selector (+/-) with "Add to Cart" gold gradient button showing calculated total price
- Scale animation on add-to-cart press

### 5.4 Barcode Scanner
**File:** `/apps/mobile/src/screens/BarcodeScannerScreen.tsx`

- Uses `expo-camera` (CameraView) for barcode scanning
- Supports barcode types: EAN-13, EAN-8, UPC-A, UPC-E, Code128, Code39, Code93, QR
- Animated scan line within gold corner brackets
- Camera torch/flashlight toggle
- Auto-searches product database on scan
- Navigates to ProductDetail if product found
- "Product not found" toast with auto-dismiss
- Camera permission request flow with branded UI

### 5.5 Shopping Cart
**File:** `/apps/mobile/src/screens/CartScreen.tsx`

- Cart items with product image, name, category, unit price, quantity controls (+/-), line total, remove button
- **Order summary:** Subtotal, VAT (15%), Delivery fee (free over R150, else R9.99)
- Free delivery threshold hint ("Add Rx.xx more for free delivery")
- Gold gradient "Checkout" button with total price
- Empty cart state with "Start Shopping" CTA
- Confirmation dialogs for remove item and clear cart
- Cart persisted to AsyncStorage (`@liqzar_cart`)

### 5.6 Checkout
**File:** `/apps/mobile/src/screens/CheckoutScreen.tsx` (1547 lines)

**3-step checkout flow:**

**Step 1 -- Delivery Address:**
- Street Address, City, Province, Postal Code (SA addresses)
- Delivery method selection:
  - Standard: R9.99, 3-5 business days
  - Express: R29.99, same-day delivery
  - Free: Orders over R150

**Step 2 -- Payment:**
- Cash on Delivery
- Card Payment (Visa, Mastercard)
- Payment method icons and selection UI

**Step 3 -- Review & Place Order:**
- Order items review with images and quantities
- Promo code input and application
- **Hardcoded promo codes:** WELCOME10 (10% off), PREMIUM20 (20% off over R200), FREEDELIVERY, SAVE50 (R50 off over R100)
- Full order summary: Subtotal, Promo Discount, Delivery Fee, VAT (15%), Grand Total
- **Age verification dialog** at final step (SA law -- must be 18+)
- **Stock availability check** before placing order (calls `checkStock` via OrderContext)
- Specific out-of-stock error handling per item
- **Delivery PIN notification** in success message
- Uses `OrderContext.placeOrder`

### 5.7 Search
**File:** `/apps/mobile/src/screens/SearchScreen.tsx`

- Debounced search (500ms delay) with minimum 2-character threshold
- Recent searches display (mock data: Johnnie Walker Black, Hennessy VS, etc.)
- Microphone button placeholder for voice search
- Product results as list cards with images
- Empty state with "Browse Catalog" CTA
- Navigate to ProductDetail on tap

### 5.8 Order History
**File:** `/apps/mobile/src/screens/OrderHistoryScreen.tsx`

- Filter tabs: All, Active, Completed, Cancelled (with count badges)
- Order cards with: left-side colored status stripe, order number, relative time ("2h ago"), status pill, item thumbnails, total price, "View Details" button
- Active statuses: pending, confirmed, preparing, ready, en_route

### 5.9 Order Detail
**File:** `/apps/mobile/src/screens/OrderDetailScreen.tsx`

- Fetches order data from Supabase via `ordersApi.getOrderById`
- **Timeline visualization** of order status progression through 8 steps (pending -> confirmed -> preparing -> ready -> driver_assigned -> picked_up -> en_route -> delivered)
- Pulsing dot animation on the currently active timeline step
- Uses `STATUS_DISPLAY` from `OrderWorkflowEngine`
- Order items list, delivery address, payment summary

### 5.10 Order Tracking (Live)
**File:** `/apps/mobile/src/screens/OrderTrackingScreen.tsx`

- **MapView** (react-native-maps) with:
  - Driver marker (animated position)
  - Store/depot marker
  - Route polyline between store and customer
- Real-time tracking data: driver GPS coordinates, ETA in minutes, current status
- **Driver info card:** Name, phone number, photo, rating (stars), vehicle details (make, model, color, plate)
- **Delivery PIN display** for customer to share with driver
- **Progress steps bar:** Confirmed -> Preparing -> Picked Up -> En Route -> Delivered
- Call driver button, share tracking link button
- Mock Johannesburg area coordinates for demo

### 5.11 Wishlist / Favorites
**File:** `/apps/mobile/src/screens/WishlistScreen.tsx`

- 2-column product grid of saved items
- Fetches from Supabase via `wishlistApi.getWishlist` (with product join)
- Each card: product image, category, name, bottle size, price, stock status
- "Add to Cart" button (gold gradient) for in-stock items
- "Out of Stock" badge for unavailable items
- Remove from wishlist with confirmation dialog (heart-dislike icon)
- Empty state: "No items in wishlist" with "Browse Products" CTA
- Pull-to-refresh

### 5.12 Saved Addresses
**File:** `/apps/mobile/src/screens/SavedAddressesScreen.tsx`

- Address list with label icons (Home, Work, or generic Location)
- "Default" badge for primary address
- Edit and delete functionality
- **Add/Edit modal** (bottom sheet style):
  - Fields: Label, Street Address, City, Province, Postal Code
  - Country fixed to "South Africa"
  - First address auto-set as default
- Supabase integration via `profileApi.getAddresses`, `addAddress`, `deleteAddress`
- Mock fallback data for demo (Cape Town and Johannesburg addresses)

### 5.13 Notifications
**File:** `/apps/mobile/src/screens/NotificationsScreen.tsx`

- Three notification types: `order_update`, `promotion`, `system`
- Unread count badge in header
- Unread indicator dot (gold) on each unread notification
- Mark-as-read on tap (updates Supabase `notifications` table)
- Navigate to OrderDetail for order_update notifications (if `data.orderId` present)
- Type-specific icon and color coding:
  - Order updates: green/receipt icon
  - Promotions: gold/pricetag icon
  - System: blue/info icon
- Relative time display (e.g., "5m ago", "2h ago", "3d ago")
- Pull-to-refresh
- Empty state with messaging about future notifications

### 5.14 AI Sommelier Chat
**File:** `/apps/mobile/src/screens/SommelierChatScreen.tsx`

- Chat interface with user and AI assistant message bubbles
- Keyword-based recommendation engine matching: whisky, whiskey, wine, vodka, gin, beer, champagne, pair, budget, recommend
- Fetches real products from Supabase matching recommended categories
- Returns expert-sounding text recommendations with product suggestion cards inline
- **Suggested prompts:** "Best whisky under R500?", "Wine for date night", "What pairs with steak?", "Recommend a budget gin"
- Product cards within chat are tappable (navigate to ProductDetail)

### 5.15 Loyalty / Rewards Program
**File:** `/apps/mobile/src/screens/LoyaltyScreen.tsx`

- **Points balance card** (gold gradient): Current points (2,450 mock), monetary value (R245)
- **Tier system:** Gold Member tier badge, progress bar to next tier (Platinum at 5,000 points)
- **How to Earn section:**
  - R1 spent = 1 Point (on every purchase)
  - Product Review = 50 Points
  - Referral = 500 Points
- **Redeem Rewards catalog:**
  - R50 Voucher (500 points)
  - R100 Voucher (1,000 points)
  - Free Delivery Pass (300 points)
  - Birthday Bottle (2,000 points)
- **Transaction History:** Shows earned and redeemed transactions with dates and point values
- **Refer a Friend banner** at bottom

### 5.16 Referral Program
**File:** `/apps/mobile/src/screens/ReferralScreen.tsx`

- **Referral code display:** "LIQZAR-SARAH50" with copy-to-clipboard button
- **How it works** (3-step explanation): Share code -> Friend orders -> Both get R50
- **Share options:** WhatsApp, SMS, Email, More (with colored icons)
- **Stats card:** Total Referrals (5), Earnings (R250), Pending (R50)
- **Referral tracking list:** Shows each referral with name, date, and status badge (signed_up / first_order / reward_earned)
- Terms & Conditions link

### 5.17 Quick Reorder
**File:** `/apps/mobile/src/screens/ReorderScreen.tsx`

- **Recent Orders section:** Shows past 5 orders with date, item count, total, product thumbnails, and one-tap "Reorder" button
- **Frequently Ordered section:** Shows top 6 products with quantity stepper (+/-) for each
- Bottom bar with "View Cart" button showing item count and total
- Truncated item name display for long product names

### 5.18 Schedule Delivery
**File:** `/apps/mobile/src/screens/ScheduleDeliveryScreen.tsx`

- **Date picker:** Horizontal scrolling 7-day picker (Today, Tomorrow, Mon, Tue, etc.)
- **Time slot selection** organized by period:
  - Morning (9AM-12PM): 3 one-hour slots
  - Afternoon (12PM-5PM): 5 one-hour slots
  - Evening (5PM-9PM): 4 one-hour slots
  - Some slots marked unavailable
- **Delivery Address card** with "Change" option
- **Delivery Instructions** text area (e.g., "Ring the bell, leave at the gate...")
- **Delivery Speed toggle:**
  - Standard (60 min)
  - Express (30 min)
- **Priority Delivery toggle:** Guaranteed within 30 min for R55
- **Pricing info:** Standard free over R150, Express R35
- "Confirm Schedule" button

### 5.19 Promo Codes
**File:** `/apps/mobile/src/screens/PromoCodeScreen.tsx`

- Manual code input field (auto-uppercase)
- Apply button with validation
- Applied code success banner (green) with savings amount and "Remove" option
- **Available promos list:**
  - WELCOME10: 10% off first order
  - PREMIUM20: 20% off orders over R500
  - FREEDELIVERY: Free delivery on next order
- Each promo card: dashed border, discount badge, code, description, expiry date, Apply/Remove button

### 5.20 Customer Rating
**File:** `/apps/mobile/src/screens/CustomerRatingScreen.tsx`

- **Rate your driver:** Driver info card (name, deliveries, rating) + 5-star selector with labels (Poor/Fair/Good/Great/Excellent)
- **Rate your delivery:** Separate 5-star selector
- **Comments:** Multi-line text input for feedback
- **Tip your driver:** Quick tip options (R10, R20, R50, Custom) with toggle selection
- Gold gradient "Submit" button

### 5.21 Edit Profile
**File:** `/apps/mobile/src/screens/EditProfileScreen.tsx`

- Gold gradient avatar with person icon, "Change Photo" link (placeholder)
- Form fields: Full Name, Email, Phone Number (read-only/disabled), Date of Birth
- "Save Changes" gold gradient button

### 5.22 Profile Hub
**File:** `/apps/mobile/src/screens/ProfileScreen.tsx`

- Avatar with gold gradient ring and user initials
- Theme toggle switch (dark/light)
- **Account group:** Edit Profile, Order History, Wishlist, Saved Addresses
- **Rewards & Offers group:** LIQZAR Rewards (2,450 points, Gold Member), Refer & Earn (Give R50 Get R50), Quick Reorder, Promo Codes
- **Preferences group:** Schedule Delivery, Notifications, Security & Biometrics, Help & Support
- Sign out button with gold gradient border

---

## 6. DRIVER FEATURES

### 6.1 Driver Dashboard
**File:** `/apps/mobile/src/screens/driver/DriverDashboard.tsx`

- Online/offline toggle for availability
- Active delivery list with status management
- **Driver actions:** Accept delivery, mark Picked Up, mark En Route, mark Delivered
- Progress bar per delivery showing current stage
- Earnings summary for the day
- Uses OrderContext for real-time order actions
- Navigation to all driver sub-screens

### 6.2 Delivery Detail
**File:** `/apps/mobile/src/screens/driver/DriverDeliveryDetail.tsx`

- Order-specific detail view with order number
- **4-step progress tracker:** Assigned -> Picked Up -> En Route -> Delivered
- Customer info with call button (`Linking.openURL(tel:...)`)
- Next-step action button that routes to appropriate flow:
  - "Picked Up" -> navigates to DriverDepotPickup -> DriverScanVerify flow
  - "En Route" -> calls `markEnRoute` then navigates to DriverNavigation
  - "Delivered" -> navigates to DriverDeliveryPinVerify
- Uses OrderContext: `markPickedUp`, `markEnRoute`, `markDelivered`

### 6.3 Earnings
**File:** `/apps/mobile/src/screens/driver/DriverEarnings.tsx`

- Period toggle: Week / Month
- Daily earnings breakdown: date, deliveries count, earnings (ZAR), tips, distance (km)
- Totals: Total earnings, total tips, total deliveries, total distance
- Visual bar chart representation (proportional to max earning day)
- Mock data: 7 days of earnings ranging R920-R2,100/day

### 6.4 Depot Pickup (Navigation to Depot)
**File:** `/apps/mobile/src/screens/driver/DriverDepotPickup.tsx`

- **MapView** with driver marker, depot marker, and route polyline
- Real Cape Town coordinates (LIQZAR Central Depot: 12 Buitengracht St, Cape Town, 8001)
- Uses `expo-location` for real driver GPS (falls back to mock if not near Cape Town)
- **Turn-by-turn directions** list (e.g., "Head south on Strand St", "Turn right onto Buitengracht St")
- "Start Navigation" button with pulsing animation
- Simulated navigation progress through route waypoints
- "Arrived at Depot" state with confirmation

### 6.5 Scan & Verify (Barcode Item Verification)
**File:** `/apps/mobile/src/screens/driver/DriverScanVerify.tsx`

- Camera-based barcode scanning for order item verification
- List of order items with barcodes (EAN-13 format)
- Scan each item to mark as verified
- Progress indicator: X of Y items scanned
- Simulator detection (`Constants.isDevice`) with mock scanning fallback
- After all items scanned: calls `markPickedUp` and `driverSignOff` via OrderContext
- Animated scan line and match confirmation animation

### 6.6 Navigation to Customer
**File:** `/apps/mobile/src/screens/driver/DriverNavigation.tsx`

- **MapView** with depot start, customer destination, and route polyline
- Multiple mock customer locations in Cape Town
- Turn-by-turn directions specific to customer address
- Real GPS location integration via `expo-location`
- Pulsing navigation animation
- Uses OrderContext: `markEnRoute`, `updateOrderStatus`
- "Arrived" state detection and confirmation

### 6.7 Delivery PIN Verification
**File:** `/apps/mobile/src/screens/driver/DriverDeliveryPinVerify.tsx`

- **4-digit PIN entry** with custom numeric keypad
- Auto-verify when all 4 digits entered
- Calls `verifyDeliveryPin(orderId, pin)` via OrderContext (server-side RPC verification)
- **3 attempts** before lockout
- Shake animation on wrong PIN
- Success scale animation on correct PIN
- On success: calls `markDelivered` and navigates to trip summary
- Backspace support, locked state handling

### 6.8 Photo Proof of Delivery
**File:** `/apps/mobile/src/screens/driver/DriverPhotoProof.tsx`

- Order and customer info display
- GPS location verification ("GPS verified -- 12 Rivonia Rd, Sandton")
- **Photo requirements checklist:**
  - Show package at door
  - Visible address number
  - Clear lighting
- Camera capture (mock in current implementation)
- Delivery notes text input
- "Submit Proof" button marks order as delivered

### 6.9 AI Assistant for Drivers
**File:** `/apps/mobile/src/screens/driver/DriverAIAssistant.tsx`

- Chat interface with user/AI message types plus "insight" cards
- **Quick prompts:** "Optimize my route", "Demand forecast", "Earnings projection", "Quick tips"
- **Live Insights dashboard:**
  - High Demand Zone alerts (e.g., "CBD & Waterfront areas -- surge pricing active +35%")
  - Route Optimization suggestions (e.g., "Switch to Buitengracht St -- save 8 min")
  - Earnings Goal tracking (e.g., "Complete 4 more deliveries to hit R2,000 target")
  - Safety Alerts (e.g., "Road construction on Kloof St")
- AI responses include detailed route optimization with distance/time/fuel savings

### 6.10 AI Item Verification
**File:** `/apps/mobile/src/screens/driver/DriverAIItemVerify.tsx`

- AI-powered item confirmation with confidence scores per item
- Item list with barcode, quantity, AI confidence percentage (95-100%)
- Tap to verify each item
- Progress bar (verified count / total)
- **AI Analysis summary:** Item match status, temperature check, package integrity
- All-verified state with completion action

### 6.11 Driver Chat
**File:** `/apps/mobile/src/screens/driver/DriverChat.tsx`

- **Chat channels:**
  - Customer channels (per active order, shows order number)
  - Office channels (LIQZAR Dispatch, LIQZAR Support)
- Channel list with: name, avatar, last message preview, unread count badge, online status indicator
- Full message thread view with send/receive bubbles
- Quick reply suggestions
- Real-time message display with timestamps

### 6.12 Heat Map / Demand Map
**File:** `/apps/mobile/src/screens/driver/DriverHeatMap.tsx`

- **Surge zones** with demand levels (high/medium/low):
  - Sandton CBD: 2.0x multiplier, 18 estimated deliveries
  - Rosebank: 1.5x multiplier, 12 estimated deliveries
  - Melrose Arch: 1.3x multiplier, 8 estimated deliveries
- **Time-of-day demand blocks** (8am-9pm) with peak/off-peak indicators
- Peak hours: 11am-1pm and 5pm-8pm
- Positioning suggestion (e.g., "Move to Sandton CBD for 40% more orders")
- Earnings estimate (e.g., "Est. R350-R500 in the next 2 hours")
- Color-coded legend

### 6.13 Trip Summary
**File:** `/apps/mobile/src/screens/driver/DriverTripSummary.tsx`

- **Trip stats:** Distance (8.2 km), Time (24 min), Rating (Pending)
- **Route info:** Depot address -> Customer address
- **Earnings breakdown:** Base fare (R45), Distance (R24.60), Surge (R0), Tips (R20) = Total R89.60
- Items delivered list with quantities
- Customer rating section (1-5 stars)
- "Report Issue" button
- "Back to Dashboard" action

### 6.14 Driver Ratings & Performance
**File:** `/apps/mobile/src/screens/driver/DriverRatings.tsx`

- Overall rating display (e.g., 4.83/5)
- **Rating breakdown:** 5-star (285), 4-star (42), 3-star (10), 2-star (3), 1-star (2)
- **Performance metrics:** On-Time Delivery (97%), Acceptance Rate (92%), Completion Rate (99%), Customer Satisfaction (4.8/5)
- Recent customer reviews with names, dates, ratings, and comments

### 6.15 Driver Settings
**File:** `/apps/mobile/src/screens/driver/DriverSettings.tsx`

- **Notification toggles:** New Order Alerts, Earnings Updates, Dispatch Messages, Promotional Offers
- Navigation voice toggle
- Theme toggle (dark/light)
- Vehicle info display (Type, Make, Model, Plate, Color -- mock: White Toyota Corolla)
- Settings sections for Business, Notifications, Preferences

### 6.16 Driver Support
**File:** `/apps/mobile/src/screens/driver/DriverSupport.tsx`

- **FAQ section** (expandable/collapsible):
  - How to accept orders (60-second acceptance window)
  - Customer unavailable procedure (5-min wait, call, then "Customer Unavailable" option)
  - Earnings calculation (base fee + distance + tips + surge)
  - Vehicle info updates (portal or dispatch contact, 24-48h processing)
- **Issue reporting:**
  - Issue types: Order Issue, App Bug, Payment Issue, Safety Concern, Other
  - Description text area
  - "Submit Report" with validation

### 6.17 Driver Menu
**File:** `/apps/mobile/src/screens/driver/DriverMenu.tsx`

- Organized menu sections:
  - **Deliveries:** Dashboard, All Deliveries, Depot Pickup, Scan & Verify
  - **AI & Tools:** AI Assistant (NEW badge), Navigation, Barcode Scanner, AI Item Verify (NEW badge), Photo Proof, Heat Map, Trip Summary
  - **Communication:** Chat, Support
  - **Account:** Ratings, Settings, Sign Out
- Each item with icon, label, subtitle, and color coding

---

## 7. ADMIN FEATURES

### 7.1 Admin Dashboard
**File:** `/apps/mobile/src/screens/admin/AdminDashboard.tsx`

- Order overview with status counts and relative timestamps
- Status configuration for all 13 order statuses
- Currency formatting with `formatCurrency`/`formatRand`
- Uses OrderContext for real-time order management
- Quick access to all admin functions

### 7.2 Order Management
**File:** `/apps/mobile/src/screens/admin/AdminOrderManagement.tsx`

- **Filter tabs:** All, Pending, Confirmed, Preparing, Ready, Driver Assigned, Picked Up, En Route, Delivered, Completed, Cancelled, Refunded
- Search by order number or customer name
- Order cards with status icons, customer info, phone, address, total, item count
- Imports `STATUS_DISPLAY` from `OrderWorkflowEngine`
- Uses OrderContext for real-time order data

### 7.3 Order Detail (Admin)
**File:** `/apps/mobile/src/screens/admin/AdminOrderDetail.tsx`

- Full order detail with all 11 status types and color-coded display
- Customer info with phone (callable via Linking)
- Order timeline using `OrderWorkflowEngine` status display
- Admin actions: advance order status, assign driver, cancel, refund
- Modal for driver assignment and status changes

### 7.4 Product Management
**File:** `/apps/mobile/src/screens/admin/AdminProductManagement.tsx`

- Product catalog with category filtering (All, Whisky, Wine, Vodka, Gin, Brandy, Beer, Champagne)
- Product data: name, category, bottle size, price, stock quantity, low stock threshold, in_stock status
- Stock quantity and threshold management
- Search and filter functionality

### 7.5 Stock Control
**File:** `/apps/mobile/src/screens/admin/AdminStockControl.tsx`

- **Low stock alerts** with product name, category, current quantity vs threshold
- **Stock adjustment history:** Previous qty, new qty, adjustment amount, reason, adjusted by, timestamp
- Out-of-stock items highlighted (quantity = 0)
- Alert-based reorder recommendations

### 7.6 Driver Management
**File:** `/apps/mobile/src/screens/admin/AdminDriverManagement.tsx`

- **Filter tabs:** All, Active, Verified, Unverified
- Driver profiles: name, phone, rating, total deliveries, verification status, active status, online status
- Vehicle details: type (car/motorcycle/scooter/van), make, model, license plate, color
- Driver activation/deactivation and verification controls
- Mock fleet: Toyota Corolla, Honda CBR, etc. with SA license plates

### 7.7 Reports & Analytics
**File:** `/apps/mobile/src/screens/admin/AdminReports.tsx`

- **Period filter:** Today, This Week, This Month, Custom
- **Revenue chart:** Daily revenue bar chart (Mon-Sun)
- **Top Products leaderboard:** Rank, product name, units sold, revenue
- **Driver Leaderboard:** Rank, driver name, deliveries, rating, earnings
- Gold/Silver/Bronze ranking colors
- Pull-to-refresh

### 7.8 Admin Settings
**File:** `/apps/mobile/src/screens/admin/AdminSettings.tsx`

- **Business settings:** Delivery Zones, Delivery Fees (R9.99 standard), Minimum Order Value (R150)
- **Notification settings** (toggles)
- **Preference settings** (navigation items with current values)
- **Account actions:** Sign out

### 7.9 Customer Management
**File:** `/apps/mobile/src/screens/admin/AdminCustomerManagement.tsx`

- **Filter tabs:** All, VIP, Active, Inactive, New
- Customer profiles: first/last name, phone, email, join date, total orders, total spent, VIP status, active status, rating, last order date, loyalty points, notes
- Customer detail modal with full profile
- SA phone numbers (+27 format) and .co.za email addresses
- VIP badge and customer notes (e.g., "Prefers premium whisky. Birthday in June.")

### 7.10 Promo Management
**File:** `/apps/mobile/src/screens/admin/AdminPromoManagement.tsx`

- Active promotions and expired promotions lists
- Promo data: code, description, discount type (percentage/fixed/free_delivery), value, min order, usage count/limit, expiry date, start date, target audience, active status
- **Expired promos** with total usage and revenue impact tracking
- Example promos: WELCOME20 (20% off new customers), VIPGOLD (R75 off for VIP), FREEDEL (free delivery over R200)
- Target audiences: New Users, VIP, All Users

### 7.11 Zone Management
**File:** `/apps/mobile/src/screens/admin/AdminZoneManagement.tsx`

- Delivery zone configuration: name, radius (km), delivery fee, active drivers, surge multiplier, surge enabled toggle, is_active, min order, estimated delivery time, driver priority, color
- **Zones:**
  - CBD: 5km radius, R0 delivery fee, 15-25 min, 12 drivers, High priority
  - Northern Suburbs: 10km radius, R25 fee, 25-40 min, 8 drivers, 1.2x surge
  - Southern Suburbs: 15km radius, R45 fee, 35-50 min, 5 drivers
- **Zone performance metrics:** Orders per zone
- Zone edit modal with all configurable parameters

---

## 8. WAREHOUSE FEATURES

### 8.1 Warehouse Dashboard
**File:** `/apps/mobile/src/screens/warehouse/WarehouseDashboard.tsx`

- **Task priority system:**
  - High: Orders > 30 min old or total > R1,000
  - Medium: Orders > 15 min old or total > R500
  - Normal: Everything else
- Task types: pick, pack, dispatch
- Derives task info from live order data
- Priority-based task queue ordering

### 8.2 Task List
**File:** `/apps/mobile/src/screens/warehouse/WarehouseTaskList.tsx`

- Tasks with: order number, task type (pick/pack/dispatch), status (pending/in_progress/completed), priority (high/medium/normal), item count, creation time, customer name
- Color-coded priority indicators
- Task type icons and status badges
- Navigate to task detail on tap

### 8.3 Task Detail
**File:** `/apps/mobile/src/screens/warehouse/WarehouseTaskDetail.tsx`

- Task-specific item list with: product name, quantity, barcode, scan status, **warehouse location** (e.g., "Aisle A, Shelf 3", "Aisle B, Shelf 1")
- Barcode scanning for item verification
- Order info: order number, customer name, delivery address
- Task progression: Start -> In Progress -> Complete
- Uses OrderContext: `startPreparing`, `markReady`
- Integrates with OrderWorkflowEngine for status transitions

### 8.4 Stock View
**File:** `/apps/mobile/src/screens/warehouse/WarehouseStockView.tsx`

- Category-filtered product inventory: whisky, wine, vodka, gin, brandy, beer, champagne
- Stock data: product name, category, bottle size, current stock quantity, max stock capacity, last updated timestamp
- Visual stock level bars (quantity/max_stock ratio)
- Search functionality
- Low stock highlighting

### 8.5 Receiving (Goods Receipt)
**File:** `/apps/mobile/src/screens/warehouse/WarehouseReceiving.tsx`

- Product suggestion/search for incoming goods
- Product data with barcodes for scanning
- Add received items with quantities
- Recent receipts history with date, item count, received by
- Barcode-based product lookup
- Categories: Whisky, Vodka, Gin, Champagne, Brandy, Beer, Wine

### 8.6 Quality Check
**File:** `/apps/mobile/src/screens/warehouse/WarehouseQualityCheck.tsx`

- **Quality criteria checklist:**
  - Packaging Integrity (sealed, no damage)
  - Temperature Compliance (safe transport range)
  - Label Verification (correct name, vintage, expiry)
  - Quantity Matches Manifest (physical count vs delivery note)
  - No Counterfeit Indicators (tax stamps, holograms, seals)
- Pass/fail toggle per criterion
- Batch info: ID, supplier, date/time, item count, PO number
- Recent inspection history with scores and statuses (Approved/Rejected/Partial)
- Supplier tracking

### 8.7 Returns Processing
**File:** `/apps/mobile/src/screens/warehouse/WarehouseReturns.tsx`

- Return types: Wrong item, Damaged, Changed mind
- Return statuses: Pending, Inspecting, Approved, Rejected
- Condition assessment: New, Good, Damaged, Destroyed
- Refund types: Full, Partial, Store Credit
- Return items: return ID, order number, customer name, reason, item name, quantity, price, refund amount
- Return inspection and approval workflow

### 8.8 AI Predictions (Demand Forecasting)
**File:** `/apps/mobile/src/screens/warehouse/WarehouseAIPredictions.tsx`

- **Per-product forecasts:**
  - Current stock vs predicted 7-day demand
  - Reorder suggestion quantity
  - AI confidence percentage (88-96%)
  - 7-day demand bar visualization
  - Auto-reorder toggle per product
- **Reorder suggestions** with urgency levels (High/Medium/Low), deadlines, suppliers, estimated costs
- **Seasonal event alerts:**
  - Event name and date
  - Impact level (High/Medium/Low)
  - Affected product categories
  - Demand increase percentage

### 8.9 Depot Release
**File:** `/apps/mobile/src/screens/warehouse/WarehouseDepotRelease.tsx`

- Order-specific release checklist: item name, quantity, checkbox per item
- Driver name and order number display
- All-items-checked validation before release
- Calls `depotRelease(orderId)` via OrderContext (Supabase RPC)
- Success confirmation with navigation back
- Error handling for failed releases

---

## 9. ORDER WORKFLOW ENGINE

**Source file:** `/apps/mobile/src/services/OrderWorkflowEngine.ts` (1069 lines)

### 9.1 Order Statuses (13 states)
`pending` -> `confirmed` -> `preparing` -> `ready` -> `driver_assigned` -> `picked_up` -> `en_route` -> `delivered` -> `completed`

Branch states: `cancelled`, `refunded`, `delivery_failed`, `rescheduled`

### 9.2 Valid Transitions
Each status has defined valid next-states (e.g., `pending` can only go to `confirmed` or `cancelled`).

### 9.3 Side Effects Per Transition
| Transition | Side Effects |
|---|---|
| confirmed | Decrement stock (RPC), create warehouse pick task, generate 4-digit delivery PIN, validate unit prices |
| preparing | Update warehouse task to in_progress |
| ready | Complete pick task, create dispatch task, auto-assign nearest driver |
| driver_assigned | Create delivery_assignments record |
| picked_up | Update delivery assignment, complete dispatch task |
| en_route | Create delivery_tracking entry with GPS coordinates |
| delivered | Complete delivery assignment, schedule auto-complete (24h) |
| cancelled | Restore stock, cancel warehouse tasks, cancel delivery, auto-trigger refund |
| refunded | Restore stock, update payment_status |

### 9.4 Concurrency Control
- **Optimistic concurrency:** Uses `.eq("status", fromStatus)` in Supabase updates to prevent TOCTOU (Time-of-Check-Time-of-Use) race conditions
- If concurrent update detected, returns error "Order was already updated by someone else"

### 9.5 Payment Processing
- Card payments: 2-second simulated processing delay
- Cash on Delivery: 0.5-second simulated delay

### 9.6 Delivery PIN
- 4-digit PIN generated server-side on order confirmation
- Verified server-side via Supabase RPC (`verify_delivery_pin`)
- No client-side fallback for security
- 3 attempts before lockout

### 9.7 Event System
- Per-order and wildcard listeners
- Event types for all status transitions
- Used by contexts and screens for real-time updates

---

## 10. CONTEXT PROVIDERS / STATE MANAGEMENT

### 10.1 AuthContext
**File:** `/apps/mobile/src/contexts/AuthContext.tsx`
- User authentication state, role management, sign-in/sign-up/sign-out
- Phone-to-role mapping for test accounts
- Supabase auth integration with session persistence

### 10.2 CartContext
**File:** `/apps/mobile/src/contexts/CartContext.tsx`
- CartItem: id, name, price, quantity, image_url, category, bottle_size
- Persisted to AsyncStorage (`@liqzar_cart`)
- Functions: addItem, removeItem, updateQuantity, clearCart
- Computed: total, itemCount (both memoized)

### 10.3 OrderContext
**File:** `/apps/mobile/src/contexts/OrderContext.tsx`
- Real-time Supabase subscription for order changes (postgres_changes)
- Role-based order filtering
- Customer: placeOrder, cancelOrder
- Driver: acceptDelivery, markPickedUp, markEnRoute, markDelivered
- Warehouse: startPreparing, markReady
- Admin: assignDriver
- Stock verification, delivery PIN management, depot operations
- Demo: simulateFlow for testing full order lifecycle
- Notification system with role-targeted alerts
- App foreground refresh

### 10.4 ThemeContext
**File:** `/apps/mobile/src/contexts/ThemeContext.tsx`
- Persisted to AsyncStorage (`liqzar-theme-mode`)
- Default: dark mode
- Provides: mode, colors, gradients, shadows, isDark, toggleTheme, setMode

---

## 11. API / BACKEND SERVICES

### 11.1 Products API (`productsApi`)
**File:** `/apps/mobile/src/services/api.ts`
- `getProducts(params)`: Category filter, search query, pagination
- `getProductById(id)`: Single product details
- `getFeaturedProducts()`: Featured collection
- `getTrendingProducts()`: Trending items
- `getHappyHourProducts()`: Products with discount >= 20%

### 11.2 Orders API (`ordersApi`)
- `getOrders(userId)`: User's order history
- `getOrderById(orderId)`: Single order details
- `createOrder(orderData)`: Place new order

### 11.3 Profile API (`profileApi`)
- `getProfile(userId)`: User profile data
- `updateProfile(userId, data)`: Update profile
- `getAddresses(userId)`: Saved delivery addresses
- `addAddress(userId, address)`: Add new address
- `deleteAddress(addressId)`: Remove address

### 11.4 Wishlist API (`wishlistApi`)
- `getWishlist(userId)`: Get wishlist with product joins
- `addToWishlist(userId, productId)`: Add product
- `removeFromWishlist(userId, productId)`: Remove product
- `isInWishlist(userId, productId)`: Check if product is wishlisted

### 11.5 AI Sommelier Service
**File:** `/apps/mobile/src/services/ai.ts`
- Keyword-based recommendation system
- Fetches actual products from Supabase matching category
- Returns text recommendations + product suggestions

### 11.6 Supabase Configuration
**File:** `/apps/mobile/src/lib/supabase.ts`
- URL: `https://emmipyyfcrwkjogepscg.supabase.co`
- Auth: SecureAuthStorage, autoRefreshToken, persistSession

---

## 12. DATA MODELS

**File:** `/apps/mobile/src/types/index.ts`

| Model | Key Fields |
|---|---|
| **Product** | id, name, category, price, image_url, description, bottle_size, alcohol_pct, country, rating, review_count, in_stock, is_featured, is_trending, is_best_seller, is_new_arrival, discount |
| **Order** | id, order_number, status (13 types), total, subtotal, delivery_fee, vat_amount, discount_amount, created_at, estimated_delivery, delivery_address, items |
| **Address** | label, street, city, province, postalCode, country, coordinates (lat/lng), deliveryZone |
| **UserProfile** | id, full_name, email, phone_number, avatar_url, date_of_birth |
| **WarehouseTask** | id, order_id, task_type (pick/pack/dispatch), status, priority, items (with barcode, is_scanned, location) |
| **DriverProfile** | id, full_name, phone, id_number, license_number, is_verified, is_active, rating, total_deliveries, total_earnings, vehicle |
| **DriverVehicle** | type (scooter/motorcycle/car/van/truck), make, model, license_plate, capacity_kg |
| **DeliveryAssignment** | status (assigned/accepted/picked_up/en_route/delivered/failed), distance_km |
| **StockAdjustment** | previous_qty, new_qty, adjustment, reason |
| **PromoCode** | code, discount_type (percentage/fixed/free_delivery), discount_value, min_order_value, max_uses, used_count, expires_at |
| **DeliveryRating** | driver_rating, delivery_rating, comment |

---

## 13. DESIGN SYSTEM / THEME

**File:** `/apps/mobile/src/theme/index.ts`

### 13.1 Color Palettes
- **Dark mode:** Black/gold luxury (#050403 background, #D4AF37 gold primary)
- **Light mode:** Cream/gold elegant (#FAFAF8 background, #B8962E gold primary)

### 13.2 Typography Scale
h1 (32px), h2 (24px), h3 (20px), h4 (18px), body (16px), bodySmall (14px), caption (12px), label (14px uppercase), button (16px bold)

### 13.3 Spacing
xs (4), sm (8), md (16), lg (24), xl (32), xxl (48)

### 13.4 Border Radius
sm (8), md (12), lg (16), xl (24), full (9999)

### 13.5 Gradients
gold, goldShimmer, background, card, header, darkOverlay

### 13.6 Shadows
gold, goldSubtle, dark, card

### 13.7 UI Components
- LinearGradient (expo-linear-gradient) for premium buttons and cards
- BlurView (expo-blur) for overlay effects
- Haptic feedback (expo-haptics): light, medium, heavy, selection, success, error, warning (iOS only)
- Animated components with scale, fade, slide, and pulsing effects

---

## 14. THIRD-PARTY INTEGRATIONS

| Package | Purpose |
|---|---|
| **@supabase/supabase-js** | Backend (database, auth, real-time, RPC, storage) |
| **expo-camera** | Barcode scanning (customer and driver) |
| **expo-location** | Driver GPS for navigation and tracking |
| **expo-haptics** | Haptic feedback (iOS) |
| **expo-blur** | BlurView for premium UI overlays |
| **expo-linear-gradient** | Gradient backgrounds and buttons |
| **expo-secure-store** | Secure token storage |
| **expo-constants** | Device/simulator detection |
| **react-native-maps** (MapView) | Order tracking, driver navigation, depot pickup |
| **react-native-safe-area-context** | Safe area insets for all screens |
| **@react-navigation/native** | Navigation framework |
| **@react-navigation/native-stack** | Stack navigator |
| **@react-navigation/bottom-tabs** | Tab navigator |
| **@react-native-async-storage** | Cart and theme persistence |

---

## 15. DELIVERY SYSTEM

### 15.1 Delivery Methods
- **Standard:** R9.99, 3-5 business days (free over R150)
- **Express:** R29.99 (or R35 scheduled), same-day
- **Priority:** R55, guaranteed 30 minutes
- **Free:** Orders over R150 (standard delivery)

### 15.2 Delivery Zones
- CBD: 5km radius, free delivery, 15-25 min
- Northern Suburbs: 10km radius, R25, 25-40 min
- Southern Suburbs: 15km radius, R45, 35-50 min

### 15.3 Delivery Flow
1. Order placed -> stock decremented -> warehouse pick task created -> delivery PIN generated
2. Warehouse picks and packs order
3. Order marked ready -> dispatch task created -> nearest driver auto-assigned
4. Driver navigates to depot -> scans/verifies all items -> signs off
5. Driver navigates to customer -> marks en_route -> GPS tracking active
6. Driver arrives -> customer provides 4-digit PIN -> driver verifies via server-side RPC
7. Delivery confirmed -> photo proof optional -> trip summary generated
8. Auto-complete after 24 hours if not already completed

### 15.4 Delivery PIN Security
- 4-digit PIN generated server-side on order confirmation
- Only verifiable via Supabase RPC (no client-side validation)
- 3 verification attempts before lockout
- Displayed to customer on tracking screen
- Required for delivery completion

---

## 16. SEARCH & FILTERING

- **Product search:** Debounced full-text search (Supabase `ilike` query), minimum 2 characters
- **Category filtering:** 11 categories with icons (Whisky, Vodka, Gin, Wine, Beer, Champagne, Cognac, Rum, Tequila, Liqueurs + All)
- **Barcode search:** Camera-based barcode scanning -> product lookup
- **Order filtering:** Status-based tabs (All, Active, Completed, Cancelled for customers; all 12 statuses for admin)
- **Driver filtering:** All, Active, Verified, Unverified
- **Customer filtering:** All, VIP, Active, Inactive, New
- **Warehouse stock:** Category-based filtering with search
- **Voice search:** Microphone button placeholder (not yet implemented)

---

## 17. NOTIFICATION SYSTEM

### 17.1 In-App Notifications
- Three types: order_update, promotion, system
- Stored in Supabase `notifications` table
- Mark-as-read with Supabase update
- Deep linking to OrderDetail for order updates
- Unread count badge in header
- Time-relative display

### 17.2 Order Workflow Notifications
- Generated as side effects of status transitions via OrderWorkflowEngine
- Role-targeted: customers get delivery updates, drivers get assignment alerts, warehouse gets task alerts, admin gets all
- Templates defined per status transition

---

## 18. COMPLETE SCREEN INVENTORY

### Authentication (2 screens)
1. `LoginScreen.tsx` -- Phone OTP login, quick role login
2. `SignUpScreen.tsx` -- Email registration

### Customer (24 screens)
3. `HomeScreen.tsx` -- Main dashboard with carousel, categories, products, services
4. `CatalogScreen.tsx` -- Product browsing with filters
5. `ProductDetailScreen.tsx` -- Individual product view
6. `CartScreen.tsx` -- Shopping cart
7. `CheckoutScreen.tsx` -- 3-step checkout
8. `ProfileScreen.tsx` -- User account hub
9. `SearchScreen.tsx` -- Product search
10. `OrderHistoryScreen.tsx` -- Past orders
11. `OrderDetailScreen.tsx` -- Order timeline
12. `OrderTrackingScreen.tsx` -- Live map tracking
13. `WishlistScreen.tsx` -- Saved favorites
14. `SavedAddressesScreen.tsx` -- Address management
15. `NotificationsScreen.tsx` -- Notification center
16. `SommelierChatScreen.tsx` -- AI recommendations
17. `BarcodeScannerScreen.tsx` -- Camera barcode scan
18. `CustomerRatingScreen.tsx` -- Driver/delivery rating + tipping
19. `EditProfileScreen.tsx` -- Profile editing
20. `PromoCodeScreen.tsx` -- Promo code management
21. `ReorderScreen.tsx` -- Quick reorder from history
22. `ScheduleDeliveryScreen.tsx` -- Scheduled delivery booking
23. `LoyaltyScreen.tsx` -- Rewards program
24. `ReferralScreen.tsx` -- Referral program
25. `CustomerDeliveryPin.tsx` -- (File not found -- may be handled inline in OrderTracking)

### Driver (17 screens)
26. `DriverDashboard.tsx` -- Main driver screen
27. `DriverDeliveryDetail.tsx` -- Per-delivery management
28. `DriverEarnings.tsx` -- Earnings tracking
29. `DriverDepotPickup.tsx` -- Navigation to depot with map
30. `DriverScanVerify.tsx` -- Barcode item verification
31. `DriverNavigation.tsx` -- Navigation to customer with map
32. `DriverMenu.tsx` -- Full driver menu
33. `DriverAIAssistant.tsx` -- AI routing/demand/earnings insights
34. `DriverChat.tsx` -- Messaging (customer + dispatch)
35. `DriverSettings.tsx` -- Preferences and notifications
36. `DriverRatings.tsx` -- Performance metrics and reviews
37. `DriverSupport.tsx` -- FAQ and issue reporting
38. `DriverAIItemVerify.tsx` -- AI confidence-based item verification
39. `DriverPhotoProof.tsx` -- Proof of delivery photos
40. `DriverHeatMap.tsx` -- Demand surge zones and timing
41. `DriverTripSummary.tsx` -- Post-delivery summary
42. `DriverDeliveryPinVerify.tsx` -- 4-digit PIN verification

### Admin (11 screens)
43. `AdminDashboard.tsx` -- Business overview
44. `AdminOrderManagement.tsx` -- All orders with status filtering
45. `AdminOrderDetail.tsx` -- Order detail with admin actions
46. `AdminProductManagement.tsx` -- Product catalog management
47. `AdminStockControl.tsx` -- Stock alerts and adjustments
48. `AdminDriverManagement.tsx` -- Driver fleet management
49. `AdminReports.tsx` -- Revenue, product, and driver analytics
50. `AdminSettings.tsx` -- Business configuration
51. `AdminCustomerManagement.tsx` -- Customer profiles and VIP management
52. `AdminPromoManagement.tsx` -- Promotion creation and tracking
53. `AdminZoneManagement.tsx` -- Delivery zone configuration

### Warehouse (9 screens)
54. `WarehouseDashboard.tsx` -- Priority task queue
55. `WarehouseTaskList.tsx` -- Pick/pack/dispatch task list
56. `WarehouseTaskDetail.tsx` -- Task execution with barcode scanning
57. `WarehouseStockView.tsx` -- Inventory levels by category
58. `WarehouseReceiving.tsx` -- Goods receipt processing
59. `WarehouseQualityCheck.tsx` -- Quality inspection checklist
60. `WarehouseReturns.tsx` -- Returns processing workflow
61. `WarehouseAIPredictions.tsx` -- AI demand forecasting and reorder suggestions
62. `WarehouseDepotRelease.tsx` -- Driver goods release with verification

### Components
63. `AgeGate.tsx` -- 18+ verification gate
64. `Icon.tsx` -- Ionicons wrapper component

**Total: 64 screens + components (across 4 roles)**

---

## 19. KEY BUSINESS RULES

1. **Age restriction:** All users must confirm they are 18+ (SA legal requirement for alcohol sales). Age gate at app entry and additional verification at checkout.
2. **VAT:** 15% VAT applied on all orders (South African standard rate).
3. **Free delivery threshold:** Orders over R150 qualify for free standard delivery.
4. **Delivery fees:** Standard R9.99, Express R29.99-R35, Priority R55.
5. **Minimum order:** R100-R200 depending on delivery zone.
6. **Stock management:** Atomic stock decrement on order confirmation, automatic restore on cancellation/refund.
7. **Delivery PIN:** 4-digit PIN generated on confirmation, required for delivery completion, server-side only verification, 3 attempts max.
8. **Order auto-complete:** Orders auto-complete 24 hours after delivery if not already completed.
9. **Driver acceptance window:** 60 seconds to accept an order before reassignment.
10. **Surge pricing:** Zone-based multipliers during peak hours (11am-1pm, 5pm-8pm).
11. **Loyalty points:** R1 = 1 point, Review = 50 points, Referral = 500 points.
12. **Referral reward:** R50 credit for both referrer and referee on first order.
13. **Tier system:** Gold at current, Platinum at 5,000 points.
