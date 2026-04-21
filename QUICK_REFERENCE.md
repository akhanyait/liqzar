# Quick Reference Guide

Quick commands and snippets for working with the LIQZAR monorepo.

## 📦 Installation & Setup

```bash
# Clone and setup
git clone <repo>
cd liqzar-concierge-delivery
yarn install

# Setup mobile environment
cd apps/mobile
cp .env.example .env
# Edit .env with your API keys
```

## 🚀 Development

### Start All Apps

```bash
# From root
yarn dev        # Starts both web and mobile
yarn web        # Web only
yarn mobile     # Mobile only
```

### Individual Apps

**Web App:**

```bash
cd apps/web
yarn dev        # http://localhost:5173
yarn build      # Production build
yarn preview    # Preview build locally
```

**Mobile App:**

```bash
cd apps/mobile
yarn start      # Starts Expo dev server
yarn ios        # iOS simulator
yarn android    # Android emulator
yarn web        # Run in browser
```

## 🔧 Package Management

### Add Dependencies

```bash
# To root (dev tools)
yarn add -W -D typescript

# To web app
cd apps/web && yarn add package-name

# To mobile app
cd apps/mobile && yarn add package-name

# To shared package
cd packages/api-client && yarn add axios
```

### Update Dependencies

```bash
# Update all workspaces
yarn upgrade-interactive --latest

# Update specific package
yarn upgrade package-name
```

## 🏗 Building

```bash
# Build everything
yarn build

# Build specific app
yarn build --filter=@liqzar/web
yarn build --filter=@liqzar/mobile
```

## 🧪 Testing & Quality

```bash
# Run all tests
yarn test

# Lint all code
yarn lint

# Type check
yarn type-check

# Clean all builds
yarn clean
```

## 📱 Mobile Development

### Run on Device

**iOS:**

```bash
cd apps/mobile
yarn ios
# Or: Open in Xcode
open ios/liqzar.xcworkspace
```

**Android:**

```bash
cd apps/mobile
yarn android
# Or: Open in Android Studio
studio android/
```

### Build Production

```bash
cd apps/mobile

# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android

# Build both
eas build --platform all
```

### Debug

```bash
# Clear Metro cache
yarn start --reset-cache

# Reset node_modules
rm -rf node_modules && yarn install

# Open React Native Debugger
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

## 🔐 API & Authentication

### Using API Client

```typescript
import {
  authApi,
  productsApi,
  ordersApi,
  driversApi,
} from "@liqzar/api-client";

// Login
const user = await authApi.login({
  email: "user@example.com",
  password: "password",
});

// Get products
const products = await productsApi.getProducts();

// Create order
const order = await ordersApi.createOrder({
  items: [{ product_id: "123", quantity: 2 }],
});
```

### Using Auth Manager

```typescript
import { getAuthManager } from "@liqzar/auth";

const authManager = getAuthManager();

// Login
await authManager.login("email@example.com", "password");

// Check auth state
const isLoggedIn = authManager.isAuthenticated();
const user = authManager.getUser();

// Subscribe to auth changes
const unsubscribe = authManager.subscribe((state) => {
  console.log("Auth state:", state);
});

// Logout
await authManager.logout();
```

## 🎨 Using Shared Types

```typescript
import type {
  User,
  Product,
  Order,
  OrderWithItems,
  Driver,
  DeliveryTracking,
} from "@liqzar/types";

// Type-safe functions
function processOrder(order: Order): void {
  // TypeScript knows all Order properties
}

// API responses
const products: Product[] = await productsApi.getProducts();
```

## 🛠 Utils

```typescript
import {
  formatPrice,
  formatDate,
  isValidEmail,
  validatePassword,
} from "@liqzar/utils";

// Format currency
formatPrice(9999); // "R 99.99"

// Format dates
formatDate(new Date()); // "8 Jan 2026"
formatRelativeTime(date); // "2 hours ago"

// Validation
isValidEmail("test@example.com"); // true
const errors = validatePassword("weak"); // ['Too short', ...]
```

## 🗄️ Database Queries

**Using Supabase directly (web app):**

```typescript
import { supabase } from "./integrations/supabase/client";

// Simple query
const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("category", "wine");

// With relationships (use separate queries if needed)
const { data: orders } = await supabase.from("orders").select("*");

// Then fetch related data
const userIds = orders.map((o) => o.user_id);
const { data: profiles } = await supabase
  .from("profiles")
  .select("*")
  .in("user_id", userIds);
```

**Using API Client (recommended):**

```typescript
// Let the API client handle the complexity
const products = await productsApi.getProductsByCategory("wine");
const orders = await ordersApi.getOrders({ status: "pending" });
```

## 📁 File Structure

```
liqzar-concierge-delivery/
├── apps/
│   ├── web/                 # React web app
│   └── mobile/             # React Native mobile app
├── packages/
│   ├── api-client/         # Backend API calls
│   ├── types/              # TypeScript types
│   ├── auth/               # Authentication
│   └── utils/              # Utilities
├── supabase/               # Database migrations & functions
├── package.json            # Workspace root
├── turbo.json             # Build pipeline
└── tsconfig.base.json     # Shared TS config
```

## 🔍 Troubleshooting

### "Cannot find module '@liqzar/...'"

```bash
# From root
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
yarn install
```

### "Module not found" in mobile app

```bash
cd apps/mobile
yarn start --reset-cache
```

### TypeScript errors

```bash
# Check all packages
yarn type-check

# Check specific package
cd apps/web && yarn type-check
```

### Build fails

```bash
# Clean and rebuild
yarn clean
yarn install
yarn build
```

## 🌐 Environment Variables

**Web App (apps/web/.env):**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
```

**Mobile App (apps/mobile/.env):**

```env
API_BASE_URL=https://your-api.supabase.co
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key
```

## 📚 Documentation

- [MONOREPO_MIGRATION_PLAN.md](./MONOREPO_MIGRATION_PLAN.md) - Full migration plan
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Detailed setup instructions
- [apps/mobile/README.md](./apps/mobile/README.md) - Mobile app docs

## 🆘 Common Issues

| Issue               | Solution                     |
| ------------------- | ---------------------------- |
| Workspace not found | `yarn install` from root     |
| Metro bundler error | `yarn start --reset-cache`   |
| TypeScript errors   | Check `tsconfig.json` paths  |
| API 401 errors      | Check auth tokens in storage |
| Build fails         | `yarn clean && yarn install` |

## 💡 Tips

- Always run `yarn install` from root after pulling changes
- Use `yarn workspace @liqzar/web add package` to add dependencies
- Keep shared packages focused and minimal
- Test on both iOS and Android before deploying mobile
- Use TypeScript strict mode for better type safety
- Commit `yarn.lock` for consistent dependencies

## 🎯 Workflow Examples

### Adding a New API Endpoint

1. Add type to `packages/types/src/index.ts`
2. Add endpoint to `packages/api-client/src/<module>.ts`
3. Use in web: `import { api } from '@liqzar/api-client'`
4. Use in mobile: `import { api } from '@liqzar/api-client'`

### Creating a New Screen (Mobile)

1. Create `apps/mobile/src/screens/<category>/NewScreen.tsx`
2. Add to navigator in `apps/mobile/src/navigation/AppNavigator.tsx`
3. Use shared types and API client
4. Test on both platforms

### Updating Shared Logic

1. Edit `packages/<package>/src/<file>.ts`
2. Changes automatically picked up by apps (via workspace links)
3. No need to rebuild for development
4. Run `yarn build` for production builds
