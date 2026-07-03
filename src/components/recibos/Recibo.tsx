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

interface ReciboProps {
  cobro: CobroConDetalle;
  puesto?: Puesto;
  mercadoNombre?: string | null;
  onClose?: () => void;
}

const MESES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const money = (n: number) => n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recibo de cobro mensual (puerto de Recibo.tsx original). */
export default function Recibo({ cobro, puesto, mercadoNombre, onClose }: ReciboProps) {
  const fechaCobro = new Date(cobro.fecha_cobro);
  const fechaFormateada = fechaCobro.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const mesNombre = cobro.mes ? MESES[cobro.mes - 1] : "";
  const anio = cobro.anio || fechaCobro.getFullYear();

  const rentaMensual = cobro.renta_mensual || 0;
  const listaPagos = cobro.pagos_adicionales ?? [];
  const totalPagosAdicionales = listaPagos.reduce((sum, pa) => sum + (pa.monto ?? 0), 0);
  const montoTotal = cobro.monto || rentaMensual + totalPagosAdicionales;

  const getReceiptLinesForBluetooth = (): string[] => {
    const mercado = mercadoNombre ? mercadoNombre : "Mercado Municipal";
    return buildReceiptLines(({ center, left }) => {
      const l: string[] = [
        "",
        center("MUNICIPALIDAD DE COMAYAGUA"),
        center("RECIBO COBRO MERCADOS"),
        center(mercado),
        "",
        `Fecha: ${fechaFormateada}   Recibo: ${formatNumeroRecibo(cobro.numero_recibo)}`,
        "--------------------------------",
        `Contribuyente: ${left(cobro.nombre_cliente || "N/A")}`,
        `No. Identidad: ${left((puesto?.numero_identidad ?? "").trim() || "_________________")}`,
        `RTN: ${left((puesto?.rtn ?? "").trim() || "_________________")}`,
        ...(puesto?.codigo ? [`Cod. Puesto: ${puesto.codigo}`] : []),
        "--------------------------------",
        "Cod.  N.Rubro  Descripcion      Valor    Total",
        "--------------------------------",
      ];
      if (rentaMensual > 0) {
        const r = money(rentaMensual);
        l.push(`${left(puesto?.codigo || "N/A", 4)}  -   RENTA ${mesNombre} ${anio}   ${r}  ${r}`);
      }
      listaPagos.forEach((p) => {
        const idx = p.concepto.indexOf(". ");
        const desc = idx >= 0 ? p.concepto.slice(idx + 2).trim() : p.concepto;
        const r = money(p.monto);
        l.push(`${left(puesto?.codigo || "N/A", 4)}  -   ${left(desc, 14)}   ${r}  ${r}`);
      });
      l.push("--------------------------------");
      l.push(`TOTAL A PAGAR: ${money(montoTotal)}`);
      l.push(left(numeroATexto(montoTotal)));
      l.push("");
      l.push(center(`Cobro ${mesNombre} ${anio} - Puesto ${cobro.numero_puesto}`));
      l.push(center("Tipo: VIGENTE (Pago corriente)"));
      l.push("");
      return l;
    });
  };

  const handleDescargar = () =>
    downloadReciboHtml({
      contentId: "recibo-content",
      title: `Recibo ${formatNumeroRecibo(cobro.numero_recibo)}`,
      filename: `Recibo-${formatNumeroRecibo(cobro.numero_recibo)}-${fechaFormateada.replace(/\//g, "-")}.html`,
    });

  return (
    <ReciboContainer id="recibo-content">
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
          <Text>{cobro.nombre_cliente || "N/A"}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">
            No. Identidad:
          </Text>
          <Text>{puesto?.numero_identidad?.trim() || "_________________"}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">
            RTN:
          </Text>
          <Text>{puesto?.rtn?.trim() || "_________________"}</Text>
        </HStack>
        {puesto?.codigo && (
          <HStack>
            <Text fontWeight="bold" minW="120px">
              Código Puesto:
            </Text>
            <Text fontWeight="bold" color="blue.600">
              {puesto.codigo}
            </Text>
          </HStack>
        )}
      </VStack>

      <Divider />

      <Box className="recibo-tabla-wrapper">
        <Box as="table" className="recibo-tabla" width="100%" border="1px solid" borderColor="gray.300">
          <Box as="thead" bg="gray.100">
            <Box as="tr">
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs" fontWeight="bold">
                Código
              </Box>
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs" fontWeight="bold">
                Nº Rubro
              </Box>
              <Box as="th" p={2} borderRight="1px solid" borderColor="gray.300" textAlign="left" fontSize="xs" fontWeight="bold">
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
            {rentaMensual > 0 && (
              <Box as="tr">
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                  {puesto?.codigo || "N/A"}
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                  —
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" fontSize="xs" className="col-desc">
                  RENTA MENSUAL - {mesNombre} {anio} - {cobro.tipo_puesto || "N/A"}
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                  1.00
                </Box>
                <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" className="col-numeric">
                  {money(rentaMensual)}
                </Box>
                <Box as="td" p={2} borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                  {money(rentaMensual)}
                </Box>
              </Box>
            )}
            {listaPagos.map((pago, index) => {
              const idxRubro = pago.concepto.indexOf(". ");
              const numeroRubro = idxRubro >= 0 ? pago.concepto.slice(0, idxRubro).trim() : "";
              const descripcionRubro = idxRubro >= 0 ? pago.concepto.slice(idxRubro + 2).trim() : pago.concepto;
              const descripcionMostrar = (descripcionRubro || pago.concepto || "Rubro").toUpperCase();
              return (
                <Box as="tr" key={index}>
                  <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                    {puesto?.codigo || "N/A"}
                  </Box>
                  <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                    {numeroRubro || "—"}
                  </Box>
                  <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" fontSize="xs" className="col-desc">
                    {descripcionMostrar}
                  </Box>
                  <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize="xs">
                    1.00
                  </Box>
                  <Box as="td" p={2} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" className="col-numeric">
                    {money(pago.monto)}
                  </Box>
                  <Box as="td" p={2} borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize="xs" fontWeight="bold" className="col-numeric">
                    {money(pago.monto)}
                  </Box>
                </Box>
              );
            })}
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
          COBRO MENSUAL {mesNombre} DE {anio} - PUESTO {cobro.numero_puesto} - HNL. {money(montoTotal)}***
        </Text>
        <Text fontSize="xs" fontWeight="bold" textAlign="center" color="green.600" mt={1}>
          Tipo: VIGENTE (Pago corriente)
        </Text>
      </Box>

      <BotonesImpresionRecibo getReceiptLinesForBluetooth={getReceiptLinesForBluetooth} onDescargar={handleDescargar} onClose={onClose} />
    </ReciboContainer>
  );
}
