# AR Agenda Pro

Esta versión conserva la agenda existente y agrega un panel de Súper Admin.

## 1. Supabase
1. Abre Supabase > SQL Editor.
2. Ejecuta `supabase/01_superadmin.sql`.
3. En Authentication > Users copia el UUID de tu usuario.
4. Ejecuta la última línea del SQL sustituyendo `TU_UUID_DE_AUTH`.

## 2. Vercel
Sube este proyecto a un repositorio nuevo y conéctalo a Vercel.

En Vercel > Project Settings > Environment Variables agrega:
- `SUPABASE_URL` = la URL de tu proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` = la service_role key de Supabase. NUNCA la pongas en archivos del frontend.

Después vuelve a desplegar.

## 3. Entrada
- `panel.html`: login/panel normal.
- `superadmin.html`: panel de Súper Admin.
- `index.html`: agenda pública existente.

## 4. Crear accesos
Desde `superadmin.html` puedes crear administradores o profesionales. El endpoint `/api/create-user` valida que quien lo llama sea Súper Admin y usa la service role solo en el servidor.

## 5. WhatsApp
La API de WhatsApp NO está activada todavía. La estructura queda preparada para agregarla después de estabilizar agenda + Vercel, tal como acordamos.
