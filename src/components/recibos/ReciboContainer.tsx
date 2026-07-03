"use client";

import { Box, VStack } from "@chakra-ui/react";

/** Contenedor compartido por los 5 componentes de recibo (mismo wrapper del original). */
export function ReciboContainer({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      id={id}
      className="recibo-termico recibo-con-marca"
      bg="white"
      p={{ base: 4, md: 8 }}
      maxW="800px"
      mx="auto"
      borderWidth="1px"
      borderRadius="md"
      boxShadow="lg"
      sx={{
        "@media print": {
          boxShadow: "none",
          border: "none",
        },
      }}
    >
      <VStack spacing={4} align="stretch">
        {children}
      </VStack>
      <style>{`
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>
    </Box>
  );
}
