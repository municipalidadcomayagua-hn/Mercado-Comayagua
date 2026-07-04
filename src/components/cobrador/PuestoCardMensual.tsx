"use client";

import { memo } from "react";
import { Badge, Box, Button, Card, CardBody, Collapse, Divider, FormControl, FormLabel, HStack, Heading, IconButton, Input, Select, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { Check, ChevronDown, ChevronUp, Edit, FileText, Plus, Save, Trash2, X, XCircle } from "lucide-react";
import type { Rubro } from "@/lib/data/types";
import { RUBRO_RENTA_MENSUAL } from "@/lib/data/types";

const formatCurrency = (amount: number): string => `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export interface RubroFilaDraft {
  codigo: string;
  concepto: string;
  monto: string;
  rubroId?: string;
}

export interface PagoAdicionalDraft {
  concepto: string;
  monto: string;
}

export interface PagoMensual {
  rentaMensual: string;
  pagosAdicionales: PagoAdicionalDraft[];
  /** Rubros por mes. Si existe, se usa para mostrar y guardar. */
  rubros?: RubroFilaDraft[];
  guardado: boolean;
  editando?: boolean;
  cobroId?: string;
  /** true cuando se generó el recibo (mes "Ya pagado", ya no editable) */
  reciboGenerado?: boolean;
  /** Abonos parciales por concepto (desde estado de cuenta). Clave = "Renta mensual" o concepto de pago adicional */
  abonosPorConcepto?: Record<string, number>;
}

export interface PuestoLocal {
  /** Id real del puesto (todos los puestos de esta pantalla vienen ya guardados de la base). */
  id: string;
  nombreCliente: string;
  numeroPuesto: string;
  tipoPuesto: string;
  valorDiario: string;
  numeroIdentidad?: string;
  rtn?: string;
  codigo?: string;
  pagosMensuales: { [mesIndex: number]: PagoMensual };
  expanded: boolean;
  editando: boolean;
}

interface PuestoCardProps {
  puesto: PuestoLocal;
  loading: { [puestoId: string]: boolean };
  onActualizarPuesto: (puestoId: string, campo: keyof PuestoLocal, valor: unknown) => void;
  onEditarPuesto: (puesto: PuestoLocal) => void;
  onCancelarEdicion: (puesto: PuestoLocal) => void;
  onGuardarCambiosPuesto: (puesto: PuestoLocal) => void;
  onActualizarRentaMensual: (puestoId: string, mesIndex: number, renta: string) => void;
  onAgregarPagoAdicional: (puestoId: string, mesIndex: number) => void;
  onEliminarPagoAdicional: (puestoId: string, mesIndex: number, indexPago: number) => void;
  onActualizarPagoAdicional: (puestoId: string, mesIndex: number, indexPago: number, campo: "concepto" | "monto", valor: string) => void;
  onCalcularTotalMes: (puesto: PuestoLocal, mesIndex: number) => number;
  onIniciarEdicionMes: (puestoId: string, mesIndex: number) => void;
  onCancelarEdicionMes: (puestoId: string, mesIndex: number) => void;
  onGuardarCobroMes: (puesto: PuestoLocal, mesIndex: number) => void;
  onVerRecibo: (puesto: PuestoLocal, mesIndex: number) => void;
  onActualizarRubroMes: (puestoId: string, mesIndex: number, rubroIndex: number, campo: keyof RubroFilaDraft, valor: string) => void;
  onAgregarRubroMes: (puestoId: string, mesIndex: number) => void;
  onEliminarRubroMes: (puestoId: string, mesIndex: number, rubroIndex: number) => void;
  rubrosCatalogo: Rubro[];
  /** Deuda = solo meses que ya pasaron sin pagar */
  onCalcularDeudaMesesVencidos: (puesto: PuestoLocal) => number;
  /** Saldo real (incluye abonos parciales); si existe, se usa en lugar del calculo local */
  saldoPendienteReal?: number;
}

// Puerto de PuestoCard (CobroAmbulante.tsx original). Se quito la rama de
// "puesto nuevo sin guardar" (guardado===false): en esta pantalla todos los
// puestos vienen ya guardados desde la base (se registran en Locatarios),
// ese branch era codigo inalcanzable en el original (ver MIGRATION_NOTES.md).
export const PuestoCardMensual = memo(function PuestoCardMensual({
  puesto,
  loading,
  onActualizarPuesto,
  onEditarPuesto,
  onCancelarEdicion,
  onGuardarCambiosPuesto,
  onActualizarRentaMensual,
  onAgregarPagoAdicional,
  onEliminarPagoAdicional,
  onActualizarPagoAdicional,
  onCalcularTotalMes,
  onIniciarEdicionMes,
  onCancelarEdicionMes,
  onGuardarCobroMes,
  onVerRecibo,
  onActualizarRubroMes,
  onAgregarRubroMes,
  onEliminarRubroMes,
  rubrosCatalogo,
  onCalcularDeudaMesesVencidos,
  saldoPendienteReal,
}: PuestoCardProps) {
  const deudaMesesVencidos = saldoPendienteReal ?? onCalcularDeudaMesesVencidos(puesto);

  return (
    <Card borderWidth="2px" borderColor="blue.200" overflow="hidden">
      <CardBody p={{ base: 3, md: 4 }}>
        <VStack spacing={4} align="stretch">
          <HStack justify="space-between" flexWrap="wrap" gap={2} align="flex-start">
            <HStack spacing={2} flexWrap="wrap" minW={0} flex="1 1 auto">
              <Heading size={{ base: "sm", md: "md" }} noOfLines={2} title={`${puesto.nombreCliente} – Locatario Nº ${puesto.numeroPuesto}`}>
                {puesto.nombreCliente} – Locatario Nº {puesto.numeroPuesto}
              </Heading>
              {puesto.codigo && (
                <Badge colorScheme="blue" fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" flexShrink={0}>
                  Código: {puesto.codigo}
                </Badge>
              )}
              {puesto.tipoPuesto && (
                <Text color="gray.600" fontSize={{ base: "sm", md: "md" }} flexShrink={0}>
                  ({puesto.tipoPuesto})
                </Text>
              )}
            </HStack>
            <HStack flexShrink={0}>
              {!puesto.editando && (
                <IconButton aria-label="Editar locatario" icon={<Edit size={18} />} onClick={() => onEditarPuesto(puesto)} colorScheme="blue" variant="ghost" size="sm" />
              )}
              <IconButton
                aria-label={puesto.expanded ? "Contraer" : "Expandir"}
                icon={puesto.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                onClick={() => onActualizarPuesto(puesto.id, "expanded", !puesto.expanded)}
                size="sm"
                variant="ghost"
              />
            </HStack>
          </HStack>

          <Collapse in={puesto.expanded} animateOpacity={false}>
            <VStack spacing={4} align="stretch">
              {!puesto.editando ? (
                <Box bg="green.50" p={{ base: 3, md: 4 }} borderRadius="md" borderWidth="1px" borderColor="green.200" minW={0}>
                  <VStack spacing={2} align="stretch">
                    <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                      <Text fontSize={{ base: "sm", md: "md" }} fontWeight="bold" color="green.700" minW={0}>
                        Información del locatario (guardada)
                      </Text>
                      {puesto.codigo && (
                        <Badge colorScheme="blue" fontSize={{ base: "md", md: "lg" }} fontWeight="bold" p={2} borderRadius="md" flexShrink={0}>
                          Código: {puesto.codigo}
                        </Badge>
                      )}
                    </HStack>
                    <SimpleGrid columns={{ base: 1, md: 2, lg: puesto.codigo ? 5 : 4 }} spacing={4}>
                      {puesto.codigo && (
                        <Box bg="blue.50" p={3} borderRadius="md" borderWidth="1px" borderColor="blue.200" minW={0}>
                          <Text fontSize="xs" color="gray.600" mb={1}>
                            Código del Puesto
                          </Text>
                          <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="blue.600" noOfLines={1}>
                            {puesto.codigo}
                          </Text>
                        </Box>
                      )}
                      <Box minW={0}>
                        <Text fontSize="xs" color="gray.600">
                          Nombre del Cliente
                        </Text>
                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium" noOfLines={2}>
                          {puesto.nombreCliente}
                        </Text>
                      </Box>
                      <Box minW={0}>
                        <Text fontSize="xs" color="gray.600">
                          Número de puesto
                        </Text>
                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium">
                          {puesto.numeroPuesto}
                        </Text>
                      </Box>
                      <Box minW={0}>
                        <Text fontSize="xs" color="gray.600">
                          Tipo
                        </Text>
                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium">
                          {puesto.tipoPuesto}
                        </Text>
                      </Box>
                      <Box minW={0}>
                        <Text fontSize="xs" color="gray.600">
                          Valor Diario
                        </Text>
                        <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium">
                          {formatCurrency(parseFloat(puesto.valorDiario) || 0)}
                        </Text>
                      </Box>
                      {(puesto.numeroIdentidad ?? "").trim() && (
                        <Box minW={0}>
                          <Text fontSize="xs" color="gray.600">
                            Nº Identidad
                          </Text>
                          <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium" noOfLines={1}>
                            {puesto.numeroIdentidad}
                          </Text>
                        </Box>
                      )}
                      {(puesto.rtn ?? "").trim() && (
                        <Box minW={0}>
                          <Text fontSize="xs" color="gray.600">
                            RTN
                          </Text>
                          <Text fontSize={{ base: "sm", md: "md" }} fontWeight="medium" noOfLines={1}>
                            {puesto.rtn}
                          </Text>
                        </Box>
                      )}
                    </SimpleGrid>
                    <Text fontSize="xs" color="gray.600" mt={2}>
                      Los datos del locatario están guardados. Puede editar la información haciendo clic en el botón de editar.
                    </Text>
                  </VStack>
                </Box>
              ) : (
                <VStack spacing={4} align="stretch">
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                    <FormControl isRequired>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Nombre del Cliente</FormLabel>
                      <Input value={puesto.nombreCliente} onChange={(e) => onActualizarPuesto(puesto.id, "nombreCliente", e.target.value)} size={{ base: "md", md: "lg" }} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Número de puesto</FormLabel>
                      <Input value={puesto.numeroPuesto} onChange={(e) => onActualizarPuesto(puesto.id, "numeroPuesto", e.target.value)} size={{ base: "md", md: "lg" }} />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Tipo</FormLabel>
                      <Select value={puesto.tipoPuesto} onChange={(e) => onActualizarPuesto(puesto.id, "tipoPuesto", e.target.value)} size={{ base: "md", md: "lg" }}>
                        <option value="Mercadería">Mercadería</option>
                        <option value="Frutas">Frutas</option>
                        <option value="Verduras">Verduras</option>
                        <option value="Ropa">Ropa</option>
                        <option value="Otros">Otros</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>Nº identidad (opcional)</FormLabel>
                      <Input value={puesto.numeroIdentidad ?? ""} onChange={(e) => onActualizarPuesto(puesto.id, "numeroIdentidad", e.target.value)} maxLength={15} size={{ base: "md", md: "lg" }} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize={{ base: "sm", md: "md" }}>RTN (opcional)</FormLabel>
                      <Input value={puesto.rtn ?? ""} onChange={(e) => onActualizarPuesto(puesto.id, "rtn", e.target.value)} size={{ base: "md", md: "lg" }} />
                    </FormControl>
                  </SimpleGrid>
                  <HStack spacing={4} flexWrap="wrap" gap={2}>
                    <Button
                      leftIcon={<Check size={18} />}
                      colorScheme="green"
                      onClick={() => onGuardarCambiosPuesto(puesto)}
                      isLoading={loading[puesto.id]}
                      isDisabled={!puesto.nombreCliente || !puesto.numeroPuesto || !puesto.tipoPuesto}
                      size={{ base: "md", md: "lg" }}
                    >
                      Guardar Cambios
                    </Button>
                    <Button leftIcon={<XCircle size={18} />} colorScheme="gray" variant="outline" onClick={() => onCancelarEdicion(puesto)} isDisabled={loading[puesto.id]} size={{ base: "md", md: "lg" }}>
                      Cancelar
                    </Button>
                  </HStack>
                </VStack>
              )}

              <VStack spacing={4} align="stretch">
                {MESES.map((mes, mesIndex) => {
                  const pagoMes = puesto.pagosMensuales[mesIndex] || { rentaMensual: "", pagosAdicionales: [], guardado: false, editando: false };
                  const totalMes = onCalcularTotalMes(puesto, mesIndex);
                  const estaEditando = Boolean(pagoMes.editando);
                  const estaGuardado = Boolean(pagoMes.guardado) && !estaEditando;
                  const estaPagado = pagoMes.reciboGenerado === true;
                  const tieneAbonosParciales = !!(pagoMes.abonosPorConcepto && Object.keys(pagoMes.abonosPorConcepto).length > 0);
                  const hayMesesAnterioresSinPagar = mesIndex > 0 && Array.from({ length: mesIndex }, (_, i) => i).some((i) => !puesto.pagosMensuales[i]?.reciboGenerado);

                  return (
                    <Box key={mesIndex} p={4} borderWidth="1px" borderRadius="md" bg={estaPagado ? "green.50" : "white"} borderColor={estaPagado ? "green.200" : "gray.200"}>
                      <HStack justify="space-between" mb={3} flexWrap="wrap" spacing={2}>
                        <HStack flexWrap="wrap">
                          <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>
                            {mes}
                          </Text>
                          {estaPagado && (
                            <Badge colorScheme="green" fontSize={{ base: "xs", md: "sm" }}>
                              Ya pagado
                            </Badge>
                          )}
                          {estaEditando && (
                            <Badge colorScheme="orange" fontSize={{ base: "xs", md: "sm" }}>
                              Editando
                            </Badge>
                          )}
                          {estaGuardado && !estaPagado && !tieneAbonosParciales && (
                            <Button size="xs" colorScheme="orange" variant="outline" leftIcon={<Edit size={14} />} onClick={() => onIniciarEdicionMes(puesto.id, mesIndex)}>
                              Editar mes
                            </Button>
                          )}
                        </HStack>
                        <Text fontWeight="bold" fontSize={{ base: "md", md: "lg" }} color="blue.600">
                          Total: {formatCurrency(totalMes)}
                        </Text>
                      </HStack>

                      <VStack spacing={3} align="stretch">
                        {estaGuardado &&
                          !estaPagado &&
                          pagoMes.abonosPorConcepto &&
                          Object.keys(pagoMes.abonosPorConcepto).length > 0 &&
                          (() => {
                            const lineas: { concepto: string; monto: number; abonado: number; pendiente: number }[] = [];
                            const abonos = pagoMes.abonosPorConcepto!;
                            if (pagoMes.rubros?.length) {
                              for (const r of pagoMes.rubros) {
                                const rubroCat = r.rubroId ? rubrosCatalogo.find((x) => x.id === r.rubroId) : undefined;
                                const codigo = rubroCat?.codigo ?? r.codigo ?? "";
                                const concepto = rubroCat?.concepto ?? r.concepto ?? "";
                                const key = codigo ? `${codigo}. ${concepto}` : concepto;
                                const monto = parseFloat(r.monto) || 0;
                                const abonado = abonos[key] ?? 0;
                                if (monto > 0 || abonado > 0) lineas.push({ concepto: codigo ? `${codigo} ${concepto}` : concepto, monto, abonado, pendiente: monto - abonado });
                              }
                            } else {
                              const renta = parseFloat(pagoMes.rentaMensual) || 0;
                              if (renta > 0) {
                                const abonado = abonos[RUBRO_RENTA_MENSUAL] ?? 0;
                                lineas.push({ concepto: RUBRO_RENTA_MENSUAL, monto: renta, abonado, pendiente: renta - abonado });
                              }
                              for (const pa of pagoMes.pagosAdicionales) {
                                const concepto = (pa.concepto || "").trim();
                                const monto = parseFloat(pa.monto) || 0;
                                const abonado = abonos[concepto] ?? 0;
                                if (concepto && (monto > 0 || abonado > 0)) lineas.push({ concepto, monto, abonado, pendiente: monto - abonado });
                              }
                            }
                            if (lineas.length === 0) return null;
                            return (
                              <Box p={3} bg="teal.50" borderRadius="md" borderWidth="1px" borderColor="teal.200">
                                <Text fontSize="sm" fontWeight="bold" color="teal.700" mb={2}>
                                  Abonos aplicados (desde Estado de cuenta)
                                </Text>
                                <VStack align="stretch" spacing={1}>
                                  {lineas.map((l) => (
                                    <HStack key={l.concepto} justify="space-between" fontSize="sm">
                                      <Text noOfLines={1}>{l.concepto}</Text>
                                      <Text fontWeight="medium">
                                        {l.abonado > 0 ? `${formatCurrency(l.abonado)} / ${formatCurrency(l.monto)}` : formatCurrency(l.monto)}
                                        {l.pendiente > 0 && (
                                          <Box as="span" color="orange.600" ml={2}>
                                            (pend. {formatCurrency(l.pendiente)})
                                          </Box>
                                        )}
                                      </Text>
                                    </HStack>
                                  ))}
                                </VStack>
                              </Box>
                            );
                          })()}

                        {pagoMes.rubros?.length ? (
                          <Box>
                            <HStack justify="space-between" mb={2}>
                              <FormLabel fontSize={{ base: "xs", md: "sm" }} mb={0}>
                                Rubros del mes
                              </FormLabel>
                              {(estaEditando || (estaGuardado && !estaPagado)) && !tieneAbonosParciales && (
                                <Button size="xs" colorScheme="green" leftIcon={<Plus size={14} />} onClick={() => onAgregarRubroMes(puesto.id, mesIndex)}>
                                  Agregar rubro
                                </Button>
                              )}
                            </HStack>
                            <VStack spacing={2} align="stretch">
                              {pagoMes.rubros.map((rubro, rubroIdx) => {
                                const tieneRubro = !!(rubro.rubroId || rubro.codigo || rubro.concepto);
                                const rubroCat = rubro.rubroId ? rubrosCatalogo.find((r) => r.id === rubro.rubroId) : undefined;
                                const codigoDisplay = rubroCat?.codigo ?? rubro.codigo;
                                const conceptoDisplay = rubroCat?.concepto ?? rubro.concepto;
                                const puedeEditar = !estaPagado && !tieneAbonosParciales && (estaEditando || estaGuardado);
                                const otrasFilas = (pagoMes.rubros || []).filter((_, i) => i !== rubroIdx);
                                const rubrosIdsYaUsados = otrasFilas.map((r) => r.rubroId).filter(Boolean);
                                const codigosYaUsados = otrasFilas.map((r) => (r.rubroId ? rubrosCatalogo.find((c) => c.id === r.rubroId)?.codigo : r.codigo)).filter(Boolean);
                                const opcionesRubro = rubrosCatalogo.filter((r) => {
                                  if (r.id === rubro.rubroId) return true;
                                  if (rubrosIdsYaUsados.includes(r.id)) return false;
                                  if (r.codigo && codigosYaUsados.includes(r.codigo)) return false;
                                  return true;
                                });
                                return (
                                  <Box key={`rubro-mes-${puesto.id}-${mesIndex}-${rubroIdx}`} p={2} borderWidth="1px" borderRadius="md" borderColor="gray.200">
                                    {rubrosCatalogo.length > 0 ? (
                                      <>
                                        {tieneRubro ? (
                                          <HStack justify="space-between" align="center" mb={2} flexWrap="wrap" gap={1}>
                                            <Text fontSize="sm" fontWeight="medium" noOfLines={2}>
                                              <Box as="span" fontWeight="bold" color="blue.600">
                                                {codigoDisplay}
                                              </Box>{" "}
                                              {conceptoDisplay}
                                            </Text>
                                            {puedeEditar && (
                                              <HStack>
                                                <Button size="xs" variant="ghost" colorScheme="gray" onClick={() => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "rubroId", "")}>
                                                  Cambiar
                                                </Button>
                                                <IconButton aria-label="Eliminar rubro" icon={<Trash2 size={14} />} size="xs" colorScheme="red" variant="ghost" onClick={() => onEliminarRubroMes(puesto.id, mesIndex, rubroIdx)} />
                                              </HStack>
                                            )}
                                          </HStack>
                                        ) : (
                                          <HStack mb={2} spacing={2}>
                                            <Select size="sm" placeholder="Seleccionar rubro..." value="" onChange={(e) => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "rubroId", e.target.value)} isDisabled={!puedeEditar}>
                                              {opcionesRubro.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                  {r.concepto}
                                                </option>
                                              ))}
                                            </Select>
                                            {puedeEditar && (
                                              <IconButton aria-label="Eliminar rubro" icon={<Trash2 size={14} />} size="xs" colorScheme="red" variant="ghost" onClick={() => onEliminarRubroMes(puesto.id, mesIndex, rubroIdx)} />
                                            )}
                                          </HStack>
                                        )}
                                        <Input
                                          type="number"
                                          step="0.01"
                                          placeholder="Ingresar valor"
                                          value={rubro.monto}
                                          onChange={(e) => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "monto", e.target.value)}
                                          isDisabled={estaPagado || tieneAbonosParciales}
                                          size="sm"
                                        />
                                      </>
                                    ) : (
                                      <HStack spacing={2}>
                                        <Input placeholder="Código" value={rubro.codigo} onChange={(e) => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "codigo", e.target.value)} isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)} size="sm" maxW="70px" />
                                        <Input placeholder="Concepto" value={rubro.concepto} onChange={(e) => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "concepto", e.target.value)} isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)} size="sm" flex={1} />
                                        <Input type="number" step="0.01" placeholder="Monto" value={rubro.monto} onChange={(e) => onActualizarRubroMes(puesto.id, mesIndex, rubroIdx, "monto", e.target.value)} isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)} size="sm" maxW="90px" />
                                        {puedeEditar && (
                                          <IconButton aria-label="Eliminar rubro" icon={<Trash2 size={16} />} size="sm" colorScheme="red" variant="ghost" onClick={() => onEliminarRubroMes(puesto.id, mesIndex, rubroIdx)} />
                                        )}
                                      </HStack>
                                    )}
                                  </Box>
                                );
                              })}
                            </VStack>
                          </Box>
                        ) : (
                          <>
                            <FormControl isRequired>
                              <FormLabel fontSize={{ base: "xs", md: "sm" }}>Renta Mensual (HNL)</FormLabel>
                              <Input
                                type="number"
                                value={pagoMes.rentaMensual || ""}
                                onChange={(e) => onActualizarRentaMensual(puesto.id, mesIndex, e.target.value)}
                                placeholder="0.00"
                                isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)}
                                size={{ base: "sm", md: "md" }}
                              />
                            </FormControl>
                            <Box>
                              <HStack justify="space-between" mb={2}>
                                <FormLabel fontSize={{ base: "xs", md: "sm" }} mb={0}>
                                  Pagos Adicionales
                                </FormLabel>
                                {!estaPagado && !tieneAbonosParciales && (estaEditando || estaGuardado) && (
                                  <Button size="xs" colorScheme="green" leftIcon={<Plus size={14} />} onClick={() => onAgregarPagoAdicional(puesto.id, mesIndex)}>
                                    Agregar
                                  </Button>
                                )}
                              </HStack>
                              <VStack spacing={2} align="stretch">
                                {rubrosCatalogo.length === 0 ? (
                                  <Text fontSize="xs" color="orange.600" fontStyle="italic">
                                    Configure el catálogo de rubros en Admin para agregar pagos adicionales. Solo se permiten rubros precargados.
                                  </Text>
                                ) : (
                                  <>
                                    {pagoMes.pagosAdicionales.map((pagoAdicional, indexPago) => {
                                      const conceptoStr = (pagoAdicional.concepto || "").trim();
                                      const idxPunto = conceptoStr.indexOf(". ");
                                      const codigoFromConcepto = idxPunto >= 0 ? conceptoStr.slice(0, idxPunto).trim() : "";
                                      const rubroSeleccionado = codigoFromConcepto ? rubrosCatalogo.find((r) => (r.codigo || "").trim() === codigoFromConcepto) : undefined;
                                      const otrosConceptos = pagoMes.pagosAdicionales
                                        .filter((_, i) => i !== indexPago)
                                        .map((pa) => {
                                          const s = (pa.concepto || "").trim();
                                          const i = s.indexOf(". ");
                                          return i >= 0 ? s.slice(0, i).trim() : "";
                                        })
                                        .filter(Boolean);
                                      const opcionesPago = rubrosCatalogo.filter((r) => r.id === rubroSeleccionado?.id || !otrosConceptos.includes((r.codigo || "").trim()));
                                      return (
                                        <HStack key={`${puesto.id}-${mesIndex}-${indexPago}`} spacing={2} align="center">
                                          <Select
                                            size="sm"
                                            placeholder="Seleccionar rubro del catálogo..."
                                            value={rubroSeleccionado?.id || ""}
                                            onChange={(e) => {
                                              const id = e.target.value;
                                              const r = rubrosCatalogo.find((x) => x.id === id);
                                              if (r) onActualizarPagoAdicional(puesto.id, mesIndex, indexPago, "concepto", [r.codigo, r.concepto].filter(Boolean).join(". ") || r.concepto);
                                            }}
                                            isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)}
                                            flex={2}
                                          >
                                            {opcionesPago.map((r) => (
                                              <option key={r.id} value={r.id}>
                                                {r.codigo} – {r.concepto}
                                              </option>
                                            ))}
                                          </Select>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Monto"
                                            value={pagoAdicional.monto || ""}
                                            onChange={(e) => onActualizarPagoAdicional(puesto.id, mesIndex, indexPago, "monto", e.target.value)}
                                            isDisabled={estaPagado || tieneAbonosParciales || (estaGuardado && !estaEditando)}
                                            size={{ base: "sm", md: "md" }}
                                            flex={1}
                                            maxW="120px"
                                          />
                                          {!estaPagado && !tieneAbonosParciales && (estaEditando || estaGuardado) && (
                                            <IconButton aria-label="Eliminar pago adicional" icon={<Trash2 size={16} />} size="sm" colorScheme="red" variant="ghost" onClick={() => onEliminarPagoAdicional(puesto.id, mesIndex, indexPago)} />
                                          )}
                                        </HStack>
                                      );
                                    })}
                                    {pagoMes.pagosAdicionales.length === 0 && (
                                      <Text fontSize="xs" color="gray.500" fontStyle="italic">
                                        No hay pagos adicionales. Use &quot;Agregar&quot; y seleccione un rubro del catálogo.
                                      </Text>
                                    )}
                                  </>
                                )}
                              </VStack>
                            </Box>
                            {!estaPagado && !tieneAbonosParciales && (estaEditando || estaGuardado) && (
                              <Button size="sm" variant="outline" colorScheme="teal" leftIcon={<Plus size={14} />} onClick={() => onAgregarRubroMes(puesto.id, mesIndex)}>
                                Definir rubros solo para este mes
                              </Button>
                            )}
                          </>
                        )}

                        <HStack spacing={2} justify="flex-end">
                          {estaGuardado && !estaEditando && estaPagado && (
                            <Button
                              type="button"
                              colorScheme="blue"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onVerRecibo(puesto, mesIndex);
                              }}
                              leftIcon={<FileText size={16} />}
                              size={{ base: "sm", md: "md" }}
                            >
                              Ver recibo
                            </Button>
                          )}
                          {estaGuardado && !estaEditando && !estaPagado && (
                            <Button
                              type="button"
                              colorScheme="teal"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onVerRecibo(puesto, mesIndex);
                              }}
                              leftIcon={<FileText size={16} />}
                              size={{ base: "sm", md: "md" }}
                              isDisabled={hayMesesAnterioresSinPagar}
                              title={hayMesesAnterioresSinPagar ? "Debe generar recibo (pagar) primero en los meses anteriores, empezando por Enero." : undefined}
                            >
                              Generar recibo
                            </Button>
                          )}
                          {!estaPagado && !tieneAbonosParciales && (
                            <>
                              <Button
                                colorScheme="blue"
                                onClick={() => onGuardarCobroMes(puesto, mesIndex)}
                                isDisabled={loading[puesto.id] || (pagoMes.rubros?.length ? totalMes <= 0 : !pagoMes.rentaMensual || parseFloat(pagoMes.rentaMensual) <= 0)}
                                isLoading={loading[puesto.id]}
                                leftIcon={<Save size={16} />}
                                size={{ base: "sm", md: "md" }}
                              >
                                {estaEditando ? "Guardar Cambios" : "Guardar rubro"}
                              </Button>
                              {estaEditando && (
                                <Button colorScheme="gray" onClick={() => onCancelarEdicionMes(puesto.id, mesIndex)} leftIcon={<X size={16} />} size={{ base: "sm", md: "md" }} isDisabled={loading[puesto.id]}>
                                  Cancelar
                                </Button>
                              )}
                            </>
                          )}
                        </HStack>
                      </VStack>
                    </Box>
                  );
                })}
              </VStack>

              <Divider />

              <HStack justify="flex-end" pt={2}>
                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold">
                  Deuda (meses vencidos):
                </Text>
                <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold" color="orange.600">
                  {formatCurrency(deudaMesesVencidos)}
                </Text>
              </HStack>
            </VStack>
          </Collapse>
        </VStack>
      </CardBody>
    </Card>
  );
});
