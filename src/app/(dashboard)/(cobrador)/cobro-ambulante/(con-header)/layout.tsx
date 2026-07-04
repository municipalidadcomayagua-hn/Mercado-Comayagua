"use client";

import { Box, VStack } from "@chakra-ui/react";
import { CobroAmbulanteHeader } from "@/components/cobrador/CobroAmbulanteHeader";

/**
 * Grupo de rutas para las 4 subvistas de /cobro-ambulante (espacios,
 * pagos-mensuales, pagos-diarios, estado-cuenta): todas comparten el
 * encabezado institucional. El panel central (/cobro-ambulante, fuera de
 * este grupo) no lo muestra, igual que el original.
 */
export default function ConHeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box w="full" maxW="100%" overflowX="hidden">
      <VStack spacing={{ base: 5, md: 8 }} align="stretch" w="full">
        <CobroAmbulanteHeader />
        {children}
      </VStack>
    </Box>
  );
}
