import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Cobrador } from "@/lib/data/types";

// Puerto de src/services/ambulantesService.ts original (funciones de
// lectura/edicion sobre `cobradores`, sin privilegios de Auth). La creacion
// de cobradores requiere crear un usuario de Supabase Auth, lo cual no puede
// hacerse desde el cliente (a diferencia del original, que usaba
// createUserWithEmailAndPassword del navegador) - ver
// src/app/actions/cobradores.ts (Server Action con service_role).
//
// Nota: en Postgres no existe la limitacion de Firestore de "evitar indices
// compuestos con filtro en memoria" que tenia el original (getAmbulantesActivos
// filtraba `estado==='activo'` en memoria); aqui se filtra directo en la
// consulta sin cambiar el resultado.

export async function getCobradores(): Promise<Cobrador[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobradores")
    .select("*")
    .order("codigo_cuenta");
  if (error) throw error;
  return data;
}

export async function getCobradoresActivos(): Promise<Cobrador[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobradores")
    .select("*")
    .eq("estado", "activo")
    .order("codigo_cuenta");
  if (error) throw error;
  return data;
}

export async function getCobradorByUserId(userId: string): Promise<Cobrador | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobradores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCobradorById(id: string): Promise<Cobrador | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobradores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateCobrador(
  id: string,
  updates: Partial<
    Pick<Cobrador, "nombre" | "apellido" | "dni" | "telefono" | "email" | "estado" | "mercado_id" | "foto_url" | "lat" | "lng">
  >
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cobradores").update(updates).eq("id", id);
  if (error) throw error;
}

/** Elimina el cobrador (no elimina el usuario de Auth ni el perfil - igual que el original). */
export async function deleteCobrador(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("cobradores").delete().eq("id", id);
  if (error) throw error;
}

/** Genera el siguiente codigo de cuenta (A001, A002, ...). Acepta cualquier cliente (browser o admin). */
export async function generarCodigoCuenta(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const { data, error } = await supabase.from("cobradores").select("codigo_cuenta");
  if (error) throw error;
  if (!data.length) return "A001";

  const maxCodigo = data.reduce((max, c) => {
    const num = parseInt(c.codigo_cuenta.substring(1), 10);
    return num > max ? num : max;
  }, 0);

  return `A${String(maxCodigo + 1).padStart(3, "0")}`;
}
