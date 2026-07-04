"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardBody,
  HStack,
  Heading,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, FileText, ListOrdered, Store, Users } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getCobradoresActivos } from "@/lib/data/repositories/cobradores.repo";
import { getMercadosActivos } from "@/lib/data/repositories/mercados.repo";
import { getEstadisticasDelMes } from "@/lib/data/repositories/cobros.repo";
import { getTotalDeudaPendienteSistema } from "@/lib/data/repositories/cuentas.repo";

const formatCurrency = (amount: number): string => `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SECTIONS = [
  { path: "/cobradores", label: "Cobradores", description: "Gestionar cobradores y asignaciones", icon: Users, accent: "teal" },
  { path: "/mercados", label: "Mercados", description: "Administrar mercados", icon: Store, accent: "green" },
  { path: "/catalogo-rubros", label: "Catálogo de rubros", description: "Números de cuenta, conceptos y tipo (Vigente/Mora)", icon: ListOrdered, accent: "cyan" },
  { path: "/reportes/resumen-cobros", label: "Reportes – Resumen por rubro y mercado", description: "Resumen por catálogo de rubro (ej. 101.01) y mercado, con desglose por cliente, fecha y recibo", icon: FileText, accent: "purple" },
  { path: "/cierre-anual", label: "Cierre anual (mora)", description: "Pasar cobros pendientes a estado En mora al finalizar el año", icon: Calendar, accent: "orange" },
];

/**
 * Puerto de Dashboard.tsx original. Se omite el boton "Limpiar base de
 * datos" (resetDatabaseService + Cloud Function deleteAllUsersExceptAdmin):
 * MIGRATION_NOTES.md #4 documenta que Fase 8 reemplaza ese flujo completo
 * por una operacion server-side con service_role; no tiene sentido portar
 * la version client-side/Cloud Function ahora para descartarla despues.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    cobradoresActivos: 0,
    mercadosActivos: 0,
    totalMes: 0,
    deudaPendiente: 0,
  });

  useEffect(() => {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    (async () => {
      setLoading(true);
      try {
        const [cobradores, mercados, statsMes, deudaPendiente] = await Promise.all([
          getCobradoresActivos(),
          getMercadosActivos(),
          getEstadisticasDelMes(mes, anio),
          getTotalDeudaPendienteSistema(),
        ]);
        setStats({
          cobradoresActivos: cobradores.length,
          mercadosActivos: mercados.length,
          totalMes: statsMes.total,
          deudaPendiente,
        });
      } catch (error) {
        console.error("Error cargando estadisticas del dashboard:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch" w="full" maxW="100%">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Dashboard
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Bienvenido, {user?.nombre}. Accede a los módulos desde la cuadrícula.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={{ base: 3, sm: 4 }} w="full">
        <Card bg="white" borderWidth="1px" borderColor="gray.100" shadow="sm">
          <CardBody>
            <Stat>
              <StatLabel fontSize="xs" color="gray.500">
                Cobradores activos
              </StatLabel>
              <StatNumber fontSize="xl">{loading ? <Spinner size="sm" /> : stats.cobradoresActivos}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" borderWidth="1px" borderColor="gray.100" shadow="sm">
          <CardBody>
            <Stat>
              <StatLabel fontSize="xs" color="gray.500">
                Mercados activos
              </StatLabel>
              <StatNumber fontSize="xl">{loading ? <Spinner size="sm" /> : stats.mercadosActivos}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" borderWidth="1px" borderColor="gray.100" shadow="sm">
          <CardBody>
            <Stat>
              <StatLabel fontSize="xs" color="gray.500">
                Total mes (cobrado por recibo)
              </StatLabel>
              <StatNumber fontSize="xl">{loading ? <Spinner size="sm" /> : formatCurrency(stats.totalMes)}</StatNumber>
            </Stat>
          </CardBody>
        </Card>
        <Card bg="white" borderWidth="1px" borderColor="gray.100" shadow="sm">
          <CardBody>
            <Stat>
              <StatLabel fontSize="xs" color="gray.500">
                Deuda pendiente (meses vencidos)
              </StatLabel>
              <StatNumber fontSize="xl" color="orange.600">
                {loading ? <Spinner size="sm" /> : formatCurrency(stats.deudaPendiente)}
              </StatNumber>
              <StatHelpText fontSize="xs">Enero a mes anterior sin pagar</StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      <Box w="full">
        <Heading size={{ base: "sm", md: "md" }} fontWeight="600" color="gray.700" mb={{ base: 4, md: 5 }}>
          Módulos
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={{ base: 4, md: 5 }} w="full">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                as="button"
                textAlign="left"
                bg="white"
                borderWidth="2px"
                borderColor="gray.100"
                boxShadow="sm"
                cursor="pointer"
                transition="all 0.2s"
                minH={{ base: "100px", md: "120px" }}
                _hover={{
                  borderColor: `${item.accent}.300`,
                  boxShadow: "md",
                  transform: "translateY(-3px)",
                }}
                _active={{ transform: "scale(0.99)" }}
                onClick={() => router.push(item.path)}
              >
                <CardBody py={5} px={5}>
                  <HStack spacing={4} align="flex-start">
                    <Box p={3} borderRadius="xl" bg={`${item.accent}.50`} color={`${item.accent}.600`} flexShrink={0}>
                      <Icon size={28} strokeWidth={1.8} />
                    </Box>
                    <Box flex={1} minW={0}>
                      <Text fontWeight="700" color="gray.800" fontSize="md">
                        {item.label}
                      </Text>
                      <Text fontSize="sm" color="gray.500" mt={1} noOfLines={2}>
                        {item.description}
                      </Text>
                    </Box>
                    <Box flexShrink={0}>
                      <ChevronRight size={22} color="var(--chakra-colors-gray-400)" />
                    </Box>
                  </HStack>
                </CardBody>
              </Card>
            );
          })}
        </SimpleGrid>
      </Box>
    </VStack>
  );
}
