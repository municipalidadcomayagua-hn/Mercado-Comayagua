import { createClient } from "@/lib/supabase/client";
import type { Abono, Cobro, CuentaPorCobrar } from "@/lib/data/types";
import { siguienteNumeroRecibo } from "./folio.repo";
import { getCobroById, getCobrosPorAmbulante, updateCobro } from "./cobros.repo";

// Puerto de src/services/cuentasPorCobrarService.ts original.
//
// Cambio de plataforma (no de logica): el id compuesto `${ambulanteId}_${numeroPuesto}`
// del original se reemplaza por la constraint UNIQUE(cobrador_id, numero_puesto) del
// esquema relacional (MIGRATION_NOTES.md seccion 3.6); las consultas por esa pareja
// de columnas reemplazan la lectura por id compuesto.
//
// Nota sobre concurrencia (documentado, no corregido): igual que el original
// (lectura + escritura sin transaccion en Firestore), agregarMonto/registrarAbono
// hacen un select seguido de un update/upsert desde el cliente. El riesgo de
// carrera es el mismo que en el sistema original, no mayor ni menor.

/** Input minimo de un cobro para actualizar la cuenta (evita depender del tipo completo). */
type CobroParaCuenta = Pick<
  Cobro,
  "cobrador_id" | "numero_puesto" | "monto" | "nombre_cliente" | "mes" | "anio" | "fecha_cobro_dia" | "es_cobro_diario" | "reporte_diario_completado"
>;

async function agregarMonto(
  cobradorId: string,
  numeroPuesto: string,
  monto: number,
  nombreClienteParam: string | null | undefined,
  cobro: Pick<CobroParaCuenta, "mes" | "anio" | "fecha_cobro_dia" | "nombre_cliente">
): Promise<void> {
  const supabase = createClient();
  const { data: existente } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .maybeSingle();

  const ahora = new Date();
  let montoTotal = monto;
  let totalAbonado = 0;
  let nombre = nombreClienteParam ?? cobro.nombre_cliente ?? null;

  if (existente) {
    montoTotal = (existente.monto_total ?? 0) + monto;
    totalAbonado = existente.total_abonado ?? 0;
    if (!nombre && existente.nombre_cliente) nombre = existente.nombre_cliente;
  }

  const saldoPendiente = Math.max(0, montoTotal - totalAbonado);
  let fechaVencimiento: string | null = null;
  let ultimaFechaCobro = ahora;

  // Fin del mes del cobro (para cobros mensuales).
  if (cobro.mes && cobro.anio) {
    fechaVencimiento = new Date(cobro.anio, cobro.mes, 0, 23, 59, 59).toISOString();
  } else if (cobro.fecha_cobro_dia) {
    // Para cobro diario: vence el mismo dia (desde el dia siguiente ya esta atrasado).
    const f = new Date(cobro.fecha_cobro_dia);
    ultimaFechaCobro = f;
    fechaVencimiento = new Date(
      f.getFullYear(),
      f.getMonth(),
      f.getDate(),
      23,
      59,
      59,
      999
    ).toISOString();
  }

  if (existente?.ultima_fecha_cobro) {
    const existenteFecha = new Date(existente.ultima_fecha_cobro);
    if (existenteFecha > ultimaFechaCobro) ultimaFechaCobro = existenteFecha;
  }

  const estado: "al_dia" | "saldado" = saldoPendiente <= 0 ? "saldado" : "al_dia";

  const { error } = await supabase.from("cuentas_por_cobrar").upsert(
    {
      cobrador_id: cobradorId,
      numero_puesto: numeroPuesto,
      nombre_cliente: nombre,
      monto_total: montoTotal,
      total_abonado: totalAbonado,
      saldo_pendiente: saldoPendiente,
      ultima_fecha_cobro: ultimaFechaCobro.toISOString(),
      fecha_vencimiento: fechaVencimiento,
      estado,
      ultima_fecha_abono: existente?.ultima_fecha_abono ?? null,
      updated_at: ahora.toISOString(),
    },
    { onConflict: "cobrador_id,numero_puesto" }
  );
  if (error) throw error;
}

/**
 * Actualiza/crea la cuenta por cobrar cuando se registra un cobro (solo
 * mensual; los diarios no se reflejan en estado de cuenta).
 *
 * Nota: el original tenia un branch para sumar pagosDiarios[] que era
 * inalcanzable (habia un `if (esCobroDiario) return` justo antes), dejado
 * como codigo muerto de una version anterior. Se omite aqui porque el
 * comportamiento observable siempre fue "los cobros diarios no afectan
 * cuentas_por_cobrar" (documentado en el propio comentario original).
 */
export async function actualizarCuentaDesdeCobro(cobro: CobroParaCuenta): Promise<void> {
  if (cobro.reporte_diario_completado === true) return;
  if (cobro.es_cobro_diario === true) return;

  await agregarMonto(cobro.cobrador_id, cobro.numero_puesto, cobro.monto, cobro.nombre_cliente, cobro);
}

/** Suma un monto a una cuenta sin pasar por un cobro (para lotes creados en paralelo). */
export async function sumarMontoACuenta(
  cobradorId: string,
  numeroPuesto: string,
  monto: number,
  nombreCliente?: string | null
): Promise<void> {
  const supabase = createClient();
  const { data: existente } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .maybeSingle();

  const ahora = new Date().toISOString();

  if (!existente) {
    const { error } = await supabase.from("cuentas_por_cobrar").insert({
      cobrador_id: cobradorId,
      numero_puesto: numeroPuesto,
      nombre_cliente: nombreCliente ?? null,
      monto_total: monto,
      total_abonado: 0,
      saldo_pendiente: monto,
      ultima_fecha_cobro: ahora,
      fecha_vencimiento: null,
      estado: "al_dia",
    });
    if (error) throw error;
    return;
  }

  const montoTotal = (existente.monto_total ?? 0) + monto;
  const totalAbonado = existente.total_abonado ?? 0;
  const saldoPendiente = Math.max(0, montoTotal - totalAbonado);
  const estado: CuentaPorCobrar["estado"] = saldoPendiente <= 0 ? "saldado" : existente.estado ?? "al_dia";

  const { error } = await supabase
    .from("cuentas_por_cobrar")
    .update({
      nombre_cliente: nombreCliente ?? existente.nombre_cliente ?? null,
      monto_total: montoTotal,
      saldo_pendiente: saldoPendiente,
      estado,
      updated_at: ahora,
    })
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto);
  if (error) throw error;
}

/** Total abonado por puesto para un anio (para que el anio siguiente empiece en 0). */
async function getTotalAbonadoPorPuestoYAnio(
  cobradorId: string,
  anio: number
): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("abonos")
    .select("numero_puesto, monto")
    .eq("cobrador_id", cobradorId)
    .eq("anio", anio);
  if (error) throw error;

  const porPuesto: Record<string, number> = {};
  for (const row of data) {
    const key = String(row.numero_puesto ?? "");
    porPuesto[key] = (porPuesto[key] ?? 0) + (row.monto ?? 0);
  }
  return porPuesto;
}

/**
 * Cuentas por cobrar de un cobrador, recalculadas: montoTotal/saldo solo por
 * meses VENCIDOS del anio actual (el mes en curso aun no cuenta como deuda),
 * y totalAbonado solo del anio actual (el anio siguiente empieza en 0).
 * Los valores guardados en la fila son un cache; esta funcion los sobreescribe
 * en memoria, igual que el original.
 */
export async function getCuentasPorAmbulante(cobradorId: string): Promise<CuentaPorCobrar[]> {
  const supabase = createClient();
  const { data: cuentas, error } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cobrador_id", cobradorId);
  if (error) throw error;

  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;

  const cobros = await getCobrosPorAmbulante(cobradorId);
  const soloMesesVencidos = cobros.filter(
    (c) =>
      c.tipo_cobro === "mensual" &&
      (c.estado ?? "activo") === "activo" &&
      c.anio === anioActual &&
      c.mes != null &&
      c.mes >= 1 &&
      c.mes < mesActual
  );

  const montoPorPuesto: Record<string, number> = {};
  for (const c of soloMesesVencidos) {
    const key = String(c.numero_puesto ?? "");
    montoPorPuesto[key] = (montoPorPuesto[key] ?? 0) + (c.monto ?? 0);
  }

  const abonadoPorPuesto = await getTotalAbonadoPorPuestoYAnio(cobradorId, anioActual);

  const listFiltrada: CuentaPorCobrar[] = [];
  for (const cuenta of cuentas) {
    const key = String(cuenta.numero_puesto);
    const montoTotalMensual = montoPorPuesto[key] ?? 0;
    if (montoTotalMensual === 0) continue; // no mostrar puestos sin cobros mensuales (solo diarios)
    const totalAbonadoAnio = abonadoPorPuesto[key] ?? 0;
    listFiltrada.push({
      ...cuenta,
      monto_total: montoTotalMensual,
      total_abonado: totalAbonadoAnio,
      saldo_pendiente: Math.max(0, montoTotalMensual - totalAbonadoAnio),
    });
  }

  listFiltrada.sort((a, b) =>
    String(a.numero_puesto).localeCompare(String(b.numero_puesto), undefined, { numeric: true })
  );
  return listFiltrada;
}

export async function getCuentaPorPuesto(
  cobradorId: string,
  numeroPuesto: string
): Promise<CuentaPorCobrar | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface RegistrarAbonoOpciones {
  meses?: number[];
  anio?: number;
  mesAplicado?: number;
  rubroAplicado?: { concepto: string };
  nombreCliente?: string;
  mercadoId?: string;
}

export interface ResultadoRegistroAbono {
  abonoId: string;
  numeroRecibo?: number;
  meses?: number[];
  anio?: number;
  mesAplicado?: number;
  rubroAplicado?: { concepto: string };
  monto: number;
  fecha: Date;
  nombreCliente?: string;
  numeroPuesto: string;
}

/**
 * Registra un abono y actualiza la cuenta. Si `meses`+`anio` se envian
 * (pagos mensuales completos), marca esos cobros como recibo generado. Si
 * `mesAplicado`+`rubroAplicado` se envian (abono parcial por concepto),
 * actualiza la tabla hija cobros_abonos_concepto del cobro de ese mes.
 */
export async function registrarAbono(
  cobradorId: string,
  numeroPuesto: string,
  monto: number,
  quienRegistraId: string,
  quienRegistraNombre?: string,
  referencia?: string,
  opciones?: RegistrarAbonoOpciones
): Promise<ResultadoRegistroAbono> {
  const supabase = createClient();
  const { data: cuenta, error: cuentaError } = await supabase
    .from("cuentas_por_cobrar")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .maybeSingle();
  if (cuentaError) throw cuentaError;
  if (!cuenta) throw new Error("No existe cuenta por cobrar para este puesto");

  const ahora = new Date();
  const totalAbonado = (cuenta.total_abonado ?? 0) + monto;
  const montoTotal = cuenta.monto_total ?? 0;
  const saldoPendiente = Math.max(0, montoTotal - totalAbonado);
  const estado: CuentaPorCobrar["estado"] = saldoPendiente <= 0 ? "saldado" : cuenta.estado ?? "al_dia";

  const meses = opciones?.meses?.length ? opciones.meses : undefined;
  const anio = opciones?.anio;

  // Siempre se asigna numeroRecibo (abonos totales o parciales generan recibo).
  const numeroRecibo = await siguienteNumeroRecibo(opciones?.mercadoId ?? null);

  if (meses?.length && anio != null) {
    const cobros = await getCobrosPorAmbulante(cobradorId);
    const cobrosAMarcar = cobros.filter(
      (c) =>
        c.tipo_cobro === "mensual" &&
        (c.estado ?? "activo") === "activo" &&
        c.numero_puesto === numeroPuesto &&
        c.anio === anio &&
        meses.includes(c.mes ?? 0) &&
        !c.recibo_generado
    );
    for (const c of cobrosAMarcar) {
      await updateCobro(c.id, { recibo_generado: true, estado_cargo: "pagado" });
    }
  }

  const mesAplicado = opciones?.mesAplicado;
  const rubroAplicado = opciones?.rubroAplicado;
  if (mesAplicado != null && anio != null && rubroAplicado?.concepto) {
    const cobros = await getCobrosPorAmbulante(cobradorId);
    const cobroMes = cobros.find(
      (c) =>
        c.tipo_cobro === "mensual" &&
        (c.estado ?? "activo") === "activo" &&
        c.numero_puesto === numeroPuesto &&
        c.anio === anio &&
        c.mes === mesAplicado &&
        !c.recibo_generado
    );
    if (cobroMes) {
      const cobroDetalle = await getCobroById(cobroMes.id);
      const abonosActuales: Record<string, number> = {};
      for (const ac of cobroDetalle?.abonos_concepto ?? []) {
        abonosActuales[ac.concepto] = ac.monto;
      }
      const concepto = rubroAplicado.concepto.trim();
      abonosActuales[concepto] = (abonosActuales[concepto] ?? 0) + monto;
      const totalAbonadoCobro = Object.values(abonosActuales).reduce((s, v) => s + v, 0);
      const reciboGenerado = totalAbonadoCobro >= (cobroMes.monto ?? 0);

      await updateCobro(cobroMes.id, {
        abonos_concepto: Object.entries(abonosActuales).map(([c, m]) => ({ concepto: c, monto: m })),
        ...(reciboGenerado && { recibo_generado: true, estado_cargo: "pagado" }),
      });
    }
  }

  const { data: abonoCreado, error: abonoError } = await supabase
    .from("abonos")
    .insert({
      cobrador_id: cobradorId,
      numero_puesto: numeroPuesto,
      monto,
      fecha: ahora.toISOString(),
      cobrador_nombre: quienRegistraNombre ?? null,
      referencia: referencia ?? null,
      numero_recibo: numeroRecibo,
      meses: meses ?? null,
      anio: anio ?? null,
      mes_aplicado: opciones?.mesAplicado ?? null,
      rubro_aplicado_concepto: opciones?.rubroAplicado?.concepto ?? null,
      mercado_id: opciones?.mercadoId?.trim() || null,
    })
    .select("id")
    .single();
  if (abonoError) throw abonoError;

  const { error: updateError } = await supabase
    .from("cuentas_por_cobrar")
    .update({
      total_abonado: totalAbonado,
      saldo_pendiente: saldoPendiente,
      ultima_fecha_abono: ahora.toISOString(),
      estado,
      updated_at: ahora.toISOString(),
    })
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto);
  if (updateError) throw updateError;

  return {
    abonoId: abonoCreado.id,
    numeroRecibo,
    meses,
    anio,
    mesAplicado: opciones?.mesAplicado,
    rubroAplicado: opciones?.rubroAplicado,
    monto,
    fecha: ahora,
    nombreCliente: opciones?.nombreCliente,
    numeroPuesto,
  };
}

export async function getAbonosPorCuenta(cobradorId: string, numeroPuesto: string): Promise<Abono[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("abonos")
    .select("*")
    .eq("cobrador_id", cobradorId)
    .eq("numero_puesto", numeroPuesto)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

/** Resumen para el cobrador: total cobrado y total pendiente (solo meses vencidos). */
export async function getResumenCobrador(
  cobradorId: string
): Promise<{ totalCobrado: number; totalPendiente: number }> {
  const cuentas = await getCuentasPorAmbulante(cobradorId);
  const totalCobrado = cuentas.reduce((s, c) => s + c.monto_total, 0);
  const totalPendiente = cuentas.reduce((s, c) => s + c.saldo_pendiente, 0);
  return { totalCobrado, totalPendiente };
}

/** Total de deuda pendiente en el sistema (solo meses vencidos sin pagar). Para el Dashboard admin. */
export async function getTotalDeudaPendienteSistema(): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.from("cuentas_por_cobrar").select("cobrador_id");
  if (error) throw error;

  const cobradorIds = new Set<string>();
  for (const row of data) {
    if (row.cobrador_id) cobradorIds.add(row.cobrador_id);
  }

  let total = 0;
  for (const cobradorId of cobradorIds) {
    const res = await getResumenCobrador(cobradorId);
    total += res.totalPendiente;
  }
  return total;
}
