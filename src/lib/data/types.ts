import type { Database } from "@/lib/supabase/database.types";

export type Mercado = Database["public"]["Tables"]["mercados"]["Row"];
export type Perfil = Database["public"]["Tables"]["perfiles"]["Row"];
export type Cobrador = Database["public"]["Tables"]["cobradores"]["Row"];
export type Rubro = Database["public"]["Tables"]["rubros"]["Row"];
export type Puesto = Database["public"]["Tables"]["puestos"]["Row"];
export type Cobro = Database["public"]["Tables"]["cobros"]["Row"];
export type CobroPagoAdicional =
  Database["public"]["Tables"]["cobros_pagos_adicionales"]["Row"];
export type CobroPagoDiario =
  Database["public"]["Tables"]["cobros_pagos_diarios"]["Row"];
export type CobroAbonoConcepto =
  Database["public"]["Tables"]["cobros_abonos_concepto"]["Row"];
export type CuentaPorCobrar =
  Database["public"]["Tables"]["cuentas_por_cobrar"]["Row"];
export type Abono = Database["public"]["Tables"]["abonos"]["Row"];
export type DeudaMora = Database["public"]["Tables"]["deudas_mora"]["Row"];
export type AbonoMora = Database["public"]["Tables"]["abonos_mora"]["Row"];

/** Cobro con sus tablas hijas cargadas (equivalente al documento anidado original). */
export interface CobroConDetalle extends Cobro {
  pagos_adicionales: CobroPagoAdicional[];
  pagos_diarios: CobroPagoDiario[];
  abonos_concepto: CobroAbonoConcepto[];
}

/** Clave estandar para renta mensual en cobros_abonos_concepto (portado de RUBRO_RENTA_MENSUAL). */
export const RUBRO_RENTA_MENSUAL = "Renta mensual";

/** Centinela de catalogo global de rubros (portado de RUBROS_GLOBAL_ID = 'GLOBAL'). */
export const RUBRO_GLOBAL_SENTINEL = null;
