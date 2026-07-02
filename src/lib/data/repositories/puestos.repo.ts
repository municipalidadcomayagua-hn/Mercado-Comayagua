import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Puesto } from "@/lib/data/types";
import { getCobrosPorAmbulante } from "./cobros.repo";

// Puerto de src/services/puestosService.ts + src/services/eliminarLocatarioService.ts originales.

type PuestoInsert = Database["public"]["Tables"]["puestos"]["Insert"];
type PuestoUpdate = Database["public"]["Tables"]["puestos"]["Update"];

// Iniciales del nombre del cliente (ej: "Desarrollo Sandres" -> "DS").
function getIniciales(nombreCliente: string): string {
  const palabras = nombreCliente.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return palabras
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
}

// Codigo corto: Iniciales + Numero puesto (2 digitos) + Anio (ej: DS022026).
async function generarCodigoPuesto(
  nombreCliente: string,
  numeroPuesto: string,
  anio: number
): Promise<string> {
  const iniciales = getIniciales(nombreCliente) || "XX";
  const numero = String(numeroPuesto).trim().padStart(2, "0").slice(0, 2);
  const baseCodigo = `${iniciales}${numero}${anio}`;

  const supabase = createClient();
  const { data, error } = await supabase.from("puestos").select("codigo").eq("anio", anio);
  if (error) {
    console.error("Error generando código de puesto:", error);
    return baseCodigo;
  }

  const codigosExistentes = new Set(data.map((p) => p.codigo).filter(Boolean));
  if (!codigosExistentes.has(baseCodigo)) return baseCodigo;

  let sufijo = 2;
  while (codigosExistentes.has(`${baseCodigo}-${sufijo}`)) sufijo++;
  return `${baseCodigo}-${sufijo}`;
}

export type CrearPuestoInput = Omit<PuestoInsert, "id" | "codigo" | "created_at">;

export async function createPuesto(puesto: CrearPuestoInput): Promise<string> {
  const codigo = await generarCodigoPuesto(puesto.nombre_cliente, puesto.numero_puesto, puesto.anio);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("puestos")
    .insert({ ...puesto, codigo })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getPuestoById(id: string): Promise<Puesto | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("puestos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPuestosPorAmbulante(cobradorId: string, anio?: number): Promise<Puesto[]> {
  const supabase = createClient();
  let query = supabase
    .from("puestos")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .order("created_at", { ascending: false });
  if (anio !== undefined) {
    query = query.eq("anio", anio);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function sanitizarNumeros<T extends Record<string, unknown>>(updates: T): T {
  const sanitizado = { ...updates };
  for (const key of Object.keys(sanitizado)) {
    const value = sanitizado[key];
    if (typeof value === "number" && !Number.isFinite(value)) {
      (sanitizado as Record<string, unknown>)[key] = 0;
    }
  }
  return sanitizado;
}

/** No permite actualizar el codigo una vez creado (igual que el original). */
export async function updatePuesto(
  id: string,
  updates: Omit<PuestoUpdate, "id" | "created_at" | "codigo">
): Promise<void> {
  const updatesSanitizados = sanitizarNumeros(updates);

  const supabase = createClient();
  const { error } = await supabase.from("puestos").update(updatesSanitizados).eq("id", id);
  if (error) throw error;
}

/** Verifica si ya existe un puesto activo con el mismo numero para el mismo cobrador y anio. */
export async function existePuesto(
  cobradorId: string,
  numeroPuesto: string,
  anio: number
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("puestos")
    .select("id")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .eq("anio", anio)
    .eq("activo", true)
    .limit(1);
  if (error) {
    console.error("Error verificando puesto:", error);
    return false;
  }
  return data.length > 0;
}

/**
 * Elimina un locatario (puesto) y todos sus datos asociados: cobros
 * (mensuales y diarios), cuenta por cobrar, abonos, deudas en mora y sus
 * abonos, y el puesto. Puerto de eliminarLocatarioService.eliminarLocatarioCompleto.
 */
export async function eliminarLocatarioCompleto(puesto: Puesto): Promise<void> {
  if (!puesto.id) throw new Error("El puesto no tiene ID");
  const cobradorId = puesto.cobrador_id;
  const numeroPuesto = puesto.numero_puesto;
  const puestoId = puesto.id;

  const supabase = createClient();

  // 1. Eliminar cobros (mensuales y diarios) de este puesto.
  const cobros = await getCobrosPorAmbulante(cobradorId);
  const cobrosDelPuesto = cobros.filter((c) => String(c.numero_puesto) === String(numeroPuesto));
  if (cobrosDelPuesto.length > 0) {
    const { error } = await supabase
      .from("cobros")
      .delete()
      .in(
        "id",
        cobrosDelPuesto.map((c) => c.id)
      );
    if (error) throw error;
  }

  // 2. Eliminar cuenta por cobrar.
  await supabase
    .from("cuentas_por_cobrar")
    .delete()
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto);

  // 3. Eliminar abonos de la cuenta.
  await supabase.from("abonos").delete().eq("cobrador_id", cobradorId).eq("numero_puesto", numeroPuesto);

  // 4. Eliminar deudas en mora del puesto y sus abonos (deudas_mora.puesto_id
  // es FK RESTRICT hacia puestos, hay que borrar antes de borrar el puesto).
  const { data: deudas, error: deudasError } = await supabase
    .from("deudas_mora")
    .select("id")
    .eq("puesto_id", puestoId);
  if (deudasError) throw deudasError;

  for (const deuda of deudas ?? []) {
    await supabase.from("abonos_mora").delete().eq("deuda_mora_id", deuda.id);
    await supabase.from("deudas_mora").delete().eq("id", deuda.id);
  }

  // 5. Eliminar el puesto.
  const { error: puestoError } = await supabase.from("puestos").delete().eq("id", puestoId);
  if (puestoError) throw puestoError;
}
