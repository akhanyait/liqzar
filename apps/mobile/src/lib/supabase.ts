import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { SecureAuthStorage } from "../services/storage";

// Supabase configuration — loaded from app.config.js (which reads from ENV vars).
// Never hard-code credentials in source; set SUPABASE_URL and SUPABASE_ANON_KEY
// as environment variables or in a `.env` file that is excluded from version control.
const supabaseUrl: string = Constants.expoConfig?.extra?.supabaseUrl || "";
const supabaseAnonKey: string = Constants.expoConfig?.extra?.supabaseAnonKey || "";

export { supabaseUrl, supabaseAnonKey };

if (__DEV__ && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    "[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not configured. " +
    "Set them as environment variables or in app.config.js extra fields.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
