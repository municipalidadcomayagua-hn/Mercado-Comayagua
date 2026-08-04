-- Los locatarios (puestos) y todo lo derivado de ellos pasan a tener alcance
-- por MERCADO en vez de por COBRADOR: varios cobradores asignados al mismo
-- mercado (perfiles.mercado_id) ven y cobran los mismos puestos.
--
-- cobrador_id NO se elimina: queda como columna de auditoria ("quien
-- registro/proceso esto"), y sigue siendo la base del cierre diario personal
-- (cierres_diarios) y del reporte de resumen del admin (que agrupa por el
-- mercado VIGENTE del cobrador, decision ya documentada de una fase anterior).
--
-- La base esta vacia al aplicar esta migracion (recien limpiada para
-- entrega): los UPDATE de relleno son una red de seguridad, no una
-- migracion de datos real.

begin;

-- 1. Nuevas columnas de alcance en puestos y cuentas_por_cobrar -----------
alter table public.puestos
  add column if not exists mercado_id uuid references public.mercados (id);

update public.puestos p
   set mercado_id = pe.mercado_id
  from public.perfiles pe
 where pe.id = p.cobrador_id and p.mercado_id is null;

alter table public.puestos
  alter column mercado_id set not null;

alter table public.cuentas_por_cobrar
  add column if not exists mercado_id uuid references public.mercados (id);

update public.cuentas_por_cobrar c
   set mercado_id = pe.mercado_id
  from public.perfiles pe
 where pe.id = c.cobrador_id and c.mercado_id is null;

alter table public.cuentas_por_cobrar
  alter column mercado_id set not null;

-- 2. cobros/abonos ya tenian mercado_id, pero era opcional -----------------
--    (una fila con mercado_id null seria invisible para todo el equipo del
--    mercado = perdida de datos silenciosa, por eso pasa a obligatorio)
update public.cobros c
   set mercado_id = pe.mercado_id
  from public.perfiles pe
 where pe.id = c.cobrador_id and c.mercado_id is null;

alter table public.cobros
  alter column mercado_id set not null;

update public.abonos a
   set mercado_id = pe.mercado_id
  from public.perfiles pe
 where pe.id = a.cobrador_id and a.mercado_id is null;

alter table public.abonos
  alter column mercado_id set not null;

-- 3. Unicidad: de (cobrador, ...) a (mercado, ...) -------------------------
alter table public.puestos
  drop constraint puestos_cobrador_id_numero_puesto_anio_codigo_key;

alter table public.puestos
  add constraint puestos_mercado_numero_anio_codigo_key
  unique (mercado_id, numero_puesto, anio, codigo);

-- Un puesto activo no puede repetir numero_puesto en el mismo anio dentro
-- del mismo mercado (antes: dentro del mismo cobrador).
drop index public.puestos_activo_unico;

create unique index puestos_activo_unico
  on public.puestos (mercado_id, numero_puesto, anio)
  where (activo);

-- Respalda el upsert onConflict "mercado_id,numero_puesto" de
-- cuentas.repo.ts (agregarMonto).
alter table public.cuentas_por_cobrar
  drop constraint cuentas_por_cobrar_cobrador_id_numero_puesto_key;

alter table public.cuentas_por_cobrar
  add constraint cuentas_por_cobrar_mercado_numero_key
  unique (mercado_id, numero_puesto);

-- 4. Indices de apoyo para las nuevas lecturas -----------------------------
-- Los indices por cobrador_id existentes se conservan: cierres_diarios y el
-- reporte del admin siguen leyendo por cobrador.
create index if not exists puestos_mercado_anio_idx
  on public.puestos (mercado_id, anio);

create index if not exists cuentas_por_cobrar_mercado_id_idx
  on public.cuentas_por_cobrar (mercado_id);

create index if not exists cobros_mercado_fecha_idx
  on public.cobros (mercado_id, fecha_cobro desc);

create index if not exists cobros_mercado_diario_fecha_idx
  on public.cobros (mercado_id, es_cobro_diario, fecha_cobro_dia);

create index if not exists abonos_mercado_anio_idx
  on public.abonos (mercado_id, anio);

create index if not exists abonos_mercado_puesto_idx
  on public.abonos (mercado_id, numero_puesto);

commit;
