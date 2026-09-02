-- Ejecutar en Supabase SQL Editor una sola vez.
-- Completa permisos del profesional y permite DELETE al súper admin.

create or replace function public.es_profesional_de_cita(p_profesional_id uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.profesionales p
    join public.miembros_negocio m
      on m.negocio_id=p.negocio_id and m.usuario_id=auth.uid()
    where p.id=p_profesional_id
      and p.usuario_id=auth.uid()
      and p.activo=true and m.activo=true and m.es_profesional=true
  );
$$;

grant execute on function public.es_profesional_de_cita(uuid) to authenticated;

drop policy if exists "profesional ve sus citas" on public.citas;
create policy "profesional ve sus citas" on public.citas for select to authenticated
using (public.es_profesional_de_cita(profesional_id));

drop policy if exists "profesional edita sus citas" on public.citas;
create policy "profesional edita sus citas" on public.citas for update to authenticated
using (public.es_profesional_de_cita(profesional_id))
with check (public.es_profesional_de_cita(profesional_id));

drop policy if exists "profesional ve sus horarios" on public.horarios;
create policy "profesional ve sus horarios" on public.horarios for select to authenticated
using (public.es_profesional_de_cita(profesional_id));

drop policy if exists "superadmin elimina negocios" on public.negocios;
create policy "superadmin elimina negocios" on public.negocios for delete to authenticated
using (public.es_super_admin());
