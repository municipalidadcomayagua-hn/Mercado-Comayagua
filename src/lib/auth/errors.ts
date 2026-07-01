/**
 * Mapeo de errores de Supabase Auth a mensajes en espanol, portado desde
 * AuthProvider.login del original (que mapeaba codigos de Firebase Auth).
 *
 * Diferencia de plataforma (documentada, no corregible): Firebase distinguia
 * "auth/wrong-password" de "auth/user-not-found"; Supabase, por diseno
 * anti-enumeracion de usuarios, devuelve siempre "invalid_credentials" para
 * ambos casos. No es posible mostrar "no existe una cuenta con este correo"
 * sin debilitar esa proteccion, asi que ambos casos comparten un mensaje.
 */
export function mapAuthError(error: unknown): string {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo.";
  }

  const code = (error as { code?: string } | undefined)?.code;

  if (code === "invalid_credentials") {
    return "Correo o contraseña incorrectos.";
  }
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return "Demasiados intentos. Espera un momento e intenta de nuevo.";
  }
  if (code === "email_not_confirmed") {
    return "Debes confirmar tu correo antes de iniciar sesión.";
  }

  return "No se pudo iniciar sesión. Intenta de nuevo.";
}
