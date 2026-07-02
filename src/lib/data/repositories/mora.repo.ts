import { createClient } from "@/lib/supabase/client";
import type { AbonoMora, DeudaMora } from "@/lib/data/types";
import { siguienteNumeroRecibo } from "./folio.repo";

// Puerto de src/services/deudasMoraService.ts original.

export async function getDeudasMoraPorPuesto(puestoId: string): Promise<DeudaMora[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("deudas_mora").select("*").eq("puesto_id", puestoId);
  if (error) throw error;
  return data;
}

export async function crearDeudaMora(
  puestoId: string,
  cobradorId: string,
  numeroPuesto: string,
  nombreCliente: string,
  rubroId: string,
  rubroCodigo: string,
  rubroConcepto: string,
  montoTotal: number,
  descripcion?: string,
  mercadoId?: string
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deudas_mora")
    .insert({
      puesto_id: puestoId,
      cobrador_id: cobradorId,
      numero_puesto: numeroPuesto,
      nombre_cliente: nombreCliente,
      rubro_id: rubroId,
      rubro_codigo: rubroCodigo,
      rubro_concepto: rubroConcepto,
      tipo_rubro: "mora",
      monto_total: montoTotal,
      descripcion: descripcion?.trim() || null,
      total_abonado: 0,
      saldo_pendiente: montoTotal,
      mercado_id: mercadoId?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function getAbonosMoraPorDeuda(deudaMoraId: string): Promise<AbonoMora[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("abonos_mora")
    .select("*")
    .eq("deuda_mora_id", deudaMoraId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export interface ResultadoRegistroAbonoMora {
  abonoId: string;
  numeroRecibo: number;
  monto: number;
  fecha: Date;
  nombreCliente: string;
  numeroPuesto: string;
  rubroConcepto: string;
  saldoPendienteDespues: number;
  usuarioNombre: string;
}

/** Registra un abono a una deuda en mora y genera recibo. */
export async function registrarAbonoMora(
  deudaMoraId: string,
  monto: number,
  fecha: Date,
  usuarioId: string,
  usuarioNombre: string,
  observacion?: string,
  mercadoId?: string
): Promise<ResultadoRegistroAbonoMora> {
  const supabase = createClient();
  const { data: deuda, error: deudaError } = await supabase
    .from("deudas_mora")
    .select("*")
    .eq("id", deudaMoraId)
    .maybeSingle();
  if (deudaError) throw deudaError;
  if (!deuda) throw new Error("No existe la deuda en mora");

  const totalAbonado = (deuda.total_abonado ?? 0) + monto;
  const montoTotal = deuda.monto_total ?? 0;
  const saldoPendienteDespues = Math.max(0, montoTotal - totalAbonado);
  const numeroRecibo = await siguienteNumeroRecibo(mercadoId ?? null);
  const ahora = new Date();

  const { data: abonoCreado, error: abonoError } = await supabase
    .from("abonos_mora")
    .insert({
      deuda_mora_id: deudaMoraId,
      monto,
      fecha: fecha.toISOString(),
      observacion: observacion?.trim() || null,
      usuario_id: usuarioId,
      usuario_nombre: usuarioNombre,
      numero_recibo: numeroRecibo,
      saldo_pendiente_despues: saldoPendienteDespues,
      mercado_id: mercadoId?.trim() || null,
    })
    .select("id")
    .single();
  if (abonoError) throw abonoError;

  const { error: updateError } = await supabase
    .from("deudas_mora")
    .update({
      total_abonado: totalAbonado,
      saldo_pendiente: saldoPendienteDespues,
      updated_at: ahora.toISOString(),
    })
    .eq("id", deudaMoraId);
  if (updateError) throw updateError;

  // Si el locatario saldo todas sus deudas en mora, quitarlo de mora.
  const puestoId = deuda.puesto_id;
  if (puestoId) {
    const deudasDelPuesto = await getDeudasMoraPorPuesto(puestoId);
    const tieneSaldoPendiente = deudasDelPuesto.some((d) => d.saldo_pendiente > 0);
    if (!tieneSaldoPendiente) {
      await supabase.from("puestos").update({ en_mora: false }).eq("id", puestoId);
    }
  }

  return {
    abonoId: abonoCreado.id,
    numeroRecibo,
    monto,
    fecha,
    nombreCliente: deuda.nombre_cliente ?? "",
    numeroPuesto: deuda.numero_puesto ?? "",
    rubroConcepto: deuda.rubro_concepto ?? "",
    saldoPendienteDespues,
    usuarioNombre,
  };
}

export async function getDeudaMoraById(id: string): Promise<DeudaMora | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("deudas_mora").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
