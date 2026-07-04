"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Heading,
  VStack,
  HStack,
  Button,
  Input,
  Card,
  CardBody,
  Text,
  useToast,
  FormControl,
  FormLabel,
  SimpleGrid,
  Divider,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  useDisclosure,
  Textarea,
  Select,
} from "@chakra-ui/react";
import { Calendar, Save, CheckCircle, Upload, Edit, Receipt, FileText } from "lucide-react";
import { createCobro, getCobrosDiariosPorFecha, getCobroById, updateCobro } from "@/lib/data/repositories/cobros.repo";
import { getRubrosGlobales } from "@/lib/data/repositories/rubros.repo";
import type { Rubro, CobroConDetalle } from "@/lib/data/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import ReciboDiario from "@/components/recibos/ReciboDiario";
import ReciboDiarioGlobal from "@/components/recibos/ReciboDiarioGlobal";

// Puerto de src/components/PagosDiarios.tsx original.

const formatCurrency = (amount: number): string =>
  `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface PagoDiario {
  numeroPuesto: number;
  monto: string;
  rubroId?: string;
  guardado: boolean;
  editando: boolean;
  timestamp?: Date;
  cobroId?: string;
  /** true cuando ya se generó el recibo de este puesto; no se puede editar */
  reciboGenerado?: boolean;
}

function puestosVacios(): PagoDiario[] {
  return Array.from({ length: 120 }, (_, i) => ({
    numeroPuesto: i + 1,
    monto: "",
    guardado: false,
    editando: false,
  }));
}

export default function PagosDiariosPage() {
  const { user, mercadoNombre } = useAuth();
  const mercadoId = user?.mercado_id ?? undefined;
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingPuesto, setLoadingPuesto] = useState<{ [key: number]: boolean }>({});
  const [reporteCompletado, setReporteCompletado] = useState(false);
  const [fechaCobro, setFechaCobro] = useState(new Date().toISOString().split("T")[0]);
  const [reciboCobro, setReciboCobro] = useState<CobroConDetalle | null>(null);
  const { isOpen: isReciboOpen, onOpen: onReciboOpen, onClose: onReciboClose } = useDisclosure();
  const { isOpen: isReciboGlobalOpen, onOpen: onReciboGlobalOpen, onClose: onReciboGlobalClose } = useDisclosure();
  const [observacionesReciboGlobal, setObservacionesReciboGlobal] = useState("");
  const [rubrosCatalogo, setRubrosCatalogo] = useState<Rubro[]>([]);
  const [pagos, setPagos] = useState<PagoDiario[]>(puestosVacios());

  useEffect(() => {
    getRubrosGlobales()
      .then((rubros) => setRubrosCatalogo(rubros.filter((r) => (r.tipo_rubro ?? "vigente") === "vigente")))
      .catch(() => setRubrosCatalogo([]));
  }, []);

  useEffect(() => {
    if (fechaCobro && user?.id) {
      setPagos(puestosVacios());
      setReporteCompletado(false);
      cargarCobrosDelDia();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaCobro, user?.id]);

  const cargarCobrosDelDia = async () => {
    if (!user?.id) return;
    try {
      const fecha = new Date(fechaCobro);
      const cobrosDelDia = await getCobrosDiariosPorFecha(user.id, fecha);

      const reporteCompleto = cobrosDelDia.find((c) => c.reporte_diario_completado);
      if (reporteCompleto) setReporteCompletado(true);

      const nuevosPagos = puestosVacios();

      cobrosDelDia.forEach((cobro) => {
        const esCobroIndividualPorPuesto = !cobro.reporte_diario_completado && cobro.pagos_diarios.length === 1;
        cobro.pagos_diarios.forEach((pago) => {
          const puestoIndex = pago.numero_puesto - 1;
          if (puestoIndex >= 0 && puestoIndex < 120) {
            const existente = nuevosPagos[puestoIndex];
            nuevosPagos[puestoIndex] = {
              numeroPuesto: pago.numero_puesto,
              monto: pago.monto.toString(),
              guardado: true,
              editando: false,
              ...(pago.timestamp && { timestamp: new Date(pago.timestamp) }),
              ...(pago.rubro_id && { rubroId: pago.rubro_id }),
              cobroId: esCobroIndividualPorPuesto ? cobro.id : existente?.cobroId,
              reciboGenerado: esCobroIndividualPorPuesto ? !!cobro.recibo_generado : existente?.reciboGenerado,
            };
          }
        });
      });
      setPagos(nuevosPagos);
    } catch (error) {
      console.error("Error cargando cobros del día:", error);
    }
  };

  const actualizarPago = (numeroPuesto: number, monto: string) => {
    setPagos(pagos.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, monto } : p)));
  };

  const actualizarRubroPuesto = (numeroPuesto: number, rubroId: string) => {
    setPagos(pagos.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, rubroId: rubroId || undefined } : p)));
  };

  const handleEditarPuesto = (numeroPuesto: number) => {
    const pago = pagos.find((p) => p.numeroPuesto === numeroPuesto);
    if (reporteCompletado) {
      toast({ title: "No permitido", description: "El reporte diario ya fue generado. No se puede editar.", status: "warning", isClosable: true });
      return;
    }
    if (pago?.reciboGenerado) {
      toast({ title: "No permitido", description: "Ya se generó el recibo de este puesto. No se puede editar.", status: "warning", isClosable: true });
      return;
    }
    setPagos(pagos.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, editando: true } : p)));
  };

  const handleCancelarEdicion = () => {
    cargarCobrosDelDia();
  };

  const handleGuardarEdicion = async (numeroPuesto: number, nuevoMonto: number) => {
    const puesto = pagos.find((p) => p.numeroPuesto === numeroPuesto);
    if (reporteCompletado) {
      toast({ title: "No permitido", description: "El reporte diario ya fue generado. No se puede editar.", status: "warning", isClosable: true });
      return;
    }
    if (puesto?.reciboGenerado) {
      toast({ title: "No permitido", description: "Ya se generó el recibo de este puesto. No se puede editar.", status: "warning", isClosable: true });
      return;
    }
    if (!puesto || !puesto.cobroId) {
      toast({ title: "Error", description: "No se encontró el cobro a editar", status: "error", duration: 3000, isClosable: true });
      return;
    }
    if (!user?.id) return;

    setLoadingPuesto((prev) => ({ ...prev, [numeroPuesto]: true }));
    try {
      const fecha = new Date(fechaCobro);
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const ahora = new Date();

      const rubroCat = puesto.rubroId ? rubrosCatalogo.find((r) => r.id === puesto.rubroId) : undefined;
      await createCobro({
        cobrador_id: user.id,
        codigo_cuenta: user.id,
        cobrador_nombre: user.nombre || user.email,
        numero_puesto: numeroPuesto.toString(),
        tipo_cobro: "diario",
        anio,
        monto: nuevoMonto,
        estado: "activo",
        es_cobro_diario: true,
        fecha_cobro_dia: fecha.toISOString(),
        pagos_diarios: [
          {
            numero_puesto: numeroPuesto,
            monto: nuevoMonto,
            timestamp: ahora.toISOString(),
            ...(puesto.rubroId && { rubro_id: puesto.rubroId, codigo: rubroCat?.codigo, concepto: rubroCat?.concepto }),
          },
        ],
        mes,
        valor_diario: 0,
        dias_mes: 1,
        mercado_id: mercadoId,
      });

      setPagos(pagos.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, monto: nuevoMonto.toString(), guardado: true, editando: false, timestamp: ahora } : p)));

      toast({ title: "Actualizado", description: `Puesto ${numeroPuesto} actualizado correctamente`, status: "success", duration: 2000, isClosable: true });
    } catch (error) {
      console.error("Error actualizando cobro:", error);
      toast({ title: "Error", description: `No se pudo actualizar el cobro del puesto ${numeroPuesto}`, status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoadingPuesto((prev) => ({ ...prev, [numeroPuesto]: false }));
    }
  };

  const guardarCobroIndividual = async (numeroPuesto: number, monto: number) => {
    const pagoPuesto = pagos.find((p) => p.numeroPuesto === numeroPuesto);
    if (reporteCompletado) {
      toast({ title: "No permitido", description: "El reporte diario ya fue generado. No se pueden agregar ni editar cobros.", status: "warning", isClosable: true });
      return;
    }
    if (pagoPuesto?.reciboGenerado) {
      toast({ title: "No permitido", description: "Ya se generó el recibo de este puesto. No se puede modificar.", status: "warning", isClosable: true });
      return;
    }
    if (!fechaCobro || !user?.id) {
      toast({ title: "Error", description: "Debe seleccionar la fecha del cobro", status: "error", duration: 3000, isClosable: true });
      return;
    }

    setLoadingPuesto((prev) => ({ ...prev, [numeroPuesto]: true }));
    try {
      const fecha = new Date(fechaCobro);
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const ahora = new Date();

      const pagoItem = pagos.find((p) => p.numeroPuesto === numeroPuesto);
      const rubroCat = pagoItem?.rubroId ? rubrosCatalogo.find((r) => r.id === pagoItem.rubroId) : undefined;
      const cobroId = await createCobro({
        cobrador_id: user.id,
        codigo_cuenta: user.id,
        cobrador_nombre: user.nombre || user.email,
        numero_puesto: numeroPuesto.toString(),
        tipo_cobro: "diario",
        anio,
        monto,
        estado: "activo",
        es_cobro_diario: true,
        fecha_cobro_dia: fecha.toISOString(),
        pagos_diarios: [
          {
            numero_puesto: numeroPuesto,
            monto,
            timestamp: ahora.toISOString(),
            ...(pagoItem?.rubroId && { rubro_id: pagoItem.rubroId, codigo: rubroCat?.codigo, concepto: rubroCat?.concepto }),
          },
        ],
        mes,
        valor_diario: 0,
        dias_mes: 1,
        mercado_id: mercadoId,
      });

      setPagos(pagos.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, monto: monto.toString(), guardado: true, timestamp: ahora, cobroId } : p)));

      toast({
        title: "Guardado",
        description: `Puesto ${numeroPuesto} guardado a las ${ahora.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error guardando cobro individual:", error);
      toast({ title: "Error", description: `No se pudo guardar el cobro del puesto ${numeroPuesto}`, status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoadingPuesto((prev) => ({ ...prev, [numeroPuesto]: false }));
    }
  };

  const calcularTotal = (): number => pagos.reduce((total, pago) => total + (parseFloat(pago.monto) || 0), 0);

  const handleVerRecibo = async (numeroPuesto: number) => {
    const pago = pagos.find((p) => p.numeroPuesto === numeroPuesto);
    if (!pago?.cobroId) {
      toast({ title: "Error", description: "No se encontró el cobro para este puesto", status: "error", duration: 3000, isClosable: true });
      return;
    }
    try {
      const cobro = await getCobroById(pago.cobroId);
      if (!cobro) {
        toast({ title: "Error", description: "No se pudo cargar el recibo", status: "error", duration: 3000, isClosable: true });
        return;
      }
      setReciboCobro(cobro);
      onReciboOpen();
      if (!cobro.recibo_generado) {
        await updateCobro(cobro.id, { recibo_generado: true });
        setPagos((prev) => prev.map((p) => (p.numeroPuesto === numeroPuesto ? { ...p, reciboGenerado: true } : p)));
      }
    } catch (error) {
      console.error("Error cargando recibo:", error);
      toast({ title: "Error", description: "No se pudo cargar el recibo", status: "error", duration: 3000, isClosable: true });
    }
  };

  const handleFinalizarReporteDiario = async () => {
    const pagosConMonto = pagos.filter((p) => p.monto && parseFloat(p.monto) > 0);

    if (pagosConMonto.length === 0) {
      toast({ title: "Error", description: "Debe haber al menos un puesto cobrado para finalizar el reporte", status: "error", duration: 3000, isClosable: true });
      return;
    }
    if (!fechaCobro || !user?.id) {
      toast({ title: "Error", description: "Debe seleccionar la fecha del cobro", status: "error", duration: 3000, isClosable: true });
      return;
    }

    setLoading(true);
    try {
      const fecha = new Date(fechaCobro);
      const anio = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;
      const dia = fecha.getDate();
      const ahora = new Date();

      const total = calcularTotal();
      const pagosArray = pagosConMonto.map((p) => {
        const rubroCat = p.rubroId ? rubrosCatalogo.find((r) => r.id === p.rubroId) : undefined;
        return {
          numero_puesto: p.numeroPuesto,
          monto: parseFloat(p.monto),
          timestamp: (p.timestamp ?? ahora).toISOString(),
          ...(p.rubroId && { rubro_id: p.rubroId, codigo: rubroCat?.codigo, concepto: rubroCat?.concepto }),
        };
      });

      await createCobro({
        cobrador_id: user.id,
        codigo_cuenta: user.id,
        cobrador_nombre: user.nombre || user.email,
        numero_puesto: `Reporte Diario - ${pagosConMonto.length} puestos`,
        tipo_cobro: "diario",
        anio,
        monto: total,
        estado: "activo",
        es_cobro_diario: true,
        fecha_cobro_dia: fecha.toISOString(),
        pagos_diarios: pagosArray,
        mes,
        valor_diario: 0,
        dias_mes: pagosConMonto.length,
        reporte_diario_completado: true,
        fecha_reporte_completado: ahora.toISOString(),
        mercado_id: mercadoId,
      });

      setReporteCompletado(true);

      toast({
        title: "Reporte Finalizado",
        description: `Reporte diario del ${dia}/${mes}/${anio} finalizado correctamente. Total: ${formatCurrency(total)}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error finalizando reporte diario:", error);
      toast({ title: "Error", description: "No se pudo finalizar el reporte diario", status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Pagos diarios
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Control de cobro diario para los 120 puestos del mercado.
        </Text>
      </Box>

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <CardBody>
          <HStack spacing={4}>
            <FormControl isRequired maxW="300px">
              <FormLabel fontSize={{ base: "sm", md: "md" }}>
                <HStack>
                  <Calendar size={18} />
                  <Text>Fecha del Cobro</Text>
                </HStack>
              </FormLabel>
              <Input type="date" value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} size={{ base: "md", md: "lg" }} />
            </FormControl>
          </HStack>
        </CardBody>
      </Card>

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <CardBody>
          <VStack spacing={4} align="stretch">
            <Heading size={{ base: "sm", md: "md" }} color="gray.700">
              Control de Cobro Diario - 120 Puestos
            </Heading>

            <FormControl>
              <FormLabel fontSize={{ base: "sm", md: "md" }}>Observaciones (aparecen en el recibo global del día)</FormLabel>
              <Textarea
                value={observacionesReciboGlobal}
                onChange={(e) => setObservacionesReciboGlobal(e.target.value)}
                placeholder="Ej: Cobro en horario matutino, incidencias del día..."
                size="sm"
                rows={2}
                maxW="100%"
                bg="white"
              />
            </FormControl>

            <Box overflowX="auto" maxH="70vh" overflowY="auto">
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5, xl: 6 }} spacing={3}>
                {pagos.map((pago) => (
                  <Box key={pago.numeroPuesto} borderWidth="1px" borderRadius="md" p={2} bg={pago.guardado && !pago.editando ? "green.50" : "white"}>
                    <HStack spacing={2} mb={1} justify="space-between" flexWrap="wrap" gap={1}>
                      <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="gray.700">
                        P N° {pago.numeroPuesto}
                      </Text>
                      {pago.guardado && !pago.editando && (
                        <HStack spacing={1}>
                          <Button size="xs" leftIcon={<Receipt size={12} />} colorScheme="teal" variant="ghost" onClick={() => handleVerRecibo(pago.numeroPuesto)}>
                            Recibo
                          </Button>
                          {!reporteCompletado && !pago.reciboGenerado && (
                            <Button size="xs" leftIcon={<Edit size={12} />} colorScheme="blue" variant="ghost" onClick={() => handleEditarPuesto(pago.numeroPuesto)}>
                              Editar
                            </Button>
                          )}
                        </HStack>
                      )}
                    </HStack>
                    {pago.editando && !reporteCompletado && !pago.reciboGenerado ? (
                      <VStack spacing={2} align="stretch">
                        {rubrosCatalogo.length > 0 &&
                          (() => {
                            const rubro = rubrosCatalogo.find((r) => r.id === pago.rubroId);
                            return rubro ? (
                              <HStack justify="space-between" align="center" flexWrap="wrap" gap={1}>
                                <Text fontSize="sm" fontWeight="medium" noOfLines={2}>
                                  <Box as="span" fontWeight="bold" color="blue.600">
                                    {rubro.codigo}
                                  </Box>{" "}
                                  {rubro.concepto}
                                </Text>
                                <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => actualizarRubroPuesto(pago.numeroPuesto, "")}>
                                  Cambiar
                                </Button>
                              </HStack>
                            ) : (
                              <Select
                                size="md"
                                placeholder="Seleccionar rubro..."
                                fontSize={{ base: "sm", md: "md" }}
                                minH="9"
                                sx={{ "& option": { fontSize: "sm" } }}
                                value=""
                                onChange={(e) => actualizarRubroPuesto(pago.numeroPuesto, e.target.value)}
                              >
                                {rubrosCatalogo.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.concepto}
                                  </option>
                                ))}
                              </Select>
                            );
                          })()}
                        <Input
                          type="number"
                          step="0.01"
                          value={pago.monto}
                          onChange={(e) => actualizarPago(pago.numeroPuesto, e.target.value)}
                          placeholder="Ingresar valor"
                          size="md"
                          fontSize={{ base: "sm", md: "md" }}
                          minH="9"
                        />
                        <HStack spacing={2}>
                          <Button
                            size="xs"
                            colorScheme="green"
                            onClick={() => handleGuardarEdicion(pago.numeroPuesto, parseFloat(pago.monto) || 0)}
                            isLoading={loadingPuesto[pago.numeroPuesto]}
                            isDisabled={!pago.monto || parseFloat(pago.monto) <= 0}
                          >
                            Guardar
                          </Button>
                          <Button size="xs" colorScheme="gray" variant="outline" onClick={handleCancelarEdicion} isDisabled={loadingPuesto[pago.numeroPuesto]}>
                            Cancelar
                          </Button>
                        </HStack>
                      </VStack>
                    ) : (
                      <>
                        <VStack spacing={1.5} align="stretch">
                          {rubrosCatalogo.length > 0 && !pago.guardado && !reporteCompletado && !pago.reciboGenerado && (
                            <Select
                              size="sm"
                              placeholder="Seleccionar rubro..."
                              fontSize={{ base: "sm", md: "md" }}
                              value={pago.rubroId || ""}
                              onChange={(e) => actualizarRubroPuesto(pago.numeroPuesto, e.target.value)}
                            >
                              {rubrosCatalogo.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.concepto}
                                </option>
                              ))}
                            </Select>
                          )}
                          <Input
                            type="number"
                            step="0.01"
                            value={pago.monto}
                            onChange={(e) => actualizarPago(pago.numeroPuesto, e.target.value)}
                            placeholder="Ingresar valor"
                            size="md"
                            fontSize={{ base: "sm", md: "md" }}
                            minH="9"
                            isDisabled={pago.guardado || reporteCompletado || pago.reciboGenerado || loadingPuesto[pago.numeroPuesto]}
                            bg={pago.guardado ? "green.50" : "white"}
                          />
                        </VStack>
                        {!pago.guardado && pago.monto && parseFloat(pago.monto) > 0 && !reporteCompletado && !pago.reciboGenerado && (
                          <Button
                            size="xs"
                            leftIcon={<Save size={12} />}
                            colorScheme="green"
                            mt={2}
                            w="full"
                            onClick={() => guardarCobroIndividual(pago.numeroPuesto, parseFloat(pago.monto))}
                            isLoading={loadingPuesto[pago.numeroPuesto]}
                          >
                            Guardar
                          </Button>
                        )}
                        {pago.guardado && pago.timestamp && (
                          <Badge colorScheme="green" fontSize="xx-small" mt={1}>
                            Guardado {pago.timestamp.toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}
                          </Badge>
                        )}
                      </>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            </Box>

            <Divider />

            <HStack justify="space-between" pt={4} flexWrap="wrap" gap={4}>
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
                Total del Día:
              </Text>
              <HStack spacing={3}>
                <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" color="blue.600">
                  {formatCurrency(calcularTotal())}
                </Text>
                <Button leftIcon={<FileText size={18} />} colorScheme="teal" variant="outline" size={{ base: "sm", md: "md" }} onClick={onReciboGlobalOpen} isDisabled={calcularTotal() === 0}>
                  Recibo del día
                </Button>
              </HStack>
            </HStack>

            {reporteCompletado ? (
              <Button leftIcon={<CheckCircle size={18} />} colorScheme="green" size={{ base: "md", md: "lg" }} isDisabled>
                Reporte Diario Completado
              </Button>
            ) : (
              <Button leftIcon={<Upload size={18} />} colorScheme="blue" onClick={handleFinalizarReporteDiario} isLoading={loading} size={{ base: "md", md: "lg" }} isDisabled={calcularTotal() === 0}>
                Finalizar y Enviar Reporte Diario
              </Button>
            )}
          </VStack>
        </CardBody>
      </Card>

      <Modal isOpen={isReciboOpen} onClose={onReciboClose} size="full" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none" maxW="900px" mx="auto">
          <ModalBody py={4} overflowY="auto">
            {reciboCobro && <ReciboDiario cobro={reciboCobro} onClose={onReciboClose} mercadoNombre={mercadoNombre} />}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isReciboGlobalOpen} onClose={onReciboGlobalClose} size="full" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none" maxW="900px" mx="auto">
          <ModalBody py={4} overflowY="auto">
            <ReciboDiarioGlobal
              fecha={fechaCobro}
              items={pagos
                .filter((p) => p.monto && parseFloat(p.monto) > 0)
                .map((p) => ({ numeroPuesto: p.numeroPuesto, monto: parseFloat(p.monto) }))
                .sort((a, b) => a.numeroPuesto - b.numeroPuesto)}
              cobradorNombre={user?.nombre || ""}
              mercadoNombre={mercadoNombre}
              observaciones={observacionesReciboGlobal}
              onClose={onReciboGlobalClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
