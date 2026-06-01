// App language + AI-backed translation. `t(english)` returns the string in the
// user's preferred language. Translations are fetched once via the ai-translate
// Edge Function (batched, debounced 250ms) and cached in localStorage, so after
// the first load they render instantly. English is the source language — no
// network call needed for English.
//
// Adapted from ArtisanZA's LanguageContext (May 2026). Differences:
//   - Calls liqZAR's `ai-translate` EF which uses Google Gemini directly via
//     GOOGLE_AI_API_KEY (free tier from https://aistudio.google.com).
//   - Persists the user's choice to `profiles.preferred_language` (added in
//     the 20260531 migration). Falls back to localStorage for guests.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export const SA_LANGUAGES = [
  "English",
  "isiZulu",
  "isiXhosa",
  "Afrikaans",
  "Sesotho",
  "Setswana",
  "Sepedi",
  "Xitsonga",
  "siSwati",
  "Tshivenda",
  "isiNdebele",
] as const;
export type Language = (typeof SA_LANGUAGES)[number];

interface LanguageCtx {
  language: Language;
  setLanguage: (l: Language) => void;
  /** Translate an English UI string into the active language (English passthrough). */
  t: (englishText: string) => string;
}

const Ctx = createContext<LanguageCtx>({
  language: "English",
  setLanguage: () => {},
  t: (s) => s,
});

export const useLanguage = () => useContext(Ctx);
/** Convenience hook: `const t = useT(); t("Some English label")` */
export const useT = () => useContext(Ctx).t;

const STORAGE_LANG_KEY = "liqzar_language";
const cacheKey = (lang: string) => `liqzar_i18n_${lang}`;
const loadCache = (lang: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(lang)) || "{}");
  } catch {
    return {};
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = (typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_LANG_KEY)
      : null) as Language | null;
    return stored && SA_LANGUAGES.includes(stored) ? stored : "English";
  });
  const [dict, setDict] = useState<Record<string, string>>(() =>
    loadCache(language),
  );
  const pending = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the signed-in user's saved preference once at mount.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", data.user.id)
        .maybeSingle();
      const pl = (prof as { preferred_language?: Language } | null)
        ?.preferred_language;
      if (pl && SA_LANGUAGES.includes(pl) && pl !== language) {
        applyLanguage(pl, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    if (language === "English") return;
    const items = [...pending.current];
    pending.current.clear();
    if (items.length === 0) return;
    try {
      const { data, error } = await supabase.functions.invoke("ai-translate", {
        body: { texts: items, targetLang: language },
      });
      if (error || !data?.translations) return;
      const next = { ...loadCache(language) };
      items.forEach((src, i) => {
        if (data.translations[i]) next[src] = data.translations[i];
      });
      localStorage.setItem(cacheKey(language), JSON.stringify(next));
      setDict(next);
    } catch {
      // Network/AI failure — leave English fallback in place; do not throw.
    }
  }, [language]);

  const t = useCallback(
    (text: string) => {
      if (!text || language === "English") return text;
      if (dict[text]) return dict[text];
      // Queue for batch translation; render English until it arrives.
      if (!pending.current.has(text)) {
        pending.current.add(text);
        if (flushTimer.current) clearTimeout(flushTimer.current);
        flushTimer.current = setTimeout(flush, 250);
      }
      return text;
    },
    [dict, language, flush],
  );

  const applyLanguage = (l: Language, persist = true) => {
    setLanguageState(l);
    setDict(loadCache(l));
    localStorage.setItem(STORAGE_LANG_KEY, l);
    if (persist) {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          void supabase
            .from("profiles")
            .update({ preferred_language: l })
            .eq("id", data.user.id);
        }
      });
    }
  };

  return (
    <Ctx.Provider value={{ language, setLanguage: applyLanguage, t }}>
      {children}
    </Ctx.Provider>
  );
};
