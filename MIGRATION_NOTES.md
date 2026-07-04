# Notas de migración — Sistema de Cobro de Mercados Municipales (Comayagua)

Firebase (Firestore + Auth + Cloud Functions) + Vite/React → **Next.js 15 (App Router) + Supabase (Postgres + Auth + RLS) + Vercel**.

Este documento es el entregable de **Fase 0** (auditoría, solo lectura del proyecto viejo). Se actualiza en cada fase posterior con decisiones, hallazgos y resultados.

> Proyecto viejo (solo referencia de lectura): `App Web-Mercado/App Web-Mercado/` (nota: la carpeta está anidada dos veces; el proyecto real está en el segundo nivel).
> Proyecto nuevo: `mercado-comayagua/` (este mismo directorio).

---

## 1. Inventario de rutas (React Router v6 → App Router)

Definidas en `src/App.tsx`. Dos guards: `ProtectedRoute` (cualquier usuario autenticado) y `AdminRoute` (autenticado + `isAdmin`). Layouts envuelven explícitamente los children (no hay `<Outlet>` anidado de React Router).

| Path actual | Componente | Guard | Layout | Notas / destino en App Router |
|---|---|---|---|---|
| `/login` | `Login` | ninguno | ninguno | `app/(auth)/login/page.tsx` |
| `/register` | *(redirige a `/login`)* | — | — | **No portar como ruta accesible** — ver hallazgo de seguridad §8 |
| `/dashboard` | `Dashboard` | Admin | `AdminLayout` | `app/(dashboard)/(admin)/dashboard/page.tsx` |
| `/ambulantes` | `GestionAmbulantes` | Admin | `AdminLayout` | `.../cobradores/page.tsx` (renombrado) |
| `/mercados` | `GestionMercados` | Admin | `AdminLayout` | `.../mercados/page.tsx` |
| `/catalogo-rubros` | `CatalogoRubrosAdmin` (lazy) | Admin | `AdminLayout` | `.../catalogo-rubros/page.tsx` |
| `/audit` | *(redirige a `/dashboard`)* | — | — | `AuditTool` no se porta como ruta (ver §8) |
| `/reportes/resumen-cobros` | `ReporteResumenCobros` (lazy) | Admin | `AdminLayout` | `.../reportes/resumen-cobros/page.tsx` |
| `/cierre-anual` | `CierreAnualAdmin` (lazy) | Admin | `AdminLayout` | `.../cierre-anual/page.tsx` |
| `/cobro-ambulante` | `CobroAmbulante` (panel central) | Protegida | `AmbulanteLayout` | `.../(cobrador)/cobro-ambulante/page.tsx` |
| `/cobro-ambulante/espacios` | `CobroAmbulante` (mismo componente, branch por pathname) | Protegida | `AmbulanteLayout` | `.../cobro-ambulante/espacios/page.tsx` (**página real separada**) |
| `/cobro-ambulante/pagos-mensuales` | ídem | Protegida | `AmbulanteLayout` | `.../cobro-ambulante/pagos-mensuales/page.tsx` |
| `/cobro-ambulante/pagos-diarios` | ídem | Protegida | `AmbulanteLayout` | `.../cobro-ambulante/pagos-diarios/page.tsx` |
| `/cobro-ambulante/estado-cuenta` | ídem | Protegida | `AmbulanteLayout` | `.../cobro-ambulante/estado-cuenta/page.tsx` |
| `/` | — | — | — | `Navigate` a home por rol → replicar en `middleware.ts` |

**`getDefaultRoute()`**: sin usuario → `/login`; admin → `/dashboard`; ambulante → `/cobro-ambulante`. Se replica en `middleware.ts`.

**Detalle crítico:** las 4 sub-rutas de `/cobro-ambulante/*` hoy son el **mismo componente de ~3252 líneas** (`CobroAmbulante.tsx`) que decide la vista activa parseando `pathname`. En Next.js se separan en 4 `page.tsx` reales (Fase 5), con estado compartido donde haga falta (layout o contexto).

---

## 2. Roles y guards

- **Solo 2 roles reales**: `administrador` y `ambulante` (este último es la etiqueta interna del "cobrador" — la UI lo llama "Cobradores"). No existe supervisor ni otro rol en el código.
- **Determinación del rol**: documento Firestore `usuarios/{uid}.rol`. **No se usan custom claims.**
- `isAdmin = rol === 'administrador'`, `isAmbulante = rol === 'ambulante'`.
- **admin**: Dashboard, Cobradores, Mercados, Catálogo de rubros, Reportes, Cierre anual, "Limpiar base de datos".
- **ambulante (cobrador)**: Inicio, Locatarios, Cobros mensuales, Pagos diarios, Estado de cuenta — acotado a su `mercadoId`.
- **Fallback "basic user"**: si el usuario autenticado no tiene doc en `usuarios` (o Firestore falla), `AuthProvider` sintetiza un usuario con `rol: 'ambulante', activo: true` sin persistirlo. → **Cualquier cuenta de Firebase Auth sin perfil entra como cobrador.** Documentado como hallazgo, no se replica tal cual sin decidir (ver §8).

---

## 3. Inventario de colecciones Firestore → mapeo a Postgres

Todas las fechas son Firestore `Timestamp` → `timestamptz`. Todos los montos son `number` (float64, sin decimales de precisión) → `numeric(12,2)` en Postgres (mejora, sin cambiar el valor calculado).

**No hay ningún `onSnapshot` en todo el código** (confirmado por grep exhaustivo). Todo el acceso a datos es one-shot (`getDoc`/`getDocs`). → No se requiere Supabase Realtime; TanStack Query con invalidation tras cada mutación es suficiente y fiel al comportamiento actual.

### 3.1 `usuarios` → `perfiles`
PK = `auth.users.id` (antes: uid de Firebase Auth, doc-id explícito).

| Campo Firestore | Campo Postgres | Tipo | Notas |
|---|---|---|---|
| (doc id = uid) | `id` | uuid PK, FK→`auth.users` | |
| `email` | `email` | text | también en `auth.users`, se duplica por conveniencia de queries |
| `displayName` | `nombre` | text | |
| `rol` | `rol` | text check (`administrador`,`ambulante`) | |
| `activo` | `activo` | boolean | |
| `fechaCreacion` | `created_at` | timestamptz | |
| `ultimoAcceso` | `ultimo_acceso` | timestamptz null | |
| `mercadoId` | `mercado_id` | uuid null, FK→`mercados` | solo relevante para rol ambulante |

### 3.2 `ambulantes` → `cobradores`
Detalle de perfil de cobrador (el uid del Auth vive en `perfiles`; esta tabla es información adicional 1:1).

| Firestore | Postgres | Tipo | Notas |
|---|---|---|---|
| (doc id, auto) | `id` | uuid PK | |
| `codigoCuenta` | `codigo_cuenta` | text unique | formato `A001`, `A002`... (ver §6.A) |
| `nombre` | `nombre` | text | |
| `apellido` | `apellido` | text | |
| `dni` | `dni` | text | |
| `telefono` | `telefono` | text null | |
| `email` | `email` | text null | debía terminar en `@mercado.com` (constraint de la app, no de Firestore) |
| `fechaRegistro` | `created_at` | timestamptz | |
| `estado` | `estado` | text check (`activo`,`suspendido`,`inactivo`) | |
| `foto` | `foto_url` | text null | |
| `coordenadas.lat/lng` | `lat numeric`, `lng numeric` | null | se aplanan (eran un mapa anidado) |
| `userId` | `user_id` | uuid unique, FK→`perfiles(id)` | **importante**: en el código real, `ambulanteId`/`cobradorId` de `puestos`/`cobros` es el **uid de Auth** (=`perfiles.id`), no el doc-id de esta tabla. Esta tabla es solo metadata adicional. |
| `mercadoId` | `mercado_id` | uuid null, FK→`mercados` | se mantenía duplicado también en `usuarios.mercadoId` |

### 3.3 `mercados` → `mercados`
| Firestore | Postgres | Tipo |
|---|---|---|
| (auto) | `id` | uuid PK |
| `nombre` | `nombre` | text |
| `codigo` | `codigo` | text null |
| `activo` | `activo` | boolean default true |
| `creadoEn` | `created_at` | timestamptz |

### 3.4 `puestos` → `puestos`
Los datos del cliente/locatario están **embebidos** en el documento del puesto (no hay tabla `locatarios` separada — se decidió fielmente no inventarla).

| Firestore | Postgres | Tipo | Notas |
|---|---|---|---|
| (auto) | `id` | uuid PK | |
| `ambulanteId` | `cobrador_id` | uuid FK→`perfiles(id)` | = uid de Auth del cobrador |
| `nombreCliente` | `nombre_cliente` | text | |
| `numeroPuesto` | `numero_puesto` | text | |
| `tipoPuesto` | `tipo_puesto` | text | |
| `valorDiario` | `valor_diario` | numeric(12,2) | |
| `anio` | `anio` | int | |
| `fechaRegistro` | `created_at` | timestamptz | |
| `activo` | `activo` | boolean | |
| `codigo` | `codigo` | text | generado, inmutable tras creación (ver §6.B) |
| `numeroIdentidad` | `numero_identidad` | text null | formato `0000-0000-00000` |
| `rtn` | `rtn` | text null | |
| `direccionCliente` | `direccion_cliente` | text null | |
| `telefono` | `telefono` | text null | |
| `observaciones` | `observaciones` | text null | |
| `fotoDocumentoUrl` | `foto_documento_url` | text null | URL de Cloudinary |
| `fotoPermisoOperacionUrls` | `foto_permiso_operacion_urls` | text[] null | URLs de Cloudinary |
| `fotoContratoArrendamientoUrls` | `foto_contrato_arrendamiento_urls` | text[] null | URLs de Cloudinary |
| `fotoTarjetaCobroAnualUrls` | `foto_tarjeta_cobro_anual_urls` | text[] null | URLs de Cloudinary |
| `enMora` | `en_mora` | boolean null | seteado por cierre anual / limpiado por `registrarAbonoMora` |

Constraint de negocio (`existePuesto`): UNIQUE `(cobrador_id, numero_puesto, anio) WHERE activo`.

### 3.5 `cobros` → `cobros` + 3 tablas hijas normalizadas
La tabla más grande y compleja. Se **normalizan** los 3 campos embebidos (decisión #3), sin alterar los cálculos que los producen/consumen.

**`cobros`** (campos escalares):

| Firestore | Postgres | Tipo | Notas |
|---|---|---|---|
| (auto, o UUID cliente) | `id` | uuid PK | permite insert idempotente desde el cliente |
| `ambulanteId` | `cobrador_id` | uuid FK→`perfiles(id)` | |
| `codigoCuenta` | `codigo_cuenta` | text | |
| `ambulanteNombre` | `cobrador_nombre` | text | denormalizado, igual que el original |
| `nombreCliente` | `nombre_cliente` | text null | |
| `numeroPuesto` | `numero_puesto` | text | (enlaza por valor, no por FK — igual que el original; ver hallazgo §8) |
| `tipoPuesto` | `tipo_puesto` | text null | |
| `tipoCobro` | `tipo_cobro` | text check (`diario`,`semanal`,`quincenal`,`mensual`) | |
| `valorDiario` | `valor_diario` | numeric null | |
| `diasMes` | `dias_mes` | int null | |
| `anio` | `anio` | int | |
| `monto` | `monto` | numeric(12,2) | |
| `fechaCobro` | `fecha_cobro` | timestamptz | |
| `fechaCobroDia` | `fecha_cobro_dia` | timestamptz null | |
| `cobradorId` | (=`cobrador_id`, se unifica; en el original coincide siempre con `ambulanteId`) | | |
| `cobradorNombre` | (=`cobrador_nombre`) | | |
| `estado` | `estado` | text check (`activo`,`anulado`) | |
| `motivoAnulacion` | `motivo_anulacion` | text null | |
| `fechaAnulacion` | `fecha_anulacion` | timestamptz null | |
| `anuladoPorId` | `anulado_por_id` | uuid null FK→`perfiles` | |
| `numeroRecibo` | `numero_recibo` | int | ver folio §6.C |
| `mercadoId` | `mercado_id` | uuid null FK→`mercados` | |
| `sincronizado` | `sincronizado` | boolean | bandera de sync offline, sin uso real hoy (no hay offline aún) |
| `mes` | `mes` | int null (1-12) | |
| `rentaMensual` | `renta_mensual` | numeric null | |
| `reciboGenerado` | `recibo_generado` | boolean default false | **campo de bloqueo**: mientras false, el cobro es editable (decisión #2) |
| `estadoCargo` | `estado_cargo` | text null check (`pendiente`,`pagado`,`en_mora`) | |
| `tipoPago` | `tipo_pago` | text null check (`vigente`,`mora`) | |
| `esCobroDiario` | `es_cobro_diario` | boolean | |
| `reporteDiarioCompletado` | `reporte_diario_completado` | boolean null | |
| `fechaReporteCompletado` | `fecha_reporte_completado` | timestamptz null | |
| `actualizadoCierreAnual` *(campo extra no tipado, escrito por cierreAnualService)* | `actualizado_cierre_anual` | timestamptz null | |

**`cobros_pagos_adicionales`** (de `Cobro.pagosAdicionales[]`): `id uuid PK, cobro_id uuid FK→cobros(id) ON DELETE CASCADE, concepto text, monto numeric(12,2)`.

**`cobros_pagos_diarios`** (de `Cobro.pagosDiarios[]`): `id uuid PK, cobro_id uuid FK→cobros(id) ON DELETE CASCADE, numero_puesto int, monto numeric(12,2), timestamp timestamptz null, rubro_id uuid null FK→rubros, codigo text null, concepto text null`.

**`cobros_abonos_concepto`** (de `Cobro.abonosPorConcepto{concepto: monto}`): `id uuid PK, cobro_id uuid FK→cobros(id) ON DELETE CASCADE, concepto text, monto numeric(12,2)`. (El map se vuelve filas `(concepto, monto)`.)

### 3.6 `cuentasPorCobrar` → `cuentas_por_cobrar`
Doc-id compuesto `${ambulanteId}_${numeroPuesto}` → se reemplaza por PK uuid + `UNIQUE (cobrador_id, numero_puesto)`.

| Firestore | Postgres | Tipo |
|---|---|---|
| — | `id` | uuid PK |
| `ambulanteId` | `cobrador_id` | uuid FK→perfiles |
| `numeroPuesto` | `numero_puesto` | text |
| `nombreCliente` | `nombre_cliente` | text null |
| `montoTotal` | `monto_total` | numeric(12,2) |
| `totalAbonado` | `total_abonado` | numeric(12,2) |
| `saldoPendiente` | `saldo_pendiente` | numeric(12,2) |
| `ultimaFechaCobro` | `ultima_fecha_cobro` | timestamptz |
| `ultimaFechaAbono` | `ultima_fecha_abono` | timestamptz null |
| `fechaVencimiento` | `fecha_vencimiento` | timestamptz null |
| `estado` | `estado` | text check (`al_dia`,`atrasado`,`saldado`) |
| `creadoEn`/`actualizadoEn` | `created_at`/`updated_at` | timestamptz |

**Importante:** esta tabla es un **caché recomputado** — `getCuentasPorAmbulante` ignora los valores guardados y recalcula `montoTotal`/`totalAbonado`/`saldoPendiente` en memoria a partir de `cobros` (solo meses vencidos del año actual) y `abonos` (solo del año actual) cada vez que se lee. Se documenta como comportamiento a preservar tal cual (ver §6.D-E), no como bug a "arreglar", aunque es candidato futuro a una vista materializada.

### 3.7 `abonos` → `abonos`
| Firestore | Postgres | Tipo |
|---|---|---|
| (auto) | `id` | uuid PK |
| `ambulanteId` | `cobrador_id` | uuid FK→perfiles |
| `numeroPuesto` | `numero_puesto` | text |
| `monto` | `monto` | numeric(12,2) |
| `fecha` | `fecha` | timestamptz |
| `cobradorId` | (=`cobrador_id`) | | en el original siempre coincide con `ambulanteId` |
| `cobradorNombre` | `cobrador_nombre` | text null |
| `referencia` | `referencia` | text null |
| `creadoEn` | `created_at` | timestamptz |
| `meses` | `meses` | int[] null |
| `anio` | `anio` | int null |
| `mesAplicado` | `mes_aplicado` | int null |
| `rubroAplicado.concepto` | `rubro_aplicado_concepto` | text null | se aplana |
| `numeroRecibo` | `numero_recibo` | int null |
| `mercadoId` | `mercado_id` | uuid null FK→mercados |

### 3.8 `deudasMora` → `deudas_mora`
| Firestore | Postgres | Tipo |
|---|---|---|
| (auto) | `id` | uuid PK |
| `puestoId` | `puesto_id` | uuid FK→puestos |
| `ambulanteId` | `cobrador_id` | uuid FK→perfiles |
| `numeroPuesto` | `numero_puesto` | text |
| `nombreCliente` | `nombre_cliente` | text |
| `rubroId` | `rubro_id` | uuid FK→rubros |
| `rubroCodigo` | `rubro_codigo` | text |
| `rubroConcepto` | `rubro_concepto` | text |
| `tipoRubro` | `tipo_rubro` | text default `'mora'` |
| `montoTotal` | `monto_total` | numeric(12,2) |
| `descripcion` | `descripcion` | text null |
| `totalAbonado` | `total_abonado` | numeric(12,2) |
| `saldoPendiente` | `saldo_pendiente` | numeric(12,2) |
| `creadoEn`/`actualizadoEn` | `created_at`/`updated_at` | timestamptz |
| `mercadoId` | `mercado_id` | uuid null FK→mercados |

### 3.9 `abonosMora` → `abonos_mora`
| Firestore | Postgres | Tipo |
|---|---|---|
| (auto) | `id` | uuid PK |
| `deudaMoraId` | `deuda_mora_id` | uuid FK→deudas_mora |
| `monto` | `monto` | numeric(12,2) |
| `fecha` | `fecha` | timestamptz |
| `observacion` | `observacion` | text null |
| `usuarioId` | `usuario_id` | uuid FK→perfiles |
| `usuarioNombre` | `usuario_nombre` | text |
| `numeroRecibo` | `numero_recibo` | int |
| `saldoPendienteDespues` | `saldo_pendiente_despues` | numeric(12,2) |
| `creadoEn` | `created_at` | timestamptz |
| `mercadoId` | `mercado_id` | uuid null FK→mercados |

### 3.10 `rubrosCatalogo` → `rubros`
| Firestore | Postgres | Tipo | Notas |
|---|---|---|---|---|
| (auto) | `id` | uuid PK | |
| `ambulanteId` | `cobrador_id` | uuid null FK→perfiles | **centinela `'GLOBAL'` → NULL** |
| — | `es_global` | boolean default false | true cuando antes era `ambulanteId==='GLOBAL'` (catálogo del admin, usado por `CatalogoRubrosAdmin` y cierre anual) |
| `codigo` | `codigo` | text | |
| `abreviatura` | `abreviatura` | text default `''` | |
| `concepto` | `concepto` | text | |
| `activo` | `activo` | boolean default true | |
| `tipoRubro` | `tipo_rubro` | text check (`vigente`,`mora`) default `'vigente'` | |

### 3.11 Índices Firestore ya definidos (`firestore.indexes.json`) → índices Postgres
1. `abonosMora(mercadoId, numeroRecibo desc)` → `abonos_mora(mercado_id, numero_recibo desc)`
2. `cobros(tipoCobro, anio, reciboGenerado)` → `cobros(tipo_cobro, anio, recibo_generado)`
3. `abonos(ambulanteId, anio)` → `abonos(cobrador_id, anio)`
4. `deudasMora(puestoId, rubroId)` → `deudas_mora(puesto_id, rubro_id)`

---

## 4. Cloud Functions

**Solo existe una función**, `deleteAllUsersExceptAdmin` (`functions/src/index.ts`):
- Trigger: `onCall` (HTTPS callable v2), `enforceAppCheck: false`.
- Auth: requiere `request.auth`; lee `usuarios/{uid}.rol` y exige `'administrador'` (`HttpsError('permission-denied', ...)` si no).
- Lógica: pagina `auth.listUsers(1000, nextPageToken)`, filtra el propio uid del admin, `auth.deleteUsers(uidsToDelete)` en lote, acumula `deletedCount`.
- Payload: `{}`. Respuesta: `{ deletedUsers, adminUid, adminEmail }`.
- Invocada desde `src/services/resetDatabaseService.ts` vía `httpsCallable(functions, 'deleteAllUsersExceptAdmin')`, dentro de un try/catch no fatal.

**El borrado de datos NO ocurre en la función** — corre client-side en `resetDatabaseService.ts` (`writeBatch` en lotes de 500 sobre 9 colecciones + `usuarios` salvo admin), confiando en las reglas de Firestore (inexistentes en el repo) para bloquear a no-admins. → Fase 8 reemplaza *todo* esto (función + reset client-side) por una única operación server-side con `service_role`.

---

## 5. Cloudinary vs Firebase Storage

- **Cloudinary** (`src/services/cloudinaryService.ts`) es el backend real de imágenes: unsigned upload preset (`cloud_name` default `djyspu4sf`, preset `Locatarios`, overridable por env). Sube a `locatarios/{ambulanteId}[/subfolder]`; subcarpetas usadas: default (documento/DNI), `permisos`, `contratos`, `tarjeta-anual`. Devuelve `secure_url`, guardado como texto plano en las columnas `foto_*` de `puestos`.
- **Firebase Storage** (`src/services/storageService.ts`, función `subirFotoLocatario`) está **inicializado pero es código muerto** — no se importa en ningún lugar de `src`. Confirmado por grep. **No se migra nada de Storage.**
- Decisión: Cloudinary se mantiene sin cambios (mismas env vars, prefijo `NEXT_PUBLIC_`).

---

## 6. Cálculos de negocio a portar verbatim (no se cambia la aritmética)

### A. `codigoCuenta` de cobrador (`generarCodigoCuenta`)
Si no hay ninguno → `'A001'`. Si existen, `max(parseInt(codigoCuenta.substring(1)))` + 1, formateado `A${n.padStart(3,'0')}`.

### B. `codigo` de puesto (`generarCodigoPuesto`)
`iniciales` de `nombreCliente` (1 palabra → 2 primeras letras mayúsculas; varias palabras → inicial de cada una, máx 6 chars, mayúsculas; fallback `'XX'`) + `numeroPuesto` (padStart 2, slice 2) + `anio`. Si la combinación ya existe en ese año, se agrega sufijo `-2`, `-3`, ... hasta encontrar libre.

### C. Numeración de folio/recibo (`numeroRecibo`)
Correlativo por-mercado (o global si no hay `mercadoId`), **compartido entre `cobros`, `abonos` y `abonos_mora`** — el "siguiente número" es el máximo de las tres colecciones + 1. En el original esto es un esquema de lectura-máximo-luego-incremento **con condición de carrera** (sin transacción). Se documenta como bug/riesgo conocido del original (§8), y se resuelve en Postgres con una tabla `contadores_recibo` + RPC atómico (`FOR UPDATE`), preservando el mismo resultado de negocio (mismo número que se habría generado, solo que sin la carrera).

### D. `actualizarCuentaDesdeCobro`
Ignora cobros con `reporteDiarioCompletado===true` o `esCobroDiario===true` (para no duplicar el saldo de mensuales). Suma `monto` a `montoTotal` de la cuenta (por `cobrador_id + numeroPuesto`); `saldoPendiente = max(0, montoTotal - totalAbonado)`. `fechaVencimiento`: fin de mes si hay `mes`+`anio`; si no, fin del día de `fechaCobroDia`. `estado = saldoPendiente<=0 ? 'saldado' : 'al_dia'` (nunca setea `'atrasado'` aquí).

### E. `getCuentasPorAmbulante` (recomputo en lectura)
Deuda = solo meses **vencidos del año actual** (`mes >= 1 && mes < mesActual`, `tipoCobro==='mensual'`, activo). `totalAbonado` = solo abonos del **año actual**. `saldoPendiente = max(0, ...)`. Puestos sin cargos mensuales no aparecen (los cobros diarios no cuentan para este saldo).

### F. `registrarAbono` (mensual)
Requiere cuenta existente. Suma a `totalAbonado`, recalcula saldo, `estado='saldado'` si llega a 0. Si `meses[]+anio`: marca esos cobros mensuales (no generados aún) como `reciboGenerado=true, estadoCargo='pagado'`. Si es abono parcial por concepto (`mesAplicado+anio+rubroAplicado.concepto`): suma al mapa `abonosPorConcepto` del cobro de ese mes; si el total del mapa ≥ `cobro.monto` → marca `reciboGenerado=true, estadoCargo='pagado'`.

### G. `registrarAbonoMora`
Suma a `totalAbonado` de la deuda; `saldoPendienteDespues = max(0, montoTotal - totalAbonado)` (se guarda como snapshot en el abono). Si **todas** las deudas en mora del puesto quedan en 0 → `puestos.enMora = false`.

### H. Cierre anual (`ejecutarCierreAnual`)
Toma cobros mensuales del año con `reciboGenerado=false` y `estado!=='anulado'` (deuda impaga). Agrega por `(cobrador, numeroPuesto, rubro)`: `rentaMensual` va al rubro de mora "renta" (o el primero disponible); cada `pagosAdicionales[].concepto` se empareja por substring a un rubro de mora (o cae al de renta). Por cada agregado > 0: crea o incrementa una fila en `deudasMora` (busca por `puestoId+rubroId`). Marca en lote (500) los cobros procesados con `estadoCargo='en_mora', tipoPago='mora', actualizadoCierreAnual=now`, y marca `puestos.enMora=true`. Devuelve `{cobrosMarcados, deudasMoraCreadas, puestosActualizados, errores}`.

### I. Estadísticas del día/mes
Suma `monto` solo de cobros con `reciboGenerado===true && reporteDiarioCompletado!==true` del período.

### J. Formato de folio y monto en letras
`formatNumeroRecibo(n)`: `String(Math.floor(n)).padStart(2,'0')`, `'N/A'` si es null/NaN — **se copia verbatim**.
`numeroATexto(n)`: monto en letras en español (Honduras), sufijo `CON NN/100` — **se copia verbatim** (función pura, sin dependencias de Firebase).

### K. Sistema de recibos e impresión (client-only)
- 5 componentes de recibo generan líneas ESC/POS (`buildReceiptLines`, ancho 32 chars) para impresión térmica Bluetooth (`bluetoothThermalPrint.ts`, Web Bluetooth API, UUIDs conocidos HM-10/SPP-BLE), más un flujo de descarga HTML (`Blob` + `innerHTML` del contenedor) y `window.print()`.
- Fallbacks: `rawbt:base64,...` (Android, app RawBT), `blueprint://?text=...` (iOS, app BluePrint), `mailto:`.
- Todo esto es **client-only** (Web Bluetooth, `navigator.*`, `document.getElementById(...).innerHTML`, Blob/URL.createObjectURL) → se porta verbatim a componentes marcados `"use client"`, con los mismos guards de plataforma (`isIOS`, `isAndroid`, `isSecureContext`). Requiere HTTPS (Vercel lo da por defecto).

---

## 7. Variables de entorno

`.env` original (todas `VITE_*`, ninguna es secreta salvo por buena práctica de no versionarlas):

| Variable original | ¿Se mantiene? | Variable nueva |
|---|---|---|
| `VITE_FIREBASE_*` (6 vars) | No — se elimina Firebase por completo | — |
| `VITE_CLOUDINARY_CLOUD_NAME` | Sí | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Sí | `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` |

Nuevas (Supabase):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo server-side y scripts, NUNCA con prefijo NEXT_PUBLIC_
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
```

---

## 8. Hallazgos del código original — documentados, NO corregidos sin avisar

Estos son comportamientos/bugs reales del sistema actual. Se preservan en la migración salvo que el usuario apruebe corregirlos explícitamente (regla del prompt: no cambiar lógica de negocio sin avisar).

1. **Folio con condición de carrera** (§6.C): `max()+1` leído y luego escrito sin transacción. Bajo uso concurrente simultáneo en el mismo mercado, dos cobradores podrían obtener el mismo número de recibo. La migración a Postgres con RPC atómico **elimina** la carrera sin cambiar el resultado esperado — se documenta como mejora de infraestructura, no de lógica.
2. **Fallback "basic user"** en `AuthProvider`: cualquier usuario de Firebase Auth autenticado sin documento en `usuarios` entra automáticamente como `rol: 'ambulante', activo: true`, sin crear el documento. Esto significa que la creación de una cuenta de Auth (por ejemplo, un admin usando el flujo interno) sin el paso explícito de crear el perfil ya otorga acceso de cobrador. **Pendiente de decisión** para la Fase 4: ¿el trigger `handle_new_user()` de Postgres replica este fallback (crea perfil con rol `ambulante` automáticamente, igual que hoy) o se exige perfil explícito? Recomendación: el trigger que crea la fila automáticamente en `perfiles` con rol `ambulante` por defecto **reproduce el mismo comportamiento observable** (todo usuario nuevo entra como cobrador hasta que un admin lo cambie), así que no es un cambio de lógica — se adopta así en Fase 4.
3. **`cuentasPorCobrar` es un caché que el read sobreescribe** (§3.6, §6.E): los valores guardados en el documento casi nunca se usan tal cual — `getCuentasPorAmbulante` los recalcula en memoria cada vez. Se preserva la tabla y el recompute idéntico; es candidato futuro (fuera de alcance) a convertirse en vista materializada.
4. **`Register.tsx`**: permite elegir el propio rol (incluido `administrador`) al registrarse. Hoy la ruta `/register` redirige a `/login` y por tanto es inalcanzable desde la UI, pero el componente existe en el bundle. **No se porta esta pantalla al nuevo sistema** — la creación de usuarios admin/cobrador se hace exclusivamente vía el script de migración (Fase 4) y, a futuro, desde el panel de administración (`GestionAmbulantes`→`cobradores`), nunca por auto-registro con selección de rol.
5. **`AuditTool.tsx`**: página de diagnóstico ya implementada pero con ruta `/audit` redirigida a `/dashboard` (inalcanzable). No forma parte del alcance de esta migración; se deja fuera (no se porta) salvo que el usuario pida lo contrario.
6. **Enlaces por valor, no por FK**: `cobros`/`cuentasPorCobrar`/`abonos` enlazan a `puestos` por `numeroPuesto` (texto) + `cobrador_id`, mientras que `deudasMora` sí usa `puesto_id` (FK real). Se preserva esta inconsistencia en el esquema relacional (mismo comportamiento), documentada aquí para quien la revise; no se normaliza a FK real para no alterar las queries/índices existentes sin aprobación.
7. **No hay `firestore.rules` ni `storage.rules` en el repositorio** — la seguridad real vivía (si acaso) solo en la consola de Firebase, fuera de control de versiones. Esto significa que **no hay reglas que "portar"**: las políticas RLS de Supabase (Fase 6) se escriben desde cero, basadas únicamente en lo que el código cliente/Cloud Function asumía (chequeo de `rol==='administrador'`).
8. **Money como float**, no como enteros/centavos, en todo el sistema original. Se usa `numeric(12,2)` en Postgres (más preciso que float64), sin cambiar ningún cálculo ni resultado esperado — es un cambio de representación, no de lógica.

---

## 9. Resumen de infraestructura del proyecto viejo (para no repetir errores de proceso)
- **No había control de versiones** (sin `.git` en ningún nivel) — el proyecto nuevo se inicializa con git desde el primer commit.
- Carpeta duplicada/anidada (`App Web-Mercado/App Web-Mercado/`) — el proyecto nuevo empieza limpio en `mercado-comayagua/`, sin heredar esa estructura.
- Sin TanStack Query — se introduce en el proyecto nuevo (Fase 2) para reemplazar el patrón manual `useEffect`+`useState`+refetch manual.

---

## Pendiente de aprobación antes de Fase 1
- Confirmar el mapeo de nombres de tablas (§3, ya acordado con el usuario: renombrar para claridad, ej. `ambulantes`→`cobradores`).
- Confirmar tratamiento del hallazgo §8.2 (fallback de rol por defecto) — se adopta la recomendación (trigger con rol `ambulante` por defecto) salvo objeción.
- Confirmar que `Register.tsx` y `AuditTool.tsx` **no se portan** (§8.4, §8.5) salvo que el usuario indique lo contrario.

---

## 10. Fase 4 — Auth y roles (estado)

### Implementado y verificado
- Migración `0002_trigger_perfiles.sql`: trigger `handle_new_user` (crea fila en `perfiles` con `rol='ambulante'` por defecto al insertarse en `auth.users` — reproduce el fallback "basic user" del original, ver §8.2), columna `perfiles.debe_cambiar_password`, helper `es_admin()` para RLS (Fase 6).
- `src/lib/auth/AuthProvider.tsx`: puerto de `AuthProvider.tsx` original a Supabase Auth. Resuelve `mercadoNombre` con el mismo fallback (perfil → `cobradores.mercado_id` si falta). La rama "buscar por email" del original ya no aplica: `cobradores.user_id` es FK `NOT NULL UNIQUE`, así que el enlace siempre existe tras la migración (simplificación posible gracias al esquema relacional, mismo resultado, no un cambio de lógica).
- `src/app/login/page.tsx`: puerto verbatim de `Login.tsx` (mismo layout, mismo copy).
- `src/lib/auth/errors.ts`: mapeo de errores. **Diferencia de plataforma no corregible**: Supabase fusiona "contraseña incorrecta" y "usuario no existe" en un único error `invalid_credentials` (protección anti-enumeración de usuarios). El original distinguía ambos casos con Firebase. Se documenta aquí, no es un bug de esta migración.
- `src/app/cambiar-password/page.tsx` (pantalla nueva, no existía en el original): fuerza a definir una contraseña nueva cuando un admin crea una cuenta con contraseña temporal. Gateado en `src/lib/supabase/middleware.ts` vía `perfiles.debe_cambiar_password`.
- Verificado end-to-end contra el proyecto Supabase real con un usuario de prueba desechable (creado y luego borrado): el trigger crea el perfil correctamente, el login con contraseña funciona contra el endpoint real de Supabase Auth, y el borrado del usuario de Auth elimina en cascada su perfil.

### Decisión de alcance (2026-07-01): sin migración de usuarios ni de datos
El usuario decidió que el sistema nuevo **arranca completamente vacío**: no se migran cuentas de Firebase Auth ni el documento `usuarios/` de Firestore, y tampoco se migran los datos de negocio históricos (mercados, cobradores, puestos, cobros, abonos, deudas en mora, etc.). Esto elimina del plan:
- El script `scripts/migrate-users.ts` que se había escrito para este fin — **se eliminó** (código muerto sin este alcance). La infraestructura que sí sigue vigente (trigger `handle_new_user`, `debe_cambiar_password`, `/cambiar-password`) se mantiene porque es útil de forma general para cualquier cuenta que un admin cree con contraseña temporal, no solo para una migración.
- La **Fase 7 completa** (migración de datos Firestore → Postgres) queda fuera del plan. El usuario cargará mercados, cobradores, puestos, etc. manualmente desde las pantallas de administración una vez existan (Fase 5).
- Las secciones 3, 6 y 7 de este documento (mapeo de colecciones, cálculos de negocio, cálculos a portar) siguen siendo la referencia de **qué construir** en las pantallas y repositorios de la Fase 5 (la lógica de negocio se porta igual, solo que sin datos históricos que migrar).

---

## 11. Fase 5 — Repositorios de datos (estado, parte 1 y 2)

### Repositorios completados y verificados
`src/lib/data/repositories/{mercados,rubros,perfiles,cobradores,puestos,cobros,cuentas,mora,cierre-anual}.repo.ts` + `folio.repo.ts` (RPC de folio) — puerto 1:1 de los 8 servicios originales (`mercadosService`, `rubrosService`, `ambulantesService`, `puestosService`, `cobrosService`, `cuentasPorCobrarService`, `deudasMoraService`, `cierreAnualService`) + `eliminarLocatarioService`. Todos con `npm run build` limpio y verificados con pruebas reales contra la base (RPC de folio global y por mercado, creación de puesto/cobro/cuenta con datos desechables, luego borrados).

### Patron admin/Server Actions (nuevo, necesario por la plataforma)
`src/lib/supabase/admin.ts` (cliente `service_role`, protegido con el paquete `server-only`) + `src/lib/auth/require-admin.ts` + `src/app/actions/cobradores.ts`: crear un cobrador requiere crear un usuario de Supabase Auth, lo cual **no puede hacerse desde el cliente** (a diferencia del original, que usaba `createUserWithEmailAndPassword` del navegador — con el efecto secundario de hijackear la sesión del admin, por eso `Register.tsx` original hacía `signOut()` después). Se reemplaza por una Server Action que corre server-side con `service_role`, sin tocar la sesión de quien la invoca, con rollback del usuario de Auth si un paso posterior falla.

### Simplificaciones de plataforma (documentadas, no cambian ningún resultado)
- **Filtros "en memoria para evitar índice compuesto"**: el original tenía este patrón en varias funciones (`getAmbulantesActivos`, `getCobrosDelDia/Mes`, `getCobrosPorRangoFechas`, etc.) porque Firestore requiere índices compuestos explícitos para filtrar por múltiples campos. Postgres no tiene esa limitación; esos filtros se hacen directo en la consulta SQL. Mismo resultado, sin el workaround.
- **Folio (`numeroRecibo`)**: ya no se calcula leyendo el máximo de 2-3 colecciones (`cobros`/`abonos`/`abonosMora`) cada vez; se usa el RPC atómico `siguiente_numero_recibo` (Fase 1). Mismo resultado de negocio, sin la condición de carrera del original (ver sección 6.C y 8.1).
- **Lotes de 500 (`writeBatch`)** en `cierreAnualService.ejecutarCierreAnual`: era el límite de Firestore para escrituras en batch. Postgres no lo tiene; el marcado final de cobros pendientes se hace con un solo `UPDATE ... WHERE`, mismo resultado.

### Hallazgo de código muerto (documentado, no es un cambio de lógica)
`cuentasPorCobrarService.actualizarCuentaDesdeCobro` del original tenía un `if (cobro.esCobroDiario === true) return;` seguido, más abajo, de un branch `if (cobro.esCobroDiario && cobro.pagosDiarios?.length) { ... }` que **nunca podía ejecutarse** (la función ya había retornado antes de llegar ahí). El comportamiento observable siempre fue "los cobros diarios no afectan `cuentas_por_cobrar`" (así lo dice el propio comentario del código original). Se omitió el branch inalcanzable en el puerto (`cuentas.repo.ts`) porque eliminar código genuinamente muerto no cambia ningún resultado — no es una corrección de lógica de negocio.

### `ambulanteId` vs `cobradorId` en `Abono` (verificado, no es una simplificación arriesgada)
El tipo `Abono` original tenía dos campos separados, `ambulanteId` (dueño de la cuenta) y `cobradorId` (quien registra el abono). Se unificaron en una sola columna `cobrador_id` (ver mapeo, sección 3.7). Antes de asumir que esto era seguro, se verificaron **los dos únicos call-sites** de `registrarAbono` en el código original (`CobroAmbulante.tsx` y `EstadoDeCuentaCobrador.tsx`): ambos pasan siempre el mismo valor (`user.uid`) para ambos parámetros. La unificación es segura.

---

## 12. Fase 5 — Pantallas del cobrador: completas

Las 4 subvistas de `/cobro-ambulante` (espacios, pagos-mensuales, pagos-diarios, estado-cuenta) + el panel central + el encabezado institucional compartido ya están portadas, con `npm run build` limpio en cada checkpoint.

### Hallazgo de código muerto en `CobroAmbulante.tsx` (verificado con grep, no una suposición)
El original definía `agregarPuesto`, `eliminarPuesto`, `handleGuardarPuesto` (crear un `PuestoLocal` sin guardar y registrarlo desde cero dentro de "Pagos mensuales"), `agregarRubroPlantilla`/`eliminarRubroPlantilla`/`actualizarRubroPlantilla`, `handleDistribuirEn12Meses`/`confirmarDistribuirEn12Meses`, el estado `puestoParaDistribuir`, y el `AlertDialog` "Distribuir rubros en los 12 meses". Se verificó con `grep` sobre el archivo completo que **ningún botón invoca estas funciones** — el flujo real de alta de locatarios ya vive enteramente en "Locatarios" (espacios), que llama a su propia `handleGuardarEspacioYDistribuir`. Estas funciones eran remanentes de una versión anterior de la UI. Se omitieron en el puerto (`pagos-mensuales/page.tsx`); junto con ellas se simplificó `PuestoCard`: la rama `!puesto.guardado` (formulario de alta inicial) también era inalcanzable, porque todos los `PuestoLocal` en esta pantalla se cargan siempre desde `getPuestosPorAmbulante` (`guardado` es invariablemente `true`).

### Componentes nuevos para evitar duplicar el original
- `FotosUploader.tsx`: consolida los 4 bloques de subida de fotos casi idénticos (documento, permiso, contrato, tarjeta anual) en un componente parametrizado.
- `PuestoCardMensual.tsx`: el `PuestoCard` memoizado, ahora en su propio archivo (antes vivía inline dentro de `CobroAmbulante.tsx`).
- Grupo de rutas `(con-header)/`: agrupa las 4 subvistas bajo el layout que muestra el encabezado institucional, que el panel central no muestra.

### Folio de los 12 meses (Locatarios → "Guardar y distribuir")
El original leía el máximo una sola vez y sumaba un offset local (`ultimoRecibo + 1 + mesIndex`) para los 12 cobros creados en paralelo — con condición de carrera. El puerto llama al RPC atómico `siguiente_numero_recibo` 12 veces **secuencialmente** (no en paralelo) para reservar los 12 números de antemano, y luego crea los 12 cobros en paralelo ya con su número asignado. Mismo resultado en el caso normal (un cobrador guardando un locatario), sin el riesgo de carrera del esquema original.

### Pendiente en Fase 5
Pantallas de administración (dashboard, cobradores, mercados, catálogo de rubros, reportes, cierre anual).

---

## 13. Fase 5 — Dashboard admin

Puerto de `Dashboard.tsx` (stats + cuadrícula de módulos), reemplazando el placeholder temporal de Fase 4.

### Se omite "Limpiar base de datos"
El original tenía un botón que corría `resetDatabaseService.ts` (borrado client-side por `writeBatch` + la Cloud Function `deleteAllUsersExceptAdmin`, ver §4). No se porta ahora: §4 ya documenta que **Fase 8** reemplaza todo ese flujo por una única operación server-side con `service_role` — portar la versión vieja para descartarla después sería trabajo desechable. El resto de la pantalla (stats de `getEstadisticasDelMes`/`getTotalDeudaPendienteSistema`/activos, cuadrícula de módulos) sí es funcionalidad permanente y se portó completa.

Pendiente en Fase 5: Cobradores, Mercados, Catálogo de rubros, Reportes, Cierre anual.

---

## 14. Fase 5 — Pantalla de Cobradores

Puerto de `GestionAmbulantes.tsx` (`/ambulantes` → `/cobradores`): tabla/cards con búsqueda y filtro por estado, modal de ver/crear/editar. La creación llama a la Server Action `crearCobradorAction` (Fase 5 parte 1); la edición usa `updateCobrador` + `updatePerfilMercado` directo desde el cliente.

### No se portan `deleteAmbulante` ni `getUidByEmailFromUsuarios`
- `deleteAmbulante` se importaba en el original pero **ningún botón lo invoca** (verificado leyendo el archivo completo — solo hay acciones "Ver" y "Editar", no "Eliminar"). Código muerto, no se porta.
- `getUidByEmailFromUsuarios` era un fallback para cuando `Ambulante.userId` podía faltar. En el esquema nuevo `cobradores.user_id` es `NOT NULL` (siempre se crea junto con el usuario de Auth en `crearCobradorAction`), así que el fallback ya no tiene caso de uso.

### Quirk preservado, no corregido: editar el correo no cambia el login
Igual que el original (`updateAmbulante` escribía `email` en el doc de Firestore sin tocar Firebase Auth), el formulario de edición permite cambiar el campo "Correo Electrónico" de un cobrador ya creado, y eso solo actualiza `cobradores.email` (el dato de contacto) — **no** cambia el correo con el que ese usuario inicia sesión en Supabase Auth. Se preserva tal cual por ser un puerto 1:1, no una funcionalidad nueva; no se decidió arreglarlo en esta fase.

### Simplificación verificada
`loadMercados` ya no trae todos los mercados y filtra `.activo` en memoria — llama directo a `getMercadosActivos()`. Mismo resultado (la lista original también filtraba a solo activos antes de usarla), sin el paso intermedio.

Pendiente en Fase 5: Mercados, Catálogo de rubros, Reportes, Cierre anual.

---

## 15. Fase 5 — Pantalla de Mercados

Puerto de `GestionMercados.tsx`: CRUD directo (tabla + búsqueda, modal crear/editar, `Switch` para `activo`). Sin cambios de lógica de negocio; usa `getMercados`/`createMercado`/`updateMercado`/`deleteMercado` (ya portados en Fase 5 parte 1).

### `window.confirm` → `AlertDialog`
La confirmación antes de eliminar usaba `window.confirm` (nativo del navegador). Se reemplaza por el mismo `AlertDialog` de Chakra ya usado para eliminar locatarios en `espacios/page.tsx` — equivalente visual dentro del sistema de diseño, no un cambio de comportamiento (sigue pidiendo confirmación antes de borrar).

### Nota de esquema, no de lógica
Eliminar un mercado que todavía tiene `cobradores`/`cobros`/etc. con ese `mercado_id` puede fallar por restricción de llave foránea en Postgres (el original, sobre Firestore, no tenía esa restricción y el borrado simplemente huérfaneaba las referencias). El error de Postgres se muestra igual en el toast de error existente; no se agregó manejo especial.

Pendiente en Fase 5: Catálogo de rubros, Reportes, Cierre anual.
