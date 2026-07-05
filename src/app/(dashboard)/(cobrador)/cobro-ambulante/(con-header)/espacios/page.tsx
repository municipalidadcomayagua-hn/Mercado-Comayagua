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
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { CalendarDays, Edit, Plus, Save, Trash2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createPuesto, existePuesto, getPuestosPorAmbulante, updatePuesto, eliminarLocatarioCompleto } from "@/lib/data/repositories/puestos.repo";
import { createCobro } from "@/lib/data/repositories/cobros.repo";
import { sumarMontoACuenta } from "@/lib/data/repositories/cuentas.repo";
import { siguienteNumeroRecibo } from "@/lib/data/repositories/folio.repo";
import { getRubrosGlobales } from "@/lib/data/repositories/rubros.repo";
import type { Puesto, Rubro } from "@/lib/data/types";
import { FotosUploader } from "@/components/cobrador/FotosUploader";
import SeccionMoraLocatario from "@/components/cobrador/SeccionMoraLocatario";

const formatCurrency = (amount: number): string => `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Fila de rubro en el formulario de espacio (no confundir con Rubro = fila del catalogo). */
interface RubroFilaDraft {
  codigo: string;
  concepto: string;
  monto: string;
  rubroId?: string;
}

interface DraftEspacio {
  nombreCliente: string;
  numeroPuesto: string;
  tipoPuesto: string;
  valorDiario: string;
  numeroIdentidad: string;
  rtn: string;
  direccionCliente: string;
  telefono: string;
  observaciones: string;
  fotoDocumentoUrl: string;
  fotoPermisoOperacionUrls: string[];
  fotoContratoArrendamientoUrls: string[];
  fotoTarjetaCobroAnualUrls: string[];
}

const DRAFT_VACIO: DraftEspacio = {
  nombreCliente: "",
  numeroPuesto: "",
  tipoPuesto: "",
  valorDiario: "",
  numeroIdentidad: "",
  rtn: "",
  direccionCliente: "",
  telefono: "",
  observaciones: "",
  fotoDocumentoUrl: "",
  fotoPermisoOperacionUrls: [],
  fotoContratoArrendamientoUrls: [],
  fotoTarjetaCobroAnualUrls: [],
};

// Puerto de la vista "Locatarios" (VistaEspaciosAsignados) de CobroAmbulante.tsx original.
export default function EspaciosPage() {
  const { user } = useAuth();
  const cobradorId = user?.id;
  const mercadoId = user?.mercado_id ?? undefined;
  const nombreCobrador = user?.nombre || "";
  const anio = new Date().getFullYear();
  const toast = useToast();

  const [espaciosList, setEspaciosList] = useState<Puesto[]>([]);
  const [loadingEspacios, setLoadingEspacios] = useState(false);
  const [showNewEspacioForm, setShowNewEspacioForm] = useState(false);
  const [editEspacioId, setEditEspacioId] = useState<string | null>(null);
  const [draftEspacio, setDraftEspacio] = useState<DraftEspacio>(DRAFT_VACIO);
  const [draftRubrosEspacio, setDraftRubrosEspacio] = useState<RubroFilaDraft[]>([]);
  const [rubrosCatalogo, setRubrosCatalogo] = useState<Rubro[]>([]);
  const [savingEspacio, setSavingEspacio] = useState(false);
  const [distribuyendoEspacio, setDistribuyendoEspacio] = useState(false);

  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [subiendoFotoPermiso, setSubiendoFotoPermiso] = useState(false);
  const [subiendoFotoContrato, setSubiendoFotoContrato] = useState(false);
  const [subiendoFotoTarjetaAnual, setSubiendoFotoTarjetaAnual] = useState(false);

  const [permisoFotosPuesto, setPermisoFotosPuesto] = useState<Puesto | null>(null);
  const [contratoFotosPuesto, setContratoFotosPuesto] = useState<Puesto | null>(null);
  const [tarjetaAnualFotosPuesto, setTarjetaAnualFotosPuesto] = useState<Puesto | null>(null);
  const { isOpen: isPermisoFotosOpen, onOpen: onPermisoFotosOpen, onClose: onPermisoFotosClose } = useDisclosure();
  const { isOpen: isContratoFotosOpen, onOpen: onContratoFotosOpen, onClose: onContratoFotosClose } = useDisclosure();
  const { isOpen: isTarjetaAnualFotosOpen, onOpen: onTarjetaAnualFotosOpen, onClose: onTarjetaAnualFotosClose } = useDisclosure();
  const [moraPuesto, setMoraPuesto] = useState<Puesto | null>(null);

  const [puestoAEliminar, setPuestoAEliminar] = useState<Puesto | null>(null);
  const [eliminandoLocatario, setEliminandoLocatario] = useState(false);
  const cancelarEliminarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getRubrosGlobales()
      .then((rubros) => setRubrosCatalogo(rubros.filter((r) => (r.tipo_rubro ?? "vigente") === "vigente")))
      .catch(() => setRubrosCatalogo([]));
  }, []);

  useEffect(() => {
    if (cobradorId) loadEspacios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobradorId]);

  const loadEspacios = async () => {
    if (!cobradorId) return;
    setLoadingEspacios(true);
    try {
      const list = await getPuestosPorAmbulante(cobradorId, anio);
      setEspaciosList(list.filter((p) => p.activo !== false));
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los locatarios", status: "error", isClosable: true });
    } finally {
      setLoadingEspacios(false);
    }
  };

  const limpiarDraft = () => {
    setDraftEspacio(DRAFT_VACIO);
    setDraftRubrosEspacio([]);
  };

  const handleSaveNewEspacio = async () => {
    if (!cobradorId || !draftEspacio.nombreCliente.trim() || !draftEspacio.numeroPuesto.trim() || !draftEspacio.tipoPuesto.trim()) {
      toast({ title: "Campos requeridos", description: "Complete nombre del locatario, número y tipo de puesto", status: "error", isClosable: true });
      return;
    }
    const existe = await existePuesto(cobradorId, draftEspacio.numeroPuesto.trim(), anio);
    if (existe) {
      toast({ title: "Error", description: `Ya existe un locatario con el número ${draftEspacio.numeroPuesto} para este año`, status: "error", isClosable: true });
      return;
    }
    setSavingEspacio(true);
    try {
      await createPuesto({
        cobrador_id: cobradorId,
        nombre_cliente: draftEspacio.nombreCliente.trim(),
        numero_puesto: draftEspacio.numeroPuesto.trim(),
        tipo_puesto: draftEspacio.tipoPuesto,
        valor_diario: parseFloat(draftEspacio.valorDiario) || 0,
        anio,
        activo: true,
        numero_identidad: draftEspacio.numeroIdentidad.trim() || null,
        rtn: draftEspacio.rtn.trim() || null,
        direccion_cliente: draftEspacio.direccionCliente.trim() || null,
        telefono: draftEspacio.telefono.trim() || null,
        observaciones: draftEspacio.observaciones.trim() || null,
        foto_documento_url: draftEspacio.fotoDocumentoUrl.trim() || null,
        foto_permiso_operacion_urls: draftEspacio.fotoPermisoOperacionUrls.length ? draftEspacio.fotoPermisoOperacionUrls : null,
        foto_contrato_arrendamiento_urls: draftEspacio.fotoContratoArrendamientoUrls.length ? draftEspacio.fotoContratoArrendamientoUrls : null,
        foto_tarjeta_cobro_anual_urls: draftEspacio.fotoTarjetaCobroAnualUrls.length ? draftEspacio.fotoTarjetaCobroAnualUrls : null,
      });
      toast({ title: "Locatario registrado", status: "success", isClosable: true });
      limpiarDraft();
      setShowNewEspacioForm(false);
      loadEspacios();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al guardar", description: e instanceof Error ? e.message : undefined, status: "error", duration: 8000, isClosable: true });
    } finally {
      setSavingEspacio(false);
    }
  };

  const handleUpdateEspacio = async () => {
    if (!editEspacioId || !draftEspacio.nombreCliente.trim() || !draftEspacio.numeroPuesto.trim() || !draftEspacio.tipoPuesto.trim()) return;
    setSavingEspacio(true);
    try {
      await updatePuesto(editEspacioId, {
        nombre_cliente: draftEspacio.nombreCliente.trim(),
        numero_puesto: draftEspacio.numeroPuesto.trim(),
        tipo_puesto: draftEspacio.tipoPuesto,
        valor_diario: parseFloat(draftEspacio.valorDiario) || 0,
        numero_identidad: draftEspacio.numeroIdentidad.trim() || null,
        rtn: draftEspacio.rtn.trim() || null,
        direccion_cliente: draftEspacio.direccionCliente.trim() || null,
        telefono: draftEspacio.telefono.trim() || null,
        observaciones: draftEspacio.observaciones.trim() || null,
        foto_documento_url: draftEspacio.fotoDocumentoUrl.trim() || null,
        foto_permiso_operacion_urls: draftEspacio.fotoPermisoOperacionUrls.length ? draftEspacio.fotoPermisoOperacionUrls : null,
        foto_contrato_arrendamiento_urls: draftEspacio.fotoContratoArrendamientoUrls.length ? draftEspacio.fotoContratoArrendamientoUrls : null,
        foto_tarjeta_cobro_anual_urls: draftEspacio.fotoTarjetaCobroAnualUrls.length ? draftEspacio.fotoTarjetaCobroAnualUrls : null,
      });
      toast({ title: "Espacio actualizado", status: "success", isClosable: true });
      setEditEspacioId(null);
      limpiarDraft();
      loadEspacios();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al actualizar", description: e instanceof Error ? e.message : undefined, status: "error", duration: 8000, isClosable: true });
    } finally {
      setSavingEspacio(false);
    }
  };

  const handleGuardarEspacioYDistribuir = async () => {
    if (!cobradorId || !draftEspacio.nombreCliente.trim() || !draftEspacio.numeroPuesto.trim() || !draftEspacio.tipoPuesto.trim()) {
      toast({ title: "Campos requeridos", description: "Complete nombre del locatario, número y tipo de puesto", status: "error", isClosable: true });
      return;
    }
    const plantilla = draftRubrosEspacio.filter((r) => (r.codigo || r.concepto || r.rubroId) && r.monto && parseFloat(r.monto) > 0);
    if (plantilla.length === 0) {
      toast({ title: "Rubros requeridos", description: "Agregue al menos un rubro del catálogo con monto mayor a 0", status: "error", isClosable: true });
      return;
    }
    const existe = await existePuesto(cobradorId, draftEspacio.numeroPuesto.trim(), anio);
    if (existe) {
      toast({ title: "Error", description: `Ya existe un locatario con el número ${draftEspacio.numeroPuesto} para este año`, status: "error", isClosable: true });
      return;
    }
    setDistribuyendoEspacio(true);
    try {
      await createPuesto({
        cobrador_id: cobradorId,
        nombre_cliente: draftEspacio.nombreCliente.trim(),
        numero_puesto: draftEspacio.numeroPuesto.trim(),
        tipo_puesto: draftEspacio.tipoPuesto,
        valor_diario: parseFloat(draftEspacio.valorDiario) || 0,
        anio,
        activo: true,
        numero_identidad: draftEspacio.numeroIdentidad.trim() || null,
        rtn: draftEspacio.rtn.trim() || null,
        direccion_cliente: draftEspacio.direccionCliente.trim() || null,
        telefono: draftEspacio.telefono.trim() || null,
        observaciones: draftEspacio.observaciones.trim() || null,
        foto_documento_url: draftEspacio.fotoDocumentoUrl.trim() || null,
        foto_permiso_operacion_urls: draftEspacio.fotoPermisoOperacionUrls.length ? draftEspacio.fotoPermisoOperacionUrls : null,
        foto_contrato_arrendamiento_urls: draftEspacio.fotoContratoArrendamientoUrls.length ? draftEspacio.fotoContratoArrendamientoUrls : null,
        foto_tarjeta_cobro_anual_urls: draftEspacio.fotoTarjetaCobroAnualUrls.length ? draftEspacio.fotoTarjetaCobroAnualUrls : null,
      });

      const pagosAdicionales = plantilla.map((r) => {
        const cat = r.rubroId ? rubrosCatalogo.find((c) => c.id === r.rubroId) : undefined;
        const codigo = cat?.codigo ?? r.codigo ?? "";
        const concepto = cat?.concepto ?? r.concepto ?? "Rubro";
        return { concepto: [codigo, concepto].filter(Boolean).join(". ") || "Rubro", monto: parseFloat(r.monto) || 0 };
      });
      const montoTotal = pagosAdicionales.reduce((s, pa) => s + pa.monto, 0);

      // 12 numeros de recibo sequenciales (uno por mes), asignados de antemano
      // para poder crear los 12 cobros en paralelo despues.
      const numerosRecibo: number[] = [];
      for (let i = 0; i < 12; i++) {
        numerosRecibo.push(await siguienteNumeroRecibo(mercadoId ?? null));
      }

      await Promise.all(
        Array.from({ length: 12 }, (_, mesIndex) =>
          createCobro(
            {
              cobrador_id: cobradorId,
              codigo_cuenta: cobradorId,
              cobrador_nombre: nombreCobrador,
              nombre_cliente: draftEspacio.nombreCliente.trim(),
              numero_puesto: draftEspacio.numeroPuesto.trim(),
              tipo_puesto: draftEspacio.tipoPuesto,
              tipo_cobro: "mensual",
              valor_diario: 0,
              anio,
              monto: montoTotal,
              estado: "activo",
              mes: mesIndex + 1,
              renta_mensual: 0,
              pagos_adicionales: pagosAdicionales,
              recibo_generado: false,
              mercado_id: mercadoId,
            },
            { numeroRecibo: numerosRecibo[mesIndex], skipActualizarCuenta: true }
          )
        )
      );
      await sumarMontoACuenta(cobradorId, draftEspacio.numeroPuesto.trim(), 12 * montoTotal, draftEspacio.nombreCliente.trim());

      toast({
        title: "Espacio y 12 meses creados",
        description: "Los rubros quedaron distribuidos en los 12 meses. En Cobros mensuales puede editar rubros por mes y generar el recibo.",
        status: "success",
        duration: 6000,
        isClosable: true,
      });
      limpiarDraft();
      setShowNewEspacioForm(false);
      loadEspacios();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: e instanceof Error ? e.message : "No se pudo guardar el espacio ni distribuir los meses.", status: "error", duration: 8000, isClosable: true });
    } finally {
      setDistribuyendoEspacio(false);
    }
  };

  const confirmarEliminarLocatario = async () => {
    if (!puestoAEliminar) return;
    setEliminandoLocatario(true);
    try {
      await eliminarLocatarioCompleto(puestoAEliminar);
      toast({
        title: "Locatario eliminado",
        description: `${puestoAEliminar.nombre_cliente} (Puesto ${puestoAEliminar.numero_puesto}) fue eliminado. Se borraron todos los cobros, abonos y datos relacionados.`,
        status: "success",
        isClosable: true,
      });
      setPuestoAEliminar(null);
      loadEspacios();
    } catch (e) {
      console.error(e);
      toast({ title: "Error al eliminar", description: e instanceof Error ? e.message : undefined, status: "error", isClosable: true });
    } finally {
      setEliminandoLocatario(false);
    }
  };

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Locatarios
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1}>
          Registre cada locatario, agregue los rubros del catálogo del admin y distribúyalos en los 12 meses. En Cobros mensuales podrá generar el recibo y editar o agregar/eliminar rubros por mes.
        </Text>
      </Box>

      <Box>
        {!showNewEspacioForm && !editEspacioId && (
          <Button
            leftIcon={<Plus size={18} />}
            colorScheme="teal"
            onClick={() => {
              setShowNewEspacioForm(true);
              setEditEspacioId(null);
              limpiarDraft();
            }}
            size={{ base: "md", md: "lg" }}
          >
            Agregar locatario
          </Button>
        )}
      </Box>

      {(showNewEspacioForm || editEspacioId) && (
        <Card borderWidth="2px" borderColor="teal.200" bg="teal.50" maxW="100%" overflow="visible">
          <CardBody p={{ base: 3, md: 6 }} overflow="visible">
            <Heading size="sm" mb={4}>
              {editEspacioId ? "Editar locatario" : "Nuevo locatario"}
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Nombre del cliente</FormLabel>
                <Input value={draftEspacio.nombreCliente} onChange={(e) => setDraftEspacio((d) => ({ ...d, nombreCliente: e.target.value }))} placeholder="Dueño del espacio" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Número de puesto</FormLabel>
                <Input value={draftEspacio.numeroPuesto} onChange={(e) => setDraftEspacio((d) => ({ ...d, numeroPuesto: e.target.value }))} placeholder="Ej: 02" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Tipo</FormLabel>
                <Select value={draftEspacio.tipoPuesto} onChange={(e) => setDraftEspacio((d) => ({ ...d, tipoPuesto: e.target.value }))} placeholder="Seleccione" size={{ base: "md", md: "lg" }}>
                  <option value="Mercadería">Mercadería</option>
                  <option value="Frutas">Frutas</option>
                  <option value="Verduras">Verduras</option>
                  <option value="Ropa">Ropa</option>
                  <option value="Otros">Otros</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Valor de renta diaria (L.)</FormLabel>
                <Input type="number" step="0.01" min="0" value={draftEspacio.valorDiario} onChange={(e) => setDraftEspacio((d) => ({ ...d, valorDiario: e.target.value }))} placeholder="0.00" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Nº identidad (opcional)</FormLabel>
                <Input value={draftEspacio.numeroIdentidad} onChange={(e) => setDraftEspacio((d) => ({ ...d, numeroIdentidad: e.target.value }))} placeholder="0000-0000-00000" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>RTN (opcional)</FormLabel>
                <Input value={draftEspacio.rtn} onChange={(e) => setDraftEspacio((d) => ({ ...d, rtn: e.target.value }))} placeholder="RTN" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Dirección del cliente</FormLabel>
                <Input value={draftEspacio.direccionCliente} onChange={(e) => setDraftEspacio((d) => ({ ...d, direccionCliente: e.target.value }))} placeholder="Dirección" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Teléfono</FormLabel>
                <Input value={draftEspacio.telefono} onChange={(e) => setDraftEspacio((d) => ({ ...d, telefono: e.target.value }))} placeholder="Teléfono" type="tel" size={{ base: "md", md: "lg" }} />
              </FormControl>
              <FormControl gridColumn={{ base: "1", md: "1 / -1" }}>
                <FormLabel fontSize={{ base: "sm", md: "md" }}>Observaciones</FormLabel>
                <Textarea value={draftEspacio.observaciones} onChange={(e) => setDraftEspacio((d) => ({ ...d, observaciones: e.target.value }))} placeholder="Notas u observaciones" rows={3} fontSize={{ base: "sm", md: "md" }} />
              </FormControl>

              <Heading size="xs" gridColumn={{ base: "1", md: "1 / -1" }} mt={2} mb={1} color="teal.700">
                Documentación y fotos
              </Heading>
              <FormControl gridColumn={{ base: "1", md: "1 / -1" }}>
                <FormLabel>Documento de identidad o foto del titular</FormLabel>
                <FotosUploader
                  urls={draftEspacio.fotoDocumentoUrl ? [draftEspacio.fotoDocumentoUrl] : []}
                  onAdd={(urls) => setDraftEspacio((d) => ({ ...d, fotoDocumentoUrl: urls[0] }))}
                  onRemove={() => setDraftEspacio((d) => ({ ...d, fotoDocumentoUrl: "" }))}
                  multiple={false}
                  uploading={subiendoFoto}
                  setUploading={setSubiendoFoto}
                  cobradorId={cobradorId}
                  identificador={draftEspacio.numeroPuesto || draftEspacio.nombreCliente}
                  buttonLabel="Subir foto (DNI o cliente)"
                  colorScheme="teal"
                  thumbSize="120px"
                />
              </FormControl>
              <FormControl gridColumn={{ base: "1", md: "1 / -1" }}>
                <FormLabel>Fotos del permiso de operación</FormLabel>
                <FotosUploader
                  urls={draftEspacio.fotoPermisoOperacionUrls}
                  onAdd={(urls) => setDraftEspacio((d) => ({ ...d, fotoPermisoOperacionUrls: [...d.fotoPermisoOperacionUrls, ...urls] }))}
                  onRemove={(idx) => setDraftEspacio((d) => ({ ...d, fotoPermisoOperacionUrls: d.fotoPermisoOperacionUrls.filter((_, i) => i !== idx) }))}
                  multiple
                  uploading={subiendoFotoPermiso}
                  setUploading={setSubiendoFotoPermiso}
                  cobradorId={cobradorId}
                  identificador={draftEspacio.numeroPuesto || draftEspacio.nombreCliente}
                  subfolder="permisos"
                  buttonLabel="Agregar fotos del permiso"
                  descripcion="Puede subir varias fotos (el permiso suele tener más de una página)."
                />
              </FormControl>
              <FormControl gridColumn={{ base: "1", md: "1 / -1" }}>
                <FormLabel>Fotos del contrato de arrendamiento</FormLabel>
                <FotosUploader
                  urls={draftEspacio.fotoContratoArrendamientoUrls}
                  onAdd={(urls) => setDraftEspacio((d) => ({ ...d, fotoContratoArrendamientoUrls: [...d.fotoContratoArrendamientoUrls, ...urls] }))}
                  onRemove={(idx) => setDraftEspacio((d) => ({ ...d, fotoContratoArrendamientoUrls: d.fotoContratoArrendamientoUrls.filter((_, i) => i !== idx) }))}
                  multiple
                  uploading={subiendoFotoContrato}
                  setUploading={setSubiendoFotoContrato}
                  cobradorId={cobradorId}
                  identificador={draftEspacio.numeroPuesto || draftEspacio.nombreCliente}
                  subfolder="contratos"
                  buttonLabel="Agregar fotos del contrato"
                  descripcion="Puede subir varias fotos del contrato (varias páginas)."
                />
              </FormControl>
              <FormControl gridColumn={{ base: "1", md: "1 / -1" }}>
                <FormLabel>Tarjeta de cobro anual (fotos)</FormLabel>
                <FotosUploader
                  urls={draftEspacio.fotoTarjetaCobroAnualUrls}
                  onAdd={(urls) => setDraftEspacio((d) => ({ ...d, fotoTarjetaCobroAnualUrls: [...d.fotoTarjetaCobroAnualUrls, ...urls] }))}
                  onRemove={(idx) => setDraftEspacio((d) => ({ ...d, fotoTarjetaCobroAnualUrls: d.fotoTarjetaCobroAnualUrls.filter((_, i) => i !== idx) }))}
                  multiple
                  uploading={subiendoFotoTarjetaAnual}
                  setUploading={setSubiendoFotoTarjetaAnual}
                  cobradorId={cobradorId}
                  identificador={draftEspacio.numeroPuesto || draftEspacio.nombreCliente}
                  subfolder="tarjeta-anual"
                  buttonLabel="Agregar fotos de la tarjeta anual"
                  descripcion="Registro fotográfico de la tarjeta de cobro anual terminada (a fin de año). Puede subir varias fotos."
                />
              </FormControl>
            </SimpleGrid>

            {!editEspacioId && (
              <>
                <Box borderWidth="1px" borderRadius="md" p={{ base: 3, md: 4 }} bg="gray.50" mt={4} overflow="hidden">
                  <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
                    <Text fontWeight="bold" fontSize="sm" minW={0}>
                      Rubros a cobrar (catálogo del admin)
                    </Text>
                    {rubrosCatalogo.length > 0 && (
                      <Button size="sm" colorScheme="teal" leftIcon={<Plus size={16} />} onClick={() => setDraftRubrosEspacio((prev) => [...prev, { codigo: "", concepto: "", monto: "" }])} flexShrink={0}>
                        Agregar rubro
                      </Button>
                    )}
                  </HStack>
                  {rubrosCatalogo.length === 0 ? (
                    <Text fontSize="sm" color="orange.600" fontStyle="italic">
                      No hay rubros creados. Pida al administrador que los agregue en el catálogo de rubros antes de registrar cobros.
                    </Text>
                  ) : (
                    <VStack spacing={2} align="stretch">
                      {draftRubrosEspacio.map((rubro, idx) => {
                        const otras = draftRubrosEspacio.filter((_, i) => i !== idx);
                        const idsUsados = otras.map((r) => r.rubroId).filter(Boolean);
                        const opciones = rubrosCatalogo.filter((r) => r.id === rubro.rubroId || !idsUsados.includes(r.id));
                        return (
                          <Box key={idx} p={2} borderWidth="1px" borderRadius="md" borderColor="gray.200" minW={0}>
                            <HStack mb={2} spacing={2} flexWrap="wrap" align="stretch">
                              <Select
                                size="sm"
                                placeholder="Seleccionar rubro..."
                                value={rubro.rubroId || ""}
                                onChange={(e) => {
                                  const id = e.target.value;
                                  const c = rubrosCatalogo.find((r) => r.id === id);
                                  setDraftRubrosEspacio((prev) => prev.map((r, i) => (i === idx ? { ...r, rubroId: id, codigo: c?.codigo ?? "", concepto: c?.concepto ?? "" } : r)));
                                }}
                                flex={1}
                                minW={0}
                              >
                                {opciones.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.concepto}
                                  </option>
                                ))}
                              </Select>
                              <IconButton aria-label="Eliminar rubro" icon={<Trash2 size={14} />} size="xs" colorScheme="red" variant="ghost" onClick={() => setDraftRubrosEspacio((prev) => prev.filter((_, i) => i !== idx))} flexShrink={0} />
                            </HStack>
                            <Input type="number" step="0.01" placeholder="Monto" value={rubro.monto} onChange={(e) => setDraftRubrosEspacio((prev) => prev.map((r, i) => (i === idx ? { ...r, monto: e.target.value } : r)))} size="sm" w="100%" />
                          </Box>
                        );
                      })}
                      {draftRubrosEspacio.length === 0 && (
                        <Text fontSize="xs" color="gray.500" fontStyle="italic">
                          Agregue rubros del catálogo y montos. Luego use &quot;Guardar y distribuir en 12 meses&quot;.
                        </Text>
                      )}
                    </VStack>
                  )}
                </Box>
                <Button
                  mt={4}
                  colorScheme="teal"
                  size="lg"
                  w={{ base: "full", sm: "auto" }}
                  leftIcon={<CalendarDays size={18} />}
                  onClick={handleGuardarEspacioYDistribuir}
                  isLoading={distribuyendoEspacio}
                  isDisabled={
                    !draftEspacio.nombreCliente.trim() ||
                    !draftEspacio.numeroPuesto.trim() ||
                    !draftEspacio.tipoPuesto.trim() ||
                    draftRubrosEspacio.filter((r) => r.monto && parseFloat(r.monto) > 0 && (r.rubroId || r.codigo || r.concepto)).length === 0
                  }
                >
                  Guardar y distribuir en 12 meses
                </Button>
              </>
            )}

            <VStack mt={4} spacing={3} align="stretch" w="full">
              {editEspacioId ? (
                <HStack flexDirection={{ base: "column", sm: "row" }} spacing={3} w="full">
                  <Button
                    colorScheme="teal"
                    onClick={handleUpdateEspacio}
                    isLoading={savingEspacio}
                    leftIcon={<Save size={18} />}
                    isDisabled={!draftEspacio.nombreCliente.trim() || !draftEspacio.numeroPuesto.trim() || !draftEspacio.tipoPuesto.trim()}
                    w={{ base: "full", sm: "auto" }}
                    size={{ base: "md", md: "lg" }}
                  >
                    Guardar cambios
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditEspacioId(null);
                      setShowNewEspacioForm(false);
                      limpiarDraft();
                    }}
                    w={{ base: "full", sm: "auto" }}
                    size={{ base: "md", md: "lg" }}
                  >
                    Cancelar
                  </Button>
                </HStack>
              ) : (
                <HStack flexDirection={{ base: "column", sm: "row" }} spacing={3} w="full">
                  <Button
                    colorScheme="blue"
                    variant="outline"
                    onClick={handleSaveNewEspacio}
                    isLoading={savingEspacio}
                    leftIcon={<Save size={18} />}
                    isDisabled={!draftEspacio.nombreCliente.trim() || !draftEspacio.numeroPuesto.trim() || !draftEspacio.tipoPuesto.trim()}
                    w={{ base: "full", sm: "auto" }}
                    size={{ base: "md", md: "lg" }}
                  >
                    Solo guardar espacio (sin distribuir)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewEspacioForm(false);
                      setEditEspacioId(null);
                      limpiarDraft();
                    }}
                    w={{ base: "full", sm: "auto" }}
                    size={{ base: "md", md: "lg" }}
                  >
                    Cancelar
                  </Button>
                </HStack>
              )}
            </VStack>
          </CardBody>
        </Card>
      )}

      {loadingEspacios && (
        <Box textAlign="center" py={8}>
          <Spinner size="xl" color="teal.500" />
          <Text mt={4}>Cargando locatarios...</Text>
        </Box>
      )}

      {!loadingEspacios && espaciosList.length > 0 && (
        <VStack spacing={4} align="stretch">
          <Text fontWeight="600" color="gray.700">
            Locatarios registrados ({espaciosList.length})
          </Text>
          {espaciosList.map((p) => (
            <Card key={p.id} borderWidth="1px" borderColor="gray.200" overflow="visible">
              <CardBody p={{ base: 3, md: 4 }}>
                <VStack align="stretch" spacing={3}>
                  <Flex direction={{ base: "column", md: "row" }} gap={3} align={{ base: "stretch", md: "flex-start" }}>
                    <HStack spacing={4} align="flex-start" flex={1} minW={0}>
                      {p.foto_documento_url && (
                        <Box flexShrink={0}>
                          <Image src={p.foto_documento_url} alt={`Foto ${p.nombre_cliente}`} w="48px" h="48px" objectFit="cover" borderRadius="md" borderWidth="1px" />
                        </Box>
                      )}
                      <Box minW={0} flex="1">
                        {p.codigo && (
                          <Badge colorScheme="teal" mr={2} mb={1}>
                            Código: {p.codigo}
                          </Badge>
                        )}
                        {p.en_mora && (
                          <Badge colorScheme="orange" mr={2} mb={1}>
                            En mora
                          </Badge>
                        )}
                        <Text fontWeight="700" noOfLines={2} title={`${p.nombre_cliente} – Locatario Nº ${p.numero_puesto}`}>
                          {p.nombre_cliente} – Locatario Nº {p.numero_puesto}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {p.tipo_puesto}
                        </Text>
                        {p.valor_diario > 0 && (
                          <Text fontSize="sm" fontWeight="500" color="blue.600">
                            Renta diaria: {formatCurrency(p.valor_diario)}
                          </Text>
                        )}
                        {p.direccion_cliente?.trim() && (
                          <Text fontSize="xs" color="gray.500" noOfLines={1} title={p.direccion_cliente}>
                            Dir: {p.direccion_cliente}
                          </Text>
                        )}
                        {p.telefono?.trim() && (
                          <Text fontSize="xs" color="gray.500">
                            Tel: {p.telefono}
                          </Text>
                        )}
                      </Box>
                    </HStack>
                  </Flex>

                  {((p.foto_permiso_operacion_urls?.length ?? 0) > 0 || (p.foto_contrato_arrendamiento_urls?.length ?? 0) > 0 || (p.foto_tarjeta_cobro_anual_urls?.length ?? 0) > 0) && (
                    <Box borderTopWidth="1px" borderColor="gray.200" pt={3}>
                      <Text fontSize="xs" fontWeight="600" color="gray.600" mb={2}>
                        Documentos y fotos:
                      </Text>
                      <Wrap spacing={2}>
                        {(p.foto_permiso_operacion_urls?.length ?? 0) > 0 && (
                          <WrapItem>
                            <Button size="sm" variant="outline" colorScheme="blue" onClick={() => { setPermisoFotosPuesto(p); onPermisoFotosOpen(); }}>
                              Ver permiso ({p.foto_permiso_operacion_urls!.length})
                            </Button>
                          </WrapItem>
                        )}
                        {(p.foto_contrato_arrendamiento_urls?.length ?? 0) > 0 && (
                          <WrapItem>
                            <Button size="sm" variant="outline" colorScheme="green" onClick={() => { setContratoFotosPuesto(p); onContratoFotosOpen(); }}>
                              Ver contrato ({p.foto_contrato_arrendamiento_urls!.length})
                            </Button>
                          </WrapItem>
                        )}
                        {(p.foto_tarjeta_cobro_anual_urls?.length ?? 0) > 0 && (
                          <WrapItem>
                            <Button size="sm" variant="outline" colorScheme="purple" onClick={() => { setTarjetaAnualFotosPuesto(p); onTarjetaAnualFotosOpen(); }}>
                              Ver tarjeta anual ({p.foto_tarjeta_cobro_anual_urls!.length})
                            </Button>
                          </WrapItem>
                        )}
                      </Wrap>
                    </Box>
                  )}

                  <Wrap spacing={2}>
                    <WrapItem>
                      <Button size="sm" leftIcon={<AlertCircle size={16} />} variant="outline" colorScheme="orange" onClick={() => setMoraPuesto(p)}>
                        Gestionar mora
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <Button
                        size="sm"
                        leftIcon={<Edit size={16} />}
                        variant="outline"
                        colorScheme="teal"
                        onClick={() => {
                          setEditEspacioId(p.id);
                          setShowNewEspacioForm(false);
                          setDraftEspacio({
                            nombreCliente: p.nombre_cliente,
                            numeroPuesto: p.numero_puesto,
                            tipoPuesto: p.tipo_puesto,
                            valorDiario: p.valor_diario.toString(),
                            numeroIdentidad: p.numero_identidad ?? "",
                            rtn: p.rtn ?? "",
                            direccionCliente: p.direccion_cliente ?? "",
                            telefono: p.telefono ?? "",
                            observaciones: p.observaciones ?? "",
                            fotoDocumentoUrl: p.foto_documento_url ?? "",
                            fotoPermisoOperacionUrls: p.foto_permiso_operacion_urls ?? [],
                            fotoContratoArrendamientoUrls: p.foto_contrato_arrendamiento_urls ?? [],
                            fotoTarjetaCobroAnualUrls: p.foto_tarjeta_cobro_anual_urls ?? [],
                          });
                        }}
                      >
                        Editar
                      </Button>
                    </WrapItem>
                    <WrapItem>
                      <Button size="sm" leftIcon={<Trash2 size={16} />} variant="outline" colorScheme="red" onClick={() => setPuestoAEliminar(p)}>
                        Eliminar locatario
                      </Button>
                    </WrapItem>
                  </Wrap>
                </VStack>
              </CardBody>
            </Card>
          ))}
        </VStack>
      )}

      {!loadingEspacios && espaciosList.length === 0 && !showNewEspacioForm && !editEspacioId && (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Text color="gray.500" textAlign="center" py={6}>
              No hay locatarios. Use el botón superior para registrar el primero.
            </Text>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={isPermisoFotosOpen} onClose={() => { onPermisoFotosClose(); setPermisoFotosPuesto(null); }} size={{ base: "full", md: "4xl" }}>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "56rem" }} maxH={{ base: "100vh", md: "90vh" }} mx={{ base: 0, md: "auto" }}>
          <ModalHeader fontSize={{ base: "sm", md: "md" }} pr={10}>
            <Text noOfLines={2}>
              Permiso de operación — {permisoFotosPuesto?.nombre_cliente} (Puesto {permisoFotosPuesto?.numero_puesto})
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowY="auto" maxH={{ base: "calc(100vh - 120px)", md: "calc(90vh - 100px)" }}>
            {permisoFotosPuesto?.foto_permiso_operacion_urls?.length ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {permisoFotosPuesto.foto_permiso_operacion_urls.map((url, idx) => (
                  <Box key={url} borderWidth="1px" borderRadius="md" overflow="hidden" bg="gray.50" p={2}>
                    <Image src={url} alt={`Permiso página ${idx + 1}`} w="100%" maxH="500px" objectFit="contain" loading="lazy" />
                    <Text fontSize="xs" color="gray.500" p={2}>
                      Página {idx + 1}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            ) : (
              <Text color="gray.500">No hay fotos del permiso.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isContratoFotosOpen} onClose={() => { onContratoFotosClose(); setContratoFotosPuesto(null); }} size={{ base: "full", md: "4xl" }}>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "56rem" }} maxH={{ base: "100vh", md: "90vh" }} mx={{ base: 0, md: "auto" }}>
          <ModalHeader fontSize={{ base: "sm", md: "md" }} pr={10}>
            <Text noOfLines={2}>
              Contrato de arrendamiento — {contratoFotosPuesto?.nombre_cliente} (Puesto {contratoFotosPuesto?.numero_puesto})
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowY="auto" maxH={{ base: "calc(100vh - 120px)", md: "calc(90vh - 100px)" }}>
            {contratoFotosPuesto?.foto_contrato_arrendamiento_urls?.length ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {contratoFotosPuesto.foto_contrato_arrendamiento_urls.map((url, idx) => (
                  <Box key={url} borderWidth="1px" borderRadius="md" overflow="hidden" bg="gray.50" p={2}>
                    <Image src={url} alt={`Contrato página ${idx + 1}`} w="100%" maxH="500px" objectFit="contain" loading="lazy" />
                    <Text fontSize="xs" color="gray.500" p={2}>
                      Página {idx + 1}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            ) : (
              <Text color="gray.500">No hay fotos del contrato.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isTarjetaAnualFotosOpen} onClose={() => { onTarjetaAnualFotosClose(); setTarjetaAnualFotosPuesto(null); }} size={{ base: "full", md: "4xl" }}>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "56rem" }} maxH={{ base: "100vh", md: "90vh" }} mx={{ base: 0, md: "auto" }}>
          <ModalHeader fontSize={{ base: "sm", md: "md" }} pr={10}>
            <Text noOfLines={2}>
              Tarjeta de cobro anual — {tarjetaAnualFotosPuesto?.nombre_cliente} (Puesto {tarjetaAnualFotosPuesto?.numero_puesto})
            </Text>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} overflowY="auto" maxH={{ base: "calc(100vh - 120px)", md: "calc(90vh - 100px)" }}>
            {tarjetaAnualFotosPuesto?.foto_tarjeta_cobro_anual_urls?.length ? (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                {tarjetaAnualFotosPuesto.foto_tarjeta_cobro_anual_urls.map((url, idx) => (
                  <Box key={url} borderWidth="1px" borderRadius="md" overflow="hidden" bg="gray.50" p={2}>
                    <Image src={url} alt={`Tarjeta anual página ${idx + 1}`} w="100%" maxH="500px" objectFit="contain" loading="lazy" />
                    <Text fontSize="xs" color="gray.500" p={2}>
                      Página {idx + 1}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            ) : (
              <Text color="gray.500">No hay fotos de la tarjeta anual.</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {moraPuesto && cobradorId && (
        <SeccionMoraLocatario
          puesto={moraPuesto}
          cobradorId={cobradorId}
          mercadoId={mercadoId}
          mercadoNombre={user?.mercadoNombre}
          usuarioId={cobradorId}
          usuarioNombre={nombreCobrador || user?.email || "Usuario"}
          isOpen={!!moraPuesto}
          onClose={() => setMoraPuesto(null)}
          onActualizado={loadEspacios}
        />
      )}

      <AlertDialog isOpen={!!puestoAEliminar} leastDestructiveRef={cancelarEliminarRef} onClose={() => setPuestoAEliminar(null)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Eliminar locatario
          </AlertDialogHeader>
          <AlertDialogBody>
            ¿Está seguro de eliminar a <strong>{puestoAEliminar?.nombre_cliente}</strong> (Puesto {puestoAEliminar?.numero_puesto})? Esta acción es irreversible. Se borrarán todos los cobros, abonos, cuentas por cobrar, deudas en mora y el registro
            del locatario de la base de datos.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelarEliminarRef} onClick={() => setPuestoAEliminar(null)}>
              Cancelar
            </Button>
            <Button colorScheme="red" onClick={confirmarEliminarLocatario} ml={3} isLoading={eliminandoLocatario}>
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VStack>
  );
}
