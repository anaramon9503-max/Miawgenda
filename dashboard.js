const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

let usuarioActual = null;
let negocioActualId = null;
let esAdmin = false;
let esProfesional = false;
let profesionalActualId = null;

async function iniciarDashboard() {
  const { data, error } =
    await db.auth.getSession();

  if (
    error ||
    !data.session?.user
  ) {
    window.location.href =
      "panel.html";
    return;
  }

  usuarioActual =
    data.session.user;

  $("correoUsuario").textContent =
    usuarioActual.email || "";

  const { data: membresias, error: errorMembresia } =
    await db
      .from("miembros_negocio")
      .select(`
        negocio_id,
        es_admin,
        es_profesional,
        activo
      `)
      .eq(
        "usuario_id",
        usuarioActual.id
      )
      .eq(
        "activo",
        true
      )
      .limit(1);

  if (
    errorMembresia ||
    !membresias?.length
  ) {
    mostrarError(
      "No encontramos un negocio activo para esta cuenta."
    );
    return;
  }

  const membresia =
    membresias[0];

  negocioActualId =
    membresia.negocio_id;

  esAdmin =
    !!membresia.es_admin;

  esProfesional =
    !!membresia.es_profesional;

  if (esProfesional) {
    const { data: profesional } =
      await db
        .from("profesionales")
        .select("id")
        .eq(
          "usuario_id",
          usuarioActual.id
        )
        .eq(
          "negocio_id",
          negocioActualId
        )
        .eq(
          "activo",
          true
        )
        .maybeSingle();

    profesionalActualId =
      profesional?.id || null;
  }

  aplicarPermisos();

  await Promise.all([
    cargarNegocio(),
    cargarResumen()
  ]);
}

function aplicarPermisos() {
  if (!esAdmin) {
    $("accesoProfesionales")
      ?.classList.add("oculto");

    $("accesoServicios")
      ?.classList.add("oculto");

    $("accesoHorarios")
      ?.classList.add("oculto");

    $("navProfesionales")
      ?.classList.add("oculto");

    $("navServicios")
      ?.classList.add("oculto");

    $("navHorarios")
      ?.classList.add("oculto");
  }
}

async function cargarNegocio() {
  const { data, error } =
    await db
      .from("negocios")
      .select("nombre")
      .eq(
        "id",
        negocioActualId
      )
      .maybeSingle();

  if (error || !data) {
    console.error(error);
    $("nombreNegocio").textContent =
      "Mi negocio";
    return;
  }

  $("nombreNegocio").textContent =
    data.nombre || "Mi negocio";
}

async function cargarResumen() {
  const hoy =
    fechaLocalISO(new Date());

  let consultaHoy =
    db
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("fecha", hoy)
      .neq("estado", "cancelada");

  let consultaPendientes =
    db
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("estado", "pendiente")
      .gte("fecha", hoy);

  let consultaConfirmadas =
    db
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("estado", "confirmada")
      .gte("fecha", hoy);

  if (
    !esAdmin &&
    profesionalActualId
  ) {
    consultaHoy =
      consultaHoy.eq(
        "profesional_id",
        profesionalActualId
      );

    consultaPendientes =
      consultaPendientes.eq(
        "profesional_id",
        profesionalActualId
      );

    consultaConfirmadas =
      consultaConfirmadas.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const [
    hoyResp,
    pendientesResp,
    confirmadasResp,
    profesionalesResp
  ] = await Promise.all([
    consultaHoy,
    consultaPendientes,
    consultaConfirmadas,
    db
      .from("profesionales")
      .select("id", { count: "exact", head: true })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
  ]);

  $("citasHoy").textContent =
    hoyResp.count ?? 0;

  $("citasPendientes").textContent =
    pendientesResp.count ?? 0;

  $("citasConfirmadas").textContent =
    confirmadasResp.count ?? 0;

  $("profesionalesActivos").textContent =
    profesionalesResp.count ?? 0;

  const errores = [
    hoyResp.error,
    pendientesResp.error,
    confirmadasResp.error,
    profesionalesResp.error
  ].filter(Boolean);

  if (errores.length) {
    console.error(
      "Error cargando dashboard:",
      errores
    );
  }
}

function fechaLocalISO(fecha) {
  const año =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      fecha.getDate()
    ).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
}

function mostrarError(texto) {
  const mensaje = $("mensaje");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className =
    "mensaje error";
}

$("btnCerrar")
  ?.addEventListener(
    "click",
    async () => {
      await db.auth.signOut();
      window.location.href =
        "panel.html";
    }
  );

iniciarDashboard();
