import { createClient } from "@/lib/supabase/client";
import type { Perfil } from "@/lib/data/types";

// Puerto parcial de src/services/ambulantesService.ts original (las
// funciones que operaban sobre la coleccion `usuarios`).

export async function getPerfilById(id: string): Promise<Perfil | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Actualiza el mercado asignado de un perfil (equivalente a updateUsuarioMercado). */
export async function updatePerfilMercado(
  perfilId: string,
  mercadoId: string | null
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("perfiles")
    .update({ mercado_id: mercadoId })
    .eq("id", perfilId);
  if (error) throw error;
}

/** Mapa perfil id (cobrador) -> mercado_id, para reportes por mercado (equivalente a getUsuariosMercadoMap). */
export async function getPerfilesMercadoMap(): Promise<Record<string, string | null>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("perfiles").select("id, mercado_id");
  if (error) throw error;
  const map: Record<string, string | null> = {};
  for (const row of data) {
    map[row.id] = row.mercado_id;
  }
  return map;
}
