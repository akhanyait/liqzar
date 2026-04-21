# Migration Checklist

Use this checklist to track your progress migrating from Capacitor to the monorepo architecture.

## 📋 Pre-Migration

- [ ] **Backup current project**

  ```bash
  # Option 1: Create backup directory
  cp -r liqzar-concierge-delivery liqzar-backup

  # Option 2: Commit to git
  git add -A
  git commit -m "Backup before monorepo migration"
  git push
  ```

- [ ] **Review documentation**
  - [ ] Read MONOREPO_MIGRATION_PLAN.md
  - [ ] Read SETUP_GUIDE.md
  - [ ] Scan ARCHITECTURE.md for understanding
  - [ ] Review IMPLEMENTATION_SUMMARY.md

- [ ] **Verify Node.js version**

  ```bash
  node --version  # Should be 18+
  ```

- [ ] **Install Yarn if needed**
  ```bash
  npm install -g yarn
  yarn --version
  ```

## 🚀 Migration Execution

### Option A: Automated Migration (Recommended)

- [ ] **Run migration script**

  ```bash
  chmod +x migrate.sh
  ./migrate.sh
  ```

- [ ] **Verify script completed successfully**
  - [ ] No errors in output
  - [ ] apps/web/ directory created
  - [ ] apps/mobile/ directory exists
  - [ ] node_modules installed

### Option B: Manual Migration

- [ ] **Create directory structure**

  ```bash
  mkdir -p apps/web
  mkdir -p apps/mobile
  mkdir -p packages/{api-client,types,auth,utils}/src
  ```

- [ ] **Move web files**

  ```bash
  mv src apps/web/
  mv public apps/web/
  mv index.html apps/web/
  mv vite.config.ts apps/web/
  mv tsconfig.*.json apps/web/
  mv tailwind.config.ts apps/web/
  mv postcss.config.js apps/web/
  mv components.json apps/web/
  mv eslint.config.js apps/web/
  ```

- [ ] **Update root package.json**

  ```bash
  cp package.json package.json.old
  mv package.json.new package.json
  ```

- [ ] **Remove Capacitor**

  ```bash
  rm -rf ios/
  rm capacitor.config.ts
  ```

- [ ] **Install dependencies**
  ```bash
  yarn install
  ```

## ✅ Verification

### Test Web App

- [ ] **Navigate to web directory**

  ```bash
  cd apps/web
  ```

- [ ] **Start dev server**

  ```bash
  yarn dev
  ```

- [ ] **Open in browser**: http://localhost:5173
- [ ] **Test key features**:
  - [ ] Homepage loads
  - [ ] Can browse products
  - [ ] Can add to cart
  - [ ] Can login/register
  - [ ] Driver dashboard works
  - [ ] Admin features work
  - [ ] No console errors

- [ ] **Test build**
  ```bash
  yarn build
  ```

  - [ ] Build succeeds without errors
  - [ ] dist/ folder created

### Test Mobile App

- [ ] **Navigate to mobile directory**

  ```bash
  cd apps/mobile
  ```

- [ ] **Configure environment**

  ```bash
  cp .env.example .env
  nano .env
  ```

- [ ] **Add required environment variables**:
  - [ ] API_BASE_URL
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY

- [ ] **Install dependencies** (if not done)

  ```bash
  yarn install
  ```

- [ ] **Start Expo dev server**

  ```bash
  yarn start
  ```

- [ ] **Test on device/simulator**:
  - [ ] App bundle loads
  - [ ] Login screen appears
  - [ ] Can create account
  - [ ] Can login
  - [ ] Products screen loads
  - [ ] Can browse products
  - [ ] Profile screen works
  - [ ] Can logout
  - [ ] No errors in console

### Test Shared Packages

- [ ] **Run type check from root**

  ```bash
  cd /path/to/project/root
  yarn type-check
  ```

  - [ ] No TypeScript errors

- [ ] **Run lint**

  ```bash
  yarn lint
  ```

  - [ ] No linting errors

- [ ] **Test imports**
  - [ ] Web app can import shared packages
  - [ ] Mobile app can import shared packages
  - [ ] Auto-completion works in IDE

## 🧹 Cleanup

- [ ] **Remove old Capacitor dependencies from web**

  ```bash
  cd apps/web
  # Check package.json for any @capacitor/* or @capgo/* packages
  # Remove them if present
  ```

- [ ] **Verify no Capacitor references**

  ```bash
  cd /path/to/project/root
  grep -r "capacitor" apps/web/src/ || echo "No Capacitor references found"
  ```

- [ ] **Remove old package.json.old** (after confirming new one works)

  ```bash
  rm package.json.old
  ```

- [ ] **Clean up node_modules** (optional, saves space)
  ```bash
  rm -rf node_modules
  yarn install
  ```

## 🎯 Post-Migration Tasks

### Update Web App to Use Shared Packages

- [ ] **Replace direct Supabase calls with API client**

  **Before:**

  ```typescript
  const { data } = await supabase.from("products").select("*");
  ```

  **After:**

  ```typescript
  import { productsApi } from "@liqzar/api-client";
  const products = await productsApi.getProducts();
  ```

- [ ] **Use shared types**

  ```typescript
  import type { Product, Order, User } from "@liqzar/types";
  ```

- [ ] **Use shared utilities**

  ```typescript
  import { formatPrice, formatDate } from "@liqzar/utils";
  ```

- [ ] **Update authentication to use AuthManager**
  ```typescript
  import { getAuthManager } from "@liqzar/auth";
  const authManager = getAuthManager();
  ```

### Enhance Mobile App

- [ ] **Add driver screens**
  - [ ] Create DriverDashboardScreen
  - [ ] Create DriverScanScreen
  - [ ] Create DriverDeliveryScreen
  - [ ] Add to navigation

- [ ] **Implement barcode scanning**

  ```bash
  cd apps/mobile
  yarn add expo-barcode-scanner
  ```

- [ ] **Add location tracking**

  ```bash
  yarn add expo-location
  ```

- [ ] **Setup push notifications**

  ```bash
  yarn add expo-notifications
  ```

- [ ] **Add maps integration**
  ```bash
  yarn add react-native-maps
  ```

## 🚀 Deployment Preparation

### iOS

- [ ] **Test on physical iOS device**
- [ ] **Configure signing in Xcode**
- [ ] **Build with EAS**
  ```bash
  cd apps/mobile
  eas build --platform ios
  ```
- [ ] **Submit to App Store** (when ready)

### Android

- [ ] **Test on physical Android device**
- [ ] **Configure signing**
- [ ] **Build with EAS**
  ```bash
  cd apps/mobile
  eas build --platform android
  ```
- [ ] **Submit to Play Store** (when ready)

### Web

- [ ] **Build production web app**

  ```bash
  cd apps/web
  yarn build
  ```

- [ ] **Test production build**

  ```bash
  yarn preview
  ```

- [ ] **Deploy to hosting** (Vercel, Netlify, etc.)

## 📊 Quality Assurance

- [ ] **Cross-platform testing**
  - [ ] Web on Chrome
  - [ ] Web on Safari
  - [ ] Web on Firefox
  - [ ] iOS app on simulator
  - [ ] iOS app on device
  - [ ] Android app on emulator
  - [ ] Android app on device

- [ ] **Feature parity check**
  - [ ] Authentication works on all platforms
  - [ ] Product browsing works
  - [ ] Cart functionality works
  - [ ] Checkout works
  - [ ] Order tracking works
  - [ ] Profile management works
  - [ ] Driver features work (if applicable)

- [ ] **Performance check**
  - [ ] Web app loads quickly
  - [ ] Mobile app starts fast
  - [ ] Smooth navigation
  - [ ] No memory leaks
  - [ ] Efficient API calls

## 📝 Documentation

- [ ] **Update README.md**
  - [ ] Add monorepo structure explanation
  - [ ] Update installation instructions
  - [ ] Add links to sub-READMEs

- [ ] **Document API endpoints**
  - [ ] List all endpoints used
  - [ ] Document request/response formats
  - [ ] Add authentication requirements

- [ ] **Create developer onboarding guide**
  - [ ] How to set up the project
  - [ ] How to run locally
  - [ ] How to add features
  - [ ] Code style guide

## 🎉 Final Steps

- [ ] **Commit all changes**

  ```bash
  git add -A
  git commit -m "Migrate to monorepo architecture"
  git push
  ```

- [ ] **Tag release**

  ```bash
  git tag -a v2.0.0 -m "Monorepo migration complete"
  git push --tags
  ```

- [ ] **Inform team**
  - [ ] Share new project structure
  - [ ] Share setup instructions
  - [ ] Schedule training session if needed

- [ ] **Monitor production**
  - [ ] Check error logs
  - [ ] Monitor performance
  - [ ] Gather user feedback

## ❓ Troubleshooting

If you encounter issues, check:

- [ ] All dependencies installed: `yarn install` from root
- [ ] Environment variables set correctly in both apps
- [ ] TypeScript paths configured in tsconfig.json
- [ ] No Capacitor references remaining
- [ ] Web app still in working condition
- [ ] Mobile app can communicate with backend

Refer to:

- [ ] QUICK_REFERENCE.md for common solutions
- [ ] SETUP_GUIDE.md for detailed instructions
- [ ] ARCHITECTURE.md for understanding structure

## 📈 Success Metrics

Your migration is successful when:

✅ Web app runs without Capacitor
✅ Mobile app runs on iOS and Android
✅ Both apps use shared packages
✅ Both apps communicate with same backend
✅ No duplicate code between apps
✅ TypeScript types shared across projects
✅ Fast development workflow
✅ Can deploy independently

---

**Completed?** Congratulations! 🎉

You now have a modern, scalable, production-ready monorepo architecture!

**Next Steps:**

- Implement additional features
- Optimize performance
- Add comprehensive testing
- Set up CI/CD pipeline
- Plan next release

**Questions?** Review the documentation files or consult with your team.

---

**Progress Tracking:**

- Start Date: ******\_******
- Completion Date: ******\_******
- Issues Encountered: ******\_******
- Resolution Notes: ******\_******
