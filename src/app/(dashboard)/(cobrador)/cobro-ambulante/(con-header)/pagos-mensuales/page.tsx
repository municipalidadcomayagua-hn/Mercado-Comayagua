"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, CardBody, Heading, Modal, ModalBody, ModalContent, ModalOverlay, Spinner, Text, VStack, HStack, useDisclosure } from "@chakra-ui/react";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPuestosPorMercado, updatePuesto } from "@/lib/data/repositories/puestos.repo";
import { createCobro, getCobroById, getCobrosPorMercadoConDetalle, updateCobro } from "@/lib/data/repositories/cobros.repo";
import { getCuentasPorMercado, registrarAbono } from "@/lib/data/repositories/cuentas.repo";
import { RUBRO_RENTA_MENSUAL } from "@/lib/data/types";
import type { CobroConDetalle, Puesto, Rubro } from "@/lib/data/types";
import { getRubrosGlobales } from "@/lib/data/repositories/rubros.repo";
import { PuestoCardMensual, type PagoMensual, type PuestoLocal, type RubroFilaDraft } from "@/components/cobrador/PuestoCardMensual";
import Recibo from "@/components/recibos/Recibo";

const formatCurrency = (amount: number): string => `L. ${amount.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Fila de rubro "Renta mensual" para precargar un mes que todavia no tiene
 * cargo guardado, usando el valor_renta_mensual del locatario. Si el
 * catalogo del admin ya tiene un rubro que matchea "renta mensual" se usa
 * ese (real, con rubroId); si no, una fila reemplazable con "Cambiar" igual
 * que las demas - nunca queda fuera del catalogo de forma permanente.
 */
function construirRubroRentaMensual(valorMensual: number, rubrosCatalogo: Rubro[]): RubroFilaDraft[] {
  if (valorMensual <= 0) return [];
  const rubroCat = rubrosCatalogo.find((r) => (r.concepto || "").toLowerCase().includes("renta mensual"));
  return [
    rubroCat
      ? { rubroId: rubroCat.id, codigo: rubroCat.codigo, concepto: rubroCat.concepto, monto: valorMensual.toString() }
      : { codigo: "", concepto: "Renta mensual", monto: valorMensual.toString() },
  ];
}

/**
 * Puerto de la vista "Pagos mensuales" (VistaPagosMensuales) de
 * CobroAmbulante.tsx original. Se omitieron agregarPuesto/eliminarPuesto/
 * agregarRubroPlantilla/eliminarRubroPlantilla/actualizarRubroPlantilla/
 * handleDistribuirEn12Meses/confirmarDistribuirEn12Meses y el dialogo
 * "Distribuir en 12 meses": eran codigo inalcanzable en el original (ningun
 * boton los invocaba; se verifico con grep antes de omitirlos - ver
 * MIGRATION_NOTES.md). Los locatarios siempre llegan ya guardados desde
 * Locatarios/espacios.
 */
export default function PagosMensualesPage() {
  const { user, mercadoNombre } = useAuth();
  const cobradorId = user?.id;
  const mercadoId = user?.mercado_id ?? undefined;
  const nombreCobrador = user?.nombre || "";
  const anio = new Date().getFullYear();
  const router = useRouter();

  const [puestos, setPuestos] = useState<PuestoLocal[]>([]);
  const [loadingPuestos, setLoadingPuestos] = useState(false);
  const [loading, setLoading] = useState<{ [puestoId: string]: boolean }>({});
  const [saldoPorPuesto, setSaldoPorPuesto] = useState<Record<string, number>>({});
  const [rubrosCatalogo, setRubrosCatalogo] = useState<Rubro[]>([]);
  const [reciboSeleccionado, setReciboSeleccionado] = useState<{ cobro: CobroConDetalle; puesto: Puesto } | null>(null);
  const { isOpen: isReciboOpen, onOpen: onReciboOpen, onClose: onReciboClose } = useDisclosure();

  useEffect(() => {
    getRubrosGlobales()
      .then((rubros) => setRubrosCatalogo(rubros.filter((r) => (r.tipo_rubro ?? "vigente") === "vigente")))
      .catch(() => setRubrosCatalogo([]));
  }, []);

  const loadPuestosGuardados = useCallback(async () => {
    if (!mercadoId) return;
    setLoadingPuestos(true);
    try {
      const puestosGuardados = await getPuestosPorMercado(mercadoId, anio);
      let cobrosGuardados: CobroConDetalle[] = [];
      try {
        cobrosGuardados = await getCobrosPorMercadoConDetalle(mercadoId);
      } catch (error) {
        console.warn("No se pudieron cargar los cobros guardados, continuando sin ellos:", error);
      }

      const mesActual = new Date().getMonth() + 1; // 1-12
      const esAnioActual = anio === new Date().getFullYear();

      const puestosLocales: PuestoLocal[] = puestosGuardados.map((p) => {
        const pagosMensualesGuardados: { [mesIndex: number]: PagoMensual } = {};
        cobrosGuardados
          .filter((c) => c.numero_puesto === p.numero_puesto && c.anio === anio && c.mes && c.tipo_cobro === "mensual")
          .forEach((c) => {
            const mesIndex = (c.mes || 1) - 1;
            // Siempre se arma la lista de rubros (catalogo del admin). Los
            // meses viejos que se crearon con el campo libre "Renta Mensual"
            // (antes de unificar todo a rubros - ver MIGRATION_NOTES.md) se
            // muestran como una fila sintetica "Renta mensual" al inicio,
            // editable/reemplazable con "Cambiar" igual que cualquier otro rubro.
            const rubros: RubroFilaDraft[] = [
              ...(c.renta_mensual && c.renta_mensual > 0 ? [{ codigo: "", concepto: "Renta mensual", monto: c.renta_mensual.toString() }] : []),
              ...(c.pagos_adicionales ?? []).map((pa) => {
                const idx = pa.concepto.indexOf(". ");
                const codigo = idx >= 0 ? pa.concepto.slice(0, idx).trim() : "";
                const concepto = idx >= 0 ? pa.concepto.slice(idx + 2).trim() : pa.concepto;
                return { codigo, concepto, monto: pa.monto.toString() };
              }),
            ];
            const abonosPorConcepto: Record<string, number> = {};
            for (const ac of c.abonos_concepto ?? []) abonosPorConcepto[ac.concepto] = ac.monto;

            pagosMensualesGuardados[mesIndex] = {
              rentaMensual: (c.renta_mensual ?? 0).toString(),
              pagosAdicionales: c.pagos_adicionales?.map((pa) => ({ concepto: pa.concepto, monto: pa.monto.toString() })) || [],
              rubros,
              guardado: true,
              editando: false,
              cobroId: c.id,
              reciboGenerado: c.recibo_generado ?? false,
              ...(Object.keys(abonosPorConcepto).length > 0 && { abonosPorConcepto }),
            };
          });

        // Meses vigentes: por defecto Enero..mes actual (no se pintan meses
        // futuros que no han pasado), mas cualquier mes que ya tenga cargo
        // guardado aunque quede fuera de ese rango. Los meses vigentes sin
        // cargo guardado se precargan con la renta mensual del locatario.
        const mesesConDatos = Object.keys(pagosMensualesGuardados).map(Number);
        const mesesPorDefecto = esAnioActual ? Array.from({ length: mesActual }, (_, i) => i) : [];
        const mesesVisibles = Array.from(new Set([...mesesPorDefecto, ...mesesConDatos])).sort((a, b) => a - b);

        const valorMensualNum = p.valor_renta_mensual ?? 0;
        for (const mesIndex of mesesVisibles) {
          if (pagosMensualesGuardados[mesIndex]) continue;
          pagosMensualesGuardados[mesIndex] = {
            rentaMensual: "",
            pagosAdicionales: [],
            rubros: construirRubroRentaMensual(valorMensualNum, rubrosCatalogo),
            guardado: false,
            editando: false,
          };
        }

        return {
          id: p.id,
          nombreCliente: p.nombre_cliente,
          numeroPuesto: p.numero_puesto,
          tipoPuesto: p.tipo_puesto,
          valorDiario: p.valor_diario.toString(),
          valorMensual: valorMensualNum.toString(),
          numeroIdentidad: p.numero_identidad ?? "",
          rtn: p.rtn ?? "",
          codigo: p.codigo,
          pagosMensuales: pagosMensualesGuardados,
          mesesVisibles,
          expanded: false,
          editando: false,
        };
      });
      setPuestos(puestosLocales);

      try {
        const cuentas = await getCuentasPorMercado(mercadoId);
        const mapa: Record<string, number> = {};
        for (const c of cuentas) mapa[String(c.numero_puesto)] = c.saldo_pendiente;
        setSaldoPorPuesto(mapa);
      } catch {
        setSaldoPorPuesto({});
      }
    } catch (error) {
      console.error("Error cargando puestos:", error);
    } finally {
      setLoadingPuestos(false);
    }
  }, [mercadoId, anio, rubrosCatalogo]);

  useEffect(() => {
    if (mercadoId) loadPuestosGuardados();
  }, [mercadoId, loadPuestosGuardados]);

  const actualizarPuesto = useCallback((puestoId: string, campo: keyof PuestoLocal, valor: unknown) => {
    setPuestos((prev) => prev.map((p) => (p.id === puestoId ? { ...p, [campo]: valor } : p)));
  }, []);

  const actualizarRubroMes = useCallback(
    (puestoId: string, mesIndex: number, rubroIndex: number, campo: keyof RubroFilaDraft, valor: string) => {
      setPuestos((prev) =>
        prev.map((p) => {
          if (p.id !== puestoId) return p;
          const pago = p.pagosMensuales[mesIndex];
          if (!pago?.rubros?.length) return p;
          const rubros = [...pago.rubros];
          if (!rubros[rubroIndex]) return p;
          if (campo === "rubroId" && valor) {
            const cat = rubrosCatalogo.find((r) => r.id === valor);
            rubros[rubroIndex] = cat ? { ...rubros[rubroIndex], rubroId: valor, codigo: cat.codigo, concepto: cat.concepto } : { ...rubros[rubroIndex], rubroId: valor };
          } else {
            rubros[rubroIndex] = { ...rubros[rubroIndex], [campo]: valor };
          }
          return { ...p, pagosMensuales: { ...p.pagosMensuales, [mesIndex]: { ...pago, rubros } } };
        })
      );
    },
    [rubrosCatalogo]
  );

  const agregarRubroMes = useCallback((puestoId: string, mesIndex: number) => {
    setPuestos((prev) =>
      prev.map((p) => {
        if (p.id !== puestoId) return p;
        const pago = p.pagosMensuales[mesIndex] || { rentaMensual: "", pagosAdicionales: [], guardado: false, editando: false };
        const rubros = [...(pago.rubros || []), { codigo: "", concepto: "", monto: "" }];
        return { ...p, pagosMensuales: { ...p.pagosMensuales, [mesIndex]: { ...pago, rubros } } };
      })
    );
  }, []);

  const eliminarRubroMes = useCallback((puestoId: string, mesIndex: number, rubroIndex: number) => {
    setPuestos((prev) =>
      prev.map((p) => {
        if (p.id !== puestoId) return p;
        const pago = p.pagosMensuales[mesIndex];
        if (!pago?.rubros?.length) return p;
        const rubros = pago.rubros.filter((_, i) => i !== rubroIndex);
        return { ...p, pagosMensuales: { ...p.pagosMensuales, [mesIndex]: { ...pago, rubros } } };
      })
    );
  }, []);

  /** Activa puntualmente un mes que no estaba en la lista de vigentes (ej. un mes futuro pagado por adelantado). */
  const agregarMesVisible = useCallback(
    (puestoId: string, mesIndex: number) => {
      setPuestos((prev) =>
        prev.map((p) => {
          if (p.id !== puestoId || p.mesesVisibles.includes(mesIndex)) return p;
          const pagosMensuales = p.pagosMensuales[mesIndex]
            ? p.pagosMensuales
            : {
                ...p.pagosMensuales,
                [mesIndex]: {
                  rentaMensual: "",
                  pagosAdicionales: [],
                  rubros: construirRubroRentaMensual(parseFloat(p.valorMensual) || 0, rubrosCatalogo),
                  guardado: false,
                  editando: false,
                },
              };
          return { ...p, mesesVisibles: [...p.mesesVisibles, mesIndex].sort((a, b) => a - b), pagosMensuales };
        })
      );
    },
    [rubrosCatalogo]
  );

  const calcularTotalMes = useCallback((puesto: PuestoLocal, mesIndex: number): number => {
    const pagoMes = puesto.pagosMensuales[mesIndex];
    if (!pagoMes) return 0;
    if (pagoMes.rubros?.length) return pagoMes.rubros.reduce((sum, r) => sum + (parseFloat(r.monto) || 0), 0);
    const renta = parseFloat(pagoMes.rentaMensual) || 0;
    const adicionales = pagoMes.pagosAdicionales.reduce((sum, pa) => sum + (parseFloat(pa.monto) || 0), 0);
    return renta + adicionales;
  }, []);

  const calcularDeudaMesesVencidosPuesto = useCallback(
    (puesto: PuestoLocal): number => {
      const mesActual = new Date().getMonth() + 1;
      let total = 0;
      for (let mesIndex = 0; mesIndex < mesActual - 1 && mesIndex < 12; mesIndex++) {
        if (!puesto.pagosMensuales[mesIndex]?.reciboGenerado) total += calcularTotalMes(puesto, mesIndex);
      }
      return total;
    },
    [calcularTotalMes]
  );

  const iniciarEdicionMes = useCallback((puestoId: string, mesIndex: number) => {
    setPuestos((prev) =>
      prev.map((puesto) => {
        if (puesto.id !== puestoId) return puesto;
        const nuevos = { ...puesto.pagosMensuales };
        if (nuevos[mesIndex]) nuevos[mesIndex] = { ...nuevos[mesIndex], editando: true };
        return { ...puesto, pagosMensuales: nuevos };
      })
    );
  }, []);

  const cancelarEdicionMes = useCallback(
    async (puestoId: string, mesIndex: number) => {
      // Recargar el mes desde la base para descartar cambios sin guardar.
      await loadPuestosGuardados();
      setPuestos((prev) =>
        prev.map((p) => {
          if (p.id !== puestoId) return p;
          const nuevos = { ...p.pagosMensuales };
          if (nuevos[mesIndex]) nuevos[mesIndex] = { ...nuevos[mesIndex], editando: false };
          return { ...p, pagosMensuales: nuevos };
        })
      );
    },
    [loadPuestosGuardados]
  );

  const handleEditarPuesto = useCallback((puesto: PuestoLocal) => {
    actualizarPuesto(puesto.id, "editando", true);
  }, [actualizarPuesto]);

  const handleCancelarEdicion = useCallback(
    async (puesto: PuestoLocal) => {
      if (!mercadoId) return;
      try {
        const puestosGuardados = await getPuestosPorMercado(mercadoId, anio);
        const original = puestosGuardados.find((p) => p.id === puesto.id);
        if (original) {
          actualizarPuesto(puesto.id, "nombreCliente", original.nombre_cliente);
          actualizarPuesto(puesto.id, "numeroPuesto", original.numero_puesto);
          actualizarPuesto(puesto.id, "tipoPuesto", original.tipo_puesto);
          actualizarPuesto(puesto.id, "valorDiario", original.valor_diario.toString());
          actualizarPuesto(puesto.id, "valorMensual", original.valor_renta_mensual.toString());
          actualizarPuesto(puesto.id, "codigo", original.codigo);
        }
      } finally {
        actualizarPuesto(puesto.id, "editando", false);
      }
    },
    [mercadoId, anio, actualizarPuesto]
  );

  const handleGuardarCambiosPuesto = useCallback(
    async (puesto: PuestoLocal) => {
      if (!puesto.nombreCliente || !puesto.numeroPuesto || !puesto.tipoPuesto || !puesto.valorDiario) return;
      setLoading((prev) => ({ ...prev, [puesto.id]: true }));
      try {
        await updatePuesto(puesto.id, {
          nombre_cliente: puesto.nombreCliente,
          numero_puesto: puesto.numeroPuesto,
          tipo_puesto: puesto.tipoPuesto,
          valor_diario: parseFloat(puesto.valorDiario),
          valor_renta_mensual: parseFloat(puesto.valorMensual) || 0,
          numero_identidad: (puesto.numeroIdentidad ?? "").trim() || null,
          rtn: (puesto.rtn ?? "").trim() || null,
        });

        if (mercadoId) {
          const cobros = await getCobrosPorMercadoConDetalle(mercadoId);
          const cobrosDelPuesto = cobros.filter((c) => c.tipo_cobro === "mensual" && c.numero_puesto === puesto.numeroPuesto && c.anio === anio);
          await Promise.all(cobrosDelPuesto.map((c) => updateCobro(c.id, { nombre_cliente: puesto.nombreCliente })));
        }

        actualizarPuesto(puesto.id, "editando", false);
      } catch (error) {
        console.error("Error actualizando puesto:", error);
      } finally {
        setLoading((prev) => ({ ...prev, [puesto.id]: false }));
      }
    },
    [mercadoId, anio, actualizarPuesto]
  );

  const handleGuardarCobroMes = useCallback(
    async (puesto: PuestoLocal, mesIndex: number) => {
      const pagoMes = puesto.pagosMensuales[mesIndex];
      if (!pagoMes || !cobradorId || !mercadoId) return;

      const rubrosDelMes = pagoMes.rubros ?? [];
      if (rubrosDelMes.length === 0 || rubrosDelMes.some((r) => !r.monto || parseFloat(r.monto) <= 0)) return;
      const rentaMensual = 0;
      const pagosAdicionales = rubrosDelMes.map((r) => ({ concepto: [r.codigo, r.concepto].filter(Boolean).join(". ") || "Rubro", monto: parseFloat(r.monto) || 0 }));

      const totalAdicionales = pagosAdicionales.reduce((sum, pa) => sum + pa.monto, 0);
      const montoTotal = rentaMensual + totalAdicionales;

      setLoading((prev) => ({ ...prev, [puesto.id]: true }));
      try {
        let cobroIdFinal = pagoMes.cobroId;
        if (pagoMes.cobroId) {
          await updateCobro(pagoMes.cobroId, { renta_mensual: rentaMensual, pagos_adicionales: pagosAdicionales, monto: montoTotal });
        } else {
          cobroIdFinal = await createCobro({
            cobrador_id: cobradorId,
            codigo_cuenta: cobradorId,
            cobrador_nombre: nombreCobrador,
            nombre_cliente: puesto.nombreCliente,
            numero_puesto: puesto.numeroPuesto,
            tipo_puesto: puesto.tipoPuesto,
            tipo_cobro: "mensual",
            valor_diario: parseFloat(puesto.valorDiario) || 0,
            anio,
            monto: montoTotal,
            estado: "activo",
            mes: mesIndex + 1,
            renta_mensual: rentaMensual,
            pagos_adicionales: pagosAdicionales,
            recibo_generado: false,
            mercado_id: mercadoId,
          });
        }

        setPuestos((prev) =>
          prev.map((p) => {
            if (p.id !== puesto.id) return p;
            const nuevos = { ...p.pagosMensuales };
            nuevos[mesIndex] = { ...pagoMes, guardado: true, editando: false, cobroId: cobroIdFinal };
            return { ...p, pagosMensuales: nuevos };
          })
        );
      } catch (error) {
        console.error("Error guardando cobro:", error);
      } finally {
        setLoading((prev) => ({ ...prev, [puesto.id]: false }));
      }
    },
    [cobradorId, nombreCobrador, anio, mercadoId]
  );

  const handleVerRecibo = useCallback(
    async (puesto: PuestoLocal, mesIndex: number) => {
      const pagoMes = puesto.pagosMensuales[mesIndex];
      if (!pagoMes?.cobroId || !cobradorId || !mercadoId) return;

      if (!pagoMes.reciboGenerado) {
        const mesesSinPagar: number[] = [];
        for (let i = 0; i < mesIndex; i++) {
          if (!puesto.pagosMensuales[i]?.reciboGenerado) mesesSinPagar.push(i + 1);
        }
        if (mesesSinPagar.length > 0) return;
      }

      const tieneAbonosParciales = !!(pagoMes.abonosPorConcepto && Object.keys(pagoMes.abonosPorConcepto).length > 0);
      let cobroPendienteParaRecibo: { rentaMensual: number; pagosAdicionales: { concepto: string; monto: number }[]; monto: number } | null = null;

      if (!pagoMes.reciboGenerado) {
        if (tieneAbonosParciales) {
          const cobroActual = await getCobroById(pagoMes.cobroId);
          if (!cobroActual) return;
          const abonos: Record<string, number> = {};
          for (const ac of cobroActual.abonos_concepto ?? []) abonos[ac.concepto] = ac.monto;

          const pendientesPorConcepto: { concepto: string; pendiente: number }[] = [];
          let rentaPendiente = 0;
          const paPendientes: { concepto: string; monto: number }[] = [];
          const renta = cobroActual.renta_mensual ?? 0;
          if (renta > 0) {
            rentaPendiente = renta - (abonos[RUBRO_RENTA_MENSUAL] ?? 0);
            if (rentaPendiente > 0) pendientesPorConcepto.push({ concepto: RUBRO_RENTA_MENSUAL, pendiente: rentaPendiente });
          }
          for (const pa of cobroActual.pagos_adicionales ?? []) {
            const concepto = (pa.concepto || "").trim();
            const pendiente = pa.monto - (abonos[concepto] ?? 0);
            if (pendiente > 0) {
              pendientesPorConcepto.push({ concepto, pendiente });
              paPendientes.push({ concepto, monto: pendiente });
            }
          }
          const pendienteTotal = pendientesPorConcepto.reduce((s, p) => s + p.pendiente, 0);
          if (pendienteTotal <= 0) return;

          cobroPendienteParaRecibo = { rentaMensual: rentaPendiente, pagosAdicionales: paPendientes, monto: pendienteTotal };
          const abonosNuevos = { ...abonos };
          for (const p of pendientesPorConcepto) abonosNuevos[p.concepto] = (abonosNuevos[p.concepto] ?? 0) + p.pendiente;

          await updateCobro(pagoMes.cobroId, {
            abonos_concepto: Object.entries(abonosNuevos).map(([concepto, monto]) => ({ concepto, monto })),
            recibo_generado: true,
          });
          await registrarAbono(mercadoId, puesto.numeroPuesto, pendienteTotal, cobradorId, nombreCobrador || undefined, undefined, {
            mesAplicado: mesIndex + 1,
            anio,
            nombreCliente: puesto.nombreCliente,
          });
        } else {
          const rubrosVer = pagoMes.rubros ?? [];
          if (rubrosVer.length === 0 || rubrosVer.some((r) => !r.monto || parseFloat(r.monto) <= 0)) return;
          const rentaMensualVer = 0;
          const pagosAdicionalesVer = rubrosVer.map((r) => ({ concepto: [r.codigo, r.concepto].filter(Boolean).join(". ") || "Rubro", monto: parseFloat(r.monto) || 0 }));
          const montoTotalVer = rentaMensualVer + pagosAdicionalesVer.reduce((s, pa) => s + pa.monto, 0);
          await updateCobro(pagoMes.cobroId, { renta_mensual: rentaMensualVer, pagos_adicionales: pagosAdicionalesVer, monto: montoTotalVer });
          // Pasa por registrarAbono (en vez de marcar recibo_generado directo) para que
          // quede una fila en `abonos` con la fecha real del pago - Cierre diario y el
          // historial de abonos del locatario dependen de eso. registrarAbono ya marca
          // recibo_generado internamente para los meses indicados.
          await registrarAbono(mercadoId, puesto.numeroPuesto, montoTotalVer, cobradorId, nombreCobrador || undefined, undefined, {
            meses: [mesIndex + 1],
            anio,
            nombreCliente: puesto.nombreCliente,
          });
        }

        setPuestos((prev) =>
          prev.map((p) => {
            if (p.id !== puesto.id) return p;
            const nuevos = { ...p.pagosMensuales };
            if (nuevos[mesIndex]) nuevos[mesIndex] = { ...nuevos[mesIndex], reciboGenerado: true };
            return { ...p, pagosMensuales: nuevos };
          })
        );
      }

      let cobro = await getCobroById(pagoMes.cobroId);
      if (!cobro) return;

      if (cobroPendienteParaRecibo) {
        cobro = { ...cobro, renta_mensual: cobroPendienteParaRecibo.rentaMensual, pagos_adicionales: cobroPendienteParaRecibo.pagosAdicionales.map((pa) => ({ ...pa, id: "", cobro_id: cobro!.id })), monto: cobroPendienteParaRecibo.monto };
      } else if (pagoMes.rubros?.length && !tieneAbonosParciales) {
        const pagosAdicionalesParaRecibo = pagoMes.rubros.map((r) => ({ concepto: [r.codigo, r.concepto].filter(Boolean).join(". ") || "Rubro", monto: parseFloat(r.monto) || 0, id: "", cobro_id: cobro!.id }));
        const montoRecibo = pagosAdicionalesParaRecibo.reduce((sum, pa) => sum + pa.monto, 0);
        cobro = { ...cobro, pagos_adicionales: pagosAdicionalesParaRecibo, monto: montoRecibo };
      }

      cobro = { ...cobro, nombre_cliente: puesto.nombreCliente };

      const puestoCompleto: Puesto = {
        id: puesto.id,
        cobrador_id: cobradorId,
        mercado_id: mercadoId,
        nombre_cliente: puesto.nombreCliente,
        numero_puesto: puesto.numeroPuesto,
        tipo_puesto: puesto.tipoPuesto,
        valor_diario: parseFloat(puesto.valorDiario) || 0,
        valor_renta_mensual: parseFloat(puesto.valorMensual) || 0,
        anio,
        activo: true,
        codigo: puesto.codigo || "",
        numero_identidad: puesto.numeroIdentidad ?? null,
        rtn: puesto.rtn ?? null,
        direccion_cliente: null,
        telefono: null,
        observaciones: null,
        foto_documento_url: null,
        foto_permiso_operacion_urls: null,
        foto_contrato_arrendamiento_urls: null,
        foto_tarjeta_cobro_anual_urls: null,
        en_mora: null,
        created_at: new Date().toISOString(),
      };

      setReciboSeleccionado({ cobro, puesto: puestoCompleto });
      onReciboOpen();
    },
    [cobradorId, nombreCobrador, anio, mercadoId, onReciboOpen]
  );

  const calcularDeudaMesesVencidosTodos = (): number => puestos.reduce((total, puesto) => total + calcularDeudaMesesVencidosPuesto(puesto), 0);

  return (
    <VStack spacing={{ base: 6, md: 8 }} align="stretch">
      <Box>
        <Heading size={{ base: "md", sm: "lg" }} fontWeight="700" color="gray.800">
          Pagos
        </Heading>
        <Text color="gray.500" fontSize={{ base: "xs", sm: "sm" }} mt={1} mb={3}>
          Registre pagos mensuales por rubro o abonos parciales/diarios para cada locatario. Los locatarios y su distribución en 12 meses se registran en Locatarios.
        </Text>
        <Button size="sm" colorScheme="teal" variant="outline" leftIcon={<MapPin size={16} />} onClick={() => router.push("/cobro-ambulante/espacios")}>
          Ir a Locatarios
        </Button>
      </Box>

      <VStack spacing={6} align="stretch">
        {puestos.map((puesto) => (
          <PuestoCardMensual
            key={puesto.id}
            puesto={puesto}
            loading={loading}
            onActualizarPuesto={actualizarPuesto}
            onEditarPuesto={handleEditarPuesto}
            onCancelarEdicion={handleCancelarEdicion}
            onGuardarCambiosPuesto={handleGuardarCambiosPuesto}
            onCalcularTotalMes={calcularTotalMes}
            onIniciarEdicionMes={iniciarEdicionMes}
            onCancelarEdicionMes={cancelarEdicionMes}
            onGuardarCobroMes={handleGuardarCobroMes}
            onVerRecibo={handleVerRecibo}
            onActualizarRubroMes={actualizarRubroMes}
            onAgregarRubroMes={agregarRubroMes}
            onEliminarRubroMes={eliminarRubroMes}
            onAgregarMesVisible={agregarMesVisible}
            rubrosCatalogo={rubrosCatalogo}
            onCalcularDeudaMesesVencidos={calcularDeudaMesesVencidosPuesto}
            saldoPendienteReal={saldoPorPuesto[puesto.numeroPuesto]}
            mercadoId={mercadoId}
            cobradorId={cobradorId}
            cobradorNombre={nombreCobrador}
            mercadoNombre={mercadoNombre}
            onAbonoRegistrado={loadPuestosGuardados}
          />
        ))}
      </VStack>

      {puestos.length > 0 && (
        <Card bg="orange.50" borderWidth="1px" borderColor="orange.200" borderRadius="2xl" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <HStack justify="center">
              <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
                Deuda total (meses vencidos):
              </Text>
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="bold" color="orange.600">
                {formatCurrency(Object.keys(saldoPorPuesto).length > 0 ? Object.values(saldoPorPuesto).reduce((a, b) => a + b, 0) : calcularDeudaMesesVencidosTodos())}
              </Text>
            </HStack>
          </CardBody>
        </Card>
      )}

      {loadingPuestos && (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Box textAlign="center" py={8}>
              <Spinner size="xl" color="blue.500" />
              <Text mt={4} color="gray.600">
                Cargando puestos guardados...
              </Text>
            </Box>
          </CardBody>
        </Card>
      )}

      {!loadingPuestos && puestos.length === 0 && (
        <Card borderRadius="2xl" borderWidth="1px" borderColor="gray.100" boxShadow="0 4px 24px -4px rgba(0,0,0,0.08)">
          <CardBody>
            <Text textAlign="center" color="gray.500" py={8}>
              No hay locatarios. Registre primero en &quot;Locatarios&quot; y luego vuelva aquí para registrar los cobros mensuales.
            </Text>
            <Box textAlign="center" mt={4}>
              <Button colorScheme="teal" variant="outline" leftIcon={<MapPin size={16} />} onClick={() => router.push("/cobro-ambulante/espacios")}>
                Ir a Locatarios
              </Button>
            </Box>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={isReciboOpen} onClose={onReciboClose} size="full" isCentered>
        <ModalOverlay />
        <ModalContent maxW={{ base: "100vw", md: "900px" }} m={{ base: 2, md: 4 }} mx={{ base: 2, md: "auto" }}>
          <ModalBody p={0}>{reciboSeleccionado && <Recibo cobro={reciboSeleccionado.cobro} puesto={reciboSeleccionado.puesto} mercadoNombre={mercadoNombre} onClose={onReciboClose} />}</ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
