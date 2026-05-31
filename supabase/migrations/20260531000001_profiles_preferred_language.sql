-- Add `preferred_language` to the profiles table so the i18n LanguageContext
-- can persist a user's chosen language across devices (vs. just localStorage,
-- which is per-browser). Default to English to match the current UI source.
--
-- Wired up by:
--   - src/context/LanguageContext.tsx (reads on mount, writes on language change)
--   - supabase/functions/ai-translate/index.ts (consumes the target language
--     name when translating UI strings + chat messages)
--
-- Backfill-safe: existing rows pick up the default, no application change required.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'English';

-- Guard against typos and keep the set in sync with src/context/LanguageContext.tsx
-- (SA_LANGUAGES). If you add a language there, add it here too.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN (
    'English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sesotho',
    'Setswana', 'Sepedi', 'Xitsonga', 'siSwati', 'Tshivenda', 'isiNdebele'
  ));

COMMENT ON COLUMN public.profiles.preferred_language IS
  'User-selected app language. One of the 11 SA official languages. Defaults to English.';
