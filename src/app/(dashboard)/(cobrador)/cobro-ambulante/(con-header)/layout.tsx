"use client";

import { Alert, AlertIcon, Box, VStack } from "@chakra-ui/react";
import { CobroAmbulanteHeader } from "@/components/cobrador/CobroAmbulanteHeader";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Grupo de rutas para las subvistas de /cobro-ambulante (espacios,
 * pagos-mensuales, pagos-diarios, estado-cuenta, cierre-diario): todas
 * comparten el encabezado institucional. El panel central (/cobro-ambulante,
 * fuera de este grupo) no lo muestra, igual que el original.
 *
 * Locatarios/cobros/cuentas ahora tienen alcance por mercado (compartidos
 * entre todos los cobradores de un mismo mercado, ver MIGRATION_NOTES.md),
 * asi que un cobrador sin mercado asignado no puede operar en ninguna de
 * estas 5 pantallas - se bloquea aqui con un mensaje claro en vez de dejar
 * que cada pantalla falle por su cuenta.
 */
export default function ConHeaderLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return null;

  if (user && !user.mercado_id) {
    return (
      <Box w="full" maxW="100%" overflowX="hidden">
        <VStack spacing={{ base: 5, md: 8 }} align="stretch" w="full">
          <CobroAmbulanteHeader />
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            {isAdmin
              ? "Esta sección es exclusiva de cobradores."
              : "Su usuario no tiene un mercado asignado. Solicite al administrador que lo asigne a un mercado para poder registrar locatarios y cobros."}
          </Alert>
        </VStack>
      </Box>
    );
  }

  return (
    <Box w="full" maxW="100%" overflowX="hidden">
      <VStack spacing={{ base: 5, md: 8 }} align="stretch" w="full">
        <CobroAmbulanteHeader />
        {children}
      </VStack>
    </Box>
  );
}
