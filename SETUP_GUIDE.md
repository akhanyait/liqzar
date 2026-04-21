# Monorepo Setup and Migration Guide

This guide will help you migrate from Capacitor to a clean monorepo architecture with separate web and React Native mobile apps.

## 🎯 Overview

The new architecture consists of:

- **Monorepo root**: Manages all packages and apps
- **apps/web**: Your existing web application (unchanged)
- **apps/mobile**: New React Native/Expo mobile app
- **packages/**: Shared code (api-client, types, auth, utils)

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Git (for version control)
- For mobile development:
  - iOS: macOS with Xcode
  - Android: Android Studio
  - Expo CLI

## 🚀 Step-by-Step Migration

### Phase 1: Backup Your Current Project

```bash
# Create a backup
cp -r liqzar-concierge-delivery liqzar-concierge-delivery-backup

# Or commit all changes
git add -A
git commit -m "Backup before monorepo migration"
```

### Phase 2: Install Monorepo Tools

```bash
# Install Yarn if not already installed
npm install -g yarn

# Install Turborepo globally (optional)
npm install -g turbo
```

### Phase 3: Restructure the Project

**IMPORTANT: Follow these steps carefully to avoid breaking your web app**

1. **Create the new structure:**

```bash
# Create apps directory
mkdir -p apps

# Create packages directories
mkdir -p packages/api-client/src
mkdir -p packages/types/src
mkdir -p packages/auth/src
mkdir -p packages/utils/src
```

2. **Move web app to apps/web:**

```bash
# Move everything except the new directories to apps/web
mkdir apps/web
mv src apps/web/
mv public apps/web/
mv index.html apps/web/
mv vite.config.ts apps/web/
mv tsconfig.*.json apps/web/
mv tailwind.config.ts apps/web/
mv postcss.config.js apps/web/
mv components.json apps/web/
mv eslint.config.js apps/web/

# Copy package.json to apps/web and modify it
cp package.json apps/web/package.json
```

3. **Update web app package.json:**

Edit `apps/web/package.json` and add:

```json
{
  "name": "@liqzar/web",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "@liqzar/api-client": "*",
    "@liqzar/types": "*",
    "@liqzar/auth": "*",
    "@liqzar/utils": "*"
    // ... keep existing dependencies except Capacitor ones
  }
}
```

4. **Update web app tsconfig.json:**

Add to `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@liqzar/api-client": ["../../packages/api-client/src"],
      "@liqzar/types": ["../../packages/types/src"],
      "@liqzar/auth": ["../../packages/auth/src"],
      "@liqzar/utils": ["../../packages/utils/src"]
    }
  }
}
```

### Phase 4: Set Up Shared Packages

All package files have been created in the `packages/` directory. Now install dependencies:

```bash
# From project root
yarn install

# This will install dependencies for all packages
```

### Phase 5: Remove Capacitor

1. **Remove Capacitor dependencies from web app:**

Edit `apps/web/package.json` and remove:

- @capacitor/\*
- @capgo/\*

```bash
cd apps/web
npm uninstall @capacitor/android @capacitor/cli @capacitor/core @capacitor/geolocation @capacitor/haptics @capacitor/ios @capacitor/local-notifications @capacitor/splash-screen @capgo/capacitor-native-biometric
```

2. **Remove Capacitor files:**

```bash
# From project root
rm -rf ios/
rm capacitor.config.ts
```

3. **Update web build scripts:**

Edit `apps/web/vite.config.ts` and remove any Capacitor-specific configuration.

### Phase 6: Set Up Mobile App

1. **Copy mobile app files:**

The mobile app structure has been created in `apps/mobile/`. Now initialize it:

```bash
cd apps/mobile

# Install dependencies
npm install

# Install Expo CLI globally if not already installed
npm install -g expo-cli
```

2. **Configure environment:**

```bash
cd apps/mobile
cp .env.example .env

# Edit .env and add your API URL
```

3. **Test mobile app:**

```bash
# Start Expo dev server
npm start

# Or specifically for iOS/Android
npm run ios
npm run android
```

### Phase 7: Extract API Logic from Web

You'll need to refactor your web app to use the shared `@liqzar/api-client` package instead of direct Supabase calls.

**Example migration:**

Before (direct Supabase):

```typescript
const { data } = await supabase.from("products").select("*");
```

After (shared API client):

```typescript
import { productsApi } from "@liqzar/api-client";
const products = await productsApi.getProducts();
```

### Phase 8: Test Everything

1. **Test web app:**

```bash
cd apps/web
npm run dev

# Visit http://localhost:5173
```

2. **Test mobile app:**

```bash
cd apps/mobile
npm start

# Use Expo Go app or simulator
```

3. **Test shared packages:**

```bash
# From root
yarn lint
yarn build
```

## 🔧 Development Workflow

### Running Multiple Apps

From the monorepo root:

```bash
# Run all apps in development
yarn dev

# Run specific app
yarn web     # Web only
yarn mobile  # Mobile only
```

### Making Changes to Shared Packages

1. Edit package code in `packages/*/src/`
2. Changes are automatically picked up by apps (using workspace links)
3. No need to rebuild unless you're creating a production build

### Adding New Dependencies

**To web app:**

```bash
cd apps/web
yarn add package-name
```

**To mobile app:**

```bash
cd apps/mobile
yarn add package-name
```

**To shared package:**

```bash
cd packages/api-client  # or any package
yarn add package-name
```

## 📱 Mobile Development

### iOS Development

```bash
cd apps/mobile
npm run ios
```

Requirements:

- macOS
- Xcode 14+
- iOS Simulator or physical device

### Android Development

```bash
cd apps/mobile
npm run android
```

Requirements:

- Android Studio
- Android SDK
- Android Emulator or physical device

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build iOS
cd apps/mobile
eas build --platform ios

# Build Android
eas build --platform android
```

## 🐛 Troubleshooting

### Issue: "Cannot find module '@liqzar/api-client'"

**Solution:**

```bash
# From project root
yarn install
```

### Issue: Web app can't find shared packages

**Solution:** Check `apps/web/tsconfig.json` has correct path mappings and run:

```bash
cd apps/web
yarn install
```

### Issue: Mobile app Metro bundler errors

**Solution:**

```bash
cd apps/mobile
rm -rf node_modules
yarn install
yarn start --reset-cache
```

### Issue: TypeScript errors in packages

**Solution:**

```bash
# From project root
yarn lint
```

## 📚 Additional Resources

- [Turborepo Docs](https://turbo.build/repo/docs)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Yarn Workspaces](https://classic.yarnpkg.com/en/docs/workspaces/)

## 🆘 Need Help?

If you encounter issues:

1. Check that all `package.json` files are correct
2. Ensure you're in the right directory when running commands
3. Try deleting `node_modules` and reinstalling
4. Check that your API backend is running and accessible

## ✅ Verification Checklist

After completing migration:

- [ ] Web app runs at `http://localhost:5173`
- [ ] Web app can make API calls
- [ ] Web app authentication works
- [ ] Mobile app starts with `npm start`
- [ ] Mobile app can login/register
- [ ] Mobile app can fetch products
- [ ] Both apps connect to same backend
- [ ] Both apps use same database
- [ ] No Capacitor dependencies remain
- [ ] No `ios/` folder in project root
