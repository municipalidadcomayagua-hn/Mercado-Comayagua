"use client";

import { Badge, Box, Heading, Text, VStack } from "@chakra-ui/react";
import { useAuth } from "@/lib/auth/AuthProvider";

/** Encabezado institucional compartido por las 4 subvistas de /cobro-ambulante (puerto del bloque homónimo en CobroAmbulante.tsx original). */
export function CobroAmbulanteHeader() {
  const { mercadoNombre } = useAuth();

  return (
    <Box
      textAlign="center"
      py={{ base: 5, md: 7 }}
      px={4}
      mb={{ base: 5, md: 6 }}
      w="full"
      borderRadius="2xl"
      borderWidth="1px"
      borderColor="blue.100"
      bgGradient="linear(to-br, blue.50, white)"
      boxShadow="0 4px 24px -4px rgba(0,0,0,0.06)"
    >
      <VStack spacing={2}>
        <Heading size={{ base: "md", sm: "lg", md: "xl", lg: "2xl" }} color="blue.700" fontWeight="800">
          Municipalidad de Comayagua
        </Heading>
        <Text fontSize={{ base: "sm", md: "md", lg: "lg" }} color="gray.700">
          {mercadoNombre || "Mercado Municipal"}
        </Text>
        {mercadoNombre && (
          <Badge colorScheme="teal" fontSize="0.65rem">
            Mercado asignado a su usuario
          </Badge>
        )}
        <Heading size={{ base: "md", md: "lg", lg: "xl" }} color="blue.800" fontWeight="bold" fontFamily="serif" pt={2} borderTopWidth="1px" borderColor="blue.100" mt={1}>
          Tarjeta de Cobro
        </Heading>
      </VStack>
    </Box>
  );
}
