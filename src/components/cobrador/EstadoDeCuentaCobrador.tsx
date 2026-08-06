"use client";

import { useState, useEffect } from "react";
import {
  Box,
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
  ModalBody,
  Input,
  useDisclosure,
  Spinner,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { Plus, Search } from "lucide-react";
import { getCuentasPorMercado, getResumenMercado, type ResultadoRegistroAbono } from "@/lib/data/repositories/cuentas.repo";
import type { CuentaPorCobrar } from "@/lib/data/types";
import ReciboAbono from "@/components/recibos/ReciboAbono";
import RegistrarAbonoModal from "@/components/cobrador/RegistrarAbonoModal";

// Puerto de src/components/EstadoDeCuentaCobrador.tsx original.

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface EstadoDeCuentaCobradorProps {
  cobradorId: string;
  cobradorNombre: string;
  mercadoNombre?: string | null;
  mercadoId: string;
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
  const [reciboAbonoResultado, setReciboAbonoResultado] = useState<ResultadoRegistroAbono | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const mesActual = new Date().getMonth() + 1;

  // Con "Pagos diarios" eliminado (ver MIGRATION_NOTES.md), esta pantalla es
  // el unico lugar para registrar cualquier pago frecuente/parcial - en un
  // mercado con decenas o cientos de locatarios, encontrar uno mientras se
  // camina cobrando necesita un buscador, no solo la tabla completa.
  const busquedaNormalizada = busqueda.trim().toLowerCase();
  const cuentasFiltradas = busquedaNormalizada
    ? cuentas.filter(
        (c) =>
          (c.nombre_cliente ?? "").toLowerCase().includes(busquedaNormalizada) ||
          String(c.numero_puesto ?? "").toLowerCase().includes(busquedaNormalizada)
      )
    : cuentas;

  const cargar = async () => {
    setLoading(true);
    try {
      const [lista, res] = await Promise.all([getCuentasPorMercado(mercadoId), getResumenMercado(mercadoId)]);
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
    if (mercadoId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mercadoId]);

  const abrirModalAbono = (cuenta: CuentaPorCobrar) => {
    setCuentaSeleccionada(cuenta);
    onAbonoOpen();
  };

  const handleAbonoRegistrado = (resultado: ResultadoRegistroAbono) => {
    setCuentaSeleccionada(null);
    cargar();
    setReciboAbonoResultado(resultado);
    onReciboAbonoOpen();
  };

  if (loading) {
    return (
      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
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
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Estado de cuenta
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Resumen de cobros y saldos pendientes por cliente. Registre abonos parciales o por mes completo.
        </Text>
      </Box>

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
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

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <CardBody>
          <Heading size="md" mb={4}>
            Estado de cuenta por cliente
          </Heading>
          {cuentas.length === 0 ? (
            <Text color="gray.500">No hay cuentas por cobrar. Los cobros mensuales se irán reflejando aquí.</Text>
          ) : (
            <>
              <InputGroup mb={4} maxW={{ base: "100%", sm: "360px" }}>
                <InputLeftElement pointerEvents="none">
                  <Search size={16} color="var(--chakra-colors-gray-400)" />
                </InputLeftElement>
                <Input placeholder="Buscar por nombre o número de puesto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              </InputGroup>

              {cuentasFiltradas.length === 0 ? (
                <Text color="gray.500" fontStyle="italic">
                  No se encontraron locatarios para &quot;{busqueda}&quot;.
                </Text>
              ) : (
                <>
              <TableContainer overflowX="auto" maxW="100%" display={{ base: "none", lg: "block" }} sx={{ WebkitOverflowScrolling: "touch" }}>
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
                    {cuentasFiltradas.map((c) => (
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

              <VStack spacing={3} align="stretch" display={{ base: "flex", lg: "none" }}>
                {cuentasFiltradas.map((c) => (
                  <Box key={c.id} p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <HStack justify="space-between" align="flex-start">
                      <Box minW={0}>
                        <Text fontWeight="bold" fontSize="md">
                          Puesto {c.numero_puesto}
                        </Text>
                        <Text fontSize="sm" color="gray.600" noOfLines={1}>
                          {c.nombre_cliente || "Sin nombre"}
                        </Text>
                      </Box>
                      <Badge colorScheme={c.saldo_pendiente <= 0 ? "green" : "orange"} flexShrink={0}>
                        {c.saldo_pendiente <= 0 ? "Pagado" : "Pendiente"}
                      </Badge>
                    </HStack>
                    <SimpleGrid columns={3} spacing={2} mt={3} fontSize="sm">
                      <Box>
                        <Text color="gray.500" fontSize="xs">
                          Cobrado
                        </Text>
                        <Text fontWeight="medium">{formatCurrency(c.monto_total)}</Text>
                      </Box>
                      <Box>
                        <Text color="gray.500" fontSize="xs">
                          Abonado
                        </Text>
                        <Text fontWeight="medium">{formatCurrency(c.total_abonado)}</Text>
                      </Box>
                      <Box>
                        <Text color="gray.500" fontSize="xs">
                          Saldo
                        </Text>
                        <Text fontWeight="bold">{formatCurrency(c.saldo_pendiente)}</Text>
                      </Box>
                    </SimpleGrid>
                    <Text fontSize="xs" color="gray.500" mt={2}>
                      Última fecha cobro: {c.ultima_fecha_cobro ? new Date(c.ultima_fecha_cobro).toLocaleDateString("es-HN") : "-"}
                    </Text>
                    {c.saldo_pendiente > 0 && (
                      <Button size="sm" colorScheme="teal" leftIcon={<Plus size={14} />} mt={3} w="full" onClick={() => abrirModalAbono(c)}>
                        Registrar abono
                      </Button>
                    )}
                  </Box>
                ))}
              </VStack>
                </>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {cuentaSeleccionada && (
        <RegistrarAbonoModal
          isOpen={isAbonoOpen}
          onClose={onAbonoClose}
          mercadoId={mercadoId}
          numeroPuesto={cuentaSeleccionada.numero_puesto}
          nombreCliente={cuentaSeleccionada.nombre_cliente}
          saldoPendiente={cuentaSeleccionada.saldo_pendiente}
          cobradorId={cobradorId}
          cobradorNombre={cobradorNombre}
          onRegistrado={handleAbonoRegistrado}
        />
      )}

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
