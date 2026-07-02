import { createClient } from "@/lib/supabase/client";
import type { Rubro } from "@/lib/data/types";
import type { Database } from "@/lib/supabase/database.types";

type RubroUpdate = Database["public"]["Tables"]["rubros"]["Update"];

// Puerto de src/services/rubrosService.ts original. El centinela
// ambulanteId==='GLOBAL' del original se representa aqui como
// cobrador_id NULL + es_global=true (ver MIGRATION_NOTES.md seccion 3.10).

export async function getRubrosPorCobrador(cobradorId: string): Promise<Rubro[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rubros")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .order("codigo");
  if (error) throw error;
  return data;
}

/** Catalogo global de rubros (administrado por el admin; usado por todos los cobradores). */
export async function getRubrosGlobales(): Promise<Rubro[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rubros")
    .select("*")
    .eq("es_global", true)
    .order("codigo");
  if (error) throw error;
  return data;
}

export async function createRubro(
  cobradorId: string | null,
  data: Pick<Rubro, "codigo" | "concepto"> &
    Partial<Pick<Rubro, "abreviatura" | "activo" | "tipo_rubro">>
): Promise<string> {
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("rubros")
    .insert({
      cobrador_id: cobradorId,
      es_global: cobradorId === null,
      codigo: data.codigo.trim(),
      abreviatura: (data.abreviatura ?? "").trim(),
      concepto: data.concepto.trim(),
      activo: data.activo !== false,
      tipo_rubro: data.tipo_rubro ?? "vigente",
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateRubro(
  id: string,
  data: Partial<Pick<Rubro, "codigo" | "abreviatura" | "concepto" | "activo" | "tipo_rubro">>
): Promise<void> {
  const supabase = createClient();
  const updates: RubroUpdate = {};
  if (data.codigo !== undefined) updates.codigo = data.codigo.trim();
  if (data.abreviatura !== undefined) updates.abreviatura = data.abreviatura.trim();
  if (data.concepto !== undefined) updates.concepto = data.concepto.trim();
  if (data.activo !== undefined) updates.activo = data.activo;
  if (data.tipo_rubro !== undefined) updates.tipo_rubro = data.tipo_rubro;

  const { error } = await supabase.from("rubros").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteRubro(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("rubros").delete().eq("id", id);
  if (error) throw error;
}
