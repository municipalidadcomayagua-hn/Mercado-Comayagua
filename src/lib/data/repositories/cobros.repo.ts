import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { Cobro, CobroConDetalle } from "@/lib/data/types";
import { siguienteNumeroRecibo } from "./folio.repo";
import { actualizarCuentaDesdeCobro } from "./cuentas.repo";

// Puerto de src/services/cobrosService.ts original.
//
// Cambios de plataforma (no de logica):
// - El folio (numeroRecibo) ya no se calcula leyendo el maximo de varias
//   colecciones; se obtiene del RPC siguiente_numero_recibo (folio.repo.ts).
// - Los filtros que el original resolvia "en memoria para evitar indice
//   compuesto" (limitacion de Firestore) se hacen aqui directo en la
//   consulta SQL, sin cambiar ningun resultado.
// - pagosAdicionales/pagosDiarios/abonosPorConcepto (arrays/mapa embebidos)
//   son ahora tablas hijas normalizadas; se reemplazan por completo en cada
//   update, igual que el original sobrescribia el array/mapa entero.

type CobroInsert = Database["public"]["Tables"]["cobros"]["Insert"];
type CobroUpdate = Database["public"]["Tables"]["cobros"]["Update"];

const SELECT_CON_DETALLE =
  "*, pagos_adicionales:cobros_pagos_adicionales(*), pagos_diarios:cobros_pagos_diarios(*), abonos_concepto:cobros_abonos_concepto(*)";

export interface PagoAdicionalInput {
  concepto: string;
  monto: number;
}
export interface PagoDiarioInput {
  numero_puesto: number;
  monto: number;
  timestamp?: string | null;
  rubro_id?: string | null;
  codigo?: string | null;
  concepto?: string | null;
}
export interface AbonoConceptoInput {
  concepto: string;
  monto: number;
}

export type CrearCobroInput = Omit<
  CobroInsert,
  "id" | "numero_recibo" | "fecha_cobro" | "sincronizado" | "created_at"
> & {
  pagos_adicionales?: PagoAdicionalInput[];
  pagos_diarios?: PagoDiarioInput[];
  abonos_concepto?: AbonoConceptoInput[];
};

export interface CrearCobroOptions {
  numeroRecibo?: number;
  skipActualizarCuenta?: boolean;
}

export async function createCobro(
  cobro: CrearCobroInput,
  options?: CrearCobroOptions
): Promise<string> {
  const supabase = createClient();
  const mercadoId = cobro.mercado_id?.trim() || null;
  const numeroRecibo = options?.numeroRecibo ?? (await siguienteNumeroRecibo(mercadoId));

  const { pagos_adicionales, pagos_diarios, abonos_concepto, ...scalarFields } = cobro;

  const insertPayload: CobroInsert = {
    ...scalarFields,
    mercado_id: mercadoId,
    numero_recibo: numeroRecibo,
    sincronizado: false,
    ...(cobro.tipo_cobro === "mensual" && {
      estado_cargo: cobro.estado_cargo ?? "pendiente",
      tipo_pago: cobro.tipo_pago ?? "vigente",
    }),
  };

  const { data: creado, error } = await supabase
    .from("cobros")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) throw error;

  if (pagos_adicionales?.length) {
    const { error: paError } = await supabase
      .from("cobros_pagos_adicionales")
      .insert(pagos_adicionales.map((pa) => ({ cobro_id: creado.id, ...pa })));
    if (paError) throw paError;
  }
  if (pagos_diarios?.length) {
    const { error: pdError } = await supabase
      .from("cobros_pagos_diarios")
      .insert(pagos_diarios.map((p) => ({ cobro_id: creado.id, ...p })));
    if (pdError) throw pdError;
  }
  if (abonos_concepto?.length) {
    const { error: acError } = await supabase
      .from("cobros_abonos_concepto")
      .insert(abonos_concepto.map((a) => ({ cobro_id: creado.id, ...a })));
    if (acError) throw acError;
  }

  if (!options?.skipActualizarCuenta) {
    try {
      await actualizarCuentaDesdeCobro(creado);
    } catch (err) {
      console.error("Error actualizando cuenta por cobrar:", err);
    }
  }

  return creado.id;
}

export type ActualizarCobroInput = CobroUpdate & {
  pagos_adicionales?: PagoAdicionalInput[];
  pagos_diarios?: PagoDiarioInput[];
  abonos_concepto?: AbonoConceptoInput[];
};

export async function updateCobro(id: string, updates: ActualizarCobroInput): Promise<void> {
  const supabase = createClient();
  const { pagos_adicionales, pagos_diarios, abonos_concepto, ...scalarUpdates } = updates;

  if (Object.keys(scalarUpdates).length > 0) {
    const { error } = await supabase.from("cobros").update(scalarUpdates).eq("id", id);
    if (error) throw error;
  }

  if (pagos_adicionales !== undefined) {
    const { error: delError } = await supabase
      .from("cobros_pagos_adicionales")
      .delete()
      .eq("cobro_id", id);
    if (delError) throw delError;
    if (pagos_adicionales.length) {
      const { error: insError } = await supabase
        .from("cobros_pagos_adicionales")
        .insert(pagos_adicionales.map((pa) => ({ cobro_id: id, ...pa })));
      if (insError) throw insError;
    }
  }

  if (pagos_diarios !== undefined) {
    const { error: delError } = await supabase
      .from("cobros_pagos_diarios")
      .delete()
      .eq("cobro_id", id);
    if (delError) throw delError;
    if (pagos_diarios.length) {
      const { error: insError } = await supabase
        .from("cobros_pagos_diarios")
        .insert(pagos_diarios.map((p) => ({ cobro_id: id, ...p })));
      if (insError) throw insError;
    }
  }

  if (abonos_concepto !== undefined) {
    const { error: delError } = await supabase
      .from("cobros_abonos_concepto")
      .delete()
      .eq("cobro_id", id);
    if (delError) throw delError;
    if (abonos_concepto.length) {
      const { error: insError } = await supabase
        .from("cobros_abonos_concepto")
        .insert(abonos_concepto.map((a) => ({ cobro_id: id, ...a })));
      if (insError) throw insError;
    }
  }
}

export async function getCobroById(id: string): Promise<CobroConDetalle | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select(SELECT_CON_DETALLE)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CobroConDetalle | null;
}

export async function getCobros(): Promise<Cobro[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data;
}

/** Cobros del dia, solo activos (equivalente a getCobrosDelDia). */
export async function getCobrosDelDia(): Promise<Cobro[]> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .gte("fecha_cobro", hoy.toISOString())
    .lt("fecha_cobro", manana.toISOString())
    .eq("estado", "activo")
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data;
}

/** Cobros del mes, solo activos (equivalente a getCobrosDelMes). */
export async function getCobrosDelMes(mes: number, anio: number): Promise<Cobro[]> {
  const inicioMes = new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  const finMes = new Date(anio, mes, 0, 23, 59, 59, 999);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .gte("fecha_cobro", inicioMes.toISOString())
    .lte("fecha_cobro", finMes.toISOString())
    .eq("estado", "activo")
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data;
}

/** Cobros por rango de fechas (reportes admin), solo activos. */
export async function getCobrosPorRangoFechas(desde: Date, hasta: Date): Promise<Cobro[]> {
  const inicio = new Date(desde);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(hasta);
  fin.setHours(23, 59, 59, 999);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .gte("fecha_cobro", inicio.toISOString())
    .lte("fecha_cobro", fin.toISOString())
    .eq("estado", "activo")
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data;
}

/** Variante con pagos_adicionales/pagos_diarios: para el reporte admin de resumen por rubro (ReporteResumenCobros). */
export async function getCobrosPorRangoFechasConDetalle(desde: Date, hasta: Date): Promise<CobroConDetalle[]> {
  const inicio = new Date(desde);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(hasta);
  fin.setHours(23, 59, 59, 999);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select(SELECT_CON_DETALLE)
    .gte("fecha_cobro", inicio.toISOString())
    .lte("fecha_cobro", fin.toISOString())
    .eq("estado", "activo")
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data as unknown as CobroConDetalle[];
}

/** Variante con pagos_adicionales/abonos_concepto: para pantallas que calculan rubros pendientes por mes (ej. EstadoDeCuentaCobrador). */
export async function getCobrosPorAmbulanteConDetalle(cobradorId: string): Promise<CobroConDetalle[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select(SELECT_CON_DETALLE)
    .eq("cobrador_id", cobradorId)
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data as unknown as CobroConDetalle[];
}

export async function getCobrosPorAmbulante(cobradorId: string): Promise<Cobro[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .order("fecha_cobro", { ascending: false });
  if (error) throw error;
  return data;
}

/** Incluye pagos_diarios: PagosDiarios.tsx necesita el detalle por puesto para reconstruir el estado guardado. */
export async function getCobrosDiariosPorFecha(cobradorId: string, fecha: Date): Promise<CobroConDetalle[]> {
  const inicioDia = new Date(fecha);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(fecha);
  finDia.setHours(23, 59, 59, 999);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select(SELECT_CON_DETALLE)
    .eq("cobrador_id", cobradorId)
    .eq("es_cobro_diario", true)
    .gte("fecha_cobro_dia", inicioDia.toISOString())
    .lte("fecha_cobro_dia", finDia.toISOString());
  if (error) throw error;
  return data as unknown as CobroConDetalle[];
}

/** Anula todos los cobros mensuales activos de un puesto (al desactivar locatario). */
export async function anularCobrosMensualesPorPuesto(
  cobradorId: string,
  numeroPuesto: string,
  anio: number,
  motivoAnulacion: string,
  anuladoPorId: string
): Promise<number> {
  const cobros = await getCobrosPorAmbulante(cobradorId);
  const aAnular = cobros.filter(
    (c) =>
      c.tipo_cobro === "mensual" &&
      String(c.numero_puesto) === String(numeroPuesto) &&
      c.anio === anio &&
      (c.estado ?? "activo") === "activo"
  );
  for (const c of aAnular) {
    await anularCobro(c.id, motivoAnulacion, anuladoPorId);
  }
  return aAnular.length;
}

export async function anularCobro(
  id: string,
  motivoAnulacion: string,
  anuladoPorId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cobros")
    .update({
      estado: "anulado",
      motivo_anulacion: motivoAnulacion,
      fecha_anulacion: new Date().toISOString(),
      anulado_por_id: anuladoPorId,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Estadisticas del dia: solo cobros con recibo generado (cobrado efectivamente). Sin recibo = 0. */
export async function getEstadisticasDelDia(): Promise<{ total: number; cantidad: number }> {
  const cobros = await getCobrosDelDia();
  const conRecibo = cobros.filter(
    (c) => c.recibo_generado === true && c.reporte_diario_completado !== true
  );
  const total = conRecibo.reduce((sum, c) => sum + (c.monto ?? 0), 0);
  return { total, cantidad: conRecibo.length };
}

/** Estadisticas del mes: solo cobros con recibo generado. Sin recibo = 0. */
export async function getEstadisticasDelMes(
  mes: number,
  anio: number
): Promise<{ total: number; cantidad: number }> {
  const cobros = await getCobrosDelMes(mes, anio);
  const conRecibo = cobros.filter(
    (c) => c.recibo_generado === true && c.reporte_diario_completado !== true
  );
  const total = conRecibo.reduce((sum, c) => sum + (c.monto ?? 0), 0);
  return { total, cantidad: conRecibo.length };
}
