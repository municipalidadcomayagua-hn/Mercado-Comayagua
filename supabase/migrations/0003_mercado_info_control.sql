-- Fase 5 (post) - datos adicionales de control para mercados: administrador
-- responsable, ubicacion, horario y notas libres. Todos nullable: no afecta
-- mercados ya existentes ni ninguna logica de negocio (folio, cobros, etc.)
-- que dependa de la tabla mercados.

alter table public.mercados
  add column if not exists administrador_nombre text,
  add column if not exists administrador_telefono text,
  add column if not exists ubicacion text,
  add column if not exists horario text,
  add column if not exists notas text;
