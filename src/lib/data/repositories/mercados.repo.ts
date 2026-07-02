import { createClient } from "@/lib/supabase/client";
import type { Mercado } from "@/lib/data/types";

// Puerto de src/services/mercadosService.ts original.

export async function getMercados(): Promise<Mercado[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function getMercadosActivos(): Promise<Mercado[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .select("*")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function getMercadoById(id: string): Promise<Mercado | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createMercado(
  mercado: Pick<Mercado, "nombre"> & Partial<Pick<Mercado, "codigo" | "activo">>
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mercados")
    .insert({
      nombre: mercado.nombre,
      codigo: mercado.codigo ?? null,
      activo: mercado.activo ?? true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateMercado(
  id: string,
  updates: Partial<Pick<Mercado, "nombre" | "codigo" | "activo">>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mercados").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteMercado(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("mercados").delete().eq("id", id);
  if (error) throw error;
}
