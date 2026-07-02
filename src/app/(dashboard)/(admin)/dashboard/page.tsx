"use client";

import { Box, Heading, Text, VStack } from "@chakra-ui/react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Placeholder temporal para probar el flujo de auth/layout de punta a
// punta. El contenido real (stats, modulos, reset de base de datos) se
// porta en la siguiente etapa (pantallas de administracion).
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="lg" color="gray.800" fontWeight="800">
          Panel
        </Heading>
        <Text color="gray.500" mt={1}>
          Municipalidad de Comayagua — Mercado Municipal San Antonio
        </Text>
      </Box>

      <Box
        bg="white"
        borderRadius="2xl"
        boxShadow="md"
        border="1px solid"
        borderColor="gray.100"
        p={8}
      >
        <Heading size="md" color="blue.600" mb={2}>
          Bienvenido, {user?.nombre ?? user?.email}
        </Heading>
        <Text color="gray.500">
          El contenido del panel (estadísticas, módulos de gestión) se construye
          en la siguiente etapa de la migración.
        </Text>
      </Box>
    </VStack>
  );
}
