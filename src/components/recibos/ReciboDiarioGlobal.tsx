"use client";

import { Box, VStack, Text, Divider } from "@chakra-ui/react";
import { numeroATexto } from "@/lib/print/numeroATexto";
import { formatNumeroRecibo } from "@/lib/print/formatNumeroRecibo";
import { buildReceiptLines } from "@/lib/print/bluetoothThermalPrint";
import { downloadReciboHtml } from "@/lib/print/downloadReciboHtml";
import { ReciboContainer } from "./ReciboContainer";
import { ReciboHeader } from "./ReciboHeader";
import BotonesImpresionRecibo from "./BotonesImpresionRecibo";

export interface ItemReciboDiario {
  numeroPuesto: number;
  monto: number;
}

interface ReciboDiarioGlobalProps {
  fecha: Date | string;
  items: ItemReciboDiario[];
  numeroRecibo?: number | null;
  cobradorNombre?: string;
  mercadoNombre?: string | null;
  observaciones?: string;
  onClose?: () => void;
}

const money = (n: number) => n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recibo consolidado del reporte diario (puerto de ReciboDiarioGlobal.tsx original). */
export default function ReciboDiarioGlobal({
  fecha,
  items,
  numeroRecibo,
  cobradorNombre,
  mercadoNombre,
  observaciones,
  onClose,
}: ReciboDiarioGlobalProps) {
  const fechaCobro = typeof fecha === "string" ? new Date(fecha) : fecha;
  const fechaFormateada = fechaCobro.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const montoTotal = items.reduce((sum, it) => sum + it.monto, 0);

  const getReceiptLinesForBluetooth = (): string[] => {
    const mercado = mercadoNombre ? mercadoNombre : "Mercado Municipal";
    return buildReceiptLines(({ center, left }) => {
      const l: string[] = [
        "",
        center("MUNICIPALIDAD DE COMAYAGUA"),
        center("RECIBO COBRO MERCADOS"),
        center(mercado + " - CONSOLIDADO"),
        "",
        `Fecha: ${fechaFormateada}${numeroRecibo != null ? `   Recibo: ${formatNumeroRecibo(numeroRecibo)}` : ""}`,
        ...(cobradorNombre ? [`Cobrador: ${left(cobradorNombre)}`] : []),
        "--------------------------------",
        `Puestos cobrados: ${items.length}`,
        "--------------------------------",
      ];
      items.forEach((item) => {
        l.push(`Puesto ${item.numeroPuesto}   ${money(item.monto)}`);
      });
      l.push("--------------------------------");
      l.push(`TOTAL DEL DIA: ${money(montoTotal)}`);
      l.push(left(numeroATexto(montoTotal)));
      l.push("");
      l.push(center("Cobro diario consolidado"));
      l.push("");
      return l;
    });
  };

  const handleDescargar = () =>
    downloadReciboHtml({
      contentId: "recibo-diario-global-content",
      title: `Recibo Diario Global ${fechaFormateada}`,
      filename: `Recibo-Diario-Global-${fechaFormateada.replace(/\//g, "-")}.html`,
    });

  return (
    <ReciboContainer id="recibo-diario-global-content">
      <ReciboHeader
        subtitulo={`${mercadoNombre ? `Mercado: ${mercadoNombre}` : "Mercado Municipal"} – COBRO DIARIO CONSOLIDADO`}
        fecha={fechaFormateada}
        numeroRecibo={numeroRecibo}
        extra={cobradorNombre ? <Text fontSize="sm">Cobrador: <strong>{cobradorNombre}</strong></Text> : undefined}
      />

      <Divider />

      <VStack spacing={2} align="stretch" fontSize="sm">
        <Text fontWeight="bold">Resumen del día: {items.length} puesto(s) cobrado(s)</Text>
        {observaciones && observaciones.trim() !== "" && (
          <Box mt={2} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200" w="100%">
            <Text fontSize="xs" fontWeight="bold" color="gray.600" mb={1}>
              Observaciones:
            </Text>
            <Text fontSize="sm" whiteSpace="pre-wrap">
              {observaciones.trim()}
            </Text>
          </Box>
        )}
      </VStack>

      <Divider />

      <Box className="recibo-tabla-wrapper">
        <Box as="table" className="recibo-tabla recibo-tabla-5" width="100%" border="1px solid" borderColor="gray.300">
          <Box as="thead" bg="gray.100">
            <Box as="tr">
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs" fontWeight="bold">
                Puesto
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
            {items.map((item, index) => (
              <Box as="tr" key={index}>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                  {item.numeroPuesto}
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" fontSize="xs" className="col-desc">
                  COBRO DIARIO - PUESTO {item.numeroPuesto} - {fechaFormateada}
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                  1.00
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" className="col-numeric">
                  {money(item.monto)}
                </Box>
                <Box as="td" p={2} borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                  {money(item.monto)}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box mt={4}>
        <Text fontSize="md" fontWeight="bold" mb={2}>
          TOTAL DEL DÍA: {money(montoTotal)}
        </Text>
        <Text fontSize="sm" fontWeight="medium" textTransform="uppercase" color="gray.700">
          {numeroATexto(montoTotal)}
        </Text>
      </Box>

      <Box mt={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" fontWeight="medium" textAlign="center">
          COBRO DIARIO CONSOLIDADO {fechaFormateada} - MERCADO SAN ANTONIO - {items.length} PUESTO(S) - TOTAL HNL. {money(montoTotal)}***
        </Text>
      </Box>

      <BotonesImpresionRecibo getReceiptLinesForBluetooth={getReceiptLinesForBluetooth} onDescargar={handleDescargar} onClose={onClose} />
    </ReciboContainer>
  );
}
