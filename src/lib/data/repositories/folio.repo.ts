import { createClient } from "@/lib/supabase/client";

/**
 * Folio de recibo compartido entre cobros/abonos/abonos_mora, atomico por
 * mercado (o global si mercadoId es null). Reemplaza el esquema original de
 * "leer el maximo de 2-3 colecciones y sumar 1" (con condicion de carrera,
 * ver MIGRATION_NOTES.md seccion 6.C y 8.1) por el RPC siguiente_numero_recibo
 * (supabase/migrations/0001_esquema.sql), que produce el mismo resultado de
 * negocio de forma atomica.
 */
export async function siguienteNumeroRecibo(mercadoId?: string | null): Promise<number> {
  const supabase = createClient();
  // El tipo generado marca p_mercado_id como `string` no-nulable porque el
  // generador de tipos no expresa la nulabilidad de parametros de funciones
  // SQL; en runtime el RPC acepta NULL sin problema (ver 0001_esquema.sql).
  const { data, error } = await supabase.rpc("siguiente_numero_recibo", {
    p_mercado_id: (mercadoId ?? null) as string,
  });
  if (error) throw error;
  return data;
}
