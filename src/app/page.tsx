import { Box, Heading, Text } from "@chakra-ui/react";

// Placeholder temporal: la redireccion real por rol (getDefaultRoute) se
// implementa en middleware.ts (Fase 3) + auth (Fase 4).
export default function Home() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
      <Box textAlign="center">
        <Heading size="lg" color="blue.600">
          Municipalidad de Comayagua
        </Heading>
        <Text mt={2} color="gray.600">
          Mercado Municipal San Antonio — Sistema de Cobro
        </Text>
      </Box>
    </Box>
  );
}
