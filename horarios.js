const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

const nombreNegocio = $("nombreNegocio");
const correoUsuario = $("correoUsuario");
const profesionalHorario = $("profesionalHorario");
const servicioHorario = $("servicioHorario");
const diaHorario = $("diaHorario");
const horaSlot = $("horaSlot");
const btnGuardarHorario = $("btnGuardarHorario");
const listaHorarios = $("listaHorarios");
const mensaje = $("mensaje");

let negocioActualId = null;
let usuarioActual = null;
let profesionales = [];
let serviciosAsignados = [];
let esAdmin = false;
let esProfesional = false;
let profesionalActualId = null;

const seccionAdminHorarios = $("seccionAdminHorarios");
const seccionListaAdmin = $("seccionListaAdmin");
const seccionProfesionalHorarios = $("seccionProfesionalHorarios");
const listaMiHorario = $("listaMiHorario");
const navAdmin = $("navAdmin");
const navProfesional = $("navProfesional");
const pantallaCargaHorarios = $("pantallaCargaHorarios");
const appHorarios = $("appHorarios");

function mostrarAplicacionHorarios() {
  pantallaCargaHorarios?.classList.add("oculto");
  appHorarios?.classList.remove("app-horarios-inicial");
}

const dias = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo"
};

$("btnVolver")?.addEventListener(
  "click",
  () => {
    window.location.href =
      "dashboard.html";
  }
);

$("btnCerrar")?.addEventListener(
  "click",
  async () => {
    await db.auth.signOut();
    window.location.href =
      "panel.html";
  }
);

profesionalHorario?.addEventListener(
  "change",
  async () => {
    await cargarServiciosProfesional();
    await cargarHorarios();
  }
);

servicioHorario?.addEventListener(
  "change",
  cargarHorarios
);

btnGuardarHorario?.addEventListener(
  "click",
  guardarHorario
);

async function iniciar() {
  ocultarMensaje();

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

  correoUsuario.textContent =
    usuarioActual.email || "";

  const membresia =
    await obtenerMembresia(
      usuarioActual.id
    );

  if (!membresia) {
    mostrarError(
      "No encontramos una membresía activa para esta cuenta."
    );

    setTimeout(() => {
      window.location.href =
        "dashboard.html";
    }, 1600);

    return;
  }

  negocioActualId =
    membresia.negocio_id;

  esAdmin =
    membresia.es_admin === true;

  esProfesional =
    membresia.es_profesional === true;

  await cargarNombreNegocio();

  if (esAdmin) {
    navAdmin?.classList.remove("oculto");
    seccionAdminHorarios?.classList.remove("oculto");
    seccionListaAdmin?.classList.remove("oculto");
    seccionProfesionalHorarios?.classList.add("oculto");

    await cargarProfesionales();
    mostrarAplicacionHorarios();
    return;
  }

  if (esProfesional) {
    profesionalActualId =
      await obtenerProfesionalActual(
        usuarioActual.id
      );

    if (!profesionalActualId) {
      mostrarError(
        "Tu cuenta no está vinculada a un profesional activo."
      );
      mostrarAplicacionHorarios();
      return;
    }

    navProfesional?.classList.remove("oculto");
    seccionAdminHorarios?.classList.add("oculto");
    seccionListaAdmin?.classList.add("oculto");
    seccionProfesionalHorarios?.classList.remove("oculto");

    await cargarMiHorario();
    mostrarAplicacionHorarios();
    return;
  }

  mostrarError(
    "Esta cuenta no tiene permisos para consultar horarios."
  );
  mostrarAplicacionHorarios();
}

async function obtenerMembresia(
  usuarioId
) {
  const { data, error } =
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
        usuarioId
      )
      .eq("activo", true)
      .limit(1);

  if (error) {
    console.error(
      "Error membresía:",
      error
    );
    return null;
  }

  return data?.[0] || null;
}

async function obtenerProfesionalActual(
  usuarioId
) {
  const { data, error } =
    await db
      .from("profesionales")
      .select("id")
      .eq(
        "usuario_id",
        usuarioId
      )
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
      .maybeSingle();

  if (error) {
    console.error(
      "Error profesional actual:",
      error
    );
    return null;
  }

  return data?.id || null;
}

async function cargarNombreNegocio() {
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
    nombreNegocio.textContent =
      "Mi negocio";
    return;
  }

  nombreNegocio.textContent =
    data.nombre || "Mi negocio";
}


async function cargarMiHorario() {
  listaMiHorario.innerHTML = `
    <div class="cargando">
      Cargando tu horario...
    </div>
  `;

  // Usamos la vista pública de horarios para consulta de solo lectura.
  const { data: horarios, error } =
    await db
      .from("horarios_publicos")
      .select(`
        id,
        profesional_id,
        servicio_id,
        dia_semana,
        hora_slot,
        hora_inicio,
        hora_fin,
        activo
      `)
      .eq(
        "profesional_id",
        profesionalActualId
      )
      .eq(
        "activo",
        true
      )
      .order(
        "dia_semana",
        { ascending: true }
      )
      .order(
        "hora_inicio",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error mi horario:",
      error
    );

    listaMiHorario.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar tu horario.
      </div>
    `;

    mostrarError(
      "No fue posible cargar tu horario."
    );
    return;
  }

  if (!horarios?.length) {
    listaMiHorario.innerHTML = `
      <div class="sin-resultados">
        Aún no tienes horarios asignados.
      </div>
    `;
    return;
  }

  const idsServicios = [
    ...new Set(
      horarios
        .map(h => h.servicio_id)
        .filter(Boolean)
    )
  ];

  let mapaServicios = {};

  if (idsServicios.length) {
    const { data: servicios, error: errorServicios } =
      await db
        .from("servicios")
        .select("id,nombre")
        .in("id", idsServicios);

    if (!errorServicios) {
      mapaServicios =
        Object.fromEntries(
          (servicios || []).map(
            s => [s.id, s.nombre]
          )
        );
    }
  }

  listaMiHorario.innerHTML = "";

  for (const horario of horarios) {
    const inicio =
      horaCorta(
        horario.hora_inicio ||
        horario.hora_slot
      );

    const fin =
      horaCorta(
        horario.hora_fin
      );

    const servicio =
      mapaServicios[
        horario.servicio_id
      ] || "Servicio";

    const card =
      document.createElement("div");

    card.className =
      "horario-card";

    card.innerHTML = `
      <strong>
        ${dias[horario.dia_semana] || "Día"}
        · ${inicio}${fin ? ` - ${fin}` : ""}
      </strong>

      <div class="horario-meta">
        ${escapar(servicio)}
      </div>

      <div class="horario-meta">
        Activo
      </div>
    `;

    listaMiHorario.appendChild(card);
  }
}

async function cargarProfesionales() {
  profesionalHorario.disabled = true;

  profesionalHorario.innerHTML = `
    <option value="">
      Cargando profesionales...
    </option>
  `;

  const { data, error } =
    await db
      .from("profesionales")
      .select(`
        id,
        nombre,
        especialidad,
        activo
      `)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
      .order(
        "nombre",
        { ascending: true }
      );

  profesionalHorario.disabled = false;

  if (error) {
    console.error(
      "Error profesionales:",
      error
    );

    profesionalHorario.innerHTML = `
      <option value="">
        No fue posible cargar
      </option>
    `;

    mostrarError(
      "No fue posible cargar los profesionales."
    );
    return;
  }

  profesionales = data || [];

  profesionalHorario.innerHTML = `
    <option value="">
      Selecciona un profesional
    </option>
  `;

  for (
    const profesional
    of profesionales
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      profesional.id;

    option.textContent =
      profesional.especialidad
        ? `${profesional.nombre} · ${profesional.especialidad}`
        : profesional.nombre;

    profesionalHorario.appendChild(
      option
    );
  }

  if (!profesionales.length) {
    profesionalHorario.innerHTML = `
      <option value="">
        No hay profesionales activos
      </option>
    `;
  }
}

async function cargarServiciosProfesional() {
  const profesionalId =
    profesionalHorario.value;

  servicioHorario.disabled = true;
  servicioHorario.innerHTML = `
    <option value="">
      Cargando servicios...
    </option>
  `;

  if (!profesionalId) {
    servicioHorario.innerHTML = `
      <option value="">
        Primero selecciona un profesional
      </option>
    `;

    listaHorarios.innerHTML = `
      <div class="sin-resultados">
        Selecciona un profesional y un servicio.
      </div>
    `;

    return;
  }

  const { data: asignaciones, error: errorAsignaciones } =
    await db
      .from("profesional_servicios")
      .select("servicio_id")
      .eq(
        "profesional_id",
        profesionalId
      );

  if (errorAsignaciones) {
    console.error(
      "Error asignaciones:",
      errorAsignaciones
    );

    servicioHorario.innerHTML = `
      <option value="">
        No fue posible cargar
      </option>
    `;

    mostrarError(
      "No fue posible cargar los servicios del profesional."
    );
    return;
  }

  const ids =
    (asignaciones || [])
      .map(x => x.servicio_id);

  if (!ids.length) {
    servicioHorario.innerHTML = `
      <option value="">
        Este profesional no tiene servicios asignados
      </option>
    `;
    return;
  }

  const { data: servicios, error } =
    await db
      .from("servicios")
      .select(`
        id,
        nombre,
        duracion_minutos,
        activo
      `)
      .in("id", ids)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
      .order(
        "nombre",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error servicios:",
      error
    );

    servicioHorario.innerHTML = `
      <option value="">
        No fue posible cargar
      </option>
    `;

    mostrarError(
      "No fue posible cargar los servicios."
    );
    return;
  }

  serviciosAsignados =
    servicios || [];

  servicioHorario.innerHTML = `
    <option value="">
      Selecciona un servicio
    </option>
  `;

  for (
    const servicio
    of serviciosAsignados
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      servicio.id;

    option.textContent =
      servicio.nombre;

    servicioHorario.appendChild(
      option
    );
  }

  servicioHorario.disabled = false;
}

async function guardarHorario() {
  ocultarMensaje();

  const profesionalId =
    profesionalHorario.value;

  const servicioId =
    servicioHorario.value;

  const dia =
    Number(
      diaHorario.value
    );

  const hora =
    horaSlot.value;

  if (
    !profesionalId ||
    !servicioId ||
    !dia ||
    !hora
  ) {
    mostrarError(
      "Selecciona profesional, servicio, día y hora."
    );
    return;
  }

  const servicio =
    serviciosAsignados.find(
      s => s.id === servicioId
    );

  if (!servicio) {
    mostrarError(
      "No encontramos el servicio seleccionado."
    );
    return;
  }

  const duracion =
    Number(
      servicio.duracion_minutos
    ) || 60;

  const horaInicio =
    normalizarHora(hora);

  const horaFin =
    sumarMinutos(
      horaInicio,
      duracion
    );

  btnGuardarHorario.disabled =
    true;

  btnGuardarHorario.textContent =
    "Guardando...";

  try {
    // Evita duplicar exactamente el mismo slot.
    const { data: duplicados, error: errorDuplicados } =
      await db
        .from("horarios")
        .select("id")
        .eq(
          "profesional_id",
          profesionalId
        )
        .eq(
          "servicio_id",
          servicioId
        )
        .eq(
          "dia_semana",
          dia
        )
        .eq(
          "hora_slot",
          horaInicio
        )
        .eq(
          "activo",
          true
        )
        .limit(1);

    if (errorDuplicados) {
      throw errorDuplicados;
    }

    if (duplicados?.length) {
      mostrarError(
        "Ese horario ya está agregado."
      );
      return;
    }

    const { error } =
      await db
        .from("horarios")
        .insert({
          profesional_id:
            profesionalId,
          servicio_id:
            servicioId,
          dia_semana:
            dia,
          hora_slot:
            horaInicio,
          hora_inicio:
            horaInicio,
          hora_fin:
            horaFin,
          activo:
            true
        });

    if (error) {
      throw error;
    }

    mostrarExito(
      "Horario agregado correctamente."
    );

    horaSlot.value = "";

    await cargarHorarios();

  } catch (error) {
    console.error(
      "Error guardando horario:",
      error
    );

    mostrarError(
      error?.message ||
      "No fue posible guardar el horario."
    );

  } finally {
    btnGuardarHorario.disabled =
      false;

    btnGuardarHorario.textContent =
      "+ Agregar horario";
  }
}

async function cargarHorarios() {
  const profesionalId =
    profesionalHorario.value;

  const servicioId =
    servicioHorario.value;

  if (
    !profesionalId ||
    !servicioId
  ) {
    listaHorarios.innerHTML = `
      <div class="sin-resultados">
        Selecciona un profesional y un servicio.
      </div>
    `;
    return;
  }

  listaHorarios.innerHTML = `
    <div class="cargando">
      Cargando horarios...
    </div>
  `;

  const { data, error } =
    await db
      .from("horarios")
      .select(`
        id,
        profesional_id,
        servicio_id,
        dia_semana,
        hora_slot,
        hora_inicio,
        hora_fin,
        activo
      `)
      .eq(
        "profesional_id",
        profesionalId
      )
      .eq(
        "servicio_id",
        servicioId
      )
      .order(
        "dia_semana",
        { ascending: true }
      )
      .order(
        "hora_inicio",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error horarios:",
      error
    );

    listaHorarios.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar los horarios.
      </div>
    `;

    mostrarError(
      "No fue posible cargar los horarios."
    );
    return;
  }

  renderHorarios(
    data || []
  );
}

function renderHorarios(horarios) {
  if (!horarios.length) {
    listaHorarios.innerHTML = `
      <div class="sin-resultados">
        No hay horarios asignados para este servicio.
      </div>
    `;
    return;
  }

  listaHorarios.innerHTML = "";

  for (
    const horario
    of horarios
  ) {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      `horario-card ${
        horario.activo
          ? ""
          : "horario-inactivo"
      }`;

    const inicio =
      cortarHora(
        horario.hora_inicio ||
        horario.hora_slot
      );

    const fin =
      cortarHora(
        horario.hora_fin
      );

    card.innerHTML = `
      <strong>
        ${dias[
          horario.dia_semana
        ] || "Día"}
      </strong>

      <div class="horario-meta">
        ${inicio}${
          fin
            ? ` – ${fin}`
            : ""
        }
        · ${
          horario.activo
            ? "Activo"
            : "Inactivo"
        }
      </div>

      <div class="horario-acciones">
        <button
          type="button"
          class="btn-horario-estado"
          onclick="cambiarEstadoHorario(
            '${horario.id}',
            ${!horario.activo}
          )"
        >
          ${
            horario.activo
              ? "Desactivar"
              : "Activar"
          }
        </button>

        <button
          type="button"
          class="btn-horario-eliminar"
          onclick="eliminarHorario(
            '${horario.id}'
          )"
        >
          Eliminar
        </button>
      </div>
    `;

    listaHorarios.appendChild(
      card
    );
  }
}

async function cambiarEstadoHorario(
  id,
  nuevoActivo
) {
  ocultarMensaje();

  const { error } =
    await db
      .from("horarios")
      .update({
        activo:
          nuevoActivo
      })
      .eq("id", id);

  if (error) {
    console.error(error);
    mostrarError(
      "No fue posible cambiar el horario."
    );
    return;
  }

  mostrarExito(
    nuevoActivo
      ? "Horario activado."
      : "Horario desactivado."
  );

  await cargarHorarios();
}

async function eliminarHorario(
  id
) {
  const confirmar =
    window.confirm(
      "¿Eliminar este horario?"
    );

  if (!confirmar) return;

  ocultarMensaje();

  const { error } =
    await db
      .from("horarios")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    mostrarError(
      "No fue posible eliminar el horario."
    );
    return;
  }

  mostrarExito(
    "Horario eliminado."
  );

  await cargarHorarios();
}

function normalizarHora(
  hora
) {
  if (!hora) return "";

  if (
    /^\d{2}:\d{2}$/
      .test(hora)
  ) {
    return `${hora}:00`;
  }

  return hora;
}

function sumarMinutos(
  hora,
  minutos
) {
  const partes =
    String(hora)
      .split(":")
      .map(Number);

  const total =
    (
      (partes[0] || 0) *
      60
    ) +
    (partes[1] || 0) +
    Number(minutos || 0);

  const h =
    Math.floor(
      total / 60
    ) % 24;

  const m =
    total % 60;

  return (
    String(h)
      .padStart(2, "0") +
    ":" +
    String(m)
      .padStart(2, "0") +
    ":00"
  );
}

function cortarHora(
  hora
) {
  if (!hora) return "";

  return String(hora)
    .slice(0, 5);
}

function mostrarError(
  texto
) {
  mensaje.textContent =
    texto;

  mensaje.className =
    "mensaje error";
}

function mostrarExito(
  texto
) {
  mensaje.textContent =
    texto;

  mensaje.className =
    "mensaje exito";
}

function ocultarMensaje() {
  mensaje.textContent = "";

  mensaje.className =
    "mensaje oculto";
}

window.cambiarEstadoHorario =
  cambiarEstadoHorario;

window.eliminarHorario =
  eliminarHorario;

iniciar();

function horaCorta(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function escapar(texto = "") {
  return String(texto)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
