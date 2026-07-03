"use client";

import { Box, HStack, Text } from "@chakra-ui/react";
import { formatNumeroRecibo } from "@/lib/print/formatNumeroRecibo";

/** Encabezado institucional compartido por los 5 recibos (identico en el original). */
export function ReciboHeader({
  subtitulo,
  fecha,
  numeroRecibo,
  extra,
}: {
  subtitulo: string;
  fecha: string;
  numeroRecibo?: number | null;
  /** Contenido extra a la izquierda de fecha/recibo (ej. nombre del cobrador). */
  extra?: React.ReactNode;
}) {
  return (
    <>
      <Box textAlign="center" borderBottom="2px solid" borderColor="gray.800" pb={2}>
        <Text className="recibo-termico-title" fontSize="xl" fontWeight="bold" mb={1}>
          MUNICIPALIDAD DE COMAYAGUA
        </Text>
        <Text className="recibo-termico-sub" fontSize="md" fontWeight="bold" mb={1}>
          RECIBO COBRO MERCADOS
        </Text>
        <Text className="recibo-termico-sub" fontSize="sm" fontWeight="medium">
          {subtitulo}
        </Text>
      </Box>

      <HStack justify={extra ? "space-between" : "flex-end"} fontSize="sm" flexWrap="wrap" gap={2}>
        {extra}
        <HStack spacing={4} ml={extra ? "auto" : undefined}>
          <Text>
            Fecha: <strong>{fecha}</strong>
          </Text>
          {numeroRecibo != null && (
            <Text>
              RECIBO #: <strong>{formatNumeroRecibo(numeroRecibo)}</strong>
            </Text>
          )}
        </HStack>
      </HStack>
    </>
  );
}
