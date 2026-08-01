import { createClient } from "@/lib/supabase/client";
import type { CierreDiario } from "@/lib/data/types";

// Cierre diario general del cobrador (mensuales + diarios juntos). Los
// totales se calculan con el mismo criterio que el reporte de resumen del
// admin (reportes/resumen-cobros): mensuales con recibo_generado=true,
// diarios con reporte_diario_completado=true - ver MIGRATION_NOTES si
// aplica. Esta tabla solo guarda el snapshot del momento del cierre.

export interface ResumenDelDia {
  totalMensual: number;
  cantidadMensual: number;
  totalDiario: number;
  cantidadDiario: number;
  totalGeneral: number;
}

function rangoDelDia(fecha: Date): { inicio: Date; fin: Date } {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { inicio, fin };
}

/** Resumen de lo cobrado en el dia por un cobrador (mensuales + diarios), para la pantalla de Cierre diario. */
export async function getResumenDelDia(cobradorId: string, fecha: Date = new Date()): Promise<ResumenDelDia> {
  const { inicio, fin } = rangoDelDia(fecha);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("tipo_cobro, es_cobro_diario, recibo_generado, reporte_diario_completado, monto")
    .eq("cobrador_id", cobradorId)
    .eq("estado", "activo")
    .gte("fecha_cobro", inicio.toISOString())
    .lt("fecha_cobro", fin.toISOString());
  if (error) throw error;

  let totalMensual = 0;
  let cantidadMensual = 0;
  let totalDiario = 0;
  let cantidadDiario = 0;

  for (const c of data) {
    if (c.es_cobro_diario) {
      if (c.reporte_diario_completado) {
        totalDiario += c.monto ?? 0;
        cantidadDiario += 1;
      }
    } else if (c.tipo_cobro === "mensual" && c.recibo_generado) {
      totalMensual += c.monto ?? 0;
      cantidadMensual += 1;
    }
  }

  return { totalMensual, cantidadMensual, totalDiario, cantidadDiario, totalGeneral: totalMensual + totalDiario };
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

/** Registra (o actualiza, si ya se habia cerrado antes hoy) el cierre del dia. */
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
        total_diario: resumen.totalDiario,
        total_general: resumen.totalGeneral,
        cantidad_mensual: resumen.cantidadMensual,
        cantidad_diario: resumen.cantidadDiario,
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
