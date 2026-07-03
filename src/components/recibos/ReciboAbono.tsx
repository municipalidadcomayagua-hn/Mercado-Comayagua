"use client";

import { Box, VStack, HStack, Text, Divider } from "@chakra-ui/react";
import { buildReceiptLines } from "@/lib/print/bluetoothThermalPrint";
import { downloadReciboHtml } from "@/lib/print/downloadReciboHtml";
import { formatNumeroRecibo } from "@/lib/print/formatNumeroRecibo";
import { numeroATexto } from "@/lib/print/numeroATexto";
import { ReciboContainer } from "./ReciboContainer";
import { ReciboHeader } from "./ReciboHeader";
import BotonesImpresionRecibo from "./BotonesImpresionRecibo";
import type { ResultadoRegistroAbono } from "@/lib/data/repositories/cuentas.repo";

const MESES_NOMBRES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface ReciboAbonoProps {
  resultado: ResultadoRegistroAbono;
  cobradorNombre?: string;
  mercadoNombre?: string | null;
  onClose?: () => void;
}

/** Recibo de abono a cuenta mensual (puerto de ReciboAbono.tsx original). */
export default function ReciboAbono({ resultado, cobradorNombre, mercadoNombre, onClose }: ReciboAbonoProps) {
  const numeroPuesto = resultado.numeroPuesto;
  const fechaFormateada = resultado.fecha.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const mesesTexto = resultado.meses?.length && resultado.anio != null ? resultado.meses.map((m) => MESES_NOMBRES[m - 1]).join(", ") : null;

  const mesAplicadoTexto = resultado.mesAplicado != null && resultado.anio != null ? `${MESES_NOMBRES[resultado.mesAplicado - 1]} ${resultado.anio}` : null;

  const rubroAplicadoTexto = resultado.rubroAplicado?.concepto?.trim();

  const descripcionAbono = mesesTexto
    ? `ABONO MESES ${mesesTexto} ${resultado.anio}`
    : mesAplicadoTexto
      ? rubroAplicadoTexto
        ? `ABONO PARCIAL - ${mesAplicadoTexto} - ${rubroAplicadoTexto} - Puesto ${numeroPuesto}`
        : `ABONO PARCIAL - ${mesAplicadoTexto} - Puesto ${numeroPuesto}`
      : `ABONO PARCIAL A CUENTA - Puesto ${numeroPuesto}`;

  const getReceiptLinesForBluetooth = (): string[] => {
    const mercado = mercadoNombre ? mercadoNombre : "Mercado Municipal";
    return buildReceiptLines(({ center, left }) => [
      "",
      center("MUNICIPALIDAD DE COMAYAGUA"),
      center("RECIBO COBRO MERCADOS"),
      center(mercado + " - RECIBO DE ABONO"),
      "",
      `Fecha: ${fechaFormateada}${resultado.numeroRecibo != null ? `   Recibo: ${formatNumeroRecibo(resultado.numeroRecibo)}` : ""}`,
      "--------------------------------",
      `Contribuyente: ${left(resultado.nombreCliente || `Puesto ${numeroPuesto}`)}`,
      `Nº Puesto: ${numeroPuesto}`,
      ...(mesesTexto && resultado.anio != null
        ? [`Meses: ${mesesTexto} ${resultado.anio}`]
        : mesAplicadoTexto
          ? [`Mes aplicado: ${mesAplicadoTexto}`]
          : []),
      `Monto abono: ${formatCurrency(resultado.monto)}`,
      ...(cobradorNombre ? [`Cobrador: ${left(cobradorNombre)}`] : []),
      "--------------------------------",
      center("Recibo de abono"),
      "",
    ]);
  };

  const handleDescargar = () =>
    downloadReciboHtml({
      contentId: "recibo-abono-content",
      title: `Recibo Abono ${resultado.numeroRecibo != null ? formatNumeroRecibo(resultado.numeroRecibo) : ""} - Puesto ${numeroPuesto}`,
      filename: `Recibo-Abono-${resultado.numeroRecibo != null ? formatNumeroRecibo(resultado.numeroRecibo) : "abono"}-Puesto-${numeroPuesto}-${fechaFormateada.replace(/\//g, "-")}.html`,
    });

  return (
    <ReciboContainer id="recibo-abono-content">
      <ReciboHeader
        subtitulo={`${mercadoNombre ? `Mercado: ${mercadoNombre}` : "Mercado Municipal"} – RECIBO DE ABONO`}
        fecha={fechaFormateada}
        numeroRecibo={resultado.numeroRecibo}
      />

      <Divider />

      <VStack spacing={2} align="stretch" fontSize="sm">
        <HStack>
          <Text fontWeight="bold" minW="120px">Contribuyente:</Text>
          <Text>{resultado.nombreCliente || `Puesto ${numeroPuesto}`}</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">No. Identidad:</Text>
          <Text>_________________</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">RTN:</Text>
          <Text>_________________</Text>
        </HStack>
        <HStack>
          <Text fontWeight="bold" minW="120px">Nº Puesto:</Text>
          <Text fontWeight="bold" color="blue.600">{numeroPuesto}</Text>
        </HStack>
        {mesesTexto && resultado.anio != null ? (
          <HStack>
            <Text fontWeight="bold" minW="120px">Meses abonados:</Text>
            <Text>{mesesTexto} {resultado.anio}</Text>
          </HStack>
        ) : mesAplicadoTexto ? (
          <>
            <HStack>
              <Text fontWeight="bold" minW="120px">Mes aplicado:</Text>
              <Text color="teal.600">{mesAplicadoTexto}</Text>
            </HStack>
            {rubroAplicadoTexto && (
              <HStack>
                <Text fontWeight="bold" minW="120px">Rubro aplicado:</Text>
                <Text color="teal.700">{rubroAplicadoTexto}</Text>
              </HStack>
            )}
          </>
        ) : (
          <HStack>
            <Text fontWeight="bold" minW="120px">Tipo:</Text>
            <Text color="orange.600">Abono parcial a cuenta</Text>
          </HStack>
        )}
        {cobradorNombre && (
          <HStack>
            <Text fontWeight="bold" minW="120px">Cobrador:</Text>
            <Text>{cobradorNombre}</Text>
          </HStack>
        )}
      </VStack>

      <Divider />

      <Box className="recibo-tabla-wrapper">
        <Box as="table" className="recibo-tabla recibo-tabla-5" width="100%" border="1px solid" borderColor="gray.300" sx={{ tableLayout: "fixed" }}>
          <Box as="thead" bg="gray.100">
            <Box as="tr">
              <Box as="th" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" minW={{ base: "44px", md: "auto" }} maxW={{ base: "54px", md: "auto" }}>
                Cód.
              </Box>
              <Box as="th" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderColor="gray.300" textAlign="left" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" className="col-desc" minW={{ base: "120px", md: "auto" }}>
                Descripción
              </Box>
              <Box as="th" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderColor="gray.300" textAlign="center" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" minW={{ base: "44px", md: "auto" }} maxW={{ base: "54px", md: "auto" }}>
                Unid.
              </Box>
              <Box as="th" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderColor="gray.300" textAlign="right" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" className="col-numeric" minW={{ base: "64px", md: "auto" }}>
                Valor Unit.
              </Box>
              <Box as="th" p={{ base: 1.5, md: 2 }} textAlign="right" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" className="col-numeric">
                Total
              </Box>
            </Box>
          </Box>
          <Box as="tbody">
            <Box as="tr">
              <Box as="td" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize={{ base: "9px", md: "xs" }} minW={{ base: "44px", md: "auto" }} maxW={{ base: "54px", md: "auto" }}>
                ABONO
              </Box>
              <Box as="td" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" fontSize={{ base: "9px", md: "xs" }} className="col-desc" minW={{ base: "120px", md: "auto" }}>
                {descripcionAbono}
              </Box>
              <Box as="td" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="center" fontSize={{ base: "9px", md: "xs" }}>
                1.00
              </Box>
              <Box as="td" p={{ base: 1.5, md: 2 }} borderRight="1px solid" borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize={{ base: "9px", md: "xs" }} className="col-numeric">
                {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Box>
              <Box as="td" p={{ base: 1.5, md: 2 }} borderBottom="1px solid" borderColor="gray.300" textAlign="right" fontSize={{ base: "9px", md: "xs" }} fontWeight="bold" className="col-numeric">
                {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box mt={4}>
        <Text fontSize="md" fontWeight="bold" mb={2}>
          TOTAL A PAGAR: {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text fontSize="sm" fontWeight="medium" textTransform="uppercase" color="gray.700">
          {numeroATexto(resultado.monto)}
        </Text>
      </Box>

      <Box mt={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" fontWeight="medium" textAlign="center">
          RECIBO DE ABONO {fechaFormateada} – PUESTO {numeroPuesto} – HNL.{" "}
          {resultado.monto.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}***
        </Text>
        <Text fontSize="xs" fontWeight="bold" textAlign="center" color="green.600" mt={1}>
          Tipo:{" "}
          {mesesTexto
            ? "VIGENTE (Pago corriente)"
            : mesAplicadoTexto
              ? rubroAplicadoTexto
                ? `Abono parcial - ${mesAplicadoTexto} - ${rubroAplicadoTexto}`
                : `Abono parcial - ${mesAplicadoTexto}`
              : "Abono parcial a cuenta"}
        </Text>
        <Text fontSize="xs" color="gray.500" textAlign="center" mt={2}>
          {mesesTexto
            ? "Este recibo certifica el abono registrado. Los meses indicados quedan marcados como pagados en Pagos mensuales."
            : mesAplicadoTexto && rubroAplicadoTexto
              ? "Este recibo certifica el abono parcial. El rubro indicado queda parcialmente abonado hasta completar el saldo pendiente del mes."
              : mesAplicadoTexto
                ? "Este recibo certifica el abono parcial al mes indicado. El saldo pendiente deberá completarse para dar el mes por pagado."
                : "Este recibo certifica el abono a cuenta. Será aplicado cuando se registre el mes y rubro correspondiente."}
        </Text>
      </Box>

      <BotonesImpresionRecibo getReceiptLinesForBluetooth={getReceiptLinesForBluetooth} onDescargar={handleDescargar} onClose={onClose} />
    </ReciboContainer>
  );
}
