"use client";

import { useEffect, useState } from "react";
import {
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
  Select,
  Spinner,
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
import { Edit, Eye, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import type { Cobrador, Mercado } from "@/lib/data/types";
import { generarCodigoCuenta, getCobradores, updateCobrador } from "@/lib/data/repositories/cobradores.repo";
import { getMercadosActivos } from "@/lib/data/repositories/mercados.repo";
import { updatePerfilMercado } from "@/lib/data/repositories/perfiles.repo";
import { crearCobradorAction } from "@/app/actions/cobradores";

type EstadoCobrador = "activo" | "suspendido" | "inactivo";

interface FormData {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
  estado: EstadoCobrador;
  mercadoId: string;
}

const FORM_VACIO: FormData = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  password: "",
  estado: "activo",
  mercadoId: "",
};

const getEstadoColor = (estado: string | null | undefined) => {
  switch (estado) {
    case "activo":
      return "green";
    case "suspendido":
      return "yellow";
    case "inactivo":
      return "red";
    default:
      return "gray";
  }
};

/**
 * Puerto de GestionAmbulantes.tsx original. `deleteAmbulante` /
 * `getUidByEmailFromUsuarios` no se portan: el primero se importaba en el
 * original pero ningun boton lo invocaba (verificado con grep - no hay
 * "Eliminar" en la pantalla); el segundo era un fallback para cuando
 * `Ambulante.userId` podia faltar, pero `cobradores.user_id` es NOT NULL en
 * el esquema nuevo (siempre se crea junto con el usuario de Auth via
 * `crearCobradorAction`), asi que el fallback ya no aplica.
 */
export default function CobradoresPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [cobradores, setCobradores] = useState<Cobrador[]>([]);
  const [mercados, setMercados] = useState<Mercado[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCobrador, setSelectedCobrador] = useState<Cobrador | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [codigoCuenta, setCodigoCuenta] = useState("");
  const [formData, setFormData] = useState<FormData>(FORM_VACIO);

  const loadCobradores = async () => {
    setLoading(true);
    try {
      setCobradores(await getCobradores());
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los cobradores", status: "error", duration: 3000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  const loadMercados = async () => {
    try {
      setMercados(await getMercadosActivos());
    } catch (error) {
      console.error("Error cargando mercados:", error);
    }
  };

  const loadCodigoCuenta = async () => {
    try {
      setCodigoCuenta(await generarCodigoCuenta(createClient()));
    } catch (error) {
      console.error("Error generando código:", error);
      setCodigoCuenta("A001");
    }
  };

  useEffect(() => {
    loadCobradores();
    loadMercados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOpen) loadMercados();
    if (!isOpen && !isEditing) loadCodigoCuenta();
  }, [isOpen, isEditing]);

  const filteredCobradores = cobradores.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.codigo_cuenta.toLowerCase().includes(term) ||
      c.nombre.toLowerCase().includes(term) ||
      c.apellido.toLowerCase().includes(term) ||
      c.dni.toLowerCase().includes(term) ||
      (c.telefono ?? "").toLowerCase().includes(term);
    const matchesEstado = filtroEstado === "todos" || c.estado === filtroEstado;
    return matchesSearch && matchesEstado;
  });

  const getMercadoNombre = (mercadoId: string | null | undefined): string => {
    if (!mercadoId) return "-";
    return mercados.find((m) => m.id === mercadoId)?.nombre ?? "-";
  };

  const handleNuevoCobrador = async () => {
    setSelectedCobrador(null);
    setIsEditing(true);
    setFormData(FORM_VACIO);
    await loadCodigoCuenta();
    onOpen();
  };

  const handleEditarCobrador = (cobrador: Cobrador) => {
    setSelectedCobrador(cobrador);
    setIsEditing(true);
    setCodigoCuenta(cobrador.codigo_cuenta);
    setFormData({
      nombre: cobrador.nombre,
      apellido: cobrador.apellido,
      dni: cobrador.dni,
      telefono: cobrador.telefono ?? "",
      email: cobrador.email ?? "",
      password: "",
      estado: (cobrador.estado as EstadoCobrador) || "activo",
      mercadoId: cobrador.mercado_id ?? "",
    });
    onOpen();
  };

  const handleVerCobrador = (cobrador: Cobrador) => {
    setSelectedCobrador(cobrador);
    setIsEditing(false);
    setCodigoCuenta(cobrador.codigo_cuenta);
    setFormData({
      nombre: cobrador.nombre,
      apellido: cobrador.apellido,
      dni: cobrador.dni,
      telefono: cobrador.telefono ?? "",
      email: cobrador.email ?? "",
      password: "",
      estado: (cobrador.estado as EstadoCobrador) || "activo",
      mercadoId: cobrador.mercado_id ?? "",
    });
    onOpen();
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.apellido || !formData.dni) {
      toast({ title: "Error", description: "Por favor complete todos los campos requeridos", status: "error", duration: 3000, isClosable: true });
      return;
    }

    if (!selectedCobrador) {
      if (!formData.email) {
        toast({ title: "Error", description: "El correo electrónico es requerido", status: "error", duration: 3000, isClosable: true });
        return;
      }
      if (!formData.email.endsWith("@mercado.com")) {
        toast({ title: "Error", description: "El correo electrónico debe terminar en @mercado.com", status: "error", duration: 3000, isClosable: true });
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", status: "error", duration: 3000, isClosable: true });
        return;
      }
    }

    setSaving(true);
    try {
      const mercadoIdValue = formData.mercadoId.trim() ? formData.mercadoId : null;

      if (selectedCobrador) {
        await updateCobrador(selectedCobrador.id, {
          nombre: formData.nombre,
          apellido: formData.apellido,
          dni: formData.dni,
          telefono: formData.telefono || null,
          email: formData.email || null,
          estado: formData.estado,
          mercado_id: mercadoIdValue,
        });
        await updatePerfilMercado(selectedCobrador.user_id, mercadoIdValue);
        toast({ title: "Éxito", description: "Cobrador actualizado correctamente", status: "success", duration: 3000, isClosable: true });
      } else {
        await crearCobradorAction({
          nombre: formData.nombre,
          apellido: formData.apellido,
          dni: formData.dni,
          email: formData.email,
          telefono: formData.telefono || undefined,
          password: formData.password,
          mercadoId: mercadoIdValue,
        });
        toast({
          title: "Éxito",
          description: "Cobrador creado correctamente. El usuario puede iniciar sesión con su correo y contraseña.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      }
      onClose();
      loadCobradores();
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo guardar el cobrador", status: "error", duration: 5000, isClosable: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack spacing={8} align="stretch">
      <HStack justify="space-between" align={{ base: "flex-start", md: "center" }} flexDirection={{ base: "column", md: "row" }} spacing={4} w="100%">
        <Box>
          <Heading size="lg" fontWeight="600" color="gray.800">
            Cobradores
          </Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Administración de cobradores
          </Text>
        </Box>
        {isAdmin && (
          <Button leftIcon={<Plus size={16} />} colorScheme="blue" onClick={handleNuevoCobrador} size={{ base: "md", md: "lg" }} w={{ base: "full", md: "auto" }}>
            Nuevo cobrador
          </Button>
        )}
      </HStack>

      <Box p={{ base: 4, md: 6 }} bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
        <HStack spacing={4} flexDirection={{ base: "column", md: "row" }} align={{ base: "stretch", md: "center" }}>
          <Box flex="1" position="relative" w="100%">
            <Input
              placeholder="Buscar por código, nombre, apellido o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              paddingLeft="40px"
              size={{ base: "md", md: "lg" }}
            />
            <Box position="absolute" left="12px" top="50%" transform="translateY(-50%)">
              <Search size={20} color="var(--chakra-colors-gray-400)" />
            </Box>
          </Box>
          <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} maxW={{ base: "100%", md: "200px" }} size={{ base: "md", md: "lg" }}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="suspendido">Suspendidos</option>
            <option value="inactivo">Inactivos</option>
          </Select>
        </HStack>
      </Box>

      {loading && (
        <Box textAlign="center" py={8}>
          <Spinner size="xl" color="blue.500" />
        </Box>
      )}

      {!loading && (
        <>
          <Box bg="white" borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)" overflow="hidden" display={{ base: "none", md: "block" }}>
            <TableContainer overflowX="auto" maxW="100%" sx={{ WebkitOverflowScrolling: "touch" }}>
              <Table variant="simple" size="sm" minW={{ md: "640px" }}>
                <Thead bg="gray.50">
                  <Tr>
                    <Th>Código</Th>
                    <Th>Nombre Completo</Th>
                    <Th>DNI</Th>
                    <Th>Teléfono</Th>
                    <Th>Correo</Th>
                    <Th>Mercado</Th>
                    <Th>Estado</Th>
                    <Th>Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredCobradores.length === 0 ? (
                    <Tr>
                      <Td colSpan={8} textAlign="center" py={8}>
                        <Text color="gray.500">No hay cobradores registrados</Text>
                      </Td>
                    </Tr>
                  ) : (
                    filteredCobradores.map((c) => (
                      <Tr key={c.id}>
                        <Td fontWeight="bold">{c.codigo_cuenta}</Td>
                        <Td>{`${c.nombre} ${c.apellido}`}</Td>
                        <Td>{c.dni}</Td>
                        <Td>{c.telefono || "-"}</Td>
                        <Td>{c.email || "-"}</Td>
                        <Td>{getMercadoNombre(c.mercado_id)}</Td>
                        <Td>
                          <Badge colorScheme={getEstadoColor(c.estado ?? "activo")}>{(c.estado ?? "activo").toUpperCase()}</Badge>
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <IconButton aria-label="Ver detalles" icon={<Eye size={16} />} size="sm" variant="ghost" onClick={() => handleVerCobrador(c)} />
                            {isAdmin && <IconButton aria-label="Editar" icon={<Edit size={16} />} size="sm" variant="ghost" onClick={() => handleEditarCobrador(c)} />}
                          </HStack>
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>

          <VStack spacing={4} align="stretch" display={{ base: "flex", md: "none" }}>
            {filteredCobradores.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">No hay cobradores registrados</Text>
              </Box>
            ) : (
              filteredCobradores.map((c) => (
                <Box key={c.id} bg="white" p={4} borderRadius="lg" borderWidth="1px" boxShadow="sm">
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between" align="flex-start">
                      <Box>
                        <Text fontWeight="bold" fontSize="md">
                          {c.codigo_cuenta}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {c.nombre} {c.apellido}
                        </Text>
                      </Box>
                      <Badge colorScheme={getEstadoColor(c.estado ?? "activo")}>{(c.estado ?? "activo").toUpperCase()}</Badge>
                    </HStack>

                    <VStack spacing={2} align="stretch" fontSize="sm">
                      <HStack justify="space-between">
                        <Text color="gray.600">Mercado:</Text>
                        <Text fontWeight="medium">{getMercadoNombre(c.mercado_id)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text color="gray.600">DNI:</Text>
                        <Text fontWeight="medium">{c.dni}</Text>
                      </HStack>
                      {c.telefono && (
                        <HStack justify="space-between">
                          <Text color="gray.600">Teléfono:</Text>
                          <Text fontWeight="medium">{c.telefono}</Text>
                        </HStack>
                      )}
                      {c.email && (
                        <HStack justify="space-between">
                          <Text color="gray.600">Correo:</Text>
                          <Text fontWeight="medium" fontSize="xs">
                            {c.email}
                          </Text>
                        </HStack>
                      )}
                    </VStack>

                    <HStack spacing={2} pt={2}>
                      <Button leftIcon={<Eye size={16} />} size="sm" variant="outline" flex="1" onClick={() => handleVerCobrador(c)}>
                        Ver
                      </Button>
                      {isAdmin && (
                        <Button leftIcon={<Edit size={16} />} size="sm" colorScheme="blue" flex="1" onClick={() => handleEditarCobrador(c)}>
                          Editar
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              ))
            )}
          </VStack>
        </>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "lg" }} scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent mx={{ base: 0, md: "auto" }} my={{ base: 0, md: "auto" }} maxH={{ base: "100vh", md: "90vh" }}>
          <ModalHeader fontSize={{ base: "md", md: "lg" }}>{isEditing ? "Editar cobrador" : selectedCobrador ? "Detalles del cobrador" : "Nuevo cobrador"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isDisabled>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Código de Cuenta</FormLabel>
                <Input value={codigoCuenta} isDisabled size={{ base: "md", md: "lg" }} />
              </FormControl>

              <FormControl isRequired isDisabled={!isEditing}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Nombre</FormLabel>
                <Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} placeholder="Nombre del cobrador" isDisabled={!isEditing} size={{ base: "md", md: "lg" }} />
              </FormControl>

              <FormControl isRequired isDisabled={!isEditing}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Apellido</FormLabel>
                <Input value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value })} placeholder="Apellido del cobrador" isDisabled={!isEditing} size={{ base: "md", md: "lg" }} />
              </FormControl>

              <FormControl isRequired isDisabled={!isEditing}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>DNI</FormLabel>
                <Input value={formData.dni} onChange={(e) => setFormData({ ...formData, dni: e.target.value })} placeholder="Número de DNI" isDisabled={!isEditing} size={{ base: "md", md: "lg" }} />
              </FormControl>

              <FormControl isDisabled={!isEditing}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Teléfono</FormLabel>
                <Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="Teléfono" isDisabled={!isEditing} size={{ base: "md", md: "lg" }} />
              </FormControl>

              <FormControl isRequired={!selectedCobrador} isDisabled={!isEditing}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Correo Electrónico</FormLabel>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="ejemplo@mercado.com" isDisabled={!isEditing} size={{ base: "md", md: "lg" }} />
                {!selectedCobrador && (
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    El correo debe terminar en @mercado.com
                  </Text>
                )}
              </FormControl>

              {!selectedCobrador && isEditing && (
                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Contraseña</FormLabel>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Mínimo 6 caracteres" size={{ base: "md", md: "lg" }} />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    El cobrador usará esta contraseña para iniciar sesión
                  </Text>
                </FormControl>
              )}

              {isEditing && (
                <FormControl>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Mercado asignado</FormLabel>
                  <Select value={formData.mercadoId} onChange={(e) => setFormData({ ...formData, mercadoId: e.target.value })} size={{ base: "md", md: "lg" }} placeholder="Sin mercado">
                    {mercados.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}

              {isEditing && (
                <FormControl>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Estado</FormLabel>
                  <Select value={formData.estado} onChange={(e) => setFormData({ ...formData, estado: e.target.value as EstadoCobrador })} size={{ base: "md", md: "lg" }}>
                    <option value="activo">Activo</option>
                    <option value="suspendido">Suspendido</option>
                    <option value="inactivo">Inactivo</option>
                  </Select>
                </FormControl>
              )}

              {selectedCobrador && !isEditing && (
                <FormControl>
                  <FormLabel fontSize={{ base: "sm", md: "md" }}>Fecha de Registro</FormLabel>
                  <Input value={new Date(selectedCobrador.created_at).toLocaleDateString()} isDisabled size={{ base: "md", md: "lg" }} />
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter flexDirection={{ base: "column", sm: "row" }} gap={3}>
            <Button variant="outline" onClick={onClose} w={{ base: "full", sm: "auto" }} size={{ base: "md", md: "lg" }} isDisabled={saving}>
              {isEditing ? "Cancelar" : "Cerrar"}
            </Button>
            {isEditing && (
              <Button colorScheme="blue" onClick={handleSave} w={{ base: "full", sm: "auto" }} size={{ base: "md", md: "lg" }} isLoading={saving} loadingText="Guardando...">
                Guardar Cambios
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
