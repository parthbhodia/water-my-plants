import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config";

export const createClient = () =>
  createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
