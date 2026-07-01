-- Fase 4: creacion automatica de perfil al registrarse (equivalente al
-- fallback "basic user" del AuthProvider original, ver MIGRATION_NOTES.md
-- seccion 8.2) + columna para forzar cambio de contrasena cuando un admin
-- crea una cuenta con contrasena temporal + helper de rol para RLS (Fase 6).

alter table public.perfiles
  add column debe_cambiar_password boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, nombre, rol, activo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', new.email),
    'ambulante',
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Reproduce el mismo comportamiento observable que el fallback "basic user"
-- del original: todo usuario nuevo de Auth entra con rol 'ambulante' hasta
-- que un administrador lo cambie.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'administrador'
  );
$$;
