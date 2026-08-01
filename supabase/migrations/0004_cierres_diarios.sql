-- Cierre diario general del cobrador: snapshot de lo cobrado en el dia
-- (mensuales + diarios juntos), para que el cobrador confirme el cierre de
-- su jornada y quede un registro auditable. Los totales ya se calculan a
-- partir de `cobros` (mismo criterio que el reporte de resumen del admin:
-- mensuales con recibo_generado=true, diarios con reporte_diario_completado
-- =true) - esta tabla no reemplaza esos datos, solo guarda el snapshot del
-- momento en que el cobrador cierra el dia.

create table public.cierres_diarios (
  id uuid primary key default gen_random_uuid(),
  cobrador_id uuid not null references public.perfiles (id),
  mercado_id uuid references public.mercados (id),
  fecha date not null,
  total_mensual numeric(12,2) not null default 0,
  total_diario numeric(12,2) not null default 0,
  total_general numeric(12,2) not null default 0,
  cantidad_mensual integer not null default 0,
  cantidad_diario integer not null default 0,
  cerrado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cobrador_id, fecha)
);

create index cierres_diarios_cobrador_fecha_idx on public.cierres_diarios (cobrador_id, fecha);
create index cierres_diarios_fecha_idx on public.cierres_diarios (fecha);
