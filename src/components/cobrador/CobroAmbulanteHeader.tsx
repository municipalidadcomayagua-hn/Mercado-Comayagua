"use client";

import { Box, Heading, Text } from "@chakra-ui/react";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Encabezado institucional compartido por las 4 subvistas de /cobro-ambulante (puerto del bloque homónimo en CobroAmbulante.tsx original). */
export function CobroAmbulanteHeader() {
  const { mercadoNombre } = useAuth();

  return (
    <Box textAlign="center" py={{ base: 3, md: 6 }} borderBottom="2px solid" borderColor="blue.500" mb={4} w="full">
      <Heading size={{ base: "md", sm: "lg", md: "xl", lg: "2xl" }} color="blue.600" mb={2} fontWeight="bold">
        Municipalidad de Comayagua
      </Heading>
      <Text fontSize={{ base: "sm", md: "md", lg: "lg" }} color="gray.700" mb={2}>
        {mercadoNombre || "Mercado Municipal"}
      </Text>
      {mercadoNombre && (
        <Text fontSize="xs" color="teal.600" fontWeight="600" mb={3}>
          Mercado asignado a su usuario
        </Text>
      )}
      <Heading size={{ base: "md", md: "lg", lg: "xl" }} color="blue.800" fontWeight="bold" fontFamily="serif">
        Tarjeta de Cobro
      </Heading>
    </Box>
  );
}
