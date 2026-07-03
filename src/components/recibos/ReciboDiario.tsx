"use client";

import { Box, VStack, HStack, Text, Divider } from "@chakra-ui/react";
import { numeroATexto } from "@/lib/print/numeroATexto";
import { formatNumeroRecibo } from "@/lib/print/formatNumeroRecibo";
import { buildReceiptLines } from "@/lib/print/bluetoothThermalPrint";
import { downloadReciboHtml } from "@/lib/print/downloadReciboHtml";
import { ReciboContainer } from "./ReciboContainer";
import { ReciboHeader } from "./ReciboHeader";
import BotonesImpresionRecibo from "./BotonesImpresionRecibo";
import type { CobroConDetalle, Puesto } from "@/lib/data/types";

interface ReciboDiarioProps {
  cobro: CobroConDetalle;
  puesto?: Puesto | null;
  mercadoNombre?: string | null;
  onClose?: () => void;
}

const money = (n: number) => n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recibo de cobro diario individual (puerto de ReciboDiario.tsx original). */
export default function ReciboDiario({ cobro, puesto, mercadoNombre, onClose }: ReciboDiarioProps) {
  const fechaCobro = cobro.fecha_cobro_dia ? new Date(cobro.fecha_cobro_dia) : new Date(cobro.fecha_cobro);
  const fechaFormateada = fechaCobro.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const montoTotal = cobro.monto || 0;
  const codigoPuesto = puesto?.codigo || cobro.numero_puesto || "N/A";

  const getReceiptLinesForBluetooth = (): string[] => {
    const mercado = mercadoNombre ? mercadoNombre : "Mercado Municipal";
    return buildReceiptLines(({ center, left }) => [
      "",
      center("MUNICIPALIDAD DE COMAYAGUA"),
      center("RECIBO COBRO MERCADOS"),
      center(mercado),
      "",
      `Fecha: ${fechaFormateada}   Recibo: ${formatNumeroRecibo(cobro.numero_recibo)}`,
      "--------------------------------",
      `Contribuyente: ${left(cobro.nombre_cliente || puesto?.nombre_cliente || `Puesto ${cobro.numero_puesto}`)}`,
      `Puesto: ${codigoPuesto}`,
      "--------------------------------",
      "COBRO DIARIO",
      `Puesto ${cobro.numero_puesto} - ${fechaFormateada}`,
      `Total: ${money(montoTotal)}`,
      "--------------------------------",
      `TOTAL: ${money(montoTotal)}`,
      left(numeroATexto(montoTotal)),
      "",
      center("Recibo diario - Mercado"),
      "",
    ]);
  };

  const handleDescargar = () =>
    downloadReciboHtml({
      contentId: "recibo-diario-content",
      title: `Recibo Diario ${formatNumeroRecibo(cobro.numero_recibo)}`,
      filename: `Recibo-Diario-${formatNumeroRecibo(cobro.numero_recibo)}-Puesto-${cobro.numero_puesto}-${fechaFormateada.replace(/\//g, "-")}.html`,
    });

  return (
    <ReciboContainer id="recibo-diario-content">
      <ReciboHeader
        subtitulo={mercadoNombre ? `Mercado: ${mercadoNombre}` : "Mercado Municipal"}
        fecha={fechaFormateada}
        numeroRecibo={cobro.numero_recibo}
      />

      <Divider />

      <VStack spacing={2} align="stretch" fontSize="sm">
        <HStack>
          <Text fontWeight="bold" minW="120px">
            Contribuyente:
          </Text>
          <Text>{cobro.nombre_cliente || puesto?.nombre_cliente || `Puesto ${cobro.numero_puesto}`}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">
            No. Identidad:
          </Text>
          <Text>_________________</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">
            RTN:
          </Text>
          <Text>_________________</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">
            Puesto:
          </Text>
          <Text fontWeight="bold" color="blue.600">
            {cobro.numero_puesto}
          </Text>
        </HStack>
        {(puesto?.codigo || codigoPuesto !== cobro.numero_puesto) && (
          <HStack>
            <Text fontWeight="bold" minW="120px">
              Código Puesto:
            </Text>
            <Text fontWeight="bold" color="blue.600">
              {codigoPuesto}
            </Text>
          </HStack>
        )}
      </VStack>

      <Divider />

      <Box className="recibo-tabla-wrapper">
        <Box as="table" className="recibo-tabla recibo-tabla-5" width="100%" border="1px solid" borderColor="gray.300">
          <Box as="thead" bg="gray.100">
            <Box as="tr">
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs" fontWeight="bold">
                Código
              </Box>
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="left" fontSize="xs" fontWeight="bold" className="col-desc">
                Descripción
              </Box>
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs" fontWeight="bold">
                Unidad
              </Box>
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                Valor Unit.
              </Box>
              <Box as="th" p={2} textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                Total
              </Box>
            </Box>
          </Box>
          <Box as="tbody">
            <Box as="tr">
              <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                {codigoPuesto}
              </Box>
              <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" fontSize="xs" className="col-desc">
                COBRO DIARIO - PUESTO {cobro.numero_puesto} - {fechaFormateada}
              </Box>
              <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                1.00
              </Box>
              <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" className="col-numeric">
                {money(montoTotal)}
              </Box>
              <Box as="td" p={2} borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                {money(montoTotal)}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box mt={4}>
        <Text fontSize="md" fontWeight="bold" mb={2}>
          TOTAL A PAGAR: {money(montoTotal)}
        </Text>
        <Text fontSize="sm" fontWeight="medium" textTransform="uppercase" color="gray.700">
          {numeroATexto(montoTotal)}
        </Text>
      </Box>

      <Box mt={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" fontWeight="medium" textAlign="center">
          COBRO DIARIO {fechaFormateada} - MERCADO SAN ANTONIO - PUESTO {cobro.numero_puesto} - HNL. {money(montoTotal)}***
        </Text>
      </Box>

      <BotonesImpresionRecibo getReceiptLinesForBluetooth={getReceiptLinesForBluetooth} onDescargar={handleDescargar} onClose={onClose} />
    </ReciboContainer>
  );
}
