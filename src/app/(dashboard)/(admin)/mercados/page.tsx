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
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Edit, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Mercado } from "@/lib/data/types";
import { createMercado, deleteMercado, getMercados, updateMercado } from "@/lib/data/repositories/mercados.repo";

interface FormData {
  nombre: string;
  codigo: string;
  activo: boolean;
  administradorNombre: string;
  administradorTelefono: string;
  ubicacion: string;
  horario: string;
  notas: string;
}

const FORM_VACIO: FormData = {
  nombre: "",
  codigo: "",
  activo: true,
  administradorNombre: "",
  administradorTelefono: "",
  ubicacion: "",
  horario: "",
  notas: "",
};

/**
 * Puerto de GestionMercados.tsx original. El `window.confirm` de
 * handleEliminar se reemplaza por un AlertDialog de Chakra (mismo patron ya
 * usado en espacios/page.tsx para eliminar locatarios) - no es un cambio de
 * logica de negocio, solo el equivalente visual dentro del sistema de diseño.
 *
 * Datos de control agregados (administrador, ubicacion, horario, notas):
 * no existian en el original, se agregan a pedido para llevar mejor control
 * administrativo de cada mercado. Todos opcionales, no afectan ninguna
 * logica de cobros/folio/reportes existente.
 */
export default function MercadosPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelarEliminarRef = useRef<HTMLButtonElement>(null);

  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [selectedMercado, setSelectedMercado] = useState<Mercado | null>(null);
  const [mercadoAEliminar, setMercadoAEliminar] = useState<Mercado | null>(null);
  const [formData, setFormData] = useState<FormData>(FORM_VACIO);

  const loadMercados = async () => {
    setLoading(true);
    try {
      setMercados(await getMercados());
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los mercados", status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMercados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMercados = mercados.filter(
    (m) => m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (m.codigo ?? "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNuevo = () => {
    setSelectedMercado(null);
    setFormData(FORM_VACIO);
    onOpen();
  };

  const handleEditar = (mercado: Mercado) => {
    setSelectedMercado(mercado);
    setFormData({
      nombre: mercado.nombre,
      codigo: mercado.codigo ?? "",
      activo: mercado.activo ?? true,
      administradorNombre: mercado.administrador_nombre ?? "",
      administradorTelefono: mercado.administrador_telefono ?? "",
      ubicacion: mercado.ubicacion ?? "",
      horario: mercado.horario ?? "",
      notas: mercado.notas ?? "",
    });
    onOpen();
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({ title: "Error", description: "El nombre del mercado es requerido", status: "error", duration: 3000, isClosable: true });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: formData.nombre.trim(),
        codigo: formData.codigo.trim() || null,
        activo: formData.activo,
        administrador_nombre: formData.administradorNombre.trim() || null,
        administrador_telefono: formData.administradorTelefono.trim() || null,
        ubicacion: formData.ubicacion.trim() || null,
        horario: formData.horario.trim() || null,
        notas: formData.notas.trim() || null,
      };
      if (selectedMercado) {
        await updateMercado(selectedMercado.id, payload);
        toast({ title: "Éxito", description: "Mercado actualizado correctamente", status: "success", duration: 3000, isClosable: true });
      } else {
        await createMercado(payload);
        toast({ title: "Éxito", description: "Mercado creado correctamente", status: "success", duration: 3000, isClosable: true });
      }
      onClose();
      loadMercados();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo guardar el mercado", status: "error", duration: 3000, isClosable: true });
    } finally {
      setSaving(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!mercadoAEliminar) return;
    setEliminando(true);
    try {
      await deleteMercado(mercadoAEliminar.id);
      toast({ title: "Éxito", description: "Mercado eliminado", status: "success", duration: 3000, isClosable: true });
      setMercadoAEliminar(null);
      loadMercados();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo eliminar", status: "error", duration: 3000, isClosable: true });
    } finally {
      setEliminando(false);
    }
  };

  return (
    <VStack spacing={8} align="stretch">
      <HStack justify="space-between" align={{ base: "flex-start", md: "center" }} flexDirection={{ base: "column", md: "row" }} spacing={4} w="100%">
        <Box>
          <Heading size="lg" fontWeight="600" color="gray.800">
            Mercados
          </Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Sedes/mercados para asignar a los cobradores
          </Text>
        </Box>
        {isAdmin && (
          <Button leftIcon={<Plus size={16} />} colorScheme="blue" onClick={handleNuevo} size={{ base: "md", md: "lg" }} w={{ base: "full", md: "auto" }}>
            Nuevo Mercado
          </Button>
        )}
      </HStack>

      <Box p={4} bg="white" borderRadius="lg" borderWidth="1px" boxShadow="sm">
        <Box position="relative" mb={4}>
          <Input placeholder="Buscar por nombre o código..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} paddingLeft="40px" size="md" />
          <Box position="absolute" left="12px" top="50%" transform="translateY(-50%)">
            <Search size={20} color="var(--chakra-colors-gray-400)" />
          </Box>
        </Box>

        {loading ? (
          <Box textAlign="center" py={8}>
            <Spinner size="xl" color="blue.500" />
          </Box>
        ) : filteredMercados.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No hay mercados registrados</Text>
          </Box>
        ) : (
          <>
            <TableContainer overflowX="auto" maxW="100%" display={{ base: "none", md: "block" }} sx={{ WebkitOverflowScrolling: "touch" }}>
              <Table variant="simple" minW="560px">
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Código</Th>
                    <Th>Nombre</Th>
                    <Th>Administrador</Th>
                    <Th>Ubicación</Th>
                    <Th>Estado</Th>
                    {isAdmin && <Th>Acciones</Th>}
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredMercados.map((m) => (
                    <Tr key={m.id}>
                      <Td fontWeight="medium">{m.codigo || "-"}</Td>
                      <Td>{m.nombre}</Td>
                      <Td>
                        {m.administrador_nombre ? (
                          <>
                            <Text noOfLines={1}>{m.administrador_nombre}</Text>
                            {m.administrador_telefono && (
                              <Text fontSize="xs" color="gray.500">
                                {m.administrador_telefono}
                              </Text>
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        <Text noOfLines={1} maxW="200px">
                          {m.ubicacion || "-"}
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={m.activo ? "green" : "gray"}>{m.activo ? "Activo" : "Inactivo"}</Badge>
                      </Td>
                      {isAdmin && (
                        <Td>
                          <HStack spacing={2}>
                            <IconButton aria-label="Editar" icon={<Edit size={16} />} size="sm" variant="ghost" onClick={() => handleEditar(m)} />
                            <Button size="sm" colorScheme="red" variant="outline" onClick={() => setMercadoAEliminar(m)}>
                              Eliminar
                            </Button>
                          </HStack>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>

            <VStack spacing={3} align="stretch" display={{ base: "flex", md: "none" }}>
              {filteredMercados.map((m) => (
                <Box key={m.id} p={4} borderRadius="lg" borderWidth="1px" borderColor="gray.100">
                  <HStack justify="space-between" align="flex-start">
                    <Box minW={0}>
                      <Text fontWeight="bold" fontSize="md" noOfLines={1}>
                        {m.nombre}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {m.codigo || "Sin código"}
                      </Text>
                    </Box>
                    <Badge colorScheme={m.activo ? "green" : "gray"} flexShrink={0}>
                      {m.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </HStack>
                  {(m.administrador_nombre || m.ubicacion || m.horario) && (
                    <VStack align="stretch" spacing={0.5} mt={2} fontSize="sm" color="gray.600">
                      {m.administrador_nombre && (
                        <Text noOfLines={1}>
                          Admin: {m.administrador_nombre}
                          {m.administrador_telefono ? ` · ${m.administrador_telefono}` : ""}
                        </Text>
                      )}
                      {m.ubicacion && <Text noOfLines={1}>Ubicación: {m.ubicacion}</Text>}
                      {m.horario && <Text noOfLines={1}>Horario: {m.horario}</Text>}
                    </VStack>
                  )}
                  {isAdmin && (
                    <HStack spacing={2} pt={3} mt={3} borderTopWidth="1px" borderColor="gray.100">
                      <Button leftIcon={<Edit size={16} />} size="sm" variant="outline" flex="1" onClick={() => handleEditar(m)}>
                        Editar
                      </Button>
                      <Button size="sm" colorScheme="red" variant="outline" flex="1" onClick={() => setMercadoAEliminar(m)}>
                        Eliminar
                      </Button>
                    </HStack>
                  )}
                </Box>
              ))}
            </VStack>
          </>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "lg" }} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={{ base: 0, md: "auto" }} my={{ base: 0, md: "auto" }} maxH={{ base: "100vh", md: "90vh" }}>
          <ModalHeader fontSize={{ base: "md", md: "lg" }}>{selectedMercado ? "Editar Mercado" : "Nuevo Mercado"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Nombre</FormLabel>
                <Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Ej: Mercado Central" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Código (opcional)</FormLabel>
                <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej: MC01" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0} fontSize={{ base: "sm", md: "md" }}>
                  Activo
                </FormLabel>
                <Switch isChecked={formData.activo} onChange={(e) => setFormData({ ...formData, activo: e.target.checked })} size="lg" />
              </FormControl>

              <Box w="full" pt={2} borderTopWidth="1px" borderColor="gray.100">
                <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={3}>
                  Datos de control (opcionales)
                </Text>
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel fontSize={{ base: "sm", md: "md" }}>Administrador del mercado</FormLabel>
                    <Input
                      value={formData.administradorNombre}
                      onChange={(e) => setFormData({ ...formData, administradorNombre: e.target.value })}
                      placeholder="Nombre del encargado"
                      size={{ base: "md", md: "lg" }}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize={{ base: "sm", md: "md" }}>Teléfono del administrador</FormLabel>
                    <Input
                      value={formData.administradorTelefono}
                      onChange={(e) => setFormData({ ...formData, administradorTelefono: e.target.value })}
                      placeholder="Ej: 9999-9999"
                      type="tel"
                      size={{ base: "md", md: "lg" }}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize={{ base: "sm", md: "md" }}>Ubicación</FormLabel>
                    <Input
                      value={formData.ubicacion}
                      onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                      placeholder="Ej: Barrio El Centro, frente al parque"
                      size={{ base: "md", md: "lg" }}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize={{ base: "sm", md: "md" }}>Horario</FormLabel>
                    <Input
                      value={formData.horario}
                      onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                      placeholder="Ej: Lunes a sábado, 6:00 AM - 6:00 PM"
                      size={{ base: "md", md: "lg" }}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize={{ base: "sm", md: "md" }}>Notas</FormLabel>
                    <Textarea
                      value={formData.notas}
                      onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                      placeholder="Otros datos útiles: capacidad, referencias, observaciones..."
                      rows={3}
                      fontSize={{ base: "sm", md: "md" }}
                    />
                  </FormControl>
                </VStack>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter flexDirection={{ base: "column", sm: "row" }} gap={3}>
            <Button variant="outline" onClick={onClose} isDisabled={saving} w={{ base: "full", sm: "auto" }} size={{ base: "md", md: "lg" }}>
              Cancelar
            </Button>
            <Button colorScheme="blue" onClick={handleSave} isLoading={saving} loadingText="Guardando..." w={{ base: "full", sm: "auto" }} size={{ base: "md", md: "lg" }}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!mercadoAEliminar} leastDestructiveRef={cancelarEliminarRef} onClose={() => setMercadoAEliminar(null)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Eliminar mercado
          </AlertDialogHeader>
          <AlertDialogBody>
            ¿Está seguro de eliminar el mercado <strong>{mercadoAEliminar?.nombre}</strong>? Esta acción es irreversible.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelarEliminarRef} onClick={() => setMercadoAEliminar(null)} isDisabled={eliminando}>
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
