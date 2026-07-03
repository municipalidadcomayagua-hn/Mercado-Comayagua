/** Formato correlativo de recibo: 01, 02, 03, ... 10, 11 (siempre al menos 2 dígitos) */
export function formatNumeroRecibo(numero: number | null | undefined): string {
  if (numero == null || Number.isNaN(numero)) return "N/A";
  return String(Math.floor(numero)).padStart(2, "0");
}
