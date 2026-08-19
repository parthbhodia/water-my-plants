// Browser-safe Supabase connection values.
// The publishable key is *meant* to be public (it ships in the JS bundle);
// data is protected by Row Level Security + SECURITY DEFINER functions.
// Env vars override these defaults, so forks can point at their own project.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkjieeopawcvgfchextu.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_PYKFSeOto0Pg0TaQ1_9RvA_DGkvUsCI";
