import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Cliente para Client Components (equivalente al `src/services/firebase.ts`
// del proyecto original, pero sin exponer nada mas alla de la anon key).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
