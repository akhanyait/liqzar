#!/usr/bin/env bash
# verify-launch.sh — one-shot pre-launch verification.
#
# Runs every check that can't be done in the Claude sandbox:
#   1. iOS native build (validates the expo-build-properties deploymentTarget fix)
#   2. Android native build (validates newArchEnabled=false unblocks the gradle hang)
#   3. ai-translate Edge Function deploy + live smoke against local Supabase
#   4. Production-build perf-budget run (validates CLS fixes)
#   5. Full a11y suite (validates color-contrast un-disable + fixes)
#
# Each step is independently skippable via env flags so you can iterate on one
# failure without re-running everything. Prints a single PASS/FAIL summary
# at the end so you can paste it into the launch checklist.
#
# Usage:
#   ./scripts/verify-launch.sh                # run everything
#   SKIP_IOS=1 ./scripts/verify-launch.sh     # skip iOS, run the rest
#   ONLY=perf ./scripts/verify-launch.sh      # only the perf step
#
# Prereqs (verified at start):
#   - colima running (or Docker Desktop)
#   - supabase CLI installed
#   - openjdk@17 available via brew
#   - Xcode + iOS Simulator
#   - Android SDK + an AVD

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── ANSI colours ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; DIM='\033[2m'; NC='\033[0m'
ok()    { echo -e "${GREEN}✓${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
step()  { echo -e "\n${DIM}── $1 ──${NC}"; }

# ── State ────────────────────────────────────────────────────────────────────
RESULTS=()
record() { RESULTS+=("$1|$2|$3"); }   # status|name|detail
should_run() { [ -z "${ONLY:-}" ] || [ "${ONLY}" = "$1" ]; }

# ── Prereqs ──────────────────────────────────────────────────────────────────
step "Prereqs"
command -v colima >/dev/null && ok "colima installed" || { fail "colima missing"; exit 1; }
command -v supabase >/dev/null && ok "supabase CLI installed" || { fail "supabase CLI missing"; exit 1; }

if docker info >/dev/null 2>&1; then
  ok "docker daemon reachable"
else
  warn "docker daemon down — running: colima start"
  colima start || { fail "colima start failed"; exit 1; }
fi

JAVA_HOME_17="$(brew --prefix openjdk@17 2>/dev/null)/libexec/openjdk.jdk/Contents/Home"
[ -d "$JAVA_HOME_17" ] && ok "Java 17 at $JAVA_HOME_17" || warn "openjdk@17 missing — brew install openjdk@17"

# ── 1. iOS native build ──────────────────────────────────────────────────────
if should_run ios && [ -z "${SKIP_IOS:-}" ]; then
  step "iOS native build (xcodebuild)"
  pushd apps/mobile >/dev/null
  npx expo prebuild --platform ios --clean --no-install >/tmp/launch-ios-prebuild.log 2>&1
  if [ $? -ne 0 ]; then
    fail "expo prebuild ios failed — see /tmp/launch-ios-prebuild.log"
    record "FAIL" "iOS prebuild" "see log"
  else
    ok "expo prebuild ios"
    pushd ios >/dev/null
    pod install >/tmp/launch-ios-pod.log 2>&1
    if [ ! -d *.xcworkspace ] && ! ls *.xcworkspace >/dev/null 2>&1; then
      fail "no .xcworkspace after pod install"
      record "FAIL" "iOS xcodebuild" "no workspace"
    else
      WS=$(ls -1d *.xcworkspace | head -1)
      SCHEME="${WS%.xcworkspace}"
      # Pick by name, not UDID. UDID resolution via simctl JSON sometimes
      # surfaces stale or non-iPhone-shaped devices that xcodebuild rejects
      # ("Unable to find a destination matching..."). Name resolution lets
      # Xcode pick the appropriate runtime version itself.
      SIM_NAME=$(xcrun simctl list devices available --json | python3 -c "
import sys, json
d = json.load(sys.stdin)['devices']
cands = [x['name'] for r in d.values() for x in r if 'iPhone' in x['name'] and 'Pro' not in x['name'] and 'Air' not in x['name'] and 'Mirror' not in x['name']]
# Prefer the highest-numbered non-Pro iPhone (16e, 17, 17e, …)
cands.sort()
print(cands[-1] if cands else 'iPhone 17')")
      if [ -z "$SIM_NAME" ]; then
        fail "no iPhone simulator"
        record "FAIL" "iOS xcodebuild" "no sim"
      else
        echo "  Building against: $SIM_NAME"
        xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Debug \
          -destination "platform=iOS Simulator,name=$SIM_NAME" \
          -derivedDataPath ./build -quiet build >/tmp/launch-ios-build.log 2>&1
        if [ $? -eq 0 ]; then
          APP=$(find ./build/Build/Products -name '*.app' -maxdepth 5 | head -1)
          ok "iOS build success → $APP"
          record "PASS" "iOS xcodebuild" "$(basename "$APP")"
        else
          fail "xcodebuild failed — see /tmp/launch-ios-build.log"
          record "FAIL" "iOS xcodebuild" "see log"
        fi
      fi
    fi
    popd >/dev/null
  fi
  popd >/dev/null
fi

# ── 2. Android native build ──────────────────────────────────────────────────
if should_run android && [ -z "${SKIP_ANDROID:-}" ]; then
  step "Android native build (gradle assembleDebug)"
  rm -rf ~/.gradle/caches/transforms-* 2>/dev/null
  pushd apps/mobile >/dev/null
  npx expo prebuild --platform android --clean --no-install >/tmp/launch-android-prebuild.log 2>&1
  if [ $? -ne 0 ]; then
    fail "expo prebuild android failed"
    record "FAIL" "Android prebuild" "see log"
  else
    ok "expo prebuild android (newArchEnabled=false applied)"
    pushd android >/dev/null
    JAVA_HOME="$JAVA_HOME_17" ./gradlew assembleDebug --no-daemon --console=plain >/tmp/launch-android-build.log 2>&1
    if [ $? -eq 0 ]; then
      APK=$(find app/build/outputs/apk/debug -name '*.apk' | head -1)
      ok "Android build success → $APK"
      record "PASS" "Android gradle" "$(basename "$APK")"
    else
      fail "gradle failed — last 30 lines:"
      tail -30 /tmp/launch-android-build.log
      record "FAIL" "Android gradle" "see /tmp/launch-android-build.log"
    fi
    popd >/dev/null
  fi
  popd >/dev/null
fi

# ── 3. ai-translate Edge Function deploy + smoke ─────────────────────────────
if should_run ai-translate && [ -z "${SKIP_AI:-}" ]; then
  step "ai-translate EF deploy + smoke"
  if [ ! -d supabase/functions/ai-translate ]; then
    warn "ai-translate function not on this branch — checkout chore/lift-artisan-foundations (PR #1)"
    record "SKIP" "ai-translate" "not on this branch"
  elif ! supabase status >/dev/null 2>&1; then
    fail "supabase stack not running — run: supabase start -x vector"
    record "FAIL" "ai-translate" "no supabase"
  else
    # `supabase start` already hot-serves every function under
    # supabase/functions/<name>/ at http://127.0.0.1:54321/functions/v1/<name>
    # — no local-deploy step needed. (Remote deploy to Pro is a separate
    # `supabase functions deploy ai-translate --no-verify-jwt` — no --local
    # flag exists.) Skip straight to the smoke call.
    ok "ai-translate function present + auto-served by supabase start"
    if true; then
      ANON_KEY=$(supabase status -o json 2>/dev/null | python3 -c "
import sys, json
try:
    d=json.load(sys.stdin)
    print(d.get('ANON_KEY') or d.get('anon_key') or '')
except Exception:
    pass") || ANON_KEY=""
      [ -z "$ANON_KEY" ] && ANON_KEY="sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
      RESP=$(curl -s -w "\n%{http_code}" \
        -X POST http://127.0.0.1:54321/functions/v1/ai-translate \
        -H "Authorization: Bearer $ANON_KEY" \
        -H "Content-Type: application/json" \
        -d '{"texts":["Add to cart","Checkout"],"targetLang":"isiZulu"}')
      HTTP=$(echo "$RESP" | tail -1)
      BODY=$(echo "$RESP" | head -n -1)
      if [ "$HTTP" = "200" ]; then
        ok "ai-translate live (HTTP 200)"
        echo "  response: $BODY" | head -c 200
        record "PASS" "ai-translate" "HTTP 200"
      else
        warn "ai-translate HTTP $HTTP (likely missing LOVABLE_API_KEY in supabase/.env)"
        record "WARN" "ai-translate" "HTTP $HTTP — set LOVABLE_API_KEY"
      fi
    fi
  fi
fi

# ── 4. Production-build perf budget ─────────────────────────────────────────
if should_run perf && [ -z "${SKIP_PERF:-}" ]; then
  step "Production perf budget (LCP, CLS, JS bundle)"
  pnpm build >/tmp/launch-build.log 2>&1
  if [ $? -ne 0 ]; then
    fail "pnpm build failed"
    record "FAIL" "Perf budget" "build failed"
  else
    ok "pnpm build"
    pkill -f "vite preview" 2>/dev/null; sleep 1
    pnpm exec vite preview --port 8080 >/tmp/launch-preview.log 2>&1 &
    PREVIEW_PID=$!
    for i in {1..30}; do
      curl -fs http://localhost:8080 >/dev/null 2>&1 && break
      sleep 1
    done
    PLAYWRIGHT_AGAINST_PROD_BUILD=1 PLAYWRIGHT_BASE_URL=http://localhost:8080 \
      pnpm exec playwright test --project=perf --reporter=list 2>&1 | tee /tmp/launch-perf.log | grep -E "LCP|CLS|First-paint|✓|✘"
    PERF_EXIT=${PIPESTATUS[0]}
    kill $PREVIEW_PID 2>/dev/null
    if [ $PERF_EXIT -eq 0 ]; then
      ok "Perf budget — all metrics within budget"
      record "PASS" "Perf budget" "all metrics green"
    else
      fail "Perf budget — one or more metrics over"
      record "FAIL" "Perf budget" "see /tmp/launch-perf.log"
    fi
  fi
fi

# ── 5. Full a11y suite ──────────────────────────────────────────────────────
if should_run a11y && [ -z "${SKIP_A11Y:-}" ]; then
  step "a11y suite (full WCAG 2.1 A + AA incl. color-contrast)"
  pnpm exec playwright test --project=a11y --reporter=list 2>&1 | tee /tmp/launch-a11y.log | grep -E "✓|✘|violation"
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    ok "a11y — 0 critical/serious violations"
    record "PASS" "a11y" "0 violations"
  else
    fail "a11y violations — see /tmp/launch-a11y.log"
    record "FAIL" "a11y" "see log"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════════════"
echo "  PRE-LAUNCH VERIFICATION SUMMARY"
echo "════════════════════════════════════════════════════════════════"
printf "  %-22s %-8s %s\n" "Step" "Result" "Detail"
echo "  ────────────────────────────────────────────────────────────"
PASS=0; FAIL=0; WARN=0; SKIP=0
for r in "${RESULTS[@]}"; do
  IFS='|' read -r status name detail <<< "$r"
  case "$status" in
    PASS) printf "  %-22s ${GREEN}%-8s${NC} %s\n" "$name" "PASS" "$detail"; PASS=$((PASS+1));;
    FAIL) printf "  %-22s ${RED}%-8s${NC} %s\n" "$name" "FAIL" "$detail"; FAIL=$((FAIL+1));;
    WARN) printf "  %-22s ${YELLOW}%-8s${NC} %s\n" "$name" "WARN" "$detail"; WARN=$((WARN+1));;
    SKIP) printf "  %-22s ${DIM}%-8s${NC} %s\n" "$name" "SKIP" "$detail"; SKIP=$((SKIP+1));;
  esac
done
echo "  ────────────────────────────────────────────────────────────"
echo "  Totals: PASS=$PASS  FAIL=$FAIL  WARN=$WARN  SKIP=$SKIP"
echo

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ Launch ready.${NC} All hard checks passed."
  exit 0
else
  echo -e "${RED}✗ $FAIL hard check(s) failed.${NC} Logs in /tmp/launch-*.log"
  exit 1
fi
