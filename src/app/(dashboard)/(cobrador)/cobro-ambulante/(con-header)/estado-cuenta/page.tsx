"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import EstadoDeCuentaCobrador from "@/components/cobrador/EstadoDeCuentaCobrador";

export default function EstadoCuentaPage() {
  const { user, mercadoNombre } = useAuth();

  if (!user) return null;

  return (
    <EstadoDeCuentaCobrador
      cobradorId={user.id}
      cobradorNombre={user.nombre}
      mercadoNombre={mercadoNombre}
      mercadoId={user.mercado_id}
    />
  );
}
