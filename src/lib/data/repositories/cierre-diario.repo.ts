import { createClient } from "@/lib/supabase/client";
import type { CierreDiario } from "@/lib/data/types";

// Cierre diario general del cobrador. Los totales se calculan de dos
// fuentes: cobros mensuales creados y pagados el mismo dia (recibo_generado=true,
// fecha_cobro de hoy - caso de un mes que no existia y se cobro directo hoy),
// y abonos registrados hoy (tabla `abonos`, que tiene la fecha real del pago).
//
// "Pagos diarios" (grilla de 120 espacios, desconectada de los locatarios)
// se elimino - ver MIGRATION_NOTES.md. Todo pago frecuente o parcial ahora
// pasa por registrarAbono (Estado de cuenta, o el pago rapido de un mes en
// Cobros mensuales, que tambien se unifico para pasar por ahi), asi que
// `abonos.fecha` es la fuente confiable de "que se cobro hoy": a diferencia
// de `cobros.fecha_cobro` (que se fija cuando se crea la fila del mes, no
// cuando se paga), `abonos.fecha` siempre es el momento real del pago.
//
// Esta tabla (cierres_diarios) solo guarda el snapshot del momento del cierre.

export interface ResumenDelDia {
  totalMensual: number;
  cantidadMensual: number;
  totalAbonos: number;
  cantidadAbonos: number;
  totalGeneral: number;
}

function rangoDelDia(fecha: Date): { inicio: Date; fin: Date } {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

/** Resumen de lo cobrado en el dia por un cobrador (mensuales creados y pagados hoy + abonos de hoy), para la pantalla de Cierre diario. */
export async function getResumenDelDia(cobradorId: string, fecha: Date = new Date()): Promise<ResumenDelDia> {
  const { inicio, fin } = rangoDelDia(fecha);
  const supabase = createClient();

  const [{ data: cobros, error: cobrosError }, { data: abonos, error: abonosError }] = await Promise.all([
    supabase
      .from("cobros")
      .select("tipo_cobro, recibo_generado, monto")
      .eq("cobrador_id", cobradorId)
      .eq("estado", "activo")
      .gte("fecha_cobro", inicio.toISOString())
      .lt("fecha_cobro", fin.toISOString()),
    supabase
      .from("abonos")
      .select("monto")
      .eq("cobrador_id", cobradorId)
      .gte("fecha", inicio.toISOString())
      .lt("fecha", fin.toISOString()),
  ]);
  if (cobrosError) throw cobrosError;
  if (abonosError) throw abonosError;

  let totalMensual = 0;
  let cantidadMensual = 0;
  for (const c of cobros) {
    if (c.tipo_cobro === "mensual" && c.recibo_generado) {
      totalMensual += c.monto ?? 0;
      cantidadMensual += 1;
    }
  }

  const totalAbonos = abonos.reduce((s, a) => s + (a.monto ?? 0), 0);
  const cantidadAbonos = abonos.length;

  return { totalMensual, cantidadMensual, totalAbonos, cantidadAbonos, totalGeneral: totalMensual + totalAbonos };
}

/** Cierre ya registrado para ese cobrador en esa fecha (si existe). */
export async function getCierreDelDia(cobradorId: string, fecha: Date = new Date()): Promise<CierreDiario | null> {
  const fechaStr = fecha.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_diarios")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("fecha", fechaStr)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Registra (o actualiza, si ya se habia cerrado antes hoy) el cierre del dia.
 * Las columnas `total_diario`/`cantidad_diario` de `cierres_diarios` se
 * conservan tal cual (evita una migracion) pero ahora guardan el total/
 * cantidad de abonos del dia, no de "Pagos diarios" (eliminado) - ver
 * MIGRATION_NOTES.md.
 */
export async function cerrarDia(
  cobradorId: string,
  mercadoId: string | null,
  resumen: ResumenDelDia,
  fecha: Date = new Date()
): Promise<CierreDiario> {
  const fechaStr = fecha.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_diarios")
    .upsert(
      {
        cobrador_id: cobradorId,
        mercado_id: mercadoId,
        fecha: fechaStr,
        total_mensual: resumen.totalMensual,
        total_diario: resumen.totalAbonos,
        total_general: resumen.totalGeneral,
        cantidad_mensual: resumen.cantidadMensual,
        cantidad_diario: resumen.cantidadAbonos,
        cerrado_en: new Date().toISOString(),
      },
      { onConflict: "cobrador_id,fecha" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export interface CierreDiarioConNombres extends CierreDiario {
  cobrador_nombre: string;
  mercado_nombre: string | null;
}

/** Cierres diarios en un rango de fechas, con nombre de cobrador y mercado (para el reporte del admin). */
export async function getCierresDiarios(desde: Date, hasta: Date): Promise<CierreDiarioConNombres[]> {
  const desdeStr = desde.toISOString().split("T")[0];
  const hastaStr = hasta.toISOString().split("T")[0];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cierres_diarios")
    .select("*, perfiles(nombre), mercados(nombre)")
    .gte("fecha", desdeStr)
    .lte("fecha", hastaStr)
    .order("fecha", { ascending: false });
  if (error) throw error;

  return (data as unknown as (CierreDiario & { perfiles: { nombre: string } | null; mercados: { nombre: string } | null })[]).map((c) => ({
    ...c,
    cobrador_nombre: c.perfiles?.nombre ?? "-",
    mercado_nombre: c.mercados?.nombre ?? null,
  }));
}
