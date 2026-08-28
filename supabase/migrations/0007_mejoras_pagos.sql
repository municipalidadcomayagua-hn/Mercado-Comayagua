-- Renta mensual independiente del valor diario (no se derivan uno del otro:
-- en la practica diario x 30 casi nunca da un mensual redondo). Default 0
-- para no romper locatarios ya existentes; el formulario de Locatarios pasa
-- a pedir ambos valores por separado.
alter table public.puestos
  add column valor_renta_mensual numeric(12, 2) not null default 0;

-- Mora por periodo: permite anclar una deuda en mora a un mes/anio
-- especifico (ej. "Marzo 2024") en vez de ser generica por locatario.
-- Nullable a proposito: la mora que ya genera Cierre Anual automaticamente
-- sigue sin mes especifico ("mora general del anio"), no se le exige backfill.
alter table public.deudas_mora
  add column anio int,
  add column mes int check (mes between 1 and 12);
