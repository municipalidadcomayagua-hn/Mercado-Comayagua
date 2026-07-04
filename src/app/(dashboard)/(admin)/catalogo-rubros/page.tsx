"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Edit, Plus, Trash2 } from "lucide-react";
import type { Rubro } from "@/lib/data/types";
import { createRubro, deleteRubro, getRubrosGlobales, updateRubro } from "@/lib/data/repositories/rubros.repo";

type TipoRubro = "vigente" | "mora";

const CODIGO_CUENTA_REGEX = /^[A-Za-z0-9.,\-_\s]*$/;

/**
 * Puerto de CatalogoRubrosAdmin.tsx + CatalogoRubros.tsx original. El
 * componente original aceptaba un `cobradorId` prop para reutilizarse con
 * el catalogo personal de un cobrador, pero el unico call-site en todo el
 * codigo (verificado con grep) lo invoca siempre con `RUBROS_GLOBAL_ID`
 * (`CatalogoRubrosAdmin.tsx`) - la rama "catalogo por cobrador" nunca se
 * ejercita. Se porta como pantalla fija sobre el catalogo global
 * (`getRubrosGlobales`/`createRubro(null, ...)`), sin el prop muerto.
 */
export default function CatalogoRubrosPage() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelarEliminarRef = useRef<HTMLButtonElement>(null);

  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [abreviatura, setAbreviatura] = useState("");
  const [concepto, setConcepto] = useState("");
  const [tipoRubro, setTipoRubro] = useState<TipoRubro>("vigente");
  const [rubroAEliminar, setRubroAEliminar] = useState<Rubro | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRubros(await getRubrosGlobales());
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudieron cargar los rubros", status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditingId(null);
    setCodigo("");
    setAbreviatura("");
    setConcepto("");
    setTipoRubro("vigente");
    onOpen();
  };

  const openEdit = (r: Rubro) => {
    setEditingId(r.id);
    setCodigo(r.codigo);
    setAbreviatura(r.abreviatura ?? "");
    setConcepto(r.concepto);
    setTipoRubro((r.tipo_rubro as TipoRubro) ?? "vigente");
    onOpen();
  };

  const handleSave = async () => {
    const cod = codigo.trim();
    const conc = concepto.trim();
    if (!cod || !conc) {
      toast({ title: "Campos requeridos", description: "Código y descripción son obligatorios", status: "warning", duration: 3000, isClosable: true });
      return;
    }
    const codigoCuenta = abreviatura.trim();
    if (codigoCuenta && !CODIGO_CUENTA_REGEX.test(codigoCuenta)) {
      toast({
        title: "Código de cuenta inválido",
        description: "Solo letras, números, puntos, comas, guiones y espacios (máx. 20 caracteres).",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    try {
      if (editingId) {
        await updateRubro(editingId, { codigo: cod, abreviatura: codigoCuenta, concepto: conc, tipo_rubro: tipoRubro });
        toast({ title: "Actualizado", description: "Rubro actualizado", status: "success", duration: 2000, isClosable: true });
      } else {
        await createRubro(null, { codigo: cod, abreviatura: codigoCuenta, concepto: conc, tipo_rubro: tipoRubro });
        toast({ title: "Agregado", description: "Rubro agregado al catálogo", status: "success", duration: 2000, isClosable: true });
      }
      onClose();
      load();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo guardar el rubro", status: "error", duration: 3000, isClosable: true });
    }
  };

  const confirmarEliminar = async () => {
    if (!rubroAEliminar) return;
    setEliminando(true);
    try {
      await deleteRubro(rubroAEliminar.id);
      toast({ title: "Eliminado", description: "Rubro eliminado", status: "success", duration: 2000, isClosable: true });
      setRubroAEliminar(null);
      load();
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo eliminar", status: "error", duration: 3000, isClosable: true });
    } finally {
      setEliminando(false);
    }
  };

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="lg" fontWeight="600" color="gray.800">
          Catálogo de rubros
        </Heading>
        <Text color="gray.500" fontSize="sm" mt={1}>
          Rubros globales para pagos mensuales y diarios
        </Text>
      </Box>

      <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <CardBody>
          <HStack justify="space-between" mb={4}>
            <Text fontSize="lg" fontWeight="bold">
              Catálogo de rubros
            </Text>
            <Button leftIcon={<Plus size={18} />} colorScheme="blue" onClick={openNew}>
              Agregar rubro
            </Button>
          </HStack>
          <Text fontSize="sm" color="gray.600" mb={4}>
            Catálogo global: los rubros que agregue aquí estarán disponibles para todos los cobradores en pagos mensuales y diarios.
          </Text>
          {loading ? (
            <Text>Cargando...</Text>
          ) : rubros.length === 0 ? (
            <Text color="gray.500" fontStyle="italic">
              No hay rubros. Agregue al menos uno para usarlos en pagos diarios.
            </Text>
          ) : (
            <>
              <TableContainer overflowX="auto" maxW="100%" display={{ base: "none", md: "block" }} sx={{ WebkitOverflowScrolling: "touch" }}>
                <Table size="sm" minW="480px">
                  <Thead>
                    <Tr>
                      <Th>Código</Th>
                      <Th>Código de cuenta</Th>
                      <Th>Descripción</Th>
                      <Th>Tipo</Th>
                      <Th w="120px">Acciones</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rubros.map((r) => (
                      <Tr key={r.id}>
                        <Td fontWeight="medium">{r.codigo}</Td>
                        <Td>{r.abreviatura || "—"}</Td>
                        <Td>{r.concepto}</Td>
                        <Td>
                          <Badge colorScheme={(r.tipo_rubro ?? "vigente") === "mora" ? "orange" : "green"} size="sm">
                            {(r.tipo_rubro ?? "vigente") === "mora" ? "Mora" : "Vigente"}
                          </Badge>
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <IconButton aria-label="Editar" icon={<Edit size={14} />} size="xs" variant="ghost" colorScheme="blue" onClick={() => openEdit(r)} />
                            <IconButton aria-label="Eliminar" icon={<Trash2 size={14} />} size="xs" variant="ghost" colorScheme="red" onClick={() => setRubroAEliminar(r)} />
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>

              <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
                {rubros.map((r) => (
                  <Box key={r.id} p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                    <HStack justify="space-between" align="flex-start">
                      <Box minW={0}>
                        <HStack spacing={2}>
                          <Text fontWeight="bold" fontSize="md">
                            {r.codigo}
                          </Text>
                          {r.abreviatura && (
                            <Text fontSize="xs" color="gray.500">
                              ({r.abreviatura})
                            </Text>
                          )}
                        </HStack>
                        <Text fontSize="sm" color="gray.600" noOfLines={2}>
                          {r.concepto}
                        </Text>
                      </Box>
                      <Badge colorScheme={(r.tipo_rubro ?? "vigente") === "mora" ? "orange" : "green"} flexShrink={0}>
                        {(r.tipo_rubro ?? "vigente") === "mora" ? "Mora" : "Vigente"}
                      </Badge>
                    </HStack>
                    <HStack spacing={2} pt={3} mt={3} borderTopWidth="1px" borderColor="gray.100">
                      <Button leftIcon={<Edit size={16} />} size="sm" variant="outline" flex="1" onClick={() => openEdit(r)}>
                        Editar
                      </Button>
                      <Button leftIcon={<Trash2 size={16} />} size="sm" colorScheme="red" variant="outline" flex="1" onClick={() => setRubroAEliminar(r)}>
                        Eliminar
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingId ? "Editar rubro" : "Nuevo rubro"}</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Código</FormLabel>
                <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: 01" maxLength={20} />
              </FormControl>
              <FormControl>
                <FormLabel>Código de cuenta</FormLabel>
                <Input
                  value={abreviatura}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.length <= 20 && CODIGO_CUENTA_REGEX.test(v)) setAbreviatura(v);
                  }}
                  placeholder="Ej: A001, 01-02 (máx. 20 caracteres)"
                  maxLength={20}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Letras, números, puntos, comas, guiones. Opcional.
                </Text>
              </FormControl>
              <FormControl>
                <FormLabel>Descripción</FormLabel>
                <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Renta Diaria" />
              </FormControl>
              <FormControl>
                <FormLabel>Tipo de rubro</FormLabel>
                <Select value={tipoRubro} onChange={(e) => setTipoRubro(e.target.value as TipoRubro)}>
                  <option value="vigente">Vigente (pagos corrientes)</option>
                  <option value="mora">Mora (deuda histórica/recuperación)</option>
                </Select>
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Vigente: renta mensual, energía, etc. Mora: renta en mora, energía en mora, etc.
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handleSave}>
              {editingId ? "Guardar cambios" : "Agregar"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!rubroAEliminar} leastDestructiveRef={cancelarEliminarRef} onClose={() => setRubroAEliminar(null)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Eliminar rubro
          </AlertDialogHeader>
          <AlertDialogBody>
            ¿Eliminar el rubro <strong>{rubroAEliminar?.concepto}</strong> del catálogo?
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelarEliminarRef} onClick={() => setRubroAEliminar(null)} isDisabled={eliminando}>
              Cancelar
            </Button>
            <Button colorScheme="red" onClick={confirmarEliminar} ml={3} isLoading={eliminando}>
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}
