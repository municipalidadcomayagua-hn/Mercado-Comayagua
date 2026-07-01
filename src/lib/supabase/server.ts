import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Cliente para Server Components, Route Handlers y Server Actions.
// El `setAll` puede fallar cuando se llama desde un Server Component (no
// puede escribir cookies); se ignora porque el middleware ya se encarga de
// refrescar la sesion en cada request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component; el middleware refresca la sesion.
          }
        },
      },
    }
  );
}
