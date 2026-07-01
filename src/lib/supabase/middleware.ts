import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas alcanzables sin sesion. Todo lo demas requiere estar autenticado
// (equivalente a ProtectedRoute en el App.tsx original). El reparto fino por
// rol (AdminRoute vs cobrador) se resuelve en los layouts de cada grupo de
// rutas (Fase 5), no aqui.
const RUTAS_PUBLICAS = ["/login"];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No usar supabase.auth.getSession() en el server: no valida el JWT.
  // getUser() lo revalida contra Supabase Auth en cada request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !esRutaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Fuerza el cambio de contrasena temporal para usuarios migrados desde
  // Firebase (Fase 4, ver scripts/migrate-users.ts) antes de dejarlos usar
  // el resto del sistema.
  if (user && pathname !== "/cambiar-password") {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("debe_cambiar_password")
      .eq("id", user.id)
      .maybeSingle();

    if (perfil?.debe_cambiar_password) {
      const url = request.nextUrl.clone();
      url.pathname = "/cambiar-password";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
