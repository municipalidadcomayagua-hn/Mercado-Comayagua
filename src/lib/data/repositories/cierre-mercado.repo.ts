import { createClient } from "@/lib/supabase/client";
import type { CierreMercado } from "@/lib/data/types";

// Cierre de mercado: igual que "Cierre diario" (cierre-diario.repo.ts) pero
// agregado por TODOS los cobradores de un mercado en vez de uno solo, y
// confirmado por un administrador en vez de por el propio cobrador. Mismo
// criterio de datos: cobros mensuales pagados hoy (recibo_generado=true,
// fecha_cobro de hoy) + abonos de hoy (tabla `abonos`, fecha real del pago)
// - ver el comentario de getResumenDelDia para el porque de usar `abonos`.
//
// cobros.cobrador_nombre y abonos.cobrador_nombre ya guardan el nombre en
// cada fila (denormalizado), asi que agregar por cobrador no necesita un
// join con perfiles/cobradores.

function rangoDelDia(fecha: Date): { inicio: Date; fin: Date } {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

export interface ResumenCobradorDelDia {
  cobradorId: string;
  cobradorNombre: string;
  totalMensual: number;
  cantidadMensual: number;
  totalAbonos: number;
  cantidadAbonos: number;
  totalGeneral: number;
  /** Si ese cobrador ya confirmo su "Cierre diario" personal para esta fecha. */
  cerroSuDia: boolean;
}

export interface ResumenMercadoDelDia {
  cobradores: ResumenCobradorDelDia[];
  totalMensual: number;
  cantidadMensual: number;
  totalAbonos: number;
  cantidadAbonos: number;
  totalGeneral: number;
  cantidadCobradores: number;
}

/** Resumen de lo cobrado en el dia por TODOS los cobradores de un mercado, para la pantalla de Cierre de mercado. */
export async function getResumenMercadoDelDia(mercadoId: string, fecha: Date = new Date()): Promise<ResumenMercadoDelDia> {
  const { inicio, fin } = rangoDelDia(fecha);
  const fechaStr = fecha.toISOString().split("T")[0];
  const supabase = createClient();

  const [
    { data: cobros, error: cobrosError },
    { data: abonos, error: abonosError },
    { data: cierresDiarios, error: cierresError },
  ] = await Promise.all([
    supabase
      .from("cobros")
      .select("cobrador_id, cobrador_nombre, tipo_cobro, recibo_generado, monto")
      .eq("mercado_id", mercadoId)
      .eq("estado", "activo")
      .gte("fecha_cobro", inicio.toISOString())
      .lt("fecha_cobro", fin.toISOString()),
    supabase
      .from("abonos")
      .select("cobrador_id, cobrador_nombre, monto")
      .eq("mercado_id", mercadoId)
      .gte("fecha", inicio.toISOString())
      .lt("fecha", fin.toISOString()),
    supabase.from("cierres_diarios").select("cobrador_id").eq("mercado_id", mercadoId).eq("fecha", fechaStr),
  ]);
  if (cobrosError) throw cobrosError;
  if (abonosError) throw abonosError;
  if (cierresError) throw cierresError;

  const cobradoresQueCerraron = new Set((cierresDiarios ?? []).map((c) => c.cobrador_id));

  const porCobrador = new Map<string, ResumenCobradorDelDia>();
  const obtener = (cobradorId: string, nombre: string): ResumenCobradorDelDia => {
    let fila = porCobrador.get(cobradorId);
    if (!fila) {
      fila = {
        cobradorId,
        cobradorNombre: nombre || "-",
        totalMensual: 0,
        cantidadMensual: 0,
        totalAbonos: 0,
        cantidadAbonos: 0,
        totalGeneral: 0,
        cerroSuDia: cobradoresQueCerraron.has(cobradorId),
      };
      porCobrador.set(cobradorId, fila);
    }
    return fila;
  };

  for (const c of cobros) {
    if (c.tipo_cobro === "mensual" && c.recibo_generado) {
      const fila = obtener(c.cobrador_id, c.cobrador_nombre);
      fila.totalMensual += c.monto ?? 0;
      fila.cantidadMensual += 1;
    }
  }
  for (const a of abonos) {
    const fila = obtener(a.cobrador_id, a.cobrador_nombre ?? "-");
    fila.totalAbonos += a.monto ?? 0;
    fila.cantidadAbonos += 1;
  }

  const cobradoresList = Array.from(porCobrador.values());
  for (const fila of cobradoresList) fila.totalGeneral = fila.totalMensual + fila.totalAbonos;
  cobradoresList.sort((a, b) => b.totalGeneral - a.totalGeneral);

  const totalMensual = cobradoresList.reduce((s, c) => s + c.totalMensual, 0);
  const cantidadMensual = cobradoresList.reduce((s, c) => s + c.cantidadMensual, 0);
  const totalAbonos = cobradoresList.reduce((s, c) => s + c.totalAbonos, 0);
  const cantidadAbonos = cobradoresList.reduce((s, c) => s + c.cantidadAbonos, 0);

  return {
    cobradores: cobradoresList,
    totalMensual,
    cantidadMensual,
    totalAbonos,
    cantidadAbonos,
    totalGeneral: totalMensual + totalAbonos,
    cantidadCobradores: cobradoresList.length,
  };
}

/** Cierre de mercado ya registrado para ese mercado en esa fecha (si existe). */
export async function getCierreMercadoDelDia(mercadoId: string, fecha: Date = new Date()): Promise<CierreMercado | null> {
  const fechaStr = fecha.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_mercado")
    .select("*")
    .eq("mercado_id", mercadoId)
    .eq("fecha", fechaStr)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Registra (o actualiza, si ya se habia cerrado antes hoy) el cierre del mercado. */
export async function cerrarMercado(
  mercadoId: string,
  resumen: ResumenMercadoDelDia,
  cerradoPorId: string,
  cerradoPorNombre: string,
  fecha: Date = new Date()
): Promise<CierreMercado> {
  const fechaStr = fecha.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_mercado")
    .upsert(
      {
        mercado_id: mercadoId,
        fecha: fechaStr,
        total_mensual: resumen.totalMensual,
        total_abonos: resumen.totalAbonos,
        total_general: resumen.totalGeneral,
        cantidad_mensual: resumen.cantidadMensual,
        cantidad_abonos: resumen.cantidadAbonos,
        cantidad_cobradores: resumen.cantidadCobradores,
        cerrado_por_id: cerradoPorId,
        cerrado_por_nombre: cerradoPorNombre,
        cerrado_en: new Date().toISOString(),
      },
      { onConflict: "mercado_id,fecha" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export interface CierreMercadoConNombre extends CierreMercado {
  mercado_nombre: string;
}

/** Cierres de mercado en un rango de fechas, con nombre de mercado (para el reporte del admin). */
export async function getCierresMercado(desde: Date, hasta: Date): Promise<CierreMercadoConNombre[]> {
  const desdeStr = desde.toISOString().split("T")[0];
  const hastaStr = hasta.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_mercado")
    .select("*, mercados(nombre)")
    .gte("fecha", desdeStr)
    .lte("fecha", hastaStr)
    .order("fecha", { ascending: false });
  if (error) throw error;

  return (data as unknown as (CierreMercado & { mercados: { nombre: string } | null })[]).map((c) => ({
    ...c,
    mercado_nombre: c.mercados?.nombre ?? "-",
  }));
}
