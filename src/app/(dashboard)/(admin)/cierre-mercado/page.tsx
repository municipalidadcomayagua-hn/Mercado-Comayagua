"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
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
} from "@chakra-ui/react";
import { ClipboardCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getMercadosActivos } from "@/lib/data/repositories/mercados.repo";
import { cerrarMercado, getCierreMercadoDelDia, getResumenMercadoDelDia, type ResumenMercadoDelDia } from "@/lib/data/repositories/cierre-mercado.repo";
import type { CierreMercado, Mercado } from "@/lib/data/types";

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "YYYY-MM-DD" de hoy en hora local (no UTC: toISOString() adelanta la fecha en Honduras desde media tarde). */
function hoyLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convierte "YYYY-MM-DD" (del input date) a Date en medianoche local, no UTC. */
function parseFechaLocal(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const RESUMEN_VACIO: ResumenMercadoDelDia = {
  cobradores: [],
  totalMensual: 0,
  cantidadMensual: 0,
  totalAbonos: 0,
  cantidadAbonos: 0,
  totalGeneral: 0,
  cantidadCobradores: 0,
};

/**
 * Cierre de mercado: agrega a TODOS los cobradores de un mercado en un solo
 * cierre confirmado por el admin (a diferencia de "Cierre diario", que es
 * personal por cobrador). Mismo criterio de datos y mismo lenguaje visual
 * que Cierre diario del cobrador - ver cierre-mercado.repo.ts.
 */
function CierreMercadoContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [mercadoId, setMercadoId] = useState("");
  const [fechaStr, setFechaStr] = useState(hoyLocalStr());
  const [loadingMercados, setLoadingMercados] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState<ResumenMercadoDelDia>(RESUMEN_VACIO);
  const [cierreExistente, setCierreExistente] = useState<CierreMercado | null>(null);
  const [cerrando, setCerrando] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingMercados(true);
      try {
        const lista = await getMercadosActivos();
        setMercados(lista);
        const preseleccionado = searchParams.get("mercado");
        if (preseleccionado && lista.some((m) => m.id === preseleccionado)) {
          setMercadoId(preseleccionado);
        } else if (lista.length > 0) {
          setMercadoId(lista[0].id);
        }
      } catch (error) {
        console.error("Error cargando mercados:", error);
      } finally {
        setLoadingMercados(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = useCallback(async () => {
    if (!mercadoId) return;
    setLoading(true);
    try {
      const fecha = parseFechaLocal(fechaStr);
      const [res, cierre] = await Promise.all([getResumenMercadoDelDia(mercadoId, fecha), getCierreMercadoDelDia(mercadoId, fecha)]);
      setResumen(res);
      setCierreExistente(cierre);
    } catch (error) {
      console.error("Error cargando resumen del mercado:", error);
    } finally {
      setLoading(false);
    }
  }, [mercadoId, fechaStr]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCerrarMercado = async () => {
    if (!mercadoId || !user) return;
    setCerrando(true);
    try {
      const fecha = parseFechaLocal(fechaStr);
      const cierre = await cerrarMercado(mercadoId, resumen, user.id, user.nombre || user.email || "Admin", fecha);
      setCierreExistente(cierre);
    } catch (error) {
      console.error("Error cerrando el mercado:", error);
    } finally {
      setCerrando(false);
    }
  };

  const mercadoNombre = mercados.find((m) => m.id === mercadoId)?.nombre ?? "";

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800" display="flex" alignItems="center" gap={2}>
          <ClipboardCheck size={26} />
          Cierre de mercado
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Resumen de todos los cobradores de un mercado en un día, con el total general para confirmar el cierre.
        </Text>
      </Box>

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <CardBody>
          <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
            <FormControl isRequired>
              <FormLabel>Mercado</FormLabel>
              <Select placeholder={loadingMercados ? "Cargando..." : "Seleccione un mercado"} value={mercadoId} onChange={(e) => setMercadoId(e.target.value)} isDisabled={loadingMercados}>
                {mercados.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Fecha</FormLabel>
              <Input type="date" value={fechaStr} onChange={(e) => setFechaStr(e.target.value)} />
            </FormControl>
          </SimpleGrid>
        </CardBody>
      </Card>

      {!mercadoId ? (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Text color="gray.500" textAlign="center" py={6}>
              {loadingMercados ? "Cargando mercados..." : "No hay mercados activos."}
            </Text>
          </CardBody>
        </Card>
      ) : loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="xl" color="pink.500" />
        </Box>
      ) : (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Heading size="sm" mb={4}>
              {mercadoNombre}
            </Heading>

            <SimpleGrid columns={{ base: 1, sm: 4 }} spacing={4} mb={6}>
              <Stat>
                <StatLabel>Cobradores</StatLabel>
                <StatNumber fontSize="xl" color="gray.700">
                  {resumen.cantidadCobradores}
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Cobros mensuales</StatLabel>
                <StatNumber fontSize="xl" color="cyan.600">
                  {formatCurrency(resumen.totalMensual)}
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel>Abonos registrados</StatLabel>
                <StatNumber fontSize="xl" color="orange.600">
                  {formatCurrency(resumen.totalAbonos)}
                </StatNumber>
              </Stat>
              <Stat>
                <StatLabel fontWeight="bold">Total del mercado</StatLabel>
                <StatNumber fontSize="2xl" color="pink.600" fontWeight="bold">
                  {formatCurrency(resumen.totalGeneral)}
                </StatNumber>
              </Stat>
            </SimpleGrid>

            {resumen.cobradores.length === 0 ? (
              <Text color="gray.500" fontStyle="italic" mb={4}>
                Ningún cobrador registró cobros ni abonos en este mercado en esta fecha.
              </Text>
            ) : (
              <TableContainer overflowX="auto" maxW="100%" mb={4} sx={{ WebkitOverflowScrolling: "touch" }}>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Cobrador</Th>
                      <Th isNumeric>Mensual</Th>
                      <Th isNumeric>Abonos</Th>
                      <Th isNumeric>Total</Th>
                      <Th>Su cierre diario</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {resumen.cobradores.map((c) => (
                      <Tr key={c.cobradorId}>
                        <Td fontWeight="medium">{c.cobradorNombre}</Td>
                        <Td isNumeric>{formatCurrency(c.totalMensual)}</Td>
                        <Td isNumeric>{formatCurrency(c.totalAbonos)}</Td>
                        <Td isNumeric fontWeight="bold">
                          {formatCurrency(c.totalGeneral)}
                        </Td>
                        <Td>
                          <Badge colorScheme={c.cerroSuDia ? "green" : "gray"}>{c.cerroSuDia ? "Cerrado" : "Pendiente"}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}

            {cierreExistente && (
              <Alert status="success" borderRadius="md" mb={4}>
                <AlertIcon />
                Este mercado ya se cerró el {fechaStr} a las{" "}
                {new Date(cierreExistente.cerrado_en).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}, con un total de{" "}
                {formatCurrency(cierreExistente.total_general)}
                {cierreExistente.cerrado_por_nombre ? ` (por ${cierreExistente.cerrado_por_nombre})` : ""}. Si se registró algo después, puedes volver a cerrar para actualizarlo.
              </Alert>
            )}

            <Button
              leftIcon={<ClipboardCheck size={18} />}
              colorScheme="pink"
              size={{ base: "md", md: "lg" }}
              w={{ base: "full", sm: "auto" }}
              onClick={handleCerrarMercado}
              isLoading={cerrando}
              isDisabled={resumen.cantidadCobradores === 0}
            >
              {cierreExistente ? "Actualizar cierre del mercado" : "Cerrar mercado"}
            </Button>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}

export default function CierreMercadoPage() {
  return (
    <Suspense fallback={<Spinner size="xl" color="pink.500" />}>
      <CierreMercadoContent />
    </Suspense>
  );
}
