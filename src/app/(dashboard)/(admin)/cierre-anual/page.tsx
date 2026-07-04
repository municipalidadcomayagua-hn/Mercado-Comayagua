"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  Heading,
  Select,
  Spinner,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { AlertTriangle, Calendar } from "lucide-react";
import { ejecutarCierreAnual, getCobrosPendientesParaCierre } from "@/lib/data/repositories/cierre-anual.repo";

/**
 * Puerto de CierreAnualAdmin.tsx original. El `leastDestructiveRef={undefined as any}`
 * del AlertDialog original (workaround de tipos) se reemplaza por un
 * useRef real apuntando al boton "Cancelar" - mismo patron ya usado en el
 * resto de los AlertDialog de la app (espacios, mercados, catalogo-rubros).
 */
export default function CierreAnualPage() {
  const toast = useToast();
  const [anio, setAnio] = useState(new Date().getFullYear() - 1);
  const [pendientes, setPendientes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const loadPendientes = async () => {
    setLoading(true);
    try {
      setPendientes(await getCobrosPendientesParaCierre(anio));
    } catch (error) {
      console.error(error);
      setPendientes(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio]);

  const handleEjecutar = async () => {
    setEjecutando(true);
    try {
      const { cobrosMarcados, deudasMoraCreadas, puestosActualizados, errores } = await ejecutarCierreAnual(anio);
      onClose();
      toast({
        title: "Cierre anual ejecutado",
        description: `${cobrosMarcados} cobro(s) marcados como "En mora". ${deudasMoraCreadas} cuenta(s) de mora creadas/actualizadas. ${puestosActualizados} locatario(s) en mora. El año ${anio + 1} empieza en 0.`,
        status: "success",
        duration: 8000,
        isClosable: true,
      });
      if (errores.length > 0) {
        toast({ title: "Algunos errores", description: errores.slice(0, 3).join("; "), status: "warning", duration: 8000, isClosable: true });
      }
      await loadPendientes();
    } catch (error) {
      toast({ title: "Error al ejecutar cierre anual", description: error instanceof Error ? error.message : undefined, status: "error", duration: 6000, isClosable: true });
    } finally {
      setEjecutando(false);
    }
  };

  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="lg" fontWeight="600" color="gray.800">
          Cierre anual – Mora automática
        </Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>
          Al finalizar el año: la deuda pendiente pasa a cuentas de mora (por rubro). El año siguiente empieza en 0. Configure rubros tipo Mora (ej: Renta mensual en mora, Energía en mora).
        </Text>
      </Box>

      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <FormControl>
              <FormLabel>Año a cerrar</FormLabel>
              <Select value={anio} onChange={(e) => setAnio(parseInt(e.target.value, 10))} maxW="200px">
                {aniosDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </FormControl>

            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Cobros pendientes</AlertTitle>
                <AlertDescription>
                  {loading ? (
                    <Spinner size="sm" />
                  ) : pendientes !== null ? (
                    <>
                      Hay <strong>{pendientes}</strong> cobro(s) mensuales pendientes del año {anio} que serán marcados como &quot;En mora&quot; al ejecutar el cierre.
                    </>
                  ) : (
                    "No se pudo cargar el conteo."
                  )}
                </AlertDescription>
              </Box>
            </Alert>

            <Button leftIcon={<Calendar size={18} />} colorScheme="orange" onClick={onOpen} isDisabled={loading || (pendientes ?? 0) === 0} alignSelf="flex-start">
              Ejecutar cierre anual {anio}
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <AlertDialog isOpen={isOpen} onClose={onClose} leastDestructiveRef={cancelRef}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader display="flex" alignItems="center" gap={2}>
              <AlertTriangle size={24} color="var(--chakra-colors-orange-500)" />
              Confirmar cierre anual
            </AlertDialogHeader>
            <AlertDialogBody>
              Se transferirán <strong>{pendientes ?? 0}</strong> cobro(s) pendientes del año {anio} a cuentas de mora (por rubro). El año {anio + 1} empezará en 0. Los locatarios con deuda quedarán marcados como &quot;En mora&quot;. Ejecutar después
              del 31 de diciembre. ¿Continuar?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose} isDisabled={ejecutando}>
                Cancelar
              </Button>
              <Button colorScheme="orange" onClick={handleEjecutar} isLoading={ejecutando} ml={3}>
                Ejecutar cierre
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
