# Architecture Diagram

## 🏗️ Monorepo Structure

```
liqzar-concierge-delivery/
│
├── 📦 Root Package Management
│   ├── package.json          (Yarn workspace root)
│   ├── turbo.json            (Build orchestration)
│   └── tsconfig.base.json    (Shared TypeScript config)
│
├── 🌐 apps/web/              (React Web Application)
│   ├── src/
│   │   ├── pages/            (Route components)
│   │   ├── components/       (UI components)
│   │   ├── hooks/            (React hooks)
│   │   ├── context/          (React context)
│   │   └── integrations/     (Supabase client)
│   ├── public/               (Static assets)
│   ├── index.html            (Entry HTML)
│   ├── vite.config.ts        (Vite configuration)
│   └── package.json          (@liqzar/web)
│
├── 📱 apps/mobile/           (React Native Mobile App)
│   ├── src/
│   │   ├── navigation/       (React Navigation)
│   │   │   └── AppNavigator.tsx
│   │   ├── screens/
│   │   │   ├── auth/         (Login, Register)
│   │   │   ├── home/         (Home screen)
│   │   │   ├── products/     (Product browsing)
│   │   │   ├── orders/       (Order management)
│   │   │   └── profile/      (User profile)
│   │   └── services/
│   │       ├── api.ts        (API initialization)
│   │       └── storage.ts    (Secure token storage)
│   ├── App.tsx               (Main entry point)
│   ├── app.json              (Expo configuration)
│   └── package.json          (@liqzar/mobile)
│
├── 📚 packages/              (Shared Business Logic)
│   │
│   ├── api-client/           (@liqzar/api-client)
│   │   └── src/
│   │       ├── client.ts     (Base API client)
│   │       ├── auth.ts       (Auth endpoints)
│   │       ├── products.ts   (Product endpoints)
│   │       ├── orders.ts     (Order endpoints)
│   │       └── drivers.ts    (Driver endpoints)
│   │
│   ├── types/                (@liqzar/types)
│   │   └── src/
│   │       └── index.ts      (TypeScript definitions)
│   │
│   ├── auth/                 (@liqzar/auth)
│   │   └── src/
│   │       ├── storage.ts    (Platform-agnostic storage)
│   │       └── manager.ts    (Auth manager)
│   │
│   └── utils/                (@liqzar/utils)
│       └── src/
│           ├── format.ts     (Formatting utilities)
│           └── validation.ts (Validation utilities)
│
├── 🗄️ supabase/              (Backend & Database)
│   ├── migrations/           (Database schemas)
│   └── functions/            (Edge functions)
│
└── 📖 Documentation
    ├── MONOREPO_MIGRATION_PLAN.md
    ├── SETUP_GUIDE.md
    ├── QUICK_REFERENCE.md
    ├── IMPLEMENTATION_SUMMARY.md
    └── ARCHITECTURE.md (this file)
```

## 🔄 Data Flow

### Authentication Flow

```
User Login
    ↓
┌─────────────────────────────────────────────┐
│  Web App OR Mobile App                      │
│  (Login screen)                             │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  @liqzar/auth                            │
│  AuthManager.login(email, password)         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  @liqzar/api-client                      │
│  authApi.login({ email, password })         │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Supabase Backend                           │
│  POST /auth/v1/token                        │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Response: { access_token, refresh_token }  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  @liqzar/auth (AuthStorage)              │
│  Web: localStorage                          │
│  Mobile: Expo SecureStore                   │
└──────────────────┬──────────────────────────┘
                   ↓
           Navigate to Home
```

### API Request Flow

```
Component needs data
    ↓
┌─────────────────────────────────────────────┐
│  Screen Component                           │
│  (ProductsScreen, OrdersScreen, etc.)       │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  @liqzar/api-client                      │
│  productsApi.getProducts()                  │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  ApiClient (Interceptors)                   │
│  - Add Authorization header                 │
│  - Handle token refresh                     │
│  - Error handling                           │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Supabase REST API                          │
│  GET /rest/v1/products                      │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  Response: Product[]                        │
│  (Typed with @liqzar/types)              │
└──────────────────┬──────────────────────────┘
                   ↓
      Display in UI with @liqzar/utils
      (formatPrice, formatDate, etc.)
```

## 📊 Package Dependencies

```
┌─────────────────┐
│   apps/web      │───┐
└─────────────────┘   │
                      │
┌─────────────────┐   │
│  apps/mobile    │───┤
└─────────────────┘   │
                      ↓
        ┌─────────────────────────┐
        │  Shared Packages        │
        ├─────────────────────────┤
        │  @liqzar/api-client  │←───┐
        │  @liqzar/auth        │    │
        │  @liqzar/types       │    │
        │  @liqzar/utils       │    │
        └─────────────────────────┘    │
                      ↓                │
        ┌─────────────────────────┐    │
        │  External Dependencies  │    │
        ├─────────────────────────┤    │
        │  axios                  │────┘
        │  react                  │
        │  typescript             │
        └─────────────────────────┘
                      ↓
        ┌─────────────────────────┐
        │  Backend Services       │
        ├─────────────────────────┤
        │  Supabase               │
        │  PostgreSQL             │
        │  Edge Functions         │
        └─────────────────────────┘
```

## 🔐 Platform-Specific Implementations

### Storage Abstraction

```
┌────────────────────────────────────────────────┐
│  @liqzar/auth                               │
│  AuthStorage Interface                         │
│  ├── getItem(key: string)                      │
│  ├── setItem(key: string, value: string)       │
│  ├── removeItem(key: string)                   │
│  └── clear()                                    │
└───────────────────┬────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────────┐    ┌──────────────────┐
│  Web Platform    │    │ Mobile Platform  │
├──────────────────┤    ├──────────────────┤
│ WebAuthStorage   │    │MobileAuthStorage │
│                  │    │                  │
│ localStorage     │    │ Expo SecureStore │
│ - Simple         │    │ - Encrypted      │
│ - Synchronous    │    │ - Async          │
│ - Browser API    │    │ - Native keychain│
└──────────────────┘    └──────────────────┘
```

## 🎯 Separation of Concerns

### Before (Capacitor)

```
┌────────────────────────────────────────┐
│         Web Application                │
│  React + TypeScript + Tailwind         │
│  ├── UI Components                     │
│  ├── Business Logic                    │
│  └── API Calls                         │
└──────────────────┬─────────────────────┘
                   ↓
          ┌────────────────┐
          │   Capacitor    │
          │  (Web Wrapper) │
          └────────┬───────┘
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
   ┌────────┐          ┌──────────┐
   │  iOS   │          │ Android  │
   └────────┘          └──────────┘

❌ Problems:
- Mobile changes affect web
- Limited native access
- iOS compatibility issues
- Shared UI causing conflicts
```

### After (Monorepo)

```
┌─────────────────────────────────────────────────┐
│             Shared Packages                     │
│  📦 Business Logic Only                         │
│  ├── @liqzar/api-client  (API calls)        │
│  ├── @liqzar/types       (TypeScript types) │
│  ├── @liqzar/auth        (Authentication)   │
│  └── @liqzar/utils       (Utilities)        │
└───────────────────┬─────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        ↓                        ↓
┌──────────────────┐    ┌───────────────────┐
│   Web App        │    │   Mobile App      │
│   (Independent)  │    │   (Independent)   │
├──────────────────┤    ├───────────────────┤
│ React            │    │ React Native      │
│ Vite             │    │ Expo              │
│ Tailwind         │    │ Native Styles     │
│ React Router     │    │ React Navigation  │
│ localStorage     │    │ SecureStore       │
└──────────────────┘    └────────┬──────────┘
                                 ↓
                        ┌────────┴────────┐
                        ↓                 ↓
                   ┌────────┐      ┌──────────┐
                   │  iOS   │      │ Android  │
                   └────────┘      └──────────┘

✅ Benefits:
- Independent UIs
- Shared business logic
- Native mobile experience
- No conflicts between platforms
```

## 🚀 Build Pipeline (Turborepo)

```
yarn build
    ↓
Turborepo analyzes dependencies
    ↓
┌─────────────────────────────────────┐
│  Build Shared Packages First        │
├─────────────────────────────────────┤
│  1. @liqzar/types                │
│  2. @liqzar/utils                │
│  3. @liqzar/auth                 │
│  4. @liqzar/api-client           │
└─────────────────┬───────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  Build Apps in Parallel             │
├─────────────────────────────────────┤
│  apps/web    │ apps/mobile          │
│  └─ vite build  └─ expo build       │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│  Output                             │
├─────────────────────────────────────┤
│  apps/web/dist/                     │
│  apps/mobile/build/                 │
└─────────────────────────────────────┘

⚡ Turborepo features:
- Caches builds
- Only rebuilds changed packages
- Runs tasks in parallel
- Respects dependency graph
```

## 🔄 Development Workflow

### Starting Development

```bash
# Terminal 1: Start everything
yarn dev

# Turborepo starts:
┌──────────────────────────────────────┐
│  apps/web: vite dev server           │
│  http://localhost:5173               │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│  apps/mobile: expo start             │
│  Metro bundler + QR code             │
└──────────────────────────────────────┘

# Watches all packages for changes
# Hot reloads automatically
```

### Making Changes to Shared Package

```
1. Edit packages/api-client/src/products.ts
        ↓
2. TypeScript recompiles automatically
        ↓
3. Web & Mobile apps detect change
        ↓
4. Both apps hot reload
        ↓
5. Changes visible immediately
```

## 🛡️ Type Safety Flow

```
1. Define types in @liqzar/types
        ↓
   interface Product {
     id: string;
     name: string;
     price: number;
   }
        ↓
2. Use in API client (@liqzar/api-client)
        ↓
   async getProducts(): Promise<Product[]>
        ↓
3. Call from app (web or mobile)
        ↓
   const products = await productsApi.getProducts();
   // TypeScript knows products is Product[]
        ↓
4. Display with utils (@liqzar/utils)
        ↓
   formatPrice(products[0].price)
   // TypeScript validates price is number
```

## 📱 Mobile App Navigation Flow

```
App Start
    ↓
┌─────────────────────────────────────┐
│  App.tsx                            │
│  - Initialize API client            │
│  - Setup auth manager               │
│  - Show splash screen               │
└──────────────────┬──────────────────┘
                   ↓
┌─────────────────────────────────────┐
│  AppNavigator.tsx                   │
│  - Check auth state                 │
│  - Subscribe to auth changes        │
└──────────────────┬──────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
  Not Logged In          Logged In
        ↓                     ↓
┌──────────────────┐  ┌──────────────────┐
│   Auth Stack     │  │   Main Tabs      │
├──────────────────┤  ├──────────────────┤
│ - Login          │  │ 🏠 Home          │
│ - Register       │  │ 🛍️ Products      │
└──────────────────┘  │ 📦 Orders        │
                      │ 👤 Profile       │
                      └──────────────────┘
                            │
                User logs out
                            ↓
                  Clear tokens & back to Auth Stack
```

## 🌐 Backend Communication

```
Both Apps
    ↓
┌─────────────────────────────────────────┐
│  @liqzar/api-client                  │
│  Centralized API communication          │
└──────────────────┬──────────────────────┘
                   ↓
         Axios Interceptors
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
  Request           Response
        ↓                     ↓
  Add auth token    Handle errors
  Set headers       Refresh token
  Log requests      Parse data
        ↓                     ↓
        └──────────┬──────────┘
                   ↓
┌─────────────────────────────────────────┐
│  Supabase Backend                       │
│  REST API + PostgreSQL                  │
├─────────────────────────────────────────┤
│  Tables:                                │
│  - users                                │
│  - profiles                             │
│  - products                             │
│  - orders                               │
│  - order_items                          │
│  - driver_profiles                      │
└─────────────────────────────────────────┘
```

## 📖 Summary

This monorepo architecture provides:

✅ **Clean Separation**: Web and mobile apps are completely independent
✅ **Code Reuse**: Business logic shared via packages
✅ **Type Safety**: TypeScript throughout
✅ **Scalability**: Easy to add new apps and features
✅ **Developer Experience**: Fast builds, hot reload, great tooling
✅ **Production Ready**: Battle-tested architecture used by major companies

Companies using similar architecture:

- Vercel (Turborepo creators)
- Microsoft
- Netflix
- Uber
- Airbnb
