# LIQZAR — Test Sequences & Acceptance Criteria

**Version:** 1.0
**Date:** 9 April 2026
**Environment:** Expo Go (iOS simulator / Android emulator) + Supabase Pro `deiewcktyzzeviszukqj`
**Status:** All database migrations deployed. Yoco credentials pending (payment tests marked LIVE†).

---

## TEST ACCOUNTS (DEV mode only — `__DEV__` gated)

| Role      | Phone          | OTP      | Email                     | Password     |
| --------- | -------------- | -------- | ------------------------- | ------------ |
| Customer  | `079 077 1591` | `123456` | customer@liqzar.co.za  | customer123  |
| Driver    | `062 153 2030` | `123456` | driver@liqzar.co.za    | driver123    |
| Admin     | `079 077 1567` | `123456` | admin@liqzar.co.za     | admin123     |
| Warehouse | `078 079 0771` | `123456` | warehouse@liqzar.co.za | warehouse123 |

> Seed test accounts: `POST https://deiewcktyzzeviszukqj.supabase.co/functions/v1/seed-test-users`
> (Requires Supabase service-role auth header)

**Legend for test status:**

- ✅ **TESTABLE NOW** — works in current Expo Go build
- ⚠️ **LIVE†** — code is wired; requires Yoco merchant secrets to execute gateway
- 🔨 **NATIVE** — requires native binary rebuild (expo-notifications, expo-image-picker)
- 🤖 **MOCK** — returns static/simulated data, no real backend

---

## TS-01 · CUSTOMER SELF-REGISTRATION (Phone OTP)

**Goal:** New customer creates an account via South African mobile number.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                  | Expected Result                                                      |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | Open app — tap **Sign Up**                              | Registration screen appears with phone number field                  |
| 2    | Enter a valid SA mobile number (e.g. `+27 82 123 4567`) | Number accepted; format normalised                                   |
| 3    | Tap **Send OTP**                                        | `supabase.auth.signInWithOtp({ phone })` invoked; OTP SMS dispatched |
| 4    | Enter the 6-digit OTP received                          | OTP field accepts 6 digits                                           |
| 5    | Tap **Verify**                                          | Auth session created; `user_roles` row inserted with `customer`      |
| 6    | Profile creation prompt                                 | `profiles` row auto-inserted via DB trigger                          |
| 7    | App navigates to **HomeScreen**                         | Customer tab bar visible; role = `customer`                          |

**Edge cases:**

- Invalid phone format → inline validation error before API call
- Wrong OTP (3 attempts) → `Too many attempts` error from Supabase
- Re-submit same phone that already has an account → logs in, does not create duplicate

---

## TS-02 · CUSTOMER LOGIN (Returning User)

**Goal:** Existing customer authenticates and lands on correct role screen.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                 | Expected Result                                                                                         |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 1    | Open app — tap **Sign In**                             | Login screen with phone field                                                                           |
| 2    | Enter registered phone number                          | Field accepts SA format                                                                                 |
| 3    | Tap **Send OTP**                                       | OTP dispatched                                                                                          |
| 4    | Enter correct OTP (`123456` in DEV)                    | Auth session restored                                                                                   |
| 5    | `user_roles` lookup fires                              | Role loaded from `user_roles` table                                                                     |
| 6    | Navigate to correct home screen per role               | Customer → HomeScreen; Admin → AdminDashboard; Driver → DriverDashboard; Warehouse → WarehouseDashboard |
| 7    | Test each DEV user by tapping the quick-select buttons | Each role → correct navigation stack                                                                    |

**Edge cases:**

- Expired OTP (>5 min) → `OTP expired` error; prompt to resend
- Phone not registered → Supabase creates new account (OTP auth upserts by default)
- No `user_roles` row found in production → defaults to `customer` role

---

## TS-03 · ADMIN-ASSISTED CUSTOMER ONBOARDING

**Goal:** Admin onboards a new customer via referral sharing and account management.
**Status:** ✅ TESTABLE NOW

> Note: LIQZAR does not have a direct admin-send-invite function in the current build.
> Onboarding is customer-self-service. Admin assists via (A) referral sharing and
> (B) manual account lookup post-registration.

### Part A — Admin Shares Referral Link (Indirect Invite)

| Step | Action                                                                         | Expected Result                                                 |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1    | Log in as admin (`079 077 1567`, OTP `123456`)                                 | AdminDashboard visible                                          |
| 2    | Navigate to **Customer Management**                                            | Customer list loads from `profiles` table                       |
| 3    | Admin locates a customer's referral code via CustomerManagement → profile data | Referral code displayed                                         |
| 4    | Alternatively: log in as that customer, go to **Referral** screen              | Referral code + share buttons (WhatsApp, SMS, Email)            |
| 5    | Tap **Share via WhatsApp**                                                     | Native share sheet opens with `https://liqzar.co.za/ref/{code}` |
| 6    | Recipient follows link and registers                                           | New account created; referral linked in `referrals` table       |
| 7    | Referrer's loyalty points credited on first order by referred customer         | `loyalty_transactions` row inserted                             |

### Part B — Admin Reviews Newly Registered Customer

| Step | Action                                        | Expected Result                             |
| ---- | --------------------------------------------- | ------------------------------------------- |
| 1    | New customer registers via TS-01              | Account appears in `profiles`               |
| 2    | Log in as admin → **Customer Management**     | New customer visible in list                |
| 3    | Expand customer card                          | Name, phone, registration date, order count |
| 4    | Admin can view order history, loyalty balance | Data loaded from Supabase                   |
| 5    | Admin can deactivate if needed                | Status toggled in `profiles`                |

### Part C — Seed Test Accounts (Development / Staging Setup)

| Step | Action                                                           | Expected Result                                            |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Call `seed-test-users` Edge Function                             | `POST /functions/v1/seed-test-users` with service-role key |
| 2    | Function creates 4 accounts (admin, customer, driver, warehouse) | `200 OK` with results array                                |
| 3    | Verify each account can log in with DEV credentials              | All 4 roles functional                                     |

---

## TS-04 · FULL ORDER PLACEMENT (Happy Path)

**Goal:** Customer browses, adds to cart, and places an order successfully.
**Status:** ✅ TESTABLE NOW (payment capture requires Yoco ⚠️ LIVE†)

| Step | Action                                                   | Expected Result                                               |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------- |
| 1    | Log in as customer                                       | HomeScreen loads; products from Supabase                      |
| 2    | Tap a product → **ProductDetailScreen**                  | Name, price, stock status, ABV visible                        |
| 3    | Set quantity = 2 → **Add to Cart**                       | CartContext updated; badge increments                         |
| 4    | Open **CartScreen**                                      | Items, subtotal, VAT (15%), delivery fee, payable total shown |
| 5    | Apply promo code (see TS-09)                             | Discount applied                                              |
| 6    | Tap **Checkout**                                         | CheckoutScreen opens                                          |
| 7    | Enter SA delivery address + select province              | Address saved                                                 |
| 8    | Select delivery method (Standard / Express)              | Express blocked after 14:00 SAST (see TS-08)                  |
| 9    | Select payment method (Card / EFT / Cash on Delivery)    | Payment method captured                                       |
| 10   | Tap **Place Order**                                      | DOB check fires if no `date_of_birth` in profile (see TS-06)  |
| 11   | `checkStock()` pre-flight runs                           | Stock validated; fails if out of stock (see TS-11)            |
| 12   | Order created with status `pending` → `awaiting_payment` | `orders` row created; `LQ` prefix on order ID                 |
| 13   | `reserve_stock` RPC fires                                | Stock reserved; `stock_reserved = true`                       |
| 14   | `PaymentService.initiatePayment()` called                | ⚠️ LIVE† — Yoco checkout session created (needs Yoco keys)    |

**Verify in Supabase:**

```sql
SELECT id, status, payment_status, stock_reserved FROM orders ORDER BY created_at DESC LIMIT 1;
```

---

## TS-05 · PAYMENT FLOW

**Goal:** End-to-end Yoco payment capture.
**Status:** ⚠️ LIVE† — requires `YOCO_SECRET_KEY` + `YOCO_WEBHOOK_SECRET`

| Step | Action                                           | Expected Result                                     |
| ---- | ------------------------------------------------ | --------------------------------------------------- |
| 1    | Complete TS-04 up to Step 14                     | Order in `awaiting_payment`; `payments` row created |
| 2    | Customer completes Yoco payment on WebView       | Yoco redirects back to app                          |
| 3    | `capture-payment` EF fires                       | `payments.status = captured`                        |
| 4    | `orders.payment_status = captured`               | Updated via EF or Yoco webhook                      |
| 5    | Order transitions `awaiting_payment → confirmed` | `OrderWorkflowEngine` fires; warehouse task created |
| 6    | Customer sees order confirmed in OrderHistory    | Status chip updated                                 |

**Idempotency test:**

- Tap Place Order twice rapidly → second call blocked by `useRef` guard + `initiatePayment()` check for existing active payment

**Payment failure test:**

- Decline card in Yoco sandbox → `payment_failed` status; stock released via `release_reserved_stock` RPC
- Retry banner appears in CheckoutScreen; same order ID reused

---

## TS-06 · AGE GATE — DOB VERIFICATION (SA Liquor Act Compliance)

**Goal:** Verify customers are 18+ before completing a liquor purchase.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                           | Expected Result                                                           |
| ---- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | Log in as fresh customer with no `date_of_birth` in profile      | —                                                                         |
| 2    | Add item to cart and reach Checkout → tap Place Order            | DOB modal appears (not a Yes/No alert)                                    |
| 3    | Enter DOB in DD/MM/YYYY format — use a date making the person 17 | **Order blocked** — `"You must be 18 or older to purchase alcohol"` error |
| 4    | Enter DOB making the person exactly 18 (today minus 18 years)    | Modal accepts; `profiles.date_of_birth` saved                             |
| 5    | Dismiss and re-attempt Checkout                                  | DOB modal does NOT reappear (persisted to profile)                        |
| 6    | Enter DOB making the person 25                                   | Accepted; order proceeds                                                  |

**Edge cases:**

- Invalid day (e.g. 31/02/1995) → validation error on the modal
- Future date → validation error
- Empty fields → cannot submit

---

## TS-07 · DELIVERY HOURS ENFORCEMENT (SA Liquor Act)

**Goal:** Deliveries can only be placed and received between 09:00 and 21:00 SAST.
**Status:** ✅ TESTABLE NOW (advisory banner); runtime enforcement happens at driver handoff

| Step | Action                                                         | Expected Result                                                          |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1    | Set device time to 08:45 (before 09:00)                        | Checkout shows amber advisory banner                                     |
| 2    | Attempt to place order                                         | Order can be created (advisory only); banner warns of scheduled delivery |
| 3    | Set device time to 21:15 (after 21:00)                         | Same amber banner appears                                                |
| 4    | At driver handoff: `ComplianceService.isWithinDeliveryHours()` | Returns `false`; `performHandoffCheck()` fails `delivery_hours_check`    |
| 5    | Driver sees compliance failure                                 | `paymentAction = "hold"` (reschedule path, not refund)                   |

---

## TS-08 · SAME-DAY EXPRESS DELIVERY CUTOFF

**Goal:** Express delivery cannot be selected after 14:00 SAST.
**Status:** ✅ TESTABLE NOW

| Step | Action                                     | Expected Result                                                              |
| ---- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| 1    | Set device time to 13:55                   | Express delivery option is selectable                                        |
| 2    | Set device time to 14:05                   | Express option is disabled with tooltip "Express orders close at 14:00 SAST" |
| 3    | Standard delivery still available at 14:05 | Standard option remains active                                               |
| 4    | Set device time to 20:55                   | Standard delivery still available                                            |

---

## TS-09 · PROMO CODE VALIDATION

**Goal:** Promo codes apply correctly and fail gracefully.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                            | Expected Result                                    |
| ---- | ----------------------------------------------------------------- | -------------------------------------------------- |
| 1    | Open PromoCodeScreen or use checkout promo field                  | Promo input visible                                |
| 2    | Enter a valid active promo code (seeded in migration 003)         | Discount amount shown; `promo_codes` table queried |
| 3    | Enter an expired promo                                            | `"Promo code has expired"` error                   |
| 4    | Enter a non-existent code                                         | `"Invalid promo code"` error                       |
| 5    | Enter a valid code, remove it, re-enter                           | Amount correctly recalculated each time            |
| 6    | Use `validate_and_apply_promo` RPC directly (Supabase SQL editor) | Returns discount amount or error reason            |

**Seed a test promo:**

```sql
INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, valid_to, max_uses)
VALUES ('LIQZAR10', 'percentage', 10, 150, now() + interval '30 days', 100);
```

---

## TS-10 · ORDER CANCELLATION WINDOW

**Goal:** Orders can only be cancelled within 10 minutes of placement.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                                      | Expected Result                                                                     |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1    | Place an order (TS-04) — note the timestamp                                 | Order in `pending` / `awaiting_payment`                                             |
| 2    | Immediately go to OrderDetail → tap **Cancel Order**                        | `cancelOrder()` called; validates within 10-min window                              |
| 3    | Cancel succeeds                                                             | Order → `cancelled`; stock released; `increment_stock` RPC fires                    |
| 4    | Place new order; wait 11+ minutes (or manually backdate `created_at` in DB) | Cancel button disabled or returns error `"Cancellation window has passed"`          |
| 5    | Confirm `increment_stock` restored stock                                    | `SELECT stock_quantity FROM products WHERE id = '{product_id}'` — should = original |

**Status guard test:** Try to cancel an order already in `en_route` → must fail with status guard error.

---

## TS-11 · STOCK VALIDATION & OUT-OF-STOCK HANDLING

**Goal:** Stock pre-flight at checkout prevents orders on unavailable items.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                              | Expected Result                                           |
| ---- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Set a product's `stock_quantity = 0` via Admin Stock Control or SQL | Product shows "Out of Stock" badge in ProductDetailScreen |
| 2    | Add the item to cart (from WishlistScreen or direct navigation)     | Can be added but flagged                                  |
| 3    | Attempt checkout → Place Order                                      | `checkStock()` fires; returns itemised out-of-stock error |
| 4    | No order is created                                                 | `orders` table unaffected                                 |
| 5    | Set `stock_quantity = 1`; place order for qty 2                     | Error for insufficient quantity                           |
| 6    | Reduce qty to 1 → Place Order                                       | Proceeds; `reserve_stock` RPC reserves 1 unit             |
| 7    | Cancel order                                                        | `release_reserved_stock` RPC restores 1 unit              |
| 8    | Complete order (requires TS-05)                                     | `decrement_stock` RPC decrements; stock goes from 1 → 0   |

---

## TS-12 · DRIVER ONBOARDING & VERIFICATION

**Goal:** Driver registers, gets verified by admin, and gains access to the driver stack.
**Status:** ✅ TESTABLE NOW

| Step | Action                                          | Expected Result                                                        |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| 1    | Log in as driver (`062 153 2030`, OTP `123456`) | `user_roles.role = driver` loaded from `user_roles` table              |
| 2    | If `drivers.is_verified = false`                | `DriverVerificationGate` intercepts; `PendingVerificationScreen` shown |
| 3    | Log in as admin → **Driver Management**         | Driver appears in Unverified tab                                       |
| 4    | Admin taps **Verify** on the driver             | `is_verified = true` set in `drivers` table                            |
| 5    | Driver kills app / re-opens                     | Gate passes; DriverDashboard accessible                                |
| 6    | Driver sets status to Online                    | Toggle updates local state; available for dispatch                     |

**Edge case:** Driver account without a `driver_profiles` row → profile creation required; test the creation path.

---

## TS-13 · FULL DELIVERY LIFECYCLE (End-to-End)

**Goal:** Order flows through all 17 statuses from placement to completion.
**Status:** Partially ✅ TESTABLE NOW (payment step ⚠️ LIVE†)

```
pending → awaiting_payment → confirmed → preparing → ready →
driver_assigned → picked_up → en_route → delivered → completed
```

| Step | Status             | Actor     | Action                                             |
| ---- | ------------------ | --------- | -------------------------------------------------- |
| 1    | `pending`          | Customer  | Place order (TS-04)                                |
| 2    | `awaiting_payment` | System    | PaymentService.initiatePayment()                   |
| 3    | `confirmed`        | System ⚠️ | Yoco payment captured; warehouse task created      |
| 4    | `preparing`        | Warehouse | WarehouseTaskList → start preparing                |
| 5    | `ready`            | Warehouse | markReady(); DispatchService scores drivers        |
| 6    | `driver_assigned`  | System    | `calculate_dispatch_score` RPC assigns best driver |
| 7    | `picked_up`        | Driver    | ScanVerify → record_driver_signoff RPC             |
| 8    | `en_route`         | Driver    | Navigate → Customer                                |
| 9    | `delivered`        | Driver    | ComplianceService 5-step check + PIN verify        |
| 10   | `completed`        | System    | Auto-complete job fires; loyalty points awarded    |

**Verify loyalty trigger:**

```sql
SELECT points_balance FROM loyalty_accounts WHERE user_id = '{customer_id}';
SELECT * FROM loyalty_transactions WHERE order_id = '{order_id}';
```

---

## TS-14 · COMPLIANCE HANDOFF CHECK (5-Step Driver Gate)

**Goal:** Driver cannot complete delivery without passing SA Liquor Act compliance checks.
**Status:** ✅ TESTABLE NOW

| Step | Check                            | Pass                             | Fail path                                                   |
| ---- | -------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| 1    | **Delivery hours** (09:00–21:00) | Within window                    | `paymentAction = "hold"` → reschedule                       |
| 2    | **ID document**                  | Recipient shows valid ID         | Log `id_check` event; compliance failure                    |
| 3    | **Age verification** (18+)       | Recipient is 18+                 | `paymentAction = "refund_required"` → auto-refund triggered |
| 4    | **Intoxication check**           | Recipient appears sober          | Refuse delivery; log incident                               |
| 5    | **Substitute recipient**         | ID + age verified for substitute | Logged with substitute name                                 |

**Test sequence:**

1. Driver reaches **DriverDeliveryPinVerify** screen
2. Compliance gate intercepts before PIN entry
3. Fail check 3 (age) → `requestRefund()` auto-called → refund record created in `refunds` table
4. Pass all 5 checks → PIN entry screen presented
5. Enter correct 4-digit PIN → `verify_delivery_pin` RPC → delivery confirmed

---

## TS-15 · DELIVERY FAILURE & RETURN TO STORE

**Goal:** Driver marks delivery failed; order returns to warehouse.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                                       | Expected Result                                                  |
| ---- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | Driver is `en_route` — tap **Cannot Deliver**                                | ReturnToStoreScreen opens                                        |
| 2    | Select reason (No recipient / Wrong address / Refused / Intoxicated / Other) | Reason captured                                                  |
| 3    | Confirm                                                                      | `increment_failed_delivery_count` RPC; order → `return_to_store` |
| 4    | Warehouse receives return task                                               | `warehouse_tasks` row for return                                 |
| 5    | Warehouse marks return received                                              | Order → `return_received`                                        |
| 6    | Admin decides: reschedule or refund                                          | `rescheduled` or `cancelled → refunded`                          |

---

## TS-16 · ADMIN REFUND FLOW

**Goal:** Admin approves a refund request; `process-refund` EF executes.
**Status:** ✅ Code wired + EF deployed; gateway call ⚠️ LIVE† (needs Yoco secrets)

| Step | Action                                       | Expected Result                                                                                 |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1    | Customer places a paid order (TS-04 + TS-05) | Order in `confirmed` or later                                                                   |
| 2    | Customer raises dispute / refund request     | `DisputeScreen` → dispute created; or driver compliance failure auto-triggers `requestRefund()` |
| 3    | `RefundService.requestRefund()`              | `refunds` row created with `status = pending`                                                   |
| 4    | Log in as admin → **OrderDetail**            | Pending refund visible                                                                          |
| 5    | Admin taps **Approve Refund**                | `RefundService.approveRefund(refundId)` called                                                  |
| 6    | `refunds.status → approved`                  | DB updated                                                                                      |
| 7    | `process-refund` EF invoked                  | ⚠️ EF deployed; Yoco API call fires (needs secrets)                                             |
| 8    | Yoco refund confirmed                        | `refunds.status → completed`; `payments.status → refunded`; `orders.payment_status → refunded`  |

**Admin rejection test:**

- Tap **Reject** with reason → `refunds.status = rejected`; no EF called

---

## TS-17 · LOYALTY PROGRAM

**Goal:** Points are awarded automatically on order completion.
**Status:** ✅ TESTABLE NOW (trigger deployed in migration 20260408_003)

| Step | Action                                   | Expected Result                                                     |
| ---- | ---------------------------------------- | ------------------------------------------------------------------- |
| 1    | Complete an order (TS-13)                | `completed` status fires DB trigger                                 |
| 2    | Check **LoyaltyScreen**                  | Points balance increased                                            |
| 3    | Check `loyalty_transactions`             | Row with `type = earned`; `order_id` linked                         |
| 4    | Accumulate points to next tier threshold | Tier badge upgrades (Bronze → Silver → Gold → Platinum)             |
| 5    | Redeem points at checkout                | `loyalty_transactions` row with `type = redeemed`; discount applied |

**Direct DB verification:**

```sql
SELECT la.points_balance, la.tier, lt.points, lt.type
FROM loyalty_accounts la
JOIN loyalty_transactions lt ON lt.user_id = la.user_id
WHERE la.user_id = '{customer_id}'
ORDER BY lt.created_at DESC LIMIT 5;
```

---

## TS-18 · REFERRAL SYSTEM

**Goal:** Referral codes drive new registrations and reward referrers.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                              | Expected Result                                                 |
| ---- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1    | Log in as existing customer → **ReferralScreen**                    | Unique referral code displayed; stats card visible              |
| 2    | Copy code or tap Share (WhatsApp/SMS/Email)                         | Native share sheet opens                                        |
| 3    | New device: register using the referral code (link or manual entry) | `referrals` row created; `status = pending`                     |
| 4    | New customer places first order                                     | `referrals.status → completed`; referrer loyalty bonus credited |
| 5    | Check referrer's `loyalty_transactions`                             | Referral reward row present                                     |

---

## TS-19 · SCHEDULED DELIVERY

**Goal:** Customer books a future time slot.
**Status:** ✅ TESTABLE NOW

| Step | Action                                           | Expected Result                                       |
| ---- | ------------------------------------------------ | ----------------------------------------------------- |
| 1    | Open **ScheduleDeliveryScreen**                  | 7-day picker + time slots from `delivery_slots` table |
| 2    | Select a future date + available slot            | Slot selected; max_orders check enforced              |
| 3    | Confirm address and place scheduled order        | `scheduled_deliveries` row created; order linked      |
| 4    | View in **OrderHistory** → Scheduled tab         | Scheduled order listed with delivery time             |
| 5    | View slot capacity in admin (**ZoneManagement**) | Slot booking count incremented                        |

---

## TS-20 · WAREHOUSE TASK FLOW

**Goal:** Warehouse processes order from confirmed to ready.
**Status:** ✅ TESTABLE NOW (requires order to be in `confirmed` state)

| Step | Action                                              | Expected Result                                     |
| ---- | --------------------------------------------------- | --------------------------------------------------- |
| 1    | Order reaches `confirmed` (TS-13 step 3)            | Warehouse task auto-created (`warehouse_tasks`)     |
| 2    | Log in as warehouse → **TaskList**                  | Task appears in **Pick** tab                        |
| 3    | Tap task → **TaskDetail**                           | Items checklist; scan progress bar                  |
| 4    | Tap **Start Preparing**                             | `startPreparing()` → order → `preparing`            |
| 5    | Check off all items (manual or scan)                | Progress bar fills                                  |
| 6    | Tap **Mark Ready**                                  | `markReady()` → order → `ready`; dispatch triggered |
| 7    | **DepotRelease**: verify driver identity at handoff | `depotRelease()` → `record_depot_release` RPC       |

---

## TS-21 · PUSH NOTIFICATIONS

**Goal:** Order status changes trigger push notifications.
**Status:** 🔨 NATIVE — requires native binary rebuild

| Step | Action                                            | Expected Result                                            |
| ---- | ------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Install native build (EAS preview APK/IPA)        | App installed as standalone                                |
| 2    | Register: app prompts for notification permission | System permission dialog                                   |
| 3    | Grant permission                                  | Expo push token saved to `profiles.push_token`             |
| 4    | Place an order                                    | Status change notification received when order transitions |
| 5    | Tap notification                                  | App opens to correct OrderDetail screen                    |
| 6    | Go to **NotificationsScreen**                     | Notification listed; read/unread state correct             |
| 7    | Mark all read                                     | All notifications flagged as read in `notifications` table |

**If permission denied:**

- `NotificationsScreen` shows "Open Settings" banner
- `openNotificationSettings()` launches OS settings app

---

## TS-22 · SEARCH & DISCOVERY

**Goal:** Product search returns relevant results.
**Status:** ✅ TESTABLE NOW

| Step | Action                                      | Expected Result                              |
| ---- | ------------------------------------------- | -------------------------------------------- |
| 1    | Open **SearchScreen**                       | Recent searches displayed                    |
| 2    | Type partial product name (e.g. `"whisky"`) | Debounced (500ms) Supabase query fires       |
| 3    | Results appear                              | Product cards with name, price, stock status |
| 4    | Tap a result                                | Navigates to ProductDetailScreen             |
| 5    | Clear search                                | Recent searches restored                     |
| 6    | Search for non-existent product             | Empty state with illustration                |

---

## TS-23 · ADMIN DASHBOARD & AUDIT

**Goal:** Admin views live data and operations trail.
**Status:** ✅ TESTABLE NOW

| Step | Action                                               | Expected Result                                              |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------ |
| 1    | Log in as admin → **AdminDashboard**                 | Stats cards (Orders Today, Revenue, Active Drivers, Pending) |
| 2    | View live orders in **OrderManagement**              | Real-time list with 17-status filter tabs                    |
| 3    | Manually assign a driver to a `ready` order          | `DispatchService.reassignDriver()` called                    |
| 4    | Navigate to **ProductManagement** → add/edit product | Product saved to Supabase                                    |
| 5    | Navigate to **StockControl** → adjust stock          | Stock adjustment saved; `stock_adjustments` row created      |
| 6    | Navigate to **AuditLogScreen**                       | Paginated log of all admin actions (30/page)                 |
| 7    | Navigate to **PromoManagement** → create promo       | Promo saved to `promo_codes`                                 |
| 8    | Navigate to **ZoneManagement** → view zone           | Delivery zone polygon + fee structure                        |
| 9    | Navigate to **Reports**                              | Revenue chart, top products, driver leaderboard              |

---

## TS-24 · WEB ADMIN PANEL

**Goal:** Web admin (React 18 + Vite) works in browser.
**Status:** ✅ TESTABLE NOW — running at `http://localhost:8080`

| Step | Action                                  | Expected Result                             |
| ---- | --------------------------------------- | ------------------------------------------- |
| 1    | Open `http://localhost:8080` in browser | Login screen loads                          |
| 2    | Sign in with admin credentials          | Dashboard renders                           |
| 3    | View orders list                        | Real Supabase data                          |
| 4    | Apply dark mode toggle                  | Theme switches; CSS vars apply correctly    |
| 5    | View charts on Dashboard                | Brand-gold (#D4AF37) bar/area charts render |
| 6    | Navigate all admin sections             | No broken routes or white screens           |

---

## TS-25 · REAL-TIME ORDER TRACKING

**Goal:** Customer sees live driver location updates.
**Status:** ✅ PARTIAL — Supabase channel works; map route is mocked

| Step | Action                                                  | Expected Result                                                   |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| 1    | Order is `en_route`                                     | Tracking screen accessible from OrderDetail                       |
| 2    | Open **OrderTrackingScreen**                            | MapView renders with driver marker                                |
| 3    | Driver location updates (simulate via SQL)              | `INSERT INTO delivery_tracking ...` → customer map updates in <1s |
| 4    | ETA countdown ticks                                     | Realtime subscription active                                      |
| 5    | Delivery PIN displayed                                  | 4-digit PIN shown to customer                                     |
| 6    | Note: route polyline is mocked (Johannesburg hardcoded) | "Demo Mode" context visible                                       |

**Simulate driver location update:**

```sql
INSERT INTO delivery_tracking (assignment_id, latitude, longitude, accuracy, heading, speed)
VALUES ('{assignment_id}', -26.2041, 28.0473, 10, 180, 40);
```

---

## TS-26 · BARCODE SCANNER

**Goal:** Customer scans a product barcode and is taken directly to the product page.
**Status:** ✅ TESTABLE NOW (expo-camera is not lazy-required)

| Step | Action                        | Expected Result                                   |
| ---- | ----------------------------- | ------------------------------------------------- |
| 1    | Open **BarcodeScannerScreen** | Camera preview opens                              |
| 2    | Scan EAN-13 or UPC-A barcode  | Supabase query `products.barcode = scanned_value` |
| 3    | Match found                   | Navigate to ProductDetailScreen                   |
| 4    | No match                      | Prompt to search by name                          |

---

## TS-27 · DRIVER ASSIGNMENT TIMEOUT DETECTION

**Goal:** Amber banner appears when driver hasn't been assigned within 5 minutes.
**Status:** ✅ TESTABLE NOW

| Step | Action                                                                     | Expected Result                                            |
| ---- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1    | Order reaches `driver_assigned` state                                      | Timestamp recorded                                         |
| 2    | Open **DriverDashboard**                                                   | Active delivery card visible                               |
| 3    | Wait 5+ minutes without driver accepting (or backdate `assigned_at` in DB) | Amber banner: `"Assignment pending — approaching timeout"` |
| 4    | Admin manually reassigns driver                                            | Banner dismissed; fresh assignment                         |

---

## TS-28 · DISPUTE SUBMISSION

**Goal:** Customer can open a dispute for a problematic order.
**Status:** ✅ TESTABLE NOW

| Step | Action                                   | Expected Result                                            |
| ---- | ---------------------------------------- | ---------------------------------------------------------- |
| 1    | Log in as customer → **DisputeScreen**   | Open disputes listed                                       |
| 2    | Tap **New Dispute**                      | Modal with 7 issue types                                   |
| 3    | Select issue type; add description       | Form validates                                             |
| 4    | Submit                                   | `disputes` row created; `support_tickets` row auto-created |
| 5    | Admin views in **OrderDetail** / Support | Ticket visible with `open` status                          |

---

## TS-29 · CUSTOMER DELIVERY RATING

**Goal:** Customer rates driver and delivery after completion.
**Status:** ✅ TESTABLE NOW

| Step | Action                                          | Expected Result                                      |
| ---- | ----------------------------------------------- | ---------------------------------------------------- |
| 1    | Order reaches `completed`                       | Rating prompt appears in OrderDetail                 |
| 2    | Open **CustomerRatingScreen**                   | 5-star driver rating + 5-star delivery rating        |
| 3    | Add comment + optional tip (R10/R20/R50/Custom) | Inputs accepted                                      |
| 4    | Submit                                          | `delivery_ratings` row created (UNIQUE per order_id) |
| 5    | Attempt to rate same order again                | Rejected — UNIQUE constraint                         |
| 6    | Driver's rating average updated                 | `driver_profiles.average_rating` recalculated        |

---

## TS-30 · SOMMELIER CHAT (MOCK)

**Goal:** Customer can interact with AI sommelier. (Currently returns keyword-matched responses — no real AI.)
**Status:** 🤖 MOCK

| Step | Action                                 | Expected Result                                |
| ---- | -------------------------------------- | ---------------------------------------------- |
| 1    | Tap **AI Sommelier** FAB on HomeScreen | SommelierChatScreen opens                      |
| 2    | Type wine pairing question             | Typing indicator; local `getAIResponse()` runs |
| 3    | Response appears                       | Keyword-matched static response                |
| 4    | Note: no API call to LLM backend       | Network inspector shows no outbound AI request |

---

## SUGGESTED ADDITIONAL TEST SEQUENCES

The following sequences are recommended for pre-launch sign-off:

| ID    | Sequence                                                                                                                                                                             | Priority | Status    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------- |
| TS-31 | **Multi-driver dispatch scoring** — place 5 orders simultaneously; verify `calculate_dispatch_score` selects different drivers based on load/proximity                               | High     | ✅        |
| TS-32 | **Wishlist add/remove/cart transfer** — full lifecycle via `wishlist` table                                                                                                          | Medium   | ✅        |
| TS-33 | **Driver earnings accuracy** — complete 3 orders; verify payout totals in DriverEarnings screen                                                                                      | High     | ✅        |
| TS-34 | **Driver chat messaging** — real-time message exchange between driver and customer via Supabase Realtime                                                                             | High     | ✅        |
| TS-35 | **Concurrent stock reservation race condition** — 2 customers checkout same last-unit item simultaneously; verify only 1 succeeds via `SELECT ... FOR UPDATE` in `reserve_stock` RPC | High     | ✅        |
| TS-36 | **Delivery zone fee calculator** — place orders from different zones; verify correct delivery fee per zone                                                                           | Medium   | ✅        |
| TS-37 | **pg_cron auto-reassignment** — leave an unaccepted `driver_assigned` order for >5 min; verify cron job reassigns                                                                    | High     | ✅        |
| TS-38 | **Photo proof of delivery** — DriverPhotoProof capture + Storage upload + POD record                                                                                                 | High     | 🔨 NATIVE |
| TS-39 | **Biometric login** (Face ID / Fingerprint) — available in `expo-local-authentication` configured in app.config.js                                                                   | Medium   | 🔨 NATIVE |
| TS-40 | **Background job auto-complete** — verify `process_auto_complete_jobs` RPC fires after delivery window; order → `completed`                                                          | High     | ✅        |
| TS-41 | **RLS violation attempt** — log in as customer; attempt to `SELECT * FROM admin_audit_log` directly — must return 0 rows                                                             | Critical | ✅        |
| TS-42 | **Admin audit log completeness** — perform 5 admin actions; verify each appears in AuditLogScreen                                                                                    | High     | ✅        |
| TS-43 | **Warehouse AI demand predictions** — view `WarehouseAIPredictions`; verify rule-based forecasts render (no real ML)                                                                 | Low      | 🤖 MOCK   |
| TS-44 | **Reorder from history** — use ReorderScreen to rebuild a previous cart                                                                                                              | Medium   | ✅        |
| TS-45 | **Saved addresses** — add Home/Work/Other; set default; use at checkout                                                                                                              | Medium   | ✅        |
| TS-46 | **Session persistence** — kill and reopen app; verify user stays logged in (Supabase session persisted in SecureStore)                                                               | High     | ✅        |
| TS-47 | **Payment retry UI** — simulate payment failure; use retry banner on CheckoutScreen; verify same `order_id` reused                                                                   | High     | ⚠️ LIVE†  |
| TS-48 | **PaymentStatus data migration** — run `UPDATE orders SET payment_status = 'captured' WHERE payment_status = 'paid'`; verify no orders return `paid` status                          | High     | ✅ (SQL)  |
| TS-49 | **Yoco webhook signature verification** — send fake webhook with wrong HMAC → 401 rejected; correct HMAC → processed                                                                 | High     | ⚠️ LIVE†  |
| TS-50 | **Heat map zone display** — DriverHeatMap renders surge zones from `delivery_zones` table                                                                                            | Low      | ✅        |

---

## EXECUTION ORDER (Recommended)

```
Phase 1 — Auth & Accounts (start here)
  TS-01 → TS-02 → TS-03 → TS-12 (driver onboarding)

Phase 2 — Core Commerce
  TS-09 (promo) → TS-11 (stock) → TS-06 (age gate) → TS-04 (order placement)

Phase 3 — Lifecycle & Compliance
  TS-07 → TS-08 → TS-10 (cancellation) → TS-13 (full lifecycle) → TS-14 (compliance)

Phase 4 — Warehouse & Delivery
  TS-20 (warehouse) → TS-25 (tracking) → TS-26 (barcode) → TS-15 (return to store)

Phase 5 — Financial
  TS-05 (payment ⚠️) → TS-16 (refund ⚠️) → TS-17 (loyalty) → TS-18 (referral)

Phase 6 — Admin & Operations
  TS-23 (admin) → TS-24 (web) → TS-28 (dispute) → TS-29 (rating)

Phase 7 — Advanced (pre-launch)
  TS-35 (race condition) → TS-41 (RLS) → TS-37 (pg_cron) → TS-42 (audit)

Phase 8 — Native only (after EAS build)
  TS-21 (push notifications) → TS-38 (photo proof) → TS-39 (biometric)
```

---

## ENVIRONMENT SETUP CHECKLIST

Before running tests:

- [ ] Expo dev server running: `cd apps/mobile && npx expo start --port 8084`
- [ ] Web admin running: `cd / && npm run dev` (port 8080)
- [ ] Test accounts seeded: `POST /functions/v1/seed-test-users`
- [ ] At least 10 products in `products` table with `stock_quantity > 0`
- [ ] At least 1 active `delivery_zone` row
- [ ] At least 1 `delivery_slots` row for today or tomorrow
- [ ] Promo code seeded (see TS-09)
- [ ] Driver account verified (`drivers.is_verified = true` for test driver)
- [ ] Device time accessible for delivery hours tests (TS-07, TS-08)

---

_LIQZAR Test Sequences v1.0 — 30 primary sequences + 20 additional — 9 April 2026_
_Covers: Auth, Commerce, Compliance (SA Liquor Act), State Machine, Payment, Delivery, Warehouse, Admin, Notifications_
