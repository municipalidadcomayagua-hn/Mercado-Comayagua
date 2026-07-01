"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { mapAuthError } from "./errors";

type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
type PerfilConMercado = Perfil & { mercadoNombre: string | null };

interface AuthContextType {
  user: PerfilConMercado | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isAmbulante: boolean;
  mercadoNombre: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<PerfilConMercado | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = useCallback(
    async (authUser: SupabaseUser) => {
      setSupabaseUser(authUser);

      const { data: perfil, error } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      // No deberia pasar: el trigger handle_new_user crea el perfil al
      // registrarse (ver MIGRATION_NOTES.md seccion 8.2). Si falta, es un
      // problema de datos y no un estado a enmascarar con un rol por defecto.
      if (error || !perfil) {
        console.error("Perfil no encontrado para el usuario autenticado:", error);
        setUser(null);
        return;
      }

      let mercadoId = perfil.mercado_id;
      let mercadoNombre: string | null = null;

      // Equivalente al fallback de mercadoId via ambulantes en el original:
      // si el perfil no tiene mercado_id, se busca en cobradores (user_id
      // es FK NOT NULL, asi que este fallback siempre puede resolverse).
      if (!mercadoId && perfil.rol === "ambulante") {
        const { data: cobrador } = await supabase
          .from("cobradores")
          .select("mercado_id")
          .eq("user_id", authUser.id)
          .maybeSingle();
        mercadoId = cobrador?.mercado_id ?? null;
      }

      if (mercadoId) {
        const { data: mercado } = await supabase
          .from("mercados")
          .select("nombre")
          .eq("id", mercadoId)
          .maybeSingle();
        mercadoNombre = mercado?.nombre ?? null;
      }

      setUser({ ...perfil, mercado_id: mercadoId, mercadoNombre });
    },
    [supabase]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        cargarPerfil(authUser).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setLoading(true);
        cargarPerfil(session.user).finally(() => setLoading(false));
      } else {
        setSupabaseUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, cargarPerfil]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(mapAuthError(error));
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const isAdmin = user?.rol === "administrador";
  const isAmbulante = user?.rol === "ambulante";

  const value: AuthContextType = {
    user,
    supabaseUser,
    loading,
    login,
    logout,
    isAdmin,
    isAmbulante,
    mercadoNombre: user?.mercadoNombre ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
