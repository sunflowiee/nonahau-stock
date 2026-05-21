// IMPORTANT:
// Next.js will only inline NEXT_PUBLIC_* variables into the client bundle when accessed
// via static property access (e.g. process.env.NEXT_PUBLIC_SUPABASE_URL).
// Do NOT use bracket access (process.env["..."]) for client-side env.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
};
