# LIQZAR Mobile App

React Native mobile application for LIQZAR liquor delivery service, built with Expo.

## 📱 Features

- **Authentication**: Secure login and registration
- **Product Browsing**: Browse liquor products with search and filters
- **Order Management**: Place and track orders
- **Profile Management**: Update user information and preferences
- **Driver Features**: (Coming soon) Delivery management and tracking

## 🛠 Tech Stack

- **React Native**: 0.73.2
- **Expo**: ~50.0.0
- **React Navigation**: 6.x
- **TypeScript**: 5.x
- **Axios**: For API calls
- **Expo SecureStore**: Secure token storage

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- For iOS: macOS with Xcode
- For Android: Android Studio with SDK

## 🚀 Getting Started

### 1. Install Dependencies

```bash
yarn install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API configuration:

```env
API_BASE_URL=https://your-api.supabase.co
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Start Development Server

```bash
# Start Expo dev server
yarn start

# Or run on specific platform
yarn ios      # iOS simulator
yarn android  # Android emulator
yarn web      # Web browser
```

### 4. Run on Device

**iOS:**

- Install "Expo Go" from App Store
- Scan QR code from terminal

**Android:**

- Install "Expo Go" from Play Store
- Scan QR code from terminal

## 📁 Project Structure

```
apps/mobile/
├── App.tsx                 # Main app entry point
├── app.json               # Expo configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── .env.example           # Environment template
└── src/
    ├── navigation/        # React Navigation setup
    │   └── AppNavigator.tsx
    ├── screens/           # Screen components
    │   ├── auth/         # Login, Register
    │   ├── home/         # Home screen
    │   ├── products/     # Product listing
    │   ├── orders/       # Order management
    │   └── profile/      # User profile
    └── services/         # Business logic
        ├── api.ts        # API client initialization
        └── storage.ts    # Secure storage for auth tokens
```

## 🔧 Development

### Available Scripts

```bash
yarn start          # Start Expo dev server
yarn android        # Run on Android
yarn ios            # Run on iOS
yarn web            # Run in web browser
yarn lint           # Check code quality
yarn type-check     # Run TypeScript checks
```

### Debugging

#### React Native Debugger

```bash
# Install React Native Debugger
brew install --cask react-native-debugger

# Start it before running the app
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

#### Chrome DevTools

1. Shake device (or press Cmd+D in simulator)
2. Select "Debug"
3. Opens Chrome DevTools

#### Expo DevTools

```bash
# Automatically opens with yarn start
# Or press 'd' in terminal
```

## 📦 Shared Packages

This app uses monorepo shared packages:

- **@liqzar/types**: TypeScript type definitions
- **@liqzar/api-client**: Backend API communication
- **@liqzar/auth**: Authentication logic
- **@liqzar/utils**: Utility functions (formatting, validation)

These are automatically linked via Yarn workspaces.

## 🔐 Authentication

The app uses a token-based authentication system:

1. User logs in → receives JWT token
2. Token stored securely in Expo SecureStore
3. Token automatically added to API requests
4. Token refreshed when expired
5. User logged out if refresh fails

### Auth Flow

```
Login Screen → AuthManager.login() →
Store tokens in SecureStore →
Update auth state → Navigate to MainTabs
```

## 🌐 API Integration

The app communicates with the backend via the shared `@liqzar/api-client` package:

```typescript
import { productsApi } from "@liqzar/api-client";

// Fetch products
const products = await productsApi.getProducts();

// Search products
const results = await productsApi.searchProducts("whiskey");
```

All API calls automatically include authentication tokens.

## 📱 Navigation Structure

```
AppNavigator
├── AuthStack (when not logged in)
│   ├── Login
│   └── Register
└── MainTabs (when logged in)
    ├── Home
    ├── Products
    ├── Orders
    └── Profile
```

## 🎨 Styling

- Uses React Native StyleSheet
- Dark theme with orange accent (#F97316)
- Consistent spacing and typography
- Platform-specific adjustments where needed

## 🔔 Permissions

The app requests these permissions:

- **Camera**: For barcode scanning (driver features)
- **Location**: For delivery tracking
- **Notifications**: For order updates

Configure in `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Allow camera for barcode scanning",
        "NSLocationWhenInUseUsageDescription": "Location for delivery tracking"
      }
    },
    "android": {
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    }
  }
}
```

## 🏗 Building for Production

### Build with EAS (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure build
eas build:configure

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

### Classic Build

```bash
# iOS
expo build:ios

# Android
expo build:android
```

## 🧪 Testing

### Unit Tests

```bash
# Run tests (when configured)
yarn test
```

### E2E Tests

```bash
# Using Detox (when configured)
yarn e2e:ios
yarn e2e:android
```

## 🐛 Common Issues

### Metro Bundler Cache Issues

```bash
yarn start --reset-cache
```

### Node Modules Issues

```bash
rm -rf node_modules
yarn install
```

### iOS Build Issues

```bash
cd ios
pod install
cd ..
```

### Android Build Issues

```bash
cd android
./gradlew clean
cd ..
```

## 🚢 Deployment

### iOS App Store

1. Build IPA with EAS: `eas build --platform ios`
2. Download IPA from Expo dashboard
3. Upload to App Store Connect using Transporter
4. Submit for review

### Google Play Store

1. Build AAB with EAS: `eas build --platform android`
2. Download AAB from Expo dashboard
3. Upload to Google Play Console
4. Submit for review

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

## 🤝 Contributing

1. Create feature branch from `develop`
2. Make changes
3. Test on both iOS and Android
4. Submit pull request

## 📝 License

Proprietary - LIQZAR
