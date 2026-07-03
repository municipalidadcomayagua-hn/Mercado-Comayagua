"use client";

import { Box, VStack, HStack, Text, Divider } from "@chakra-ui/react";
import { buildReceiptLines } from "@/lib/print/bluetoothThermalPrint";
import { downloadReciboHtml } from "@/lib/print/downloadReciboHtml";
import { formatNumeroRecibo } from "@/lib/print/formatNumeroRecibo";
import { numeroATexto } from "@/lib/print/numeroATexto";
import { ReciboContainer } from "./ReciboContainer";
import { ReciboHeader } from "./ReciboHeader";
import BotonesImpresionRecibo from "./BotonesImpresionRecibo";
import type { ResultadoRegistroAbonoMora } from "@/lib/data/repositories/mora.repo";

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReciboAbonoMoraProps {
  resultado: ResultadoRegistroAbonoMora;
  mercadoNombre?: string | null;
  onClose?: () => void;
}

/** Recibo de abono a deuda en mora (puerto de ReciboAbonoMora.tsx original). */
export default function ReciboAbonoMora({ resultado, mercadoNombre, onClose }: ReciboAbonoMoraProps) {
  const fechaFormateada = resultado.fecha.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const getReceiptLinesForBluetooth = (): string[] => {
    const mercado = mercadoNombre ? mercadoNombre : "Mercado Municipal";
    return buildReceiptLines(({ center, left }) => [
      "",
      center("MUNICIPALIDAD DE COMAYAGUA"),
      center("RECIBO COBRO MERCADOS"),
      center(mercado + " - RECIBO ABONO MORA"),
      "",
      `Fecha: ${fechaFormateada}   Recibo: ${formatNumeroRecibo(resultado.numeroRecibo)}`,
      "--------------------------------",
      `Contribuyente: ${left(resultado.nombreCliente)}`,
      `Nº Puesto: ${resultado.numeroPuesto}`,
      `Rubro: ${left(resultado.rubroConcepto)} (Tipo: MORA)`,
      `Monto abonado: ${formatCurrency(resultado.monto)}`,
      `Saldo pendiente: ${formatCurrency(resultado.saldoPendienteDespues)}`,
      `Registrado por: ${left(resultado.usuarioNombre)}`,
      "--------------------------------",
      center("Recibo de abono a deuda en mora"),
      "",
    ]);
  };

  const handleDescargar = () =>
    downloadReciboHtml({
      contentId: "recibo-abono-mora-content",
      title: `Recibo Abono Mora ${formatNumeroRecibo(resultado.numeroRecibo)} - Puesto ${resultado.numeroPuesto}`,
      filename: `Recibo-Abono-Mora-${formatNumeroRecibo(resultado.numeroRecibo)}-Puesto-${resultado.numeroPuesto}-${fechaFormateada.replace(/\//g, "-")}.html`,
    });

  return (
    <ReciboContainer id="recibo-abono-mora-content">
      <ReciboHeader
        subtitulo={`${mercadoNombre ? `Mercado: ${mercadoNombre}` : "Mercado Municipal"} – RECIBO ABONO A DEUDA EN MORA`}
        fecha={fechaFormateada}
        numeroRecibo={resultado.numeroRecibo}
      />

      <Divider />

      <VStack spacing={2} align="stretch" fontSize="sm">
        <HStack>
          <Text fontWeight="bold" minW="140px">Contribuyente:</Text>
          <Text>{resultado.nombreCliente}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="140px">Nº Puesto:</Text>
          <Text fontWeight="bold" color="blue.600">{resultado.numeroPuesto}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="140px">Rubro:</Text>
          <Text>
            {resultado.rubroConcepto} —{" "}
            <Text as="span" color="orange.600" fontWeight="bold">
              Tipo: MORA
            </Text>
          </Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="140px">Monto abonado:</Text>
          <Text fontWeight="bold" color="green.600">{formatCurrency(resultado.monto)}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="140px">Saldo pendiente:</Text>
          <Text fontWeight="bold" color="orange.600">{formatCurrency(resultado.saldoPendienteDespues)}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="140px">Registrado por:</Text>
          <Text>{resultado.usuarioNombre}</Text>
        </HStack>
      </VStack>

      <Divider />

      <Box mt={4}>
        <Text fontSize="md" fontWeight="bold" mb={2}>
          TOTAL ABONADO: {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text fontSize="sm" fontWeight="medium" textTransform="uppercase" color="gray.700">
          {numeroATexto(resultado.monto)}
        </Text>
      </Box>

      <Box mt={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" fontWeight="medium" textAlign="center">
          RECIBO DE ABONO A DEUDA EN MORA – {fechaFormateada} – PUESTO {resultado.numeroPuesto} – HNL.{" "}
          {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text fontSize="xs" color="gray.500" textAlign="center" mt={2}>
          Este recibo certifica el abono registrado a la deuda en mora del locatario.
        </Text>
      </Box>

      <BotonesImpresionRecibo getReceiptLinesForBluetooth={getReceiptLinesForBluetooth} onDescargar={handleDescargar} onClose={onClose} />
    </ReciboContainer>
  );
}
