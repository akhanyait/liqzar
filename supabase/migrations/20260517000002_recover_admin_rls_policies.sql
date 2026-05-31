-- 20260517_002 — Recover admin RLS policies dropped via CASCADE.
--
-- When migration 20260418000010_remove_warehouse_role applied DROP FUNCTION
-- public.has_role(...) CASCADE, it dropped 51 dependent policies on tables
-- across the schema. The migration recreated has_role() but did not recreate
-- the dependent policies. This migration restores admin access to all
-- operationally critical tables using a single "Admin full access" policy
-- per table — consolidating the prior split SELECT/INSERT/UPDATE/DELETE
-- policies into one ALL policy each.
--
-- Idempotent: DROP POLICY IF EXISTS before each CREATE POLICY.

BEGIN;

-- Generic admin recovery: full access for admin role
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'orders',
    'order_items',
    'delivery_assignments',
    'driver_assignments',
    'driver_profiles',
    'driver_vehicles',
    'payments',
    'refunds',
    'products',
    'customer_addresses',
    'user_roles',
    'proof_of_delivery',
    'compliance_events',
    'delivery_ratings',
    'support_tickets',
    'chat_channels',
    'chat_messages',
    'loyalty_accounts',
    'loyalty_transactions',
    'referral_codes',
    'referrals',
    'delivery_zones',
    'delivery_slots',
    'scheduled_deliveries',
    'background_jobs',
    'webhook_events',
    'promo_codes',
    'notifications',
    'admin_audit_log',
    'delivery_tracking',
    'warehouse_tasks',
    'wishlists',
    'stock_notifications',
    'driver_live_locations',
    'delivery_messages',
    'order_share_tokens',
    'gift_events',
    'gift_cards',
    'gift_card_redemptions',
    'order_shipments',
    'cellar_club_subscriptions',
    'cellar_club_shipments',
    'product_reviews',
    'review_flags',
    'corporate_accounts',
    'corporate_members',
    'corporate_invoices'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Only operate on tables that actually exist in public schema
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Admin full access" ON public.%I', tbl);
      EXECUTE format(
        'CREATE POLICY "Admin full access" ON public.%I FOR ALL ' ||
        'USING (public.has_role(auth.uid(), ''admin''::public.app_role)) ' ||
        'WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))',
        tbl
      );
      RAISE NOTICE 'Recreated admin policy on public.%', tbl;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
