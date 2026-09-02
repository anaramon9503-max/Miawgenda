-- Miawgenda: datos de negocio + WhatsApp sin API
alter table public.negocios add column if not exists whatsapp text;
alter table public.negocios add column if not exists logo_url text;
alter table public.negocios add column if not exists color_marca text default '#7b55da';
alter table public.negocios add column if not exists direccion text;
alter table public.negocios add column if not exists mensaje_confirmacion text;

-- El administrador puede actualizar únicamente el negocio al que pertenece.
drop policy if exists "admin edita su negocio" on public.negocios;
create policy "admin edita su negocio"
on public.negocios for update to authenticated
using (
  public.es_super_admin()
  or exists (
    select 1 from public.miembros_negocio m
    where m.usuario_id = auth.uid()
      and m.negocio_id = negocios.id
      and m.es_admin = true
      and m.activo = true
  )
)
with check (
  public.es_super_admin()
  or exists (
    select 1 from public.miembros_negocio m
    where m.usuario_id = auth.uid()
      and m.negocio_id = negocios.id
      and m.es_admin = true
      and m.activo = true
  )
);

-- Datos que la agenda pública necesita para personalizarse.
create or replace view public.negocios_publicos as
select id, nombre, activo, whatsapp, logo_url, color_marca, direccion, mensaje_confirmacion
from public.negocios
where activo = true;

grant select on public.negocios_publicos to anon, authenticated;
