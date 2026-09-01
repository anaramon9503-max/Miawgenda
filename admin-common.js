const AR_SUPABASE_URL = window.AR_CONFIG.SUPABASE_URL;
const AR_SUPABASE_KEY = window.AR_CONFIG.SUPABASE_ANON_KEY;
const db = window.supabase.createClient(AR_SUPABASE_URL, AR_SUPABASE_KEY);

async function arSesion() {
  const { data, error } = await db.auth.getSession();
  if (error || !data.session?.user) return null;
  return { session: data.session, user: data.session.user };
}

async function arEsSuperAdmin(userId) {
  const { data, error } = await db
    .from("super_admins")
    .select("usuario_id, activo")
    .eq("usuario_id", userId)
    .eq("activo", true)
    .maybeSingle();

  return !error && !!data;
}

async function arMembresias(userId) {
  const { data, error } = await db
    .from("miembros_negocio")
    .select("negocio_id, es_admin, es_profesional, activo")
    .eq("usuario_id", userId)
    .eq("activo", true);

  if (error) throw error;
  return data || [];
}

async function arContextoUsuario() {
  const auth = await arSesion();
  if (!auth) return null;

  const superAdmin = await arEsSuperAdmin(auth.user.id);
  const membresias = await arMembresias(auth.user.id).catch(() => []);

  return {
    ...auth,
    superAdmin,
    membresias
  };
}

async function arCerrarSesion() {
  await db.auth.signOut();
  window.location.href = "panel.html";
}

function arEscape(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function arDinero(valor) {
  return Number(valor || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN"
  });
}

window.AR = {
  db,
  sesion: arSesion,
  esSuperAdmin: arEsSuperAdmin,
  membresias: arMembresias,
  contexto: arContextoUsuario,
  cerrarSesion: arCerrarSesion,
  escape: arEscape,
  dinero: arDinero
};
