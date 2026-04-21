# Monorepo Migration Plan

## Overview

Migrating from Capacitor-based mobile app to separate React Native mobile app with shared backend.

## Architecture

```
liqzar-concierge-delivery/
├── apps/
│   ├── web/              # Existing web app (unchanged)
│   └── mobile/           # New React Native Expo app
├── packages/
│   ├── api-client/       # Shared API communication
│   ├── types/            # Shared TypeScript types
│   ├── auth/             # Shared authentication logic
│   └── utils/            # Shared utilities
├── package.json          # Root workspace config
├── turbo.json            # Turborepo config (optional)
└── tsconfig.base.json    # Base TypeScript config
```

## Migration Steps

### Phase 1: Setup Monorepo Structure (DO NOT RUN YET)

1. Create workspace structure
2. Set up Yarn/npm workspaces
3. Configure TypeScript paths

### Phase 2: Extract Shared Logic

1. Extract API clients to packages/api-client
2. Extract types to packages/types
3. Extract auth logic to packages/auth
4. Extract utilities to packages/utils

### Phase 3: Create React Native Mobile App

1. Initialize Expo project in apps/mobile
2. Configure navigation
3. Set up environment variables
4. Install dependencies

### Phase 4: Remove Capacitor

1. Uninstall Capacitor dependencies
2. Remove ios/ folder
3. Clean up capacitor.config.ts
4. Update web build config

### Phase 5: Testing

1. Verify web app still works
2. Test mobile app builds
3. Test API integration
4. Test authentication flow

## Implementation Notes

- Web app must remain fully functional
- Mobile app is completely independent
- Both apps share backend API only
- No shared UI components
