import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** Verifica que el usuario autenticado sea administrador. Lanza si no. Para usar en Server Actions/Route Handlers. */
export async function requireAdmin(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Debes iniciar sesión para ejecutar esta acción.");
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (perfil?.rol !== "administrador") {
    throw new Error("Solo un administrador puede ejecutar esta acción.");
  }

  return user;
}
