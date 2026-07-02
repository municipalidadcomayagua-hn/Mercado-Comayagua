import { createClient } from "@/lib/supabase/client";
import { getRubrosGlobales } from "./rubros.repo";
import { getPuestosPorAmbulante } from "./puestos.repo";
import type { Rubro } from "@/lib/data/types";

// Puerto de src/services/cierreAnualService.ts original.
//
// Cambio de plataforma (no de logica): el original agrupaba las escrituras
// de `cobros` en lotes de 500 (limite de writeBatch de Firestore). Postgres
// no tiene esa limitacion, asi que el marcado final se hace con un solo
// UPDATE ... WHERE en vez de batches - mismo resultado, sin la restriccion
// que motivaba el chunking.

/** Encuentra el rubro Mora que corresponda al concepto (ej: "Renta mensual" -> "Renta mensual en mora"). */
function encontrarRubroMora(rubrosMora: Rubro[], conceptoBase: string): Rubro | null {
  const base = conceptoBase.trim().toLowerCase();
  if (!base) return null;
  const match = rubrosMora.find((r) => {
    const c = (r.concepto || "").toLowerCase();
    return c.includes(base) || c.replace(" en mora", "").trim() === base;
  });
  return match ?? null;
}

/** Extrae el concepto del formato "01. Renta mensual" o "Renta mensual". */
function extraerConcepto(conceptoStr: string): string {
  const idx = conceptoStr.indexOf(". ");
  return idx >= 0 ? conceptoStr.slice(idx + 2).trim() : conceptoStr.trim();
}

export interface ResultadoCierreAnual {
  cobrosMarcados: number;
  deudasMoraCreadas: number;
  puestosActualizados: number;
  errores: string[];
}

interface CobroPendienteRow {
  id: string;
  cobrador_id: string;
  numero_puesto: string;
  nombre_cliente: string | null;
  renta_mensual: number | null;
  estado: string;
}

interface AgregadoMora {
  monto: number;
  rubro: Rubro;
  cobradorId: string;
  numeroPuesto: string;
  nombreCliente: string;
}

/** Ejecuta el cierre anual: transfiere la deuda pendiente del anio a deudas_mora por rubro. */
export async function ejecutarCierreAnual(anio: number): Promise<ResultadoCierreAnual> {
  const errores: string[] = [];
  let deudasMoraCreadas = 0;
  const puestosConMora = new Set<string>();
  const supabase = createClient();

  const rubrosCatalogo = await getRubrosGlobales();
  const rubrosMora = rubrosCatalogo.filter((r) => (r.tipo_rubro ?? "vigente") === "mora");
  if (rubrosMora.length === 0) {
    errores.push(
      'Configure al menos un rubro tipo "Mora" en el catálogo (ej: Renta mensual en mora, Energía en mora).'
    );
    return { cobrosMarcados: 0, deudasMoraCreadas: 0, puestosActualizados: 0, errores };
  }

  const rubroRentaMora =
    rubrosMora.find((r) => (r.concepto || "").toLowerCase().includes("renta")) ?? rubrosMora[0];

  const { data: cobrosRaw, error: cobrosError } = await supabase
    .from("cobros")
    .select("id, cobrador_id, numero_puesto, nombre_cliente, renta_mensual, estado, pagos_adicionales:cobros_pagos_adicionales(concepto, monto)")
    .eq("tipo_cobro", "mensual")
    .eq("anio", anio)
    .eq("recibo_generado", false);
  if (cobrosError) throw cobrosError;

  const cobrosPendientes = (cobrosRaw ?? []).filter((c) => c.estado !== "anulado") as (CobroPendienteRow & {
    pagos_adicionales: { concepto: string; monto: number }[];
  })[];

  if (cobrosPendientes.length === 0) {
    return { cobrosMarcados: 0, deudasMoraCreadas: 0, puestosActualizados: 0, errores };
  }

  // Agregar por (cobradorId, numeroPuesto, rubroId) -> monto.
  const agregadoPorRubro: Record<string, AgregadoMora> = {};

  for (const cobro of cobrosPendientes) {
    const cobradorId = cobro.cobrador_id;
    const numeroPuesto = String(cobro.numero_puesto ?? "");
    const nombreCliente = cobro.nombre_cliente ?? "";

    const rentaMensual = cobro.renta_mensual ?? 0;
    if (rentaMensual > 0) {
      const key = `${cobradorId}|${numeroPuesto}|${rubroRentaMora.id}`;
      if (!agregadoPorRubro[key]) {
        agregadoPorRubro[key] = { monto: 0, rubro: rubroRentaMora, cobradorId, numeroPuesto, nombreCliente };
      }
      agregadoPorRubro[key].monto += rentaMensual;
    }

    for (const pa of cobro.pagos_adicionales ?? []) {
      const conceptoStr = String(pa.concepto ?? "");
      const monto = typeof pa.monto === "number" ? pa.monto : parseFloat(String(pa.monto)) || 0;
      if (monto <= 0) continue;
      const conceptoBase = extraerConcepto(conceptoStr);
      const rubroMora = conceptoBase ? encontrarRubroMora(rubrosMora, conceptoBase) : rubroRentaMora;
      const rubro = rubroMora ?? rubroRentaMora;
      const key = `${cobradorId}|${numeroPuesto}|${rubro.id}`;
      if (!agregadoPorRubro[key]) {
        agregadoPorRubro[key] = { monto: 0, rubro, cobradorId, numeroPuesto, nombreCliente };
      }
      agregadoPorRubro[key].monto += monto;
    }
  }

  const puestosPorCobrador: Record<string, { id: string; numero_puesto: string }[]> = {};
  const obtenerPuestoId = async (cobradorId: string, numeroPuesto: string): Promise<string | null> => {
    if (!puestosPorCobrador[cobradorId]) {
      const list = await getPuestosPorAmbulante(cobradorId, anio);
      puestosPorCobrador[cobradorId] = list.map((p) => ({ id: p.id, numero_puesto: p.numero_puesto }));
    }
    const p = puestosPorCobrador[cobradorId].find((x) => x.numero_puesto === numeroPuesto);
    return p?.id ?? null;
  };

  for (const key of Object.keys(agregadoPorRubro)) {
    const item = agregadoPorRubro[key];
    if (item.monto <= 0) continue;
    const puestoId = await obtenerPuestoId(item.cobradorId, item.numeroPuesto);
    if (!puestoId) {
      errores.push(`Puesto no encontrado: ${item.numeroPuesto} (cobrador ${item.cobradorId})`);
      continue;
    }

    const { data: deudasExistentes, error: deudasError } = await supabase
      .from("deudas_mora")
      .select("*")
      .eq("puesto_id", puestoId)
      .eq("rubro_id", item.rubro.id);
    if (deudasError) throw deudasError;

    if (!deudasExistentes || deudasExistentes.length === 0) {
      const { error: insertError } = await supabase.from("deudas_mora").insert({
        puesto_id: puestoId,
        cobrador_id: item.cobradorId,
        numero_puesto: item.numeroPuesto,
        nombre_cliente: item.nombreCliente,
        rubro_id: item.rubro.id,
        rubro_codigo: item.rubro.codigo,
        rubro_concepto: item.rubro.concepto,
        tipo_rubro: "mora",
        monto_total: item.monto,
        descripcion: `Mora año ${anio} - transferido por cierre anual`,
        total_abonado: 0,
        saldo_pendiente: item.monto,
      });
      if (insertError) throw insertError;
      deudasMoraCreadas++;
    } else {
      const existente = deudasExistentes[0];
      const montoTotalNuevo = (existente.monto_total ?? 0) + item.monto;
      const totalAbonado = existente.total_abonado ?? 0;
      const saldoPendiente = Math.max(0, montoTotalNuevo - totalAbonado);
      const { error: updateError } = await supabase
        .from("deudas_mora")
        .update({
          monto_total: montoTotalNuevo,
          saldo_pendiente: saldoPendiente,
          descripcion: [existente.descripcion, `Mora año ${anio}`].filter(Boolean).join("; "),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id);
      if (updateError) throw updateError;
    }
    puestosConMora.add(puestoId);
  }

  const { error: marcarError, count } = await supabase
    .from("cobros")
    .update(
      {
        estado_cargo: "en_mora",
        tipo_pago: "mora",
        actualizado_cierre_anual: new Date().toISOString(),
      },
      { count: "exact" }
    )
    .eq("tipo_cobro", "mensual")
    .eq("anio", anio)
    .eq("recibo_generado", false)
    .neq("estado", "anulado");
  if (marcarError) throw marcarError;
  const cobrosMarcados = count ?? cobrosPendientes.length;

  for (const puestoId of puestosConMora) {
    const { error } = await supabase.from("puestos").update({ en_mora: true }).eq("id", puestoId);
    if (error) throw error;
  }

  return {
    cobrosMarcados,
    deudasMoraCreadas,
    puestosActualizados: puestosConMora.size,
    errores,
  };
}

/** Conteo de cobros pendientes que serian afectados por el cierre anual. */
export async function getCobrosPendientesParaCierre(anio: number): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cobros")
    .select("id, estado")
    .eq("tipo_cobro", "mensual")
    .eq("anio", anio)
    .eq("recibo_generado", false);
  if (error) throw error;
  return data.filter((d) => d.estado !== "anulado").length;
}
