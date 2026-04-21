#!/usr/bin/env bash
# =============================================================================
# E2E VERIFICATION — Customer → Admin → Driver flow
# -----------------------------------------------------------------------------
# Uses the Supabase CLI + service role to simulate the handoff at the DB level.
# Safer than clicking because it exercises the exact queries the app runs.
#
# Requires:
#   - npx supabase login already done (you have liqlux linked)
#   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env, OR via `supabase secrets`
#
# Usage:
#   chmod +x E2E_VERIFY.sh
#   export SUPABASE_URL=https://deiewcktyzzeviszukqj.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=<from dashboard → settings → API>
#   ./E2E_VERIFY.sh
#
# This script does NOT write to the DB except for the test order it creates,
# and it CLEANS UP at the end.
# =============================================================================

set -euo pipefail

: "${SUPABASE_URL:?Need SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need SUPABASE_SERVICE_ROLE_KEY}"

SB="$SUPABASE_URL/rest/v1"
AUTH="-H apikey:$SUPABASE_SERVICE_ROLE_KEY -H Authorization:Bearer\ $SUPABASE_SERVICE_ROLE_KEY -H Content-Type:application/json -H Prefer:return=representation"

echo "── Step 1: Find the seeded customer + driver test-user IDs ─────────"
CUSTOMER_ID=$(curl -s $AUTH "$SB/profiles?email=eq.customer@liqzar.co.za&select=id" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")')
DRIVER_ID=$(curl -s $AUTH "$SB/profiles?email=eq.driver@liqzar.co.za&select=id" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")')

if [[ -z "$CUSTOMER_ID" || -z "$DRIVER_ID" ]]; then
  echo "FAIL: could not resolve test-user IDs. Have you run seed-test-users Edge Function?"
  exit 1
fi
echo "  Customer: $CUSTOMER_ID"
echo "  Driver:   $DRIVER_ID"

echo
echo "── Step 2: Place a test order as customer ──────────────────────────"
ORDER=$(curl -s $AUTH -X POST "$SB/orders" -d "{
  \"user_id\": \"$CUSTOMER_ID\",
  \"status\": \"pending\",
  \"subtotal\": 100,
  \"vat_amount\": 15,
  \"delivery_fee\": 50,
  \"discount_amount\": 0,
  \"total\": 165,
  \"delivery_method\": \"express\",
  \"payment_method\": \"cash_on_delivery\",
  \"payment_status\": \"pending\",
  \"delivery_address\": {\"line1\":\"E2E Test\",\"city\":\"JHB\"}
}")
ORDER_ID=$(echo "$ORDER" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
echo "  Created order: $ORDER_ID (status=pending)"

echo
echo "── Step 3: Admin-side query — pending orders should include it ─────"
PENDING_HIT=$(curl -s $AUTH "$SB/orders?id=eq.$ORDER_ID&status=eq.pending&select=id" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
if [[ "$PENDING_HIT" != "1" ]]; then
  echo "  FAIL: admin pending-query did not return the new order"
  exit 1
fi
echo "  PASS: admin sees the pending order"

echo
echo "── Step 4: Admin dispatches driver ─────────────────────────────────"
curl -s $AUTH -X PATCH "$SB/orders?id=eq.$ORDER_ID" -d "{
  \"assigned_driver_id\": \"$DRIVER_ID\",
  \"status\": \"driver_assigned\"
}" > /dev/null
NEW_STATUS=$(curl -s $AUTH "$SB/orders?id=eq.$ORDER_ID&select=status" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["status"])')
echo "  Order status after dispatch: $NEW_STATUS"
[[ "$NEW_STATUS" == "driver_assigned" ]] || { echo "  FAIL: status did not advance"; exit 1; }

echo
echo "── Step 5: Driver-side query — must find the dispatched order ──────"
DRIVER_HIT=$(curl -s $AUTH "$SB/orders?assigned_driver_id=eq.$DRIVER_ID&status=in.(pending,preparing,ready,driver_assigned,picked_up,en_route)&id=eq.$ORDER_ID&select=id" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
if [[ "$DRIVER_HIT" != "1" ]]; then
  echo "  FAIL: driver dashboard filter did not return the dispatched order"
  exit 1
fi
echo "  PASS: driver sees the dispatched order"

echo
echo "── Step 6: Customer-side query — ETA widget must find it ───────────"
WIDGET_HIT=$(curl -s $AUTH "$SB/orders?user_id=eq.$CUSTOMER_ID&status=in.(pending,awaiting_payment,confirmed,preparing,ready,driver_assigned,picked_up,en_route)&id=eq.$ORDER_ID&select=id" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)))')
if [[ "$WIDGET_HIT" != "1" ]]; then
  echo "  FAIL: LiveOrderETAWidget query did not return the order"
  exit 1
fi
echo "  PASS: customer widget sees the order"

echo
echo "── Step 7: Cleanup ─────────────────────────────────────────────────"
curl -s $AUTH -X DELETE "$SB/orders?id=eq.$ORDER_ID" > /dev/null
echo "  Deleted test order $ORDER_ID"

echo
echo "════════════════════════════════════════════════════════════════════"
echo "  E2E VERIFICATION: ALL STEPS PASSED"
echo "  customer → admin → driver → customer widget ✓"
echo "════════════════════════════════════════════════════════════════════"
