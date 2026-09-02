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
let profesionalActual = null;

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
    const { data: profesional, error: errorProfesional } =
      await db
        .from("profesionales")
        .select(`
          id,
          nombre,
          especialidad,
          activo
        `)
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

    if (errorProfesional) {
      console.error(
        "Error profesional:",
        errorProfesional
      );
    }

    profesionalActual =
      profesional || null;
  }

  aplicarVistaPorRol();

  await Promise.all([
    cargarNegocio(),
    cargarResumen()
  ]);

  if (
    esProfesional &&
    profesionalActual?.id
  ) {
    await cargarProximaCita();
  }
}

function aplicarVistaPorRol() {
  if (esAdmin) {
    $("navAdmin").classList.remove(
      "oculto"
    );

    $("textoBienvenida").textContent =
      "Bienvenida 💜";

    $("textoSecundario").textContent =
      "Control general de tu agenda.";

    $("subtituloDashboard").textContent =
      "Dashboard";

    $("iconoCuartaTarjeta").textContent =
      "👩‍⚕️";

    $("cuartaTarjetaTexto").textContent =
      "Profesionales activos";

    return;
  }

  $("navProfesional").classList.remove(
    "oculto"
  );

  $("textoBienvenida").textContent =
    "Bienvenido 👋";

  $("subtituloDashboard").textContent =
    "Mi agenda";

  $("nombrePrincipal").textContent =
    profesionalActual?.nombre ||
    "Profesional";

  $("textoSecundario").textContent =
    profesionalActual?.especialidad
      ? profesionalActual.especialidad
      : "Tu agenda profesional.";

  $("iconoCuartaTarjeta").textContent =
    "✅";

  $("cuartaTarjetaTexto").textContent =
    "Atendidas";

  $("seccionProximaCita").classList.remove(
    "oculto"
  );
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

    if (esAdmin) {
      $("nombrePrincipal").textContent =
        "Mi negocio";
    }

    return;
  }

  if (esAdmin) {
    $("nombrePrincipal").textContent =
      data.nombre || "Mi negocio";
  }
}

async function cargarResumen() {
  const hoy =
    fechaLocalISO(new Date());

  let consultaHoy =
    db
      .from("citas")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "fecha",
        hoy
      )
      .neq(
        "estado",
        "cancelada"
      );

  let consultaPendientes =
    db
      .from("citas")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "estado",
        "pendiente"
      )
      .gte(
        "fecha",
        hoy
      );

  let consultaConfirmadas =
    db
      .from("citas")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "estado",
        "confirmada"
      )
      .gte(
        "fecha",
        hoy
      );

  if (
    !esAdmin &&
    profesionalActual?.id
  ) {
    consultaHoy =
      consultaHoy.eq(
        "profesional_id",
        profesionalActual.id
      );

    consultaPendientes =
      consultaPendientes.eq(
        "profesional_id",
        profesionalActual.id
      );

    consultaConfirmadas =
      consultaConfirmadas.eq(
        "profesional_id",
        profesionalActual.id
      );
  }

  let cuartaConsulta;

  if (esAdmin) {
    cuartaConsulta =
      db
        .from("profesionales")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq(
          "negocio_id",
          negocioActualId
        )
        .eq(
          "activo",
          true
        );
  } else {
    cuartaConsulta =
      db
        .from("citas")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq(
          "negocio_id",
          negocioActualId
        )
        .eq(
          "profesional_id",
          profesionalActual?.id || ""
        )
        .eq(
          "estado",
          "atendida"
        );
  }

  const [
    hoyResp,
    pendientesResp,
    confirmadasResp,
    cuartaResp
  ] = await Promise.all([
    consultaHoy,
    consultaPendientes,
    consultaConfirmadas,
    cuartaConsulta
  ]);

  $("citasHoy").textContent =
    hoyResp.count ?? 0;

  $("citasPendientes").textContent =
    pendientesResp.count ?? 0;

  $("citasConfirmadas").textContent =
    confirmadasResp.count ?? 0;

  $("cuartaTarjetaNumero").textContent =
    cuartaResp.count ?? 0;
}

async function cargarProximaCita() {
  const hoy =
    fechaLocalISO(new Date());

  const { data, error } =
    await db
      .from("citas")
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        paciente_nombre,
        estado,
        servicio_id
      `)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "profesional_id",
        profesionalActual.id
      )
      .gte(
        "fecha",
        hoy
      )
      .in(
        "estado",
        [
          "pendiente",
          "confirmada"
        ]
      )
      .order(
        "fecha",
        { ascending: true }
      )
      .order(
        "hora_inicio",
        { ascending: true }
      )
      .limit(1);

  if (error) {
    console.error(
      "Error próxima cita:",
      error
    );

    $("proximaCitaContenido").textContent =
      "No fue posible cargar la próxima cita.";

    return;
  }

  const cita =
    data?.[0];

  if (!cita) {
    $("proximaCitaContenido").textContent =
      "No tienes próximas citas.";

    return;
  }

  let nombreServicio =
    "Servicio";

  if (cita.servicio_id) {
    const { data: servicio } =
      await db
        .from("servicios")
        .select("nombre")
        .eq(
          "id",
          cita.servicio_id
        )
        .maybeSingle();

    if (servicio?.nombre) {
      nombreServicio =
        servicio.nombre;
    }
  }

  $("proximaCitaContenido").innerHTML = `
    <div class="proxima-hora">
      ${cortarHora(cita.hora_inicio)}
      ${cita.hora_fin
        ? `– ${cortarHora(cita.hora_fin)}`
        : ""}
    </div>

    <div class="proxima-linea">
      📅 ${formatearFecha(cita.fecha)}
    </div>

    <div class="proxima-linea">
      Paciente: ${escapar(
        cita.paciente_nombre ||
        "Sin nombre"
      )}
    </div>

    <div class="proxima-linea">
      Servicio: ${escapar(
        nombreServicio
      )}
    </div>

    <span class="estado-chip">
      ${textoEstado(cita.estado)}
    </span>
  `;
}

function textoEstado(
  estado
) {
  const textos = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    atendida: "Atendida",
    cancelada: "Cancelada",
    no_asistio: "No asistió"
  };

  return textos[estado] || estado;
}

function cortarHora(
  hora
) {
  if (!hora) return "";
  return String(hora).slice(0,5);
}

function formatearFecha(
  fechaISO
) {
  if (!fechaISO) return "";

  const [
    año,
    mes,
    dia
  ] = fechaISO
    .split("-")
    .map(Number);

  return new Date(
    año,
    mes - 1,
    dia
  ).toLocaleDateString(
    "es-MX",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}

function fechaLocalISO(
  fecha
) {
  const año =
    fecha.getFullYear();

  const mes =
    String(
      fecha.getMonth() + 1
    ).padStart(2,"0");

  const dia =
    String(
      fecha.getDate()
    ).padStart(2,"0");

  return `${año}-${mes}-${dia}`;
}

function escapar(
  texto = ""
) {
  return String(texto)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function mostrarError(
  texto
) {
  const mensaje =
    $("mensaje");

  if (!mensaje) return;

  mensaje.textContent =
    texto;

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
