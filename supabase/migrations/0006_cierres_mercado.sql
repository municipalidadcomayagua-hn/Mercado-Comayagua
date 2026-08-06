-- Cierre de mercado: snapshot auditable de lo cobrado en un dia por TODOS
-- los cobradores de un mercado, confirmado por un administrador. Mismo
-- patron que cierres_diarios (migracion 0004), que es personal/por
-- cobrador - esta tabla es el equivalente a nivel mercado. Los totales se
-- calculan en la app con el mismo criterio que ya usa "Cierre diario"
-- personal (cobros mensuales con recibo_generado=true + abonos del dia,
-- ver cierre-mercado.repo.ts) - esta tabla no reemplaza esos datos, solo
-- guarda el snapshot del momento en que el admin cierra el mercado.

create table public.cierres_mercado (
  id uuid primary key default gen_random_uuid(),
  mercado_id uuid not null references public.mercados (id),
  fecha date not null,
  total_mensual numeric(12,2) not null default 0,
  total_abonos numeric(12,2) not null default 0,
  total_general numeric(12,2) not null default 0,
  cantidad_mensual integer not null default 0,
  cantidad_abonos integer not null default 0,
  cantidad_cobradores integer not null default 0,
  cerrado_por_id uuid references public.perfiles (id),
  cerrado_por_nombre text,
  cerrado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (mercado_id, fecha)
);

create index cierres_mercado_mercado_fecha_idx on public.cierres_mercado (mercado_id, fecha);
create index cierres_mercado_fecha_idx on public.cierres_mercado (fecha);
