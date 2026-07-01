-- Fase 1: esquema relacional para el sistema de cobro de mercados municipales.
-- Mapeo completo Firestore -> Postgres documentado en MIGRATION_NOTES.md (seccion 3).
-- No incluye RLS (Fase 6) ni el trigger de creacion de perfil (Fase 4).

create extension if not exists pgcrypto;

-- =========================================================================
-- mercados
-- =========================================================================
create table public.mercados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- perfiles (extiende auth.users; antes "usuarios")
-- =========================================================================
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nombre text not null,
  rol text not null check (rol in ('administrador', 'ambulante')),
  activo boolean not null default true,
  mercado_id uuid references public.mercados (id),
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now()
);

create index perfiles_mercado_id_idx on public.perfiles (mercado_id);

-- =========================================================================
-- cobradores (antes "ambulantes" - detalle de perfil del cobrador, 1:1 con perfiles)
-- =========================================================================
create table public.cobradores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.perfiles (id) on delete cascade,
  codigo_cuenta text not null unique,
  nombre text not null,
  apellido text not null,
  dni text not null,
  telefono text,
  email text,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido', 'inactivo')),
  foto_url text,
  lat numeric,
  lng numeric,
  mercado_id uuid references public.mercados (id),
  created_at timestamptz not null default now()
);

create index cobradores_mercado_id_idx on public.cobradores (mercado_id);

-- =========================================================================
-- rubros (antes "rubrosCatalogo"; centinela 'GLOBAL' -> cobrador_id null + es_global)
-- =========================================================================
create table public.rubros (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid references public.perfiles (id) on delete cascade,
  es_global boolean not null default false,
  codigo text not null,
  abreviatura text not null default '',
  concepto text not null,
  activo boolean not null default true,
  tipo_rubro text not null default 'vigente' check (tipo_rubro in ('vigente', 'mora')),
  check ((es_global and cobrador_id is null) or (not es_global and cobrador_id is not null))
);

create index rubros_cobrador_id_idx on public.rubros (cobrador_id);

-- =========================================================================
-- puestos (locatarios embebidos, igual que en el documento Firestore original)
-- =========================================================================
create table public.puestos (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid not null references public.perfiles (id),
  nombre_cliente text not null,
  numero_puesto text not null,
  tipo_puesto text not null,
  valor_diario numeric(12, 2) not null default 0,
  anio int not null,
  activo boolean not null default true,
  codigo text not null,
  numero_identidad text,
  rtn text,
  direccion_cliente text,
  telefono text,
  observaciones text,
  foto_documento_url text,
  foto_permiso_operacion_urls text[],
  foto_contrato_arrendamiento_urls text[],
  foto_tarjeta_cobro_anual_urls text[],
  en_mora boolean,
  created_at timestamptz not null default now(),
  unique (cobrador_id, numero_puesto, anio, codigo)
);

create index puestos_cobrador_id_idx on public.puestos (cobrador_id);
create index puestos_anio_idx on public.puestos (anio);

-- "existePuesto": un puesto activo no puede repetir numero_puesto en el mismo anio para el mismo cobrador
create unique index puestos_activo_unico
  on public.puestos (cobrador_id, numero_puesto, anio)
  where (activo);

-- =========================================================================
-- cobros (mensual/diario) + tablas hijas normalizadas
-- =========================================================================
create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid not null references public.perfiles (id),
  codigo_cuenta text not null,
  cobrador_nombre text not null,
  nombre_cliente text,
  numero_puesto text not null,
  tipo_puesto text,
  tipo_cobro text not null check (tipo_cobro in ('diario', 'semanal', 'quincenal', 'mensual')),
  valor_diario numeric(12, 2),
  dias_mes int,
  anio int not null,
  monto numeric(12, 2) not null,
  fecha_cobro timestamptz not null default now(),
  fecha_cobro_dia timestamptz,
  estado text not null default 'activo' check (estado in ('activo', 'anulado')),
  motivo_anulacion text,
  fecha_anulacion timestamptz,
  anulado_por_id uuid references public.perfiles (id),
  numero_recibo int not null,
  mercado_id uuid references public.mercados (id),
  sincronizado boolean not null default false,
  mes int check (mes between 1 and 12),
  renta_mensual numeric(12, 2),
  recibo_generado boolean not null default false,
  estado_cargo text check (estado_cargo in ('pendiente', 'pagado', 'en_mora')),
  tipo_pago text check (tipo_pago in ('vigente', 'mora')),
  es_cobro_diario boolean not null default false,
  reporte_diario_completado boolean,
  fecha_reporte_completado timestamptz,
  actualizado_cierre_anual timestamptz,
  created_at timestamptz not null default now()
);

create index cobros_cobrador_id_idx on public.cobros (cobrador_id);
create index cobros_numero_puesto_idx on public.cobros (numero_puesto);
create index cobros_tipo_anio_recibo_idx on public.cobros (tipo_cobro, anio, recibo_generado);
create index cobros_mercado_numero_recibo_idx on public.cobros (mercado_id, numero_recibo desc);

create table public.cobros_pagos_adicionales (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.cobros (id) on delete cascade,
  concepto text not null,
  monto numeric(12, 2) not null
);

create index cobros_pagos_adicionales_cobro_id_idx on public.cobros_pagos_adicionales (cobro_id);

create table public.cobros_pagos_diarios (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.cobros (id) on delete cascade,
  numero_puesto int not null,
  monto numeric(12, 2) not null,
  "timestamp" timestamptz,
  rubro_id uuid references public.rubros (id),
  codigo text,
  concepto text
);

create index cobros_pagos_diarios_cobro_id_idx on public.cobros_pagos_diarios (cobro_id);

create table public.cobros_abonos_concepto (
  id uuid primary key default gen_random_uuid(),
  cobro_id uuid not null references public.cobros (id) on delete cascade,
  concepto text not null,
  monto numeric(12, 2) not null
);

create index cobros_abonos_concepto_cobro_id_idx on public.cobros_abonos_concepto (cobro_id);

-- =========================================================================
-- cuentas_por_cobrar (antes id compuesto "${ambulanteId}_${numeroPuesto}")
-- =========================================================================
create table public.cuentas_por_cobrar (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid not null references public.perfiles (id),
  numero_puesto text not null,
  nombre_cliente text,
  monto_total numeric(12, 2) not null default 0,
  total_abonado numeric(12, 2) not null default 0,
  saldo_pendiente numeric(12, 2) not null default 0,
  ultima_fecha_cobro timestamptz not null default now(),
  ultima_fecha_abono timestamptz,
  fecha_vencimiento timestamptz,
  estado text not null default 'al_dia' check (estado in ('al_dia', 'atrasado', 'saldado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cobrador_id, numero_puesto)
);

create index cuentas_por_cobrar_cobrador_id_idx on public.cuentas_por_cobrar (cobrador_id);

-- =========================================================================
-- abonos (pagos mensuales aplicados a cuentas_por_cobrar)
-- =========================================================================
create table public.abonos (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid not null references public.perfiles (id),
  numero_puesto text not null,
  monto numeric(12, 2) not null,
  fecha timestamptz not null default now(),
  cobrador_nombre text,
  referencia text,
  meses int[],
  anio int,
  mes_aplicado int,
  rubro_aplicado_concepto text,
  numero_recibo int,
  mercado_id uuid references public.mercados (id),
  created_at timestamptz not null default now()
);

create index abonos_cobrador_anio_idx on public.abonos (cobrador_id, anio);
create index abonos_mercado_numero_recibo_idx on public.abonos (mercado_id, numero_recibo desc);

-- =========================================================================
-- deudas_mora (deuda historica por puesto/rubro)
-- =========================================================================
create table public.deudas_mora (
  id uuid primary key default gen_random_uuid(),
  puesto_id uuid not null references public.puestos (id),
  cobrador_id uuid not null references public.perfiles (id),
  numero_puesto text not null,
  nombre_cliente text not null,
  rubro_id uuid not null references public.rubros (id),
  rubro_codigo text not null,
  rubro_concepto text not null,
  tipo_rubro text not null default 'mora' check (tipo_rubro in ('mora')),
  monto_total numeric(12, 2) not null,
  descripcion text,
  total_abonado numeric(12, 2) not null default 0,
  saldo_pendiente numeric(12, 2) not null,
  mercado_id uuid references public.mercados (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deudas_mora_puesto_rubro_idx on public.deudas_mora (puesto_id, rubro_id);

-- =========================================================================
-- abonos_mora (pagos aplicados a deudas_mora)
-- =========================================================================
create table public.abonos_mora (
  id uuid primary key default gen_random_uuid(),
  deuda_mora_id uuid not null references public.deudas_mora (id),
  monto numeric(12, 2) not null,
  fecha timestamptz not null default now(),
  observacion text,
  usuario_id uuid not null references public.perfiles (id),
  usuario_nombre text not null,
  numero_recibo int not null,
  saldo_pendiente_despues numeric(12, 2) not null,
  mercado_id uuid references public.mercados (id),
  created_at timestamptz not null default now()
);

create index abonos_mora_mercado_numero_recibo_idx on public.abonos_mora (mercado_id, numero_recibo desc);

-- =========================================================================
-- Folio de recibo: contador por mercado (o global cuando mercado_id es null),
-- compartido entre cobros/abonos/abonos_mora. Reemplaza el esquema
-- "max()+1 sin transaccion" del original (ver MIGRATION_NOTES.md seccion 6.C
-- y 8.1) sin cambiar el numero que se habria generado.
-- =========================================================================
-- mercado_id es NULL para el contador global (sin mercado asignado).
-- "unique nulls not distinct" (PG15+) hace que exista un unico registro
-- global, en vez de uno nuevo por cada insert con NULL (comportamiento
-- por defecto de UNIQUE, que trata cada NULL como distinto).
create table public.contadores_recibo (
  id uuid primary key default gen_random_uuid(),
  mercado_id uuid references public.mercados (id),
  ultimo int not null default 0,
  unique nulls not distinct (mercado_id)
);

create or replace function public.siguiente_numero_recibo(p_mercado_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_siguiente int;
begin
  insert into public.contadores_recibo (mercado_id, ultimo)
  values (p_mercado_id, 0)
  on conflict (mercado_id) do nothing;

  update public.contadores_recibo
  set ultimo = ultimo + 1
  where mercado_id is not distinct from p_mercado_id
  returning ultimo into v_siguiente;

  return v_siguiente;
end;
$$;
