"use client";

import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
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
  ModalCloseButton,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { Plus, Receipt, AlertCircle } from "lucide-react";
import {
  getDeudasMoraPorPuesto,
  crearDeudaMora,
  getAbonosMoraPorDeuda,
  registrarAbonoMora,
  type ResultadoRegistroAbonoMora,
} from "@/lib/data/repositories/mora.repo";
import { updatePuesto } from "@/lib/data/repositories/puestos.repo";
import { getRubrosGlobales } from "@/lib/data/repositories/rubros.repo";
import ReciboAbonoMora from "@/components/recibos/ReciboAbonoMora";
import type { Puesto, DeudaMora, AbonoMora, Rubro } from "@/lib/data/types";

// Puerto de src/components/SeccionMoraLocatario.tsx original.

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface SeccionMoraLocatarioProps {
  puesto: Puesto;
  cobradorId: string;
  mercadoId?: string | null;
  mercadoNombre?: string | null;
  usuarioId: string;
  usuarioNombre: string;
  isOpen: boolean;
  onClose: () => void;
  onActualizado?: () => void;
}

export default function SeccionMoraLocatario({
  puesto,
  cobradorId,
  mercadoId,
  mercadoNombre,
  usuarioId,
  usuarioNombre,
  isOpen,
  onClose,
  onActualizado,
}: SeccionMoraLocatarioProps) {
  const toast = useToast();
  const [enMora, setEnMora] = useState(puesto.en_mora ?? false);
  const [deudas, setDeudas] = useState<DeudaMora[]>([]);
  const [rubrosCatalogo, setRubrosCatalogo] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardandoMora, setGuardandoMora] = useState(false);
  const [guardandoDeuda, setGuardandoDeuda] = useState(false);
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  const [rubroId, setRubroId] = useState("");
  const [montoTotal, setMontoTotal] = useState("");
  const [descripcionDeuda, setDescripcionDeuda] = useState("");

  const [deudaSeleccionada, setDeudaSeleccionada] = useState<DeudaMora | null>(null);
  const [montoAbono, setMontoAbono] = useState("");
  const [fechaAbono, setFechaAbono] = useState(new Date().toISOString().slice(0, 10));
  const [observacionAbono, setObservacionAbono] = useState("");
  const { isOpen: isReciboOpen, onOpen: onReciboOpen, onClose: onReciboClose } = useDisclosure();
  const [reciboResultado, setReciboResultado] = useState<ResultadoRegistroAbonoMora | null>(null);
  const [abonosPorDeuda, setAbonosPorDeuda] = useState<Record<string, AbonoMora[]>>({});

  const cargar = async () => {
    if (!puesto.id || !isOpen) return;
    setLoading(true);
    try {
      const [listaDeudas, rubros] = await Promise.all([getDeudasMoraPorPuesto(puesto.id), getRubrosGlobales()]);
      setDeudas(listaDeudas);
      setRubrosCatalogo(rubros.filter((r) => (r.tipo_rubro ?? "vigente") === "mora"));
      const abonosMap: Record<string, AbonoMora[]> = {};
      for (const d of listaDeudas) {
        abonosMap[d.id] = await getAbonosMoraPorDeuda(d.id);
      }
      setAbonosPorDeuda(abonosMap);
    } catch (e) {
      console.error(e);
      toast({ title: "Error al cargar datos de mora", status: "error", isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && puesto.id) {
      setEnMora(puesto.en_mora ?? false);
      cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, puesto.id, puesto.en_mora]);

  const handleToggleMora = async () => {
    const nuevoValor = !enMora;
    setGuardandoMora(true);
    try {
      await updatePuesto(puesto.id, { en_mora: nuevoValor });
      setEnMora(nuevoValor);
      toast({ title: nuevoValor ? "Locatario marcado en mora" : "Locatario desmarcado de mora", status: "success", isClosable: true });
      onActualizado?.();
    } catch {
      toast({ title: "Error al actualizar", status: "error", isClosable: true });
    } finally {
      setGuardandoMora(false);
    }
  };

  const handleRegistrarDeuda = async () => {
    const rubro = rubrosCatalogo.find((r) => r.id === rubroId);
    if (!rubro || !montoTotal.trim()) {
      toast({ title: "Seleccione rubro e ingrese monto", status: "warning", isClosable: true });
      return;
    }
    const monto = parseFloat(montoTotal.replace(",", "."));
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Ingrese un monto válido", status: "warning", isClosable: true });
      return;
    }
    setGuardandoDeuda(true);
    try {
      await crearDeudaMora(
        puesto.id,
        cobradorId,
        puesto.numero_puesto,
        puesto.nombre_cliente,
        rubro.id,
        rubro.codigo,
        rubro.concepto,
        monto,
        descripcionDeuda.trim() || undefined,
        mercadoId ?? undefined
      );
      await updatePuesto(puesto.id, { en_mora: true });
      setEnMora(true);
      setRubroId("");
      setMontoTotal("");
      setDescripcionDeuda("");
      toast({ title: "Deuda registrada", status: "success", isClosable: true });
      cargar();
      onActualizado?.();
    } catch {
      toast({ title: "Error al registrar deuda", status: "error", isClosable: true });
    } finally {
      setGuardandoDeuda(false);
    }
  };

  const handleRegistrarAbono = async () => {
    if (!deudaSeleccionada || !montoAbono.trim()) return;
    const monto = parseFloat(montoAbono.replace(",", "."));
    if (isNaN(monto) || monto <= 0) {
      toast({ title: "Ingrese un monto válido", status: "warning", isClosable: true });
      return;
    }
    if (monto > deudaSeleccionada.saldo_pendiente) {
      toast({ title: "El abono no puede ser mayor al saldo pendiente", status: "warning", isClosable: true });
      return;
    }
    setGuardandoAbono(true);
    try {
      const resultado = await registrarAbonoMora(
        deudaSeleccionada.id,
        monto,
        new Date(fechaAbono),
        usuarioId,
        usuarioNombre,
        observacionAbono.trim() || undefined,
        mercadoId ?? undefined
      );
      setReciboResultado(resultado);
      setMontoAbono("");
      setObservacionAbono("");
      setFechaAbono(new Date().toISOString().slice(0, 10));
      setDeudaSeleccionada(null);
      toast({ title: "Abono registrado", status: "success", isClosable: true });
      cargar();
      onActualizado?.();
      onReciboOpen();
    } catch {
      toast({ title: "Error al registrar abono", status: "error", isClosable: true });
    } finally {
      setGuardandoAbono(false);
    }
  };

  const abrirModalAbono = (deuda: DeudaMora) => {
    setDeudaSeleccionada(deuda);
    setMontoAbono("");
    setObservacionAbono("");
    setFechaAbono(new Date().toISOString().slice(0, 10));
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "4xl" }} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent maxH={{ base: "100vh", md: "90vh" }} mx={{ base: 0, md: "auto" }} my={{ base: 0, md: "auto" }} maxW={{ base: "100vw", md: "56rem" }}>
          <ModalHeader fontSize={{ base: "sm", md: "md" }} pr={10}>
            <Text noOfLines={2}>
              Gestión de mora – {puesto.nombre_cliente} (Puesto {puesto.numero_puesto})
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowX="hidden" overflowY="auto">
            {loading ? (
              <HStack justify="center" py={8}>
                <Spinner size="lg" />
                <Text>Cargando...</Text>
              </HStack>
            ) : (
              <VStack spacing={6} align="stretch">
                <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50">
                  <HStack justify="space-between" flexWrap="wrap" gap={4}>
                    <HStack>
                      <AlertCircle size={20} color="var(--chakra-colors-orange-500)" />
                      <Text fontWeight="bold">¿Locatario en mora?</Text>
                    </HStack>
                    <HStack spacing={4}>
                      <Button size="sm" colorScheme={enMora ? "orange" : "gray"} variant={enMora ? "solid" : "outline"} onClick={() => !enMora && handleToggleMora()} isDisabled={guardandoMora}>
                        Sí
                      </Button>
                      <Button size="sm" colorScheme={!enMora ? "green" : "gray"} variant={!enMora ? "solid" : "outline"} onClick={() => enMora && handleToggleMora()} isDisabled={guardandoMora}>
                        No
                      </Button>
                    </HStack>
                  </HStack>
                </Box>

                {enMora && (
                  <Box p={4} borderWidth="1px" borderRadius="md" borderColor="orange.200" bg="orange.50">
                    <Text fontWeight="bold" mb={4}>
                      Registrar deuda inicial
                    </Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>Rubro de la deuda</FormLabel>
                        <Select placeholder="Seleccionar rubro (tipo Mora)..." value={rubroId} onChange={(e) => setRubroId(e.target.value)}>
                          {rubrosCatalogo
                            .filter((r) => (r.tipo_rubro ?? "vigente") === "mora")
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.concepto} ({r.codigo})
                              </option>
                            ))}
                        </Select>
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>Monto total de la deuda (L.)</FormLabel>
                        <Input type="number" step="0.01" min="0.01" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} placeholder="0.00" />
                      </FormControl>
                      <FormControl gridColumn={{ base: 1, md: "1 / -1" }}>
                        <FormLabel>Descripción u observación (opcional)</FormLabel>
                        <Input value={descripcionDeuda} onChange={(e) => setDescripcionDeuda(e.target.value)} placeholder="Ej: mora acumulada 2021–2023" />
                      </FormControl>
                    </SimpleGrid>
                    <Button
                      mt={4}
                      leftIcon={<Plus size={16} />}
                      colorScheme="orange"
                      onClick={handleRegistrarDeuda}
                      isLoading={guardandoDeuda}
                      isDisabled={!rubroId || !montoTotal || parseFloat(montoTotal.replace(",", ".")) <= 0}
                    >
                      Registrar deuda
                    </Button>
                  </Box>
                )}

                {deudas.length > 0 && (
                  <VStack spacing={4} align="stretch">
                    <Text fontWeight="bold">Deudas en mora registradas</Text>
                    {deudas.map((deuda) => (
                      <Box key={deuda.id} p={4} borderWidth="1px" borderRadius="md" borderColor="gray.200">
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4} mb={4}>
                          <Stat>
                            <StatLabel>Deuda inicial</StatLabel>
                            <StatNumber color="red.600">{formatCurrency(deuda.monto_total)}</StatNumber>
                          </Stat>
                          <Stat>
                            <StatLabel>Total abonado</StatLabel>
                            <StatNumber color="green.600">{formatCurrency(deuda.total_abonado)}</StatNumber>
                          </Stat>
                          <Stat>
                            <StatLabel>Saldo pendiente</StatLabel>
                            <StatNumber color="orange.600" fontWeight="bold">
                              {formatCurrency(deuda.saldo_pendiente)}
                            </StatNumber>
                          </Stat>
                        </SimpleGrid>
                        <Text fontSize="sm" color="gray.600" mb={2}>
                          Rubro: {deuda.rubro_concepto}
                          {deuda.descripcion && ` – ${deuda.descripcion}`}
                        </Text>
                        {deuda.saldo_pendiente > 0 && (
                          <HStack spacing={2} flexWrap="wrap">
                            <Button size="sm" colorScheme="teal" leftIcon={<Plus size={14} />} onClick={() => abrirModalAbono(deuda)}>
                              Registrar abono
                            </Button>
                          </HStack>
                        )}

                        <Box mt={4}>
                          <Text fontWeight="medium" mb={2}>
                            Historial de abonos
                          </Text>
                          {abonosPorDeuda[deuda.id]?.length ? (
                            <TableContainer overflowX="auto" maxW="100%" sx={{ WebkitOverflowScrolling: "touch" }}>
                              <Table size="sm" minW="480px">
                                <Thead>
                                  <Tr>
                                    <Th>Fecha</Th>
                                    <Th isNumeric>Monto abonado</Th>
                                    <Th isNumeric>Saldo restante</Th>
                                    <Th>Usuario</Th>
                                    <Th>Recibo</Th>
                                    <Th></Th>
                                  </Tr>
                                </Thead>
                                <Tbody>
                                  {abonosPorDeuda[deuda.id].map((abono) => (
                                    <Tr key={abono.id}>
                                      <Td>{new Date(abono.fecha).toLocaleDateString("es-HN")}</Td>
                                      <Td isNumeric>{formatCurrency(abono.monto)}</Td>
                                      <Td isNumeric>{formatCurrency(abono.saldo_pendiente_despues)}</Td>
                                      <Td>{abono.usuario_nombre}</Td>
                                      <Td>
                                        <Badge colorScheme="blue">#{String(abono.numero_recibo).padStart(2, "0")}</Badge>
                                      </Td>
                                      <Td>
                                        <Button
                                          size="xs"
                                          variant="ghost"
                                          leftIcon={<Receipt size={12} />}
                                          onClick={() => {
                                            setReciboResultado({
                                              abonoId: abono.id,
                                              numeroRecibo: abono.numero_recibo,
                                              monto: abono.monto,
                                              fecha: new Date(abono.fecha),
                                              nombreCliente: puesto.nombre_cliente,
                                              numeroPuesto: puesto.numero_puesto,
                                              rubroConcepto: deuda.rubro_concepto,
                                              saldoPendienteDespues: abono.saldo_pendiente_despues,
                                              usuarioNombre: abono.usuario_nombre,
                                            });
                                            onReciboOpen();
                                          }}
                                        >
                                          Ver recibo
                                        </Button>
                                      </Td>
                                    </Tr>
                                  ))}
                                </Tbody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Text fontSize="sm" color="gray.500">
                              Sin abonos registrados
                            </Text>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                )}

                {enMora && deudas.length === 0 && rubrosCatalogo.filter((r) => (r.tipo_rubro ?? "vigente") === "mora").length === 0 && (
                  <Text fontSize="sm" color="gray.500">
                    Configure rubros tipo &quot;Mora&quot; en el catálogo (panel admin) para poder registrar deudas históricas.
                  </Text>
                )}
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!deudaSeleccionada} onClose={() => setDeudaSeleccionada(null)} isCentered size={{ base: "full", md: "md" }}>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "28rem" }} mx={{ base: 0, md: "auto" }}>
          <ModalHeader>Registrar abono a deuda en mora</ModalHeader>
          <ModalBody>
            {deudaSeleccionada && (
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="gray.600">
                  {deudaSeleccionada.rubro_concepto}
                  {deudaSeleccionada.descripcion && ` – ${deudaSeleccionada.descripcion}`}
                </Text>
                <Text fontWeight="bold">Saldo pendiente: {formatCurrency(deudaSeleccionada.saldo_pendiente)}</Text>
                <FormControl isRequired>
                  <FormLabel>Fecha del abono</FormLabel>
                  <Input type="date" value={fechaAbono} onChange={(e) => setFechaAbono(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Monto abonado (L.)</FormLabel>
                  <Input type="number" step="0.01" min="0.01" max={deudaSeleccionada.saldo_pendiente} value={montoAbono} onChange={(e) => setMontoAbono(e.target.value)} placeholder="0.00" />
                </FormControl>
                <FormControl>
                  <FormLabel>Observación (opcional)</FormLabel>
                  <Textarea value={observacionAbono} onChange={(e) => setObservacionAbono(e.target.value)} placeholder="Notas del abono" rows={2} />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <Box px={6} pb={4} pt={2}>
            <HStack justify="flex-end" spacing={2}>
              <Button variant="ghost" onClick={() => setDeudaSeleccionada(null)}>
                Cancelar
              </Button>
              <Button colorScheme="teal" onClick={handleRegistrarAbono} isLoading={guardandoAbono} isDisabled={!montoAbono || parseFloat(montoAbono.replace(",", ".")) <= 0}>
                Registrar abono
              </Button>
            </HStack>
          </Box>
        </ModalContent>
      </Modal>

      <Modal isOpen={isReciboOpen} onClose={onReciboClose} size={{ base: "full", md: "lg" }} isCentered>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "32rem" }} mx={{ base: 0, md: "auto" }}>
          <ModalBody py={4}>{reciboResultado && <ReciboAbonoMora resultado={reciboResultado} mercadoNombre={mercadoNombre} onClose={onReciboClose} />}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
