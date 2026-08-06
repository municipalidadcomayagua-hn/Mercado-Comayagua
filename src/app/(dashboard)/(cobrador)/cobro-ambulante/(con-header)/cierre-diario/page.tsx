"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertIcon, Box, Button, Card, CardBody, Heading, SimpleGrid, Spinner, Stat, StatLabel, StatNumber, Text, VStack } from "@chakra-ui/react";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cerrarDia, getCierreDelDia, getResumenDelDia, type ResumenDelDia } from "@/lib/data/repositories/cierre-diario.repo";
import type { CierreDiario } from "@/lib/data/types";

const formatCurrency = (n: number) => `L. ${n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const RESUMEN_VACIO: ResumenDelDia = { totalMensual: 0, cantidadMensual: 0, totalAbonos: 0, cantidadAbonos: 0, totalGeneral: 0 };

/**
 * Cierre diario general del cobrador (nuevo, no existia en el original): un
 * solo lugar para ver y confirmar todo lo cobrado en el dia (mensuales +
 * abonos). "cerrar el dia" guarda un snapshot auditable en cierres_diarios,
 * no cambia esos cobros/abonos.
 */
export default function CierreDiarioPage() {
  const { user } = useAuth();
  const cobradorId = user?.id;
  const mercadoId = user?.mercado_id ?? null;
  const hoy = new Date();
  const fechaTexto = hoy.toLocaleDateString("es-HN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenDelDia>(RESUMEN_VACIO);
  const [cierreExistente, setCierreExistente] = useState<CierreDiario | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    if (!cobradorId) return;
    setLoading(true);
    try {
      const [res, cierre] = await Promise.all([getResumenDelDia(cobradorId), getCierreDelDia(cobradorId)]);
      setResumen(res);
      setCierreExistente(cierre);
    } catch (error) {
      console.error("Error cargando resumen del día:", error);
    } finally {
      setLoading(false);
    }
  }, [cobradorId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCerrarDia = async () => {
    if (!cobradorId) return;
    setCerrando(true);
    try {
      const cierre = await cerrarDia(cobradorId, mercadoId, resumen);
      setCierreExistente(cierre);
    } catch (error) {
      console.error("Error cerrando el día:", error);
    } finally {
      setCerrando(false);
    }
  };

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Cierre diario
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1} textTransform="capitalize">
          {fechaTexto}
        </Text>
      </Box>

      {loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="xl" color="purple.500" />
        </Box>
      ) : (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Text fontSize="sm" color="gray.600" mb={4}>
              Resumen de todo lo cobrado hoy (cobros mensuales con recibo generado + abonos registrados hoy). Si falta algo, complételo en Cobros mensuales o Estado de cuenta antes de cerrar.
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4} mb={6}>
              <Stat>
                <StatLabel>Cobros mensuales</StatLabel>
                <StatNumber fontSize="xl" color="cyan.600">
                  {formatCurrency(resumen.totalMensual)}
                </StatNumber>
                <Text fontSize="xs" color="gray.500">
                  {resumen.cantidadMensual} recibo(s)
                </Text>
              </Stat>
              <Stat>
                <StatLabel>Abonos registrados</StatLabel>
                <StatNumber fontSize="xl" color="orange.600">
                  {formatCurrency(resumen.totalAbonos)}
                </StatNumber>
                <Text fontSize="xs" color="gray.500">
                  {resumen.cantidadAbonos} abono(s)
                </Text>
              </Stat>
              <Stat>
                <StatLabel fontWeight="bold">Total del día</StatLabel>
                <StatNumber fontSize="2xl" color="purple.600" fontWeight="bold">
                  {formatCurrency(resumen.totalGeneral)}
                </StatNumber>
              </Stat>
            </SimpleGrid>

            {cierreExistente && (
              <Alert status="success" borderRadius="md" mb={4}>
                <AlertIcon />
                Ya cerraste el día hoy a las{" "}
                {new Date(cierreExistente.cerrado_en).toLocaleTimeString("es-HN", { hour: "2-digit", minute: "2-digit" })}, con un total de{" "}
                {formatCurrency(cierreExistente.total_general)}. Si cobraste algo después, puedes volver a cerrar para actualizarlo.
              </Alert>
            )}

            <Button
              leftIcon={<CheckCircle2 size={18} />}
              colorScheme="purple"
              size={{ base: "md", md: "lg" }}
              w={{ base: "full", sm: "auto" }}
              onClick={handleCerrarDia}
              isLoading={cerrando}
              isDisabled={resumen.totalGeneral === 0 && resumen.cantidadMensual === 0 && resumen.cantidadAbonos === 0}
            >
              {cierreExistente ? "Actualizar cierre del día" : "Cerrar día"}
            </Button>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}
