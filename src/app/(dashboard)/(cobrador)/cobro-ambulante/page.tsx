"use client";

import { Box, Card, CardBody, Heading, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { MapPin, Receipt, CalendarDays, Wallet, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Puerto del panel central (isPanelCentral) de CobroAmbulante.tsx original.
const COBRADOR_SECTIONS = [
  { path: "/cobro-ambulante/espacios", label: "Locatarios", description: "Registrar locatarios antes de cobros mensuales", icon: MapPin, accent: "teal" },
  { path: "/cobro-ambulante/pagos-mensuales", label: "Cobros mensuales", description: "Cobros por mes por locatario", icon: Receipt, accent: "cyan" },
  { path: "/cobro-ambulante/pagos-diarios", label: "Pagos diarios", description: "Registro de cobros del día", icon: CalendarDays, accent: "orange" },
  { path: "/cobro-ambulante/estado-cuenta", label: "Estado de cuenta", description: "Resumen y abonos", icon: Wallet, accent: "green" },
];

export default function CobroAmbulantePanelPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch" w="full" maxW="100%">
      <Box w="full">
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Dashboard
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Hola, {user?.nombre || "Cobrador"}. Accede a los módulos desde la cuadrícula.
        </Text>
      </Box>
      <Box w="full">
        <Heading size={{ base: "sm", md: "md" }} fontWeight="600" color="gray.700" mb={{ base: 4, md: 5 }}>
          Módulos
        </Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={{ base: 4, md: 5 }} w="full">
          {COBRADOR_SECTIONS.map((item) => {
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
                _hover={{ borderColor: `${item.accent}.300`, boxShadow: "md", transform: "translateY(-3px)" }}
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
