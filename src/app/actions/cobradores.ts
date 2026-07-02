"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { generarCodigoCuenta } from "@/lib/data/repositories/cobradores.repo";

// Puerto de ambulantesService.createAmbulante del original. A diferencia del
// original (createUserWithEmailAndPassword desde el navegador, que hijackea
// la sesion del admin y obliga a hacer signOut despues), esto corre
// server-side con service_role y no toca la sesion de quien lo invoca.

export interface CrearCobradorInput {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  telefono?: string;
  password: string;
  mercadoId?: string | null;
}

export async function crearCobradorAction(
  input: CrearCobradorInput
): Promise<{ cobradorId: string }> {
  await requireAdmin();

  if (!input.email.endsWith("@mercado.com")) {
    throw new Error("El correo electrónico debe terminar en @mercado.com");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre: `${input.nombre} ${input.apellido}` },
  });

  if (authError || !authData.user) {
    if (authError?.code === "email_exists") {
      throw new Error("El correo electrónico ya está en uso");
    }
    throw new Error(authError?.message || "Error al crear el cobrador. Intente nuevamente.");
  }

  const userId = authData.user.id;

  try {
    // El trigger handle_new_user ya creo la fila en perfiles con rol='ambulante'
    // por defecto; la completamos y marcamos que debe cambiar la contrasena temporal.
    const { error: perfilError } = await admin
      .from("perfiles")
      .update({
        nombre: `${input.nombre} ${input.apellido}`,
        mercado_id: input.mercadoId ?? null,
        debe_cambiar_password: true,
      })
      .eq("id", userId);
    if (perfilError) throw perfilError;

    const codigoCuenta = await generarCodigoCuenta(admin);

    const { data: cobrador, error: cobradorError } = await admin
      .from("cobradores")
      .insert({
        user_id: userId,
        codigo_cuenta: codigoCuenta,
        nombre: input.nombre,
        apellido: input.apellido,
        dni: input.dni,
        telefono: input.telefono ?? null,
        email: input.email,
        estado: "activo",
        mercado_id: input.mercadoId ?? null,
      })
      .select("id")
      .single();

    if (cobradorError) throw cobradorError;

    return { cobradorId: cobrador.id };
  } catch (err) {
    // Rollback: si algo despues de crear el usuario de Auth falla, no dejar
    // una cuenta huerfana sin cobrador asociado.
    await admin.auth.admin.deleteUser(userId);
    throw err;
  }
}
