"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardBody,
  Collapse,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Select,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Calendar, ChevronDown, ChevronRight, FileText, Filter } from "lucide-react";
import { getCobrosPorRangoFechasConDetalle } from "@/lib/data/repositories/cobros.repo";
import { getPerfilesMercadoMap } from "@/lib/data/repositories/perfiles.repo";
import { getMercados } from "@/lib/data/repositories/mercados.repo";
import { getRubrosGlobales } from "@/lib/data/repositories/rubros.repo";
import type { CobroConDetalle, Mercado, Rubro } from "@/lib/data/types";

const formatCurrency = (amount: number): string => `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Fecha efectiva del cobro: para diarios fecha_cobro_dia, sino fecha_cobro */
const getFechaEfectiva = (c: CobroConDetalle): Date => (c.es_cobro_diario && c.fecha_cobro_dia ? new Date(c.fecha_cobro_dia) : new Date(c.fecha_cobro));

/** Parsea "101.01. Renta mensual" -> { codigo: "101.01", concepto: "Renta mensual" } */
const parseConceptoRubro = (concepto: string): { codigo: string; concepto: string } => {
  const s = (concepto || "").trim();
  const idx = s.indexOf(". ");
  if (idx >= 0) return { codigo: s.slice(0, idx).trim(), concepto: s.slice(idx + 2).trim() || s };
  return { codigo: "-", concepto: s || "-" };
};

interface DetalleMovimiento {
  fecha: Date;
  fechaTexto: string;
  mesTexto: string;
  cliente: string;
  numeroPuesto: string;
  cobradorNombre: string;
  tipo: "diario" | "mensual";
  monto: number;
  numeroRecibo: number | null;
}

interface FilaResumenRubro {
  mercadoId: string | null;
  mercadoNombre: string;
  codigoCuenta: string;
  codigoRubro: string;
  conceptoRubro: string;
  cantidad: number;
  montoTotal: number;
  desglose: DetalleMovimiento[];
}

/** Busca en el catálogo un rubro que represente "Renta mensual" (por concepto). */
const findRentaMensualRubro = (catalogo: Rubro[]): { codigo: string; concepto: string; codigoCuenta: string } => {
  const r = catalogo.find((x) => (x.concepto || "").toLowerCase().includes("renta mensual"));
  if (r) return { codigo: (r.codigo || "").trim(), concepto: (r.concepto || "").trim() || "Renta mensual", codigoCuenta: (r.abreviatura || "").trim() };
  if (catalogo.length > 0) {
    const first = catalogo[0];
    return { codigo: (first.codigo || "").trim(), concepto: (first.concepto || "").trim(), codigoCuenta: (first.abreviatura || "").trim() };
  }
  return { codigo: "", concepto: "Renta mensual", codigoCuenta: "" };
};

/** Obtiene concepto y código de cuenta (abreviatura) del catálogo por código de rubro */
const getConceptoYCodigoCuentaByCodigo = (catalogo: Rubro[], codigoRubro: string): { concepto: string; codigoCuenta: string } => {
  const r = catalogo.find((x) => (x.codigo || "").trim() === (codigoRubro || "").trim());
  return { concepto: r ? (r.concepto || "").trim() || "-" : "-", codigoCuenta: r ? (r.abreviatura || "").trim() : "" };
};

/**
 * Puerto de ReporteResumenCobros.tsx original. El mercado de cada cobro se
 * resuelve con el mapa cobrador->mercado *actual* (getPerfilesMercadoMap,
 * equivalente a getUsuariosMercadoMap), no con `cobro.mercado_id` guardado
 * en el momento del cobro - igual que el original, para que el reporte
 * agrupe por la asignacion vigente del cobrador aunque haya cambiado de
 * mercado despues. No se "corrige" a usar el campo directo del cobro
 * porque cambiaria el resultado del reporte para cobradores reasignados.
 */
export default function ReporteResumenCobrosPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [mercadoFiltro, setMercadoFiltro] = useState("");
  const [filas, setFilas] = useState<FilaResumenRubro[]>([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const generarReporte = useCallback(async () => {
    const desde = fechaDesde ? new Date(fechaDesde) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const hasta = fechaHasta ? new Date(fechaHasta) : new Date();
    if (desde > hasta) {
      toast({ title: "Rango inválido", description: "La fecha desde debe ser anterior a la fecha hasta", status: "error", isClosable: true });
      return;
    }
    setLoading(true);
    try {
      const [cobrosRaw, perfilMercadoMap, mercadosList, catalogoRubros] = await Promise.all([
        getCobrosPorRangoFechasConDetalle(desde, hasta),
        getPerfilesMercadoMap(),
        getMercados(),
        getRubrosGlobales(),
      ]);

      setMercados(mercadosList);

      const inicio = new Date(desde);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(hasta);
      fin.setHours(23, 59, 59, 999);

      const cobros = cobrosRaw.filter((c) => {
        const f = getFechaEfectiva(c);
        return f >= inicio && f <= fin;
      });

      const filtroMercadoId = mercadoFiltro || null;

      const getMercadoNombre = (mercadoId: string | null): string => {
        if (!mercadoId) return "Sin mercado";
        return mercadosList.find((x) => x.id === mercadoId)?.nombre ?? mercadoId;
      };

      const rentaRubro = findRentaMensualRubro(catalogoRubros);

      const agregado = new Map<
        string,
        { mercadoId: string | null; mercadoNombre: string; codigoCuenta: string; codigoRubro: string; conceptoRubro: string; desglose: DetalleMovimiento[] }
      >();

      const formatFecha = (d: Date) => d.toLocaleDateString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric" });
      const formatMesAnio = (mes: number, anio: number) => `${MESES_NOMBRES[mes - 1] ?? ""} ${anio}`;

      const addMovimiento = (mercadoId: string | null, mercadoNombre: string, codigoRubro: string, codigoCuenta: string, conceptoRubro: string, detalle: DetalleMovimiento) => {
        const cr = (codigoRubro || "-").trim();
        const key = `${mercadoId ?? "null"}|${cr}`;
        let row = agregado.get(key);
        if (!row) {
          const { concepto, codigoCuenta: cuentaCat } = getConceptoYCodigoCuentaByCodigo(catalogoRubros, cr);
          row = { mercadoId, mercadoNombre, codigoCuenta: (codigoCuenta || cuentaCat || "").trim(), codigoRubro: cr, conceptoRubro: concepto || conceptoRubro, desglose: [] };
          agregado.set(key, row);
        }
        row.desglose.push(detalle);
      };

      for (const cobro of cobros) {
        // Solo incluir cobros con recibo generado: mensual -> recibo_generado; diario -> reporte_diario_completado
        if (cobro.es_cobro_diario) {
          if (!cobro.reporte_diario_completado) continue;
        } else {
          if (!cobro.recibo_generado) continue;
        }

        const mercadoId = perfilMercadoMap[cobro.cobrador_id] ?? null;
        if (filtroMercadoId !== null && mercadoId !== filtroMercadoId) continue;

        const mercadoNombre = getMercadoNombre(mercadoId);
        const cobradorNombre = cobro.cobrador_nombre ?? "-";
        const cliente = cobro.nombre_cliente ?? `Puesto ${cobro.numero_puesto}`;
        const numeroPuesto = cobro.numero_puesto ?? "-";
        const fechaEff = getFechaEfectiva(cobro);
        const fechaTexto = formatFecha(fechaEff);
        const numeroRecibo = cobro.numero_recibo ?? null;
        const mesCobro = cobro.mes ?? fechaEff.getMonth() + 1;
        const anioCobro = cobro.anio ?? fechaEff.getFullYear();
        const mesTexto = formatMesAnio(mesCobro, anioCobro);

        if (cobro.es_cobro_diario && cobro.pagos_diarios?.length) {
          for (const p of cobro.pagos_diarios) {
            const monto = p.monto ?? 0;
            if (monto <= 0) continue;
            const codigo = (p.codigo || "").trim() || "-";
            const concepto = (p.concepto || "").trim() || "Cobro diario";
            const { concepto: conceptoCat, codigoCuenta: codigoCuentaCat } = getConceptoYCodigoCuentaByCodigo(catalogoRubros, codigo);
            addMovimiento(mercadoId, mercadoNombre, codigo, codigoCuentaCat, conceptoCat || concepto, {
              fecha: fechaEff,
              fechaTexto,
              mesTexto,
              cliente,
              numeroPuesto: String(p.numero_puesto ?? numeroPuesto),
              cobradorNombre,
              tipo: "diario",
              monto,
              numeroRecibo,
            });
          }
        } else if (cobro.tipo_cobro === "mensual") {
          const rentaMensual = cobro.renta_mensual ?? 0;
          if (rentaMensual > 0) {
            addMovimiento(mercadoId, mercadoNombre, rentaRubro.codigo, rentaRubro.codigoCuenta, rentaRubro.concepto, {
              fecha: fechaEff,
              fechaTexto,
              mesTexto,
              cliente,
              numeroPuesto,
              cobradorNombre,
              tipo: "mensual",
              monto: rentaMensual,
              numeroRecibo,
            });
          }
          for (const pa of cobro.pagos_adicionales ?? []) {
            const monto = pa.monto ?? 0;
            if (monto <= 0) continue;
            const { codigo, concepto } = parseConceptoRubro(pa.concepto || "");
            const { concepto: conceptoCat, codigoCuenta: codigoCuentaCat } = getConceptoYCodigoCuentaByCodigo(catalogoRubros, codigo);
            addMovimiento(mercadoId, mercadoNombre, codigo, codigoCuentaCat, conceptoCat || concepto, {
              fecha: fechaEff,
              fechaTexto,
              mesTexto,
              cliente,
              numeroPuesto,
              cobradorNombre,
              tipo: "mensual",
              monto,
              numeroRecibo,
            });
          }
        }
      }

      const lista: FilaResumenRubro[] = Array.from(agregado.values()).map((row) => ({
        ...row,
        cantidad: row.desglose.length,
        montoTotal: row.desglose.reduce((s, d) => s + d.monto, 0),
      }));

      lista.sort((a, b) => {
        const cmpM = (a.mercadoNombre || "").localeCompare(b.mercadoNombre || "");
        if (cmpM !== 0) return cmpM;
        return (a.codigoRubro || "").localeCompare(b.codigoRubro || "");
      });

      setFilas(lista);
      setTotalGeneral(lista.reduce((s, f) => s + f.montoTotal, 0));
      setExpandidos(new Set());

      toast({ title: "Reporte generado", description: `Resumen por catálogo de rubro y mercado. ${lista.length} líneas con desglose.`, status: "success", isClosable: true });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo generar el reporte. Revise el rango de fechas e intente de nuevo.", status: "error", isClosable: true });
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, mercadoFiltro, toast]);

  useEffect(() => {
    getMercados().then(setMercados);
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    setFechaDesde((prev) => prev || primerDia.toISOString().split("T")[0]);
    setFechaHasta((prev) => prev || hoy.toISOString().split("T")[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box maxW="1600px" mx="auto" py={{ base: 4, md: 6 }} px={{ base: 0, sm: 4 }} w="100%">
      <VStack align="stretch" spacing={{ base: 4, md: 6 }} w="full">
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="600" color="gray.800" display="flex" alignItems="center" gap={2}>
          <FileText size={28} />
          Resumen por código de cuenta (catálogo de rubro y mercados)
        </Heading>
        <Text color="gray.600" fontSize={{ base: "sm", md: "md" }}>
          Resumen por mercado, código de rubro (01, 03…) y código de cuenta (asignado en Admin al rubro). Incluye renta mensual y rubros adicionales por mes, con desglose por cliente, fecha, mes, puesto y recibo. Solo cobros con recibo generado.
        </Text>

        <Card w="full">
          <CardBody>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: 3, md: 4 }}>
              <FormControl>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  <Calendar size={16} /> Desde
                </FormLabel>
                <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Hasta</FormLabel>
                <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel display="flex" alignItems="center" gap={1}>
                  <Filter size={16} /> Mercado
                </FormLabel>
                <Select placeholder="Todos los mercados" value={mercadoFiltro} onChange={(e) => setMercadoFiltro(e.target.value)}>
                  {mercados.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl display="flex" flexDir="column" justifyContent="flex-end">
                <Button
                  leftIcon={loading ? <Spinner size="sm" /> : <FileText size={18} />}
                  colorScheme="teal"
                  onClick={generarReporte}
                  isLoading={loading}
                  isDisabled={loading}
                  minH={{ base: "44px", md: "40px" }}
                  w={{ base: "full", sm: "auto" }}
                >
                  Generar reporte
                </Button>
              </FormControl>
            </SimpleGrid>
          </CardBody>
        </Card>

        {filas.length > 0 && (
          <>
            <HStack>
              <Stat>
                <StatLabel>Total general</StatLabel>
                <StatNumber color="teal.600">{formatCurrency(totalGeneral)}</StatNumber>
              </Stat>
            </HStack>
            <Card w="full" overflow="hidden">
              <CardBody p={0}>
                <TableContainer overflowX="auto" maxW="100%" sx={{ WebkitOverflowScrolling: "touch" }}>
                  <Table size="sm" variant="striped" minW={{ base: "640px", sm: "auto" }}>
                    <Thead bg="gray.50">
                      <Tr>
                        <Th w="32px" px={1} />
                        <Th whiteSpace="nowrap">Mercado</Th>
                        <Th whiteSpace="nowrap">Cód. rubro</Th>
                        <Th whiteSpace="nowrap">Cód. cuenta</Th>
                        <Th whiteSpace="nowrap">Concepto</Th>
                        <Th isNumeric whiteSpace="nowrap">
                          Cant.
                        </Th>
                        <Th isNumeric whiteSpace="nowrap">
                          Total
                        </Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filas.map((f, i) => {
                        const rowKey = `${f.mercadoId ?? "null"}|${f.codigoRubro}|${i}`;
                        const isOpen = expandidos.has(rowKey);
                        return (
                          <Fragment key={rowKey}>
                            <Tr>
                              <Td px={1} py={1}>
                                <IconButton
                                  aria-label={isOpen ? "Cerrar desglose" : "Ver desglose"}
                                  size="xs"
                                  variant="ghost"
                                  icon={isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                  onClick={() => toggleExpand(rowKey)}
                                />
                              </Td>
                              <Td whiteSpace="nowrap">{f.mercadoNombre}</Td>
                              <Td fontWeight="semibold" whiteSpace="nowrap">
                                {f.codigoRubro}
                              </Td>
                              <Td whiteSpace="nowrap">{f.codigoCuenta || "—"}</Td>
                              <Td whiteSpace="nowrap">{f.conceptoRubro}</Td>
                              <Td isNumeric>{f.cantidad}</Td>
                              <Td isNumeric fontWeight="medium">
                                {formatCurrency(f.montoTotal)}
                              </Td>
                            </Tr>
                            <Tr>
                              <Td colSpan={7} p={0} borderBottomWidth={isOpen ? 1 : 0}>
                                <Collapse in={isOpen} animateOpacity>
                                  <Box bg="gray.50" py={3} px={4}>
                                    <Text fontSize="xs" fontWeight="bold" mb={2} color="gray.600">
                                      Desglose — {f.mercadoNombre} · {f.codigoRubro} {f.conceptoRubro}
                                    </Text>
                                    <Table size="xs" variant="simple" width="100%">
                                      <Thead>
                                        <Tr>
                                          <Th>Fecha</Th>
                                          <Th>Mes</Th>
                                          <Th>Cliente</Th>
                                          <Th>Puesto</Th>
                                          <Th>Cobrador</Th>
                                          <Th>Tipo</Th>
                                          <Th isNumeric>Monto</Th>
                                          <Th isNumeric>Recibo</Th>
                                        </Tr>
                                      </Thead>
                                      <Tbody>
                                        {f.desglose.map((d, j) => (
                                          <Tr key={j}>
                                            <Td whiteSpace="nowrap">{d.fechaTexto}</Td>
                                            <Td whiteSpace="nowrap">{d.mesTexto || "—"}</Td>
                                            <Td whiteSpace="nowrap">{d.cliente}</Td>
                                            <Td whiteSpace="nowrap">{d.numeroPuesto}</Td>
                                            <Td whiteSpace="nowrap">{d.cobradorNombre}</Td>
                                            <Td whiteSpace="nowrap">{d.tipo === "diario" ? "Diario" : "Mensual"}</Td>
                                            <Td isNumeric>{formatCurrency(d.monto)}</Td>
                                            <Td isNumeric>{d.numeroRecibo ?? "—"}</Td>
                                          </Tr>
                                        ))}
                                      </Tbody>
                                    </Table>
                                  </Box>
                                </Collapse>
                              </Td>
                            </Tr>
                          </Fragment>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </>
        )}

        {!loading && filas.length === 0 && (fechaDesde || fechaHasta) && (
          <Text color="gray.500" fontStyle="italic">
            Seleccione un rango de fechas y pulse «Generar reporte» para ver el resumen por catálogo de rubro y mercado con desglose.
          </Text>
        )}
      </VStack>
    </Box>
  );
}
