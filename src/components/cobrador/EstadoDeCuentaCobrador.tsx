"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Select,
  useDisclosure,
  Spinner,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Checkbox,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { Plus } from "lucide-react";
import {
  getCuentasPorAmbulante,
  getResumenCobrador,
  registrarAbono,
  type ResultadoRegistroAbono,
} from "@/lib/data/repositories/cuentas.repo";
import { getCobrosPorAmbulanteConDetalle } from "@/lib/data/repositories/cobros.repo";
import { RUBRO_RENTA_MENSUAL } from "@/lib/data/types";
import type { CuentaPorCobrar, CobroConDetalle } from "@/lib/data/types";
import ReciboAbono from "@/components/recibos/ReciboAbono";

// Puerto de src/components/EstadoDeCuentaCobrador.tsx original.

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface EstadoDeCuentaCobradorProps {
  cobradorId: string;
  cobradorNombre: string;
  mercadoNombre?: string | null;
  mercadoId?: string | null;
}

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function EstadoDeCuentaCobrador({ cobradorId, cobradorNombre, mercadoNombre, mercadoId }: EstadoDeCuentaCobradorProps) {
  const toast = useToast();
  const anioActual = new Date().getFullYear();
  const [cuentas, setCuentas] = useState<CuentaPorCobrar[]>([]);
  const [resumen, setResumen] = useState<{ totalCobrado: number; totalPendiente: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<CuentaPorCobrar | null>(null);
  const { isOpen: isAbonoOpen, onOpen: onAbonoOpen, onClose: onAbonoClose } = useDisclosure();
  const { isOpen: isReciboAbonoOpen, onOpen: onReciboAbonoOpen, onClose: onReciboAbonoClose } = useDisclosure();
  const [montoAbono, setMontoAbono] = useState("");
  const [referenciaAbono, setReferenciaAbono] = useState("");
  const [guardandoAbono, setGuardandoAbono] = useState(false);
  const [mesesPendientes, setMesesPendientes] = useState<{ mes: number; cobroId: string; monto: number }[]>([]);
  const [cobrosPorMes, setCobrosPorMes] = useState<Record<number, CobroConDetalle>>({});
  const [mesesSeleccionados, setMesesSeleccionados] = useState<number[]>([]);
  const [mesAplicadoSeleccionado, setMesAplicadoSeleccionado] = useState<number | "">("");
  const [rubroAplicadoSeleccionado, setRubroAplicadoSeleccionado] = useState<string>("");
  const [reciboAbonoResultado, setReciboAbonoResultado] = useState<ResultadoRegistroAbono | null>(null);

  const totalPorMesesSeleccionados = mesesPendientes.filter((mp) => mesesSeleccionados.includes(mp.mes)).reduce((sum, mp) => sum + mp.monto, 0) || 0;

  useEffect(() => {
    if (mesesSeleccionados.length > 0 && totalPorMesesSeleccionados > 0) {
      setMontoAbono(totalPorMesesSeleccionados.toFixed(2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesSeleccionados.join(","), totalPorMesesSeleccionados]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [lista, res] = await Promise.all([getCuentasPorAmbulante(cobradorId), getResumenCobrador(cobradorId)]);
      setCuentas(lista);
      setResumen(res);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al cargar estado de cuenta", status: "error", isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cobradorId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobradorId]);

  const mesActual = new Date().getMonth() + 1;

  const abrirModalAbono = async (cuenta: CuentaPorCobrar) => {
    setCuentaSeleccionada(cuenta);
    setMontoAbono("");
    setReferenciaAbono("");
    setMesesSeleccionados([]);
    setMesAplicadoSeleccionado("");
    setRubroAplicadoSeleccionado("");
    setMesesPendientes([]);
    setCobrosPorMes({});
    onAbonoOpen();
    try {
      const cobros = await getCobrosPorAmbulanteConDetalle(cobradorId);
      const pendientes = cobros.filter(
        (c) =>
          c.tipo_cobro === "mensual" &&
          (c.estado ?? "activo") === "activo" &&
          c.numero_puesto === cuenta.numero_puesto &&
          c.anio === anioActual &&
          c.mes != null &&
          c.mes < mesActual &&
          !c.recibo_generado
      );
      const conMonto = pendientes.map((c) => ({ mes: c.mes!, cobroId: c.id, monto: c.monto ?? 0 })).sort((a, b) => a.mes - b.mes);
      setMesesPendientes(conMonto);
      const porMes: Record<number, CobroConDetalle> = {};
      pendientes.forEach((c) => {
        porMes[c.mes!] = c;
      });
      setCobrosPorMes(porMes);
    } catch {
      setMesesPendientes([]);
      setCobrosPorMes({});
    }
  };

  /** Rubros del cobro de un mes con su pendiente (monto - abonado) */
  const getRubrosConPendiente = (cobro: CobroConDetalle): { concepto: string; monto: number; pendiente: number }[] => {
    const abonos: Record<string, number> = {};
    for (const ac of cobro.abonos_concepto ?? []) abonos[ac.concepto] = ac.monto;

    const rubros: { concepto: string; monto: number; pendiente: number }[] = [];
    const renta = cobro.renta_mensual ?? 0;
    if (renta > 0) {
      const abonado = abonos[RUBRO_RENTA_MENSUAL] ?? 0;
      rubros.push({ concepto: RUBRO_RENTA_MENSUAL, monto: renta, pendiente: renta - abonado });
    }
    for (const pa of cobro.pagos_adicionales ?? []) {
      const concepto = (pa.concepto || "").trim() || "Pago adicional";
      const abonado = abonos[concepto] ?? 0;
      rubros.push({ concepto, monto: pa.monto, pendiente: pa.monto - abonado });
    }
    return rubros.filter((r) => r.pendiente > 0);
  };

  const guardarAbono = async () => {
    if (!cuentaSeleccionada || !montoAbono) return;
    const monto = parseFloat(montoAbono.replace(",", "."));
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Ingrese un monto válido", status: "warning", isClosable: true });
      return;
    }
    if (monto > cuentaSeleccionada.saldo_pendiente) {
      toast({ title: "El abono no puede ser mayor al saldo pendiente", status: "warning", isClosable: true });
      return;
    }
    const esAbonoParcial = mesesSeleccionados.length === 0;
    if (esAbonoParcial && mesesPendientes.length > 0 && (mesAplicadoSeleccionado === "" || mesAplicadoSeleccionado === null)) {
      toast({ title: "Seleccione el mes al que aplica este abono", description: "Ej: abonar 1,000 al mes de enero", status: "warning", isClosable: true });
      return;
    }
    if (esAbonoParcial && mesAplicadoSeleccionado && !rubroAplicadoSeleccionado.trim()) {
      toast({ title: "Seleccione el rubro al que aplica este abono", description: "Ej: Renta mensual, Energía, etc.", status: "warning", isClosable: true });
      return;
    }
    if (esAbonoParcial && mesAplicadoSeleccionado && rubroAplicadoSeleccionado.trim()) {
      const cobro = cobrosPorMes[mesAplicadoSeleccionado];
      if (cobro) {
        const rubros = getRubrosConPendiente(cobro);
        const rubroSel = rubros.find((r) => r.concepto === rubroAplicadoSeleccionado);
        if (rubroSel && monto > rubroSel.pendiente) {
          toast({ title: `El monto no puede ser mayor al pendiente del rubro (${formatCurrency(rubroSel.pendiente)})`, status: "warning", isClosable: true });
          return;
        }
      }
    }
    if (mesesSeleccionados.length > 0 && mesesPendientes.length > 0) {
      const ordenados = [...mesesSeleccionados].sort((a, b) => a - b);
      const primerMesPendiente = mesesPendientes[0].mes;
      const hayHueco = ordenados.some((mes) => {
        const previosPendientes = mesesPendientes.filter((m) => m.mes < mes);
        return previosPendientes.some((m) => !ordenados.includes(m.mes));
      });
      if (hayHueco || (ordenados[0] ?? 0) > primerMesPendiente) {
        toast({ title: "Debe pagar los meses en orden. No puede incluir un mes si faltan meses anteriores por pagar.", status: "warning", isClosable: true });
        return;
      }
    }
    setGuardandoAbono(true);
    try {
      const opciones =
        mesesSeleccionados.length > 0
          ? { meses: mesesSeleccionados, anio: anioActual, nombreCliente: cuentaSeleccionada.nombre_cliente ?? undefined, ...(mercadoId && { mercadoId }) }
          : {
              mesAplicado: typeof mesAplicadoSeleccionado === "number" ? mesAplicadoSeleccionado : undefined,
              anio: anioActual,
              rubroAplicado: rubroAplicadoSeleccionado.trim() ? { concepto: rubroAplicadoSeleccionado.trim() } : undefined,
              nombreCliente: cuentaSeleccionada.nombre_cliente ?? undefined,
              ...(mercadoId && { mercadoId }),
            };

      const resultado = await registrarAbono(cobradorId, cuentaSeleccionada.numero_puesto, monto, cobradorId, cobradorNombre, referenciaAbono || undefined, opciones);

      toast({ title: "Abono registrado", status: "success", isClosable: true });
      onAbonoClose();
      setCuentaSeleccionada(null);
      setMesesSeleccionados([]);
      setMesAplicadoSeleccionado("");
      setRubroAplicadoSeleccionado("");
      cargar();

      setReciboAbonoResultado(resultado);
      onReciboAbonoOpen();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Error al registrar abono", status: "error", isClosable: true });
    } finally {
      setGuardandoAbono(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <HStack justify="center" py={8}>
            <Spinner size="lg" />
            <Text>Cargando estado de cuenta...</Text>
          </HStack>
        </CardBody>
      </Card>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <Card>
        <CardBody>
          <Heading size="md" mb={2}>
            Resumen del cobrador
          </Heading>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Deuda = meses que ya pasaron sin pagar. En {MESES_NOMBRES[mesActual - 1]} {anioActual}: {mesActual > 1 ? `Enero a ${MESES_NOMBRES[mesActual - 2]}` : "aún no hay meses vencidos"}.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            <Stat>
              <StatLabel>Total cobrado</StatLabel>
              <StatNumber color="green.600">{formatCurrency(resumen?.totalCobrado ?? 0)}</StatNumber>
            </Stat>
            <Stat>
              <StatLabel>Total pendiente</StatLabel>
              <StatNumber color="orange.600">{formatCurrency(resumen?.totalPendiente ?? 0)}</StatNumber>
            </Stat>
          </SimpleGrid>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Heading size="md" mb={4}>
            Estado de cuenta por cliente
          </Heading>
          {cuentas.length === 0 ? (
            <Text color="gray.500">No hay cuentas por cobrar. Los cobros mensuales se irán reflejando aquí.</Text>
          ) : (
            <TableContainer overflowX="auto" maxW="100%" sx={{ WebkitOverflowScrolling: "touch" }}>
              <Table size="sm" minW="640px">
                <Thead>
                  <Tr>
                    <Th>Puesto</Th>
                    <Th>Cliente</Th>
                    <Th>Última fecha cobro</Th>
                    <Th isNumeric>Total cobrado</Th>
                    <Th isNumeric>Abonado</Th>
                    <Th isNumeric>Saldo pendiente</Th>
                    <Th>Estado</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cuentas.map((c) => (
                    <Tr key={c.id}>
                      <Td fontWeight="medium">{c.numero_puesto}</Td>
                      <Td>{c.nombre_cliente || "-"}</Td>
                      <Td>{c.ultima_fecha_cobro ? new Date(c.ultima_fecha_cobro).toLocaleDateString("es-HN") : "-"}</Td>
                      <Td isNumeric>{formatCurrency(c.monto_total)}</Td>
                      <Td isNumeric>{formatCurrency(c.total_abonado)}</Td>
                      <Td isNumeric fontWeight="bold">
                        {formatCurrency(c.saldo_pendiente)}
                      </Td>
                      <Td>
                        <Badge colorScheme={c.saldo_pendiente <= 0 ? "green" : "orange"}>{c.saldo_pendiente <= 0 ? "Pagado" : "Pendiente de cobro"}</Badge>
                      </Td>
                      <Td>
                        {c.saldo_pendiente > 0 && (
                          <Button size="xs" colorScheme="teal" leftIcon={<Plus size={14} />} onClick={() => abrirModalAbono(c)}>
                            Registrar abono
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isAbonoOpen} onClose={onAbonoClose} isCentered size={{ base: "full", md: "md" }}>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "28rem" }} mx={{ base: 0, md: "auto" }}>
          <ModalHeader>Registrar abono</ModalHeader>
          <ModalBody>
            {cuentaSeleccionada && (
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="gray.600">
                  Puesto {cuentaSeleccionada.numero_puesto}
                  {cuentaSeleccionada.nombre_cliente && ` - ${cuentaSeleccionada.nombre_cliente}`}
                </Text>
                <Text fontWeight="bold">Saldo pendiente: {formatCurrency(cuentaSeleccionada.saldo_pendiente)}</Text>

                {mesesPendientes.length > 0 && (
                  <FormControl>
                    <FormLabel>Meses que está abonando (pagos mensuales {anioActual})</FormLabel>
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Debe pagar los meses en orden: no puede pagar un mes si tiene meses anteriores sin pagar.
                    </Text>
                    <Wrap spacing={3}>
                      {mesesPendientes.map(({ mes, monto }) => {
                        const hayMesAnteriorSinPagar = mesesPendientes.some((m) => m.mes < mes && !mesesSeleccionados.includes(m.mes));
                        const deshabilitado = hayMesAnteriorSinPagar;
                        return (
                          <WrapItem key={mes}>
                            <Checkbox
                              isChecked={mesesSeleccionados.includes(mes)}
                              isDisabled={deshabilitado}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setMesesSeleccionados((prev) => [...prev, mes].sort((a, b) => a - b));
                                } else {
                                  setMesesSeleccionados((prev) => prev.filter((m) => m !== mes));
                                }
                              }}
                            >
                              {MESES_NOMBRES[mes - 1]} ({formatCurrency(monto)})
                              {deshabilitado && " — pague antes los meses anteriores"}
                            </Checkbox>
                          </WrapItem>
                        );
                      })}
                    </Wrap>
                    {mesesSeleccionados.length > 0 && (
                      <Text fontWeight="bold" mt={2} color="teal.600">
                        Total a pagar: {formatCurrency(totalPorMesesSeleccionados)}
                      </Text>
                    )}
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Si selecciona meses completos, esos quedarán como &quot;Ya pagado&quot;. O ingrese un monto parcial (ej. 1,000 de 2,000) para abonar a cuenta; se generará recibo y el saldo se rebajará.
                    </Text>
                  </FormControl>
                )}

                {mesesPendientes.length > 0 && mesesSeleccionados.length === 0 && (
                  <>
                    <FormControl isRequired>
                      <FormLabel>Mes al que aplica este abono</FormLabel>
                      <Select
                        placeholder="Seleccione el mes (ej: Enero)"
                        value={mesAplicadoSeleccionado === "" ? "" : String(mesAplicadoSeleccionado)}
                        onChange={(e) => {
                          setMesAplicadoSeleccionado(e.target.value ? parseInt(e.target.value, 10) : "");
                          setRubroAplicadoSeleccionado("");
                        }}
                      >
                        {mesesPendientes.map(({ mes, monto }) => (
                          <option key={mes} value={mes}>
                            {MESES_NOMBRES[mes - 1]} {anioActual} — {formatCurrency(monto)}
                          </option>
                        ))}
                      </Select>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        Ej: abonar 1,000 al mes de enero
                      </Text>
                    </FormControl>
                    {mesAplicadoSeleccionado && cobrosPorMes[mesAplicadoSeleccionado] && (
                      <FormControl isRequired>
                        <FormLabel>Rubro al que aplica este abono</FormLabel>
                        <Select placeholder="Seleccione el rubro (Renta, Energía, etc.)" value={rubroAplicadoSeleccionado} onChange={(e) => setRubroAplicadoSeleccionado(e.target.value)}>
                          {getRubrosConPendiente(cobrosPorMes[mesAplicadoSeleccionado]).map((r) => (
                            <option key={r.concepto} value={r.concepto}>
                              {r.concepto} — Pendiente: {formatCurrency(r.pendiente)}
                            </option>
                          ))}
                        </Select>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          El abono se descontará de este rubro en cobros mensuales
                        </Text>
                      </FormControl>
                    )}
                  </>
                )}

                <FormControl isRequired>
                  <FormLabel>Monto del abono (L.)</FormLabel>
                  <Input type="number" step="0.01" min={0.01} max={cuentaSeleccionada.saldo_pendiente} value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="0.00" />
                </FormControl>
                <FormControl>
                  <FormLabel>Referencia (opcional)</FormLabel>
                  <Input value={referenciaAbono} onChange={(e) => setReferenciaAbono(e.target.value)} placeholder="Ej: Pago en efectivo" />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onAbonoClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="teal"
              onClick={guardarAbono}
              isLoading={guardandoAbono}
              isDisabled={
                !montoAbono ||
                parseFloat(montoAbono.replace(",", ".")) <= 0 ||
                (mesesSeleccionados.length === 0 && mesesPendientes.length > 0 && (mesAplicadoSeleccionado === "" || mesAplicadoSeleccionado === null)) ||
                (mesesSeleccionados.length === 0 && mesesPendientes.length > 0 && mesAplicadoSeleccionado !== "" && mesAplicadoSeleccionado !== null && !rubroAplicadoSeleccionado.trim())
              }
            >
              Registrar abono
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={isReciboAbonoOpen} onClose={onReciboAbonoClose} size={{ base: "full", md: "lg" }} isCentered>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "32rem" }} mx={{ base: 0, md: "auto" }}>
          <ModalBody py={4}>
            {reciboAbonoResultado && <ReciboAbono resultado={reciboAbonoResultado} cobradorNombre={cobradorNombre} mercadoNombre={mercadoNombre} onClose={onReciboAbonoClose} />}
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
