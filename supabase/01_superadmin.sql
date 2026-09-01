create table if not exists public.super_admins (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.super_admins enable row level security;

drop policy if exists "superadmin puede ver su registro" on public.super_admins;

create policy "superadmin puede ver su registro"
on public.super_admins
for select
to authenticated
using (usuario_id = auth.uid());

create or replace function public.es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins
    where usuario_id = auth.uid()
      and activo = true
  );
$$;

grant execute on function public.es_super_admin() to authenticated;

drop policy if exists "superadmin ve negocios" on public.negocios;
create policy "superadmin ve negocios"
on public.negocios
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin crea negocios" on public.negocios;
create policy "superadmin crea negocios"
on public.negocios
for insert
to authenticated
with check (public.es_super_admin());

drop policy if exists "superadmin edita negocios" on public.negocios;
create policy "superadmin edita negocios"
on public.negocios
for update
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve miembros" on public.miembros_negocio;
create policy "superadmin ve miembros"
on public.miembros_negocio
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra miembros" on public.miembros_negocio;
create policy "superadmin administra miembros"
on public.miembros_negocio
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve profesionales" on public.profesionales;
create policy "superadmin ve profesionales"
on public.profesionales
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra profesionales" on public.profesionales;
create policy "superadmin administra profesionales"
on public.profesionales
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve servicios" on public.servicios;
create policy "superadmin ve servicios"
on public.servicios
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra servicios" on public.servicios;
create policy "superadmin administra servicios"
on public.servicios
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve horarios" on public.horarios;
create policy "superadmin ve horarios"
on public.horarios
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra horarios" on public.horarios;
create policy "superadmin administra horarios"
on public.horarios
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve citas" on public.citas;
create policy "superadmin ve citas"
on public.citas
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra citas" on public.citas;
create policy "superadmin administra citas"
on public.citas
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());

drop policy if exists "superadmin ve profesional servicios" on public.profesional_servicios;
create policy "superadmin ve profesional servicios"
on public.profesional_servicios
for select
to authenticated
using (public.es_super_admin());

drop policy if exists "superadmin administra profesional servicios" on public.profesional_servicios;
create policy "superadmin administra profesional servicios"
on public.profesional_servicios
for all
to authenticated
using (public.es_super_admin())
with check (public.es_super_admin());
