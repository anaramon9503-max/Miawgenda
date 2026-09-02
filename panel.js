const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// =====================================================
// ELEMENTOS
// =====================================================

const login =
  document.getElementById("login");

const panel =
  document.getElementById("panel");

const mensaje =
  document.getElementById("mensaje");

const emailInput =
  document.getElementById("email");

const passwordInput =
  document.getElementById("password");

const btnLogin =
  document.getElementById("btnLogin");

const btnCerrar =
  document.getElementById("btnCerrar");

const nombreNegocio =
  document.getElementById("nombreNegocio");

const correoUsuario =
  document.getElementById("correoUsuario");

const listaCitas =
  document.getElementById("listaCitas");

const filtroProfesional =
  document.getElementById("filtroProfesional");

const btnNuevaCita =
  document.getElementById("btnNuevaCita");

const formularioCita =
  document.getElementById("formularioCita");

const tituloFormularioCita =
  document.getElementById("tituloFormularioCita");

const citaEditandoId =
  document.getElementById("citaEditandoId");

const citaPaciente =
  document.getElementById("citaPaciente");

const citaTelefono =
  document.getElementById("citaTelefono");

const citaEmail =
  document.getElementById("citaEmail");

const citaProfesional =
  document.getElementById("citaProfesional");

const citaServicio =
  document.getElementById("citaServicio");

const citaFecha =
  document.getElementById("citaFecha");

const citaHora =
  document.getElementById("citaHora");

const btnGuardarCita =
  document.getElementById("btnGuardarCita");

const btnCancelarFormulario =
  document.getElementById("btnCancelarFormulario");

const contadorCitas =
  document.getElementById("contadorCitas");

const accesoSuperAdmin =
  document.getElementById("accesoSuperAdmin");

const accesoServicios =
  document.getElementById("accesoServicios");

const accesoProfesionales =
  document.getElementById("accesoProfesionales");


// =====================================================
// VARIABLES
// =====================================================

let negocioActualId = null;
let profesionalActualId = null;
let esProfesional = false;
let esAdmin = false;

let profesionalesActuales = [];
let serviciosActuales = [];
let citasActuales = [];
let filtroEstadoActual = "proximas";


// =====================================================
// LOGIN
// =====================================================

btnLogin.addEventListener(
  "click",
  iniciarSesion
);

passwordInput.addEventListener(
  "keydown",
  e => {
    if (e.key === "Enter") {
      iniciarSesion();
    }
  }
);

btnCerrar.addEventListener(
  "click",
  cerrarSesion
);


// =====================================================
// EVENTOS NUEVOS
// =====================================================

if (filtroProfesional) {
  filtroProfesional.addEventListener(
    "change",
    cargarCitas
  );
}

if (btnNuevaCita) {
  btnNuevaCita.addEventListener(
    "click",
    abrirNuevaCita
  );
}

if (btnCancelarFormulario) {
  btnCancelarFormulario.addEventListener(
    "click",
    cerrarFormularioCita
  );
}

if (btnGuardarCita) {
  btnGuardarCita.addEventListener(
    "click",
    guardarCita
  );
}

if (citaProfesional) {
  citaProfesional.addEventListener(
    "change",
    async () => {
      await cargarServiciosFormulario();
      await cargarHorariosDisponibles();
    }
  );
}

if (citaServicio) {
  citaServicio.addEventListener(
    "change",
    cargarHorariosDisponibles
  );
}

if (citaFecha) {
  citaFecha.addEventListener(
    "change",
    cargarHorariosDisponibles
  );
}


// =====================================================
// INICIAR SESIÓN
// =====================================================

async function iniciarSesion() {

  const email =
    emailInput.value.trim();

  const password =
    passwordInput.value;

  ocultarMensaje();

  if (!email || !password) {

    mostrarError(
      "Escribe tu correo y contraseña."
    );

    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = "Entrando...";

  try {

    const { data, error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error(
        "No se pudo iniciar sesión."
      );
    }

    await procesarUsuario(
      data.user
    );

  } catch (error) {

    console.error(error);

    mostrarError(
      "Correo o contraseña incorrectos."
    );

  } finally {

    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
}


// =====================================================
// PROCESAR USUARIO
// =====================================================

async function procesarUsuario(user) {

  const superAdmin =
    await comprobarSuperAdmin(
      user.id
    );

  if (superAdmin) {

    window.location.href =
      "superadmin.html";

    return;
  }

  await abrirPanelNormal(
    user
  );
}


// =====================================================
// COMPROBAR SÚPER ADMIN
// =====================================================

async function comprobarSuperAdmin(
  userId
) {

  const { data, error } =
    await db
      .from("super_admins")
      .select("usuario_id")
      .eq(
        "usuario_id",
        userId
      )
      .eq(
        "activo",
        true
      )
      .maybeSingle();

  if (error) {

    console.error(
      "Error super admin:",
      error
    );

    return false;
  }

  return !!data;
}


// =====================================================
// PANEL NORMAL
// =====================================================

async function abrirPanelNormal(user) {

  login.classList.add(
    "oculto"
  );

  panel.classList.remove(
    "oculto"
  );

  correoUsuario.textContent =
    user.email || "";

  nombreNegocio.textContent =
    "Cargando...";

  if (accesoSuperAdmin) {
    accesoSuperAdmin.classList.add(
      "oculto"
    );
  }

  const membresia =
    await obtenerMembresia(
      user.id
    );

  if (!membresia) {

    nombreNegocio.textContent =
      "Sin negocio";

    listaCitas.innerHTML = `
      <div class="sin-citas">
        No se encontró un negocio
        asociado a esta cuenta.
      </div>
    `;

    return;
  }

  negocioActualId =
    membresia.negocio_id;

  esAdmin =
    membresia.es_admin === true;

  esProfesional =
    membresia.es_profesional === true;

  if (esProfesional) {
    profesionalActualId =
      await obtenerProfesional(
        user.id
      );
  }

  if (
    accesoServicios &&
    !esAdmin
  ) {
    accesoServicios.classList.add(
      "oculto"
    );
  }

  if (
    accesoProfesionales &&
    !esAdmin
  ) {
    accesoProfesionales.classList.add(
      "oculto"
    );
  }

  await cargarNombreNegocio();
  await cargarProfesionales();
  await cargarCitas();
}


// =====================================================
// MEMBRESÍA
// =====================================================

async function obtenerMembresia(
  userId
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
        userId
      )
      .eq(
        "activo",
        true
      )
      .limit(1);

  if (error) {

    console.error(error);

    mostrarError(
      "No fue posible cargar tu acceso."
    );

    return null;
  }

  if (!data || !data.length) {
    return null;
  }

  return data[0];
}


// =====================================================
// OBTENER PROFESIONAL DEL USUARIO
// =====================================================

async function obtenerProfesional(
  userId
) {

  const { data, error } =
    await db
      .from("profesionales")
      .select("id")
      .eq(
        "usuario_id",
        userId
      )
      .eq(
        "activo",
        true
      )
      .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.id || null;
}


// =====================================================
// NOMBRE NEGOCIO
// =====================================================

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
      "Negocio";

    return;
  }

  nombreNegocio.textContent =
    data.nombre;
}


// =====================================================
// PROFESIONALES
// =====================================================

async function cargarProfesionales() {

  let consulta =
    db
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
      .eq(
        "activo",
        true
      )
      .order(
        "nombre",
        { ascending: true }
      );

  if (
    esProfesional &&
    !esAdmin &&
    profesionalActualId
  ) {
    consulta =
      consulta.eq(
        "id",
        profesionalActualId
      );
  }

  const { data, error } =
    await consulta;

  if (error) {

    console.error(
      "Error profesionales:",
      error
    );

    mostrarError(
      "No fue posible cargar los profesionales."
    );

    return;
  }

  profesionalesActuales =
    data || [];

  llenarSelectProfesionales();
}


// =====================================================
// SELECT PROFESIONALES
// =====================================================

function llenarSelectProfesionales() {

  if (filtroProfesional) {

    filtroProfesional.innerHTML =
      "";

    if (esAdmin) {
      filtroProfesional.innerHTML += `
        <option value="">
          Todos los profesionales
        </option>
      `;
    }

    for (
      const profesional
      of profesionalesActuales
    ) {
      filtroProfesional.innerHTML += `
        <option value="${profesional.id}">
          ${escapar(profesional.nombre)}
        </option>
      `;
    }

    if (
      esProfesional &&
      !esAdmin &&
      profesionalActualId
    ) {
      filtroProfesional.value =
        profesionalActualId;

      filtroProfesional.disabled =
        true;
    }
  }

  if (citaProfesional) {

    citaProfesional.innerHTML = `
      <option value="">
        Selecciona un profesional
      </option>
    `;

    for (
      const profesional
      of profesionalesActuales
    ) {
      citaProfesional.innerHTML += `
        <option value="${profesional.id}">
          ${escapar(profesional.nombre)}
        </option>
      `;
    }

    if (
      esProfesional &&
      !esAdmin &&
      profesionalActualId
    ) {
      citaProfesional.value =
        profesionalActualId;

      citaProfesional.disabled =
        true;
    } else {
      citaProfesional.disabled =
        false;
    }
  }
}


// =====================================================
// CARGAR CITAS
// =====================================================

async function cargarCitas() {

  listaCitas.innerHTML = `
    <div class="cargando">
      Cargando citas...
    </div>
  `;

  asegurarFiltrosEstado();

  const hoy = fechaLocalHoy();

  let consulta =
    db
      .from("citas")
      .select(`
        id,
        negocio_id,
        profesional_id,
        servicio_id,
        paciente_nombre,
        paciente_telefono,
        paciente_email,
        fecha,
        hora_inicio,
        hora_fin,
        estado
      `)
      .eq("negocio_id", negocioActualId)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true });

  // Próximas, pendientes y confirmadas solo muestran hoy en adelante.
  if (["proximas", "pendiente", "confirmada"].includes(filtroEstadoActual)) {
    consulta = consulta.gte("fecha", hoy);
  }

  if (filtroEstadoActual === "proximas") {
    consulta = consulta.in("estado", ["pendiente", "confirmada"]);
  } else if (filtroEstadoActual !== "todas") {
    consulta = consulta.eq("estado", filtroEstadoActual);
  }

  if (esProfesional && !esAdmin && profesionalActualId) {
    consulta = consulta.eq("profesional_id", profesionalActualId);
  }

  if (esAdmin && filtroProfesional?.value) {
    consulta = consulta.eq("profesional_id", filtroProfesional.value);
  }

  const { data, error } = await consulta;

  if (error) {
    console.error(error);
    listaCitas.innerHTML = `
      <div class="sin-citas">
        No fue posible cargar las citas.
      </div>
    `;
    return;
  }

  citasActuales = data || [];

  if (contadorCitas) {
    contadorCitas.textContent =
      citasActuales.length === 1
        ? "1 cita"
        : `${citasActuales.length} citas`;
  }

  if (!citasActuales.length) {
    listaCitas.innerHTML = `
      <div class="sin-citas">
        No hay citas en esta sección.
      </div>
    `;
    return;
  }

  await cargarServiciosBase();

  const mapaProfesionales = new Map(
    profesionalesActuales.map(p => [p.id, p.nombre])
  );

  const mapaServicios = new Map(
    serviciosActuales.map(s => [s.id, s.nombre])
  );

  listaCitas.innerHTML = "";

  for (const cita of citasActuales) {
    const nombreProfesional =
      mapaProfesionales.get(cita.profesional_id) || "Sin profesional";

    const nombreServicio =
      mapaServicios.get(cita.servicio_id) || "Sin servicio";

    const tarjeta = document.createElement("div");
    tarjeta.className = `cita cita-${cita.estado}`;

    tarjeta.innerHTML = `
      <div class="fecha">
        📅 ${formatearFecha(cita.fecha)}
      </div>

      <div class="hora">
        🕐 ${horaCorta(cita.hora_inicio)} - ${horaCorta(cita.hora_fin)}
      </div>

      <div class="dato">
        <strong>Paciente:</strong>
        ${escapar(cita.paciente_nombre)}
      </div>

      <div class="dato">
        <strong>Teléfono:</strong>
        ${escapar(cita.paciente_telefono || "")}
      </div>

      <div class="dato">
        <strong>Servicio:</strong>
        ${escapar(nombreServicio)}
      </div>

      <div class="dato">
        <strong>Profesional:</strong>
        ${escapar(nombreProfesional)}
      </div>

      <div class="estado estado-${cita.estado}">
        ${nombreEstado(cita.estado)}
      </div>

      <div class="acciones">
        ${botonesPorEstado(cita)}
      </div>
    `;

    listaCitas.appendChild(tarjeta);
  }
}


// =====================================================
// FILTROS DE ESTADO
// =====================================================

function asegurarFiltrosEstado() {
  const existente = document.getElementById("filtrosEstadoCitas");

  if (existente) {
    actualizarFiltroEstadoVisual();
    return;
  }

  const contenedor = document.createElement("div");
  contenedor.id = "filtrosEstadoCitas";
  contenedor.className = "filtros-estado-citas";

  contenedor.innerHTML = `
    <label for="selectorEstadoCitas" class="filtro-estado-label">
      Ver citas
    </label>

    <select id="selectorEstadoCitas" class="filtro-estado-select">
      <option value="proximas">Próximas</option>
      <option value="pendiente">Pendientes</option>
      <option value="confirmada">Confirmadas</option>
      <option value="atendida">Atendidas</option>
      <option value="cancelada">Canceladas</option>
      <option value="no_asistio">No asistió</option>
      <option value="todas">Todas</option>
    </select>
  `;

  const referencia = contadorCitas || listaCitas;
  referencia.parentNode.insertBefore(contenedor, referencia);

  const selector =
    document.getElementById("selectorEstadoCitas");

  selector.addEventListener("change", async () => {
    filtroEstadoActual = selector.value;
    await cargarCitas();
  });

  agregarEstilosCitas();
  actualizarFiltroEstadoVisual();
}

function actualizarFiltroEstadoVisual() {
  const selector =
    document.getElementById("selectorEstadoCitas");

  if (selector) {
    selector.value = filtroEstadoActual;
  }
}

function botonesPorEstado(cita) {
  const id = cita.id;

  const confirmar = `
    <button type="button" onclick="cambiarEstado('${id}','confirmada')">
      ✓ Confirmar
    </button>`;

  const reagendar = `
    <button type="button" onclick="abrirReagendar('${id}')">
      🔄 Reagendar
    </button>`;

  const atendida = `
    <button type="button" onclick="cambiarEstado('${id}','atendida')">
      ✓ Atendida
    </button>`;

  const noAsistio = `
    <button type="button" onclick="cambiarEstado('${id}','no_asistio')">
      No asistió
    </button>`;

  const cancelar = `
    <button type="button" onclick="cambiarEstado('${id}','cancelada')">
      ✕ Cancelar
    </button>`;

  const eliminar = `
    <button type="button" onclick="eliminarCita('${id}')">
      🗑️ Eliminar
    </button>`;

  switch (cita.estado) {
    case "pendiente":
      return confirmar + reagendar + cancelar + eliminar;

    case "confirmada":
      return reagendar + atendida + noAsistio + cancelar;

    case "cancelada":
      return reagendar + eliminar;

    case "atendida":
      return "";

    case "no_asistio":
      return reagendar + eliminar;

    default:
      return reagendar + eliminar;
  }
}

function agregarEstilosCitas() {
  if (document.getElementById("estilosEstadosCitas")) return;

  const style = document.createElement("style");
  style.id = "estilosEstadosCitas";
  style.textContent = `
    .filtros-estado-citas {
      width: 100%;
      margin: 0 0 14px;
    }
    .filtro-estado-label {
      display: block;
      margin-bottom: 7px;
      font-size: 13px;
      font-weight: bold;
      color: #6f6574;
    }
    .filtro-estado-select {
      width: 100%;
      margin: 0;
      padding: 12px 14px;
      border: 1px solid #ddd6df;
      border-radius: 13px;
      background: #faf8fb;
      color: #514458;
      font-size: 14px;
      font-weight: 600;
      font-family: Arial, sans-serif;
    }
    .filtro-estado-select:focus {
      outline: 2px solid #cfc3d4;
      border-color: #8b7a92;
    }
    .estado {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 999px;
    }
    .estado-pendiente { background: #fff3c4; color: #795b00; }
    .estado-confirmada { background: #eee4ff; color: #5f36aa; }
    .estado-atendida { background: #dff4e7; color: #256b3d; }
    .estado-cancelada { background: #ffe0e5; color: #a22d42; }
    .estado-no_asistio { background: #e5e5e8; color: #4d4d55; }
    .cita-cancelada { border-left: 4px solid #d85b70; }
    .cita-atendida { border-left: 4px solid #63a979; }
    .cita-confirmada { border-left: 4px solid #8b63d6; }
    .cita-pendiente { border-left: 4px solid #d6b34c; }
    .cita-no_asistio { border-left: 4px solid #777780; }
  `;
  document.head.appendChild(style);
}


// =====================================================
// SERVICIOS BASE
// =====================================================

async function cargarServiciosBase() {

  const { data, error } =
    await db
      .from("servicios")
      .select(`
        id,
        nombre,
        descripcion,
        duracion_minutos,
        precio,
        activo
      `)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "activo",
        true
      )
      .order(
        "nombre",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error servicios:",
      error
    );

    serviciosActuales = [];
    return;
  }

  serviciosActuales =
    data || [];
}


// =====================================================
// ABRIR NUEVA CITA
// =====================================================

async function abrirNuevaCita() {

  ocultarMensaje();
  limpiarFormularioCita();

  tituloFormularioCita.textContent =
    "Nueva cita";

  formularioCita.classList.remove(
    "oculto"
  );

  citaFecha.min =
    fechaLocalHoy();

  if (
    esProfesional &&
    !esAdmin &&
    profesionalActualId
  ) {

    citaProfesional.value =
      profesionalActualId;

    await cargarServiciosFormulario();
  }

  formularioCita.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


// =====================================================
// CARGAR SERVICIOS DEL PROFESIONAL
// =====================================================

async function cargarServiciosFormulario() {

  citaServicio.innerHTML = `
    <option value="">
      Selecciona un servicio
    </option>
  `;

  citaHora.innerHTML = `
    <option value="">
      Selecciona un horario
    </option>
  `;

  const profesionalId =
    citaProfesional.value;

  if (!profesionalId) {
    return;
  }

  const { data: relaciones, error } =
    await db
      .from("profesional_servicios")
      .select("servicio_id")
      .eq(
        "profesional_id",
        profesionalId
      );

  if (error) {

    console.error(
      "Error profesional_servicios:",
      error
    );

    return;
  }

  const idsServicios =
    [
      ...new Set(
        (relaciones || [])
          .map(
            r => r.servicio_id
          )
          .filter(Boolean)
      )
    ];

  if (!idsServicios.length) {

    citaServicio.innerHTML = `
      <option value="">
        Este profesional no tiene servicios
      </option>
    `;

    return;
  }

  const { data: servicios, error: errorServicios } =
    await db
      .from("servicios")
      .select(`
        id,
        nombre,
        duracion_minutos,
        activo
      `)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq(
        "activo",
        true
      )
      .in(
        "id",
        idsServicios
      )
      .order(
        "nombre",
        { ascending: true }
      );

  if (errorServicios) {

    console.error(
      errorServicios
    );

    return;
  }

  for (
    const servicio
    of servicios || []
  ) {

    citaServicio.innerHTML += `
      <option value="${servicio.id}">
        ${escapar(servicio.nombre)}
      </option>
    `;
  }
}


// =====================================================
// HORARIOS DISPONIBLES
// =====================================================

async function cargarHorariosDisponibles() {

  citaHora.innerHTML = `
    <option value="">
      Selecciona un horario
    </option>
  `;

  const profesionalId =
    citaProfesional.value;

  const servicioId =
    citaServicio.value;

  const fecha =
    citaFecha.value;

  if (
    !profesionalId ||
    !servicioId ||
    !fecha
  ) {
    return;
  }

  const diaSemana =
    obtenerDiaSemana(
      fecha
    );

  const { data: horarios, error } =
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
      .eq(
        "dia_semana",
        diaSemana
      )
      .eq(
        "activo",
        true
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

    mostrarError(
      "No fue posible consultar los horarios."
    );

    return;
  }

  if (!horarios?.length) {

    citaHora.innerHTML = `
      <option value="">
        No hay horarios disponibles
      </option>
    `;

    return;
  }

  const { data: ocupadas, error: errorCitas } =
    await db
      .from("citas")
      .select(`
        id,
        hora_inicio,
        hora_fin,
        estado
      `)
      .eq(
        "profesional_id",
        profesionalId
      )
      .eq(
        "fecha",
        fecha
      );

  if (errorCitas) {

    console.error(
      errorCitas
    );

    mostrarError(
      "No fue posible comprobar la disponibilidad."
    );

    return;
  }

  const idEditando =
    citaEditandoId.value;

  const citasBloqueantes =
    (ocupadas || []).filter(
      cita =>
        cita.estado !== "cancelada" &&
        cita.id !== idEditando
    );

  let disponibles = 0;

  for (
    const horario
    of horarios
  ) {

    const inicio =
      horaCorta(
        horario.hora_inicio ||
        horario.hora_slot
      );

    const fin =
      horaCorta(
        horario.hora_fin
      );

    if (!inicio || !fin) {
      continue;
    }

    const ocupado =
      citasBloqueantes.some(
        cita =>
          hayTraslape(
            inicio,
            fin,
            horaCorta(cita.hora_inicio),
            horaCorta(cita.hora_fin)
          )
      );

    if (ocupado) {
      continue;
    }

    disponibles++;

    citaHora.innerHTML += `
      <option
        value="${inicio}"
        data-fin="${fin}"
      >
        ${inicio}
      </option>
    `;
  }

  if (!disponibles) {

    citaHora.innerHTML = `
      <option value="">
        No hay horarios disponibles
      </option>
    `;
  }
}


// =====================================================
// GUARDAR CITA
// =====================================================

async function guardarCita() {

  ocultarMensaje();

  const paciente =
    citaPaciente.value.trim();

  const telefono =
    citaTelefono.value.trim();

  const email =
    citaEmail.value.trim();

  const profesionalId =
    citaProfesional.value;

  const servicioId =
    citaServicio.value;

  const fecha =
    citaFecha.value;

  const horaInicio =
    citaHora.value;

  const idEditando =
    citaEditandoId.value;

  if (
    !paciente ||
    !telefono ||
    !profesionalId ||
    !servicioId ||
    !fecha ||
    !horaInicio
  ) {

    mostrarError(
      "Completa paciente, teléfono, profesional, servicio, fecha y hora."
    );

    return;
  }

  if (
    esProfesional &&
    !esAdmin &&
    profesionalId !== profesionalActualId
  ) {

    mostrarError(
      "No tienes permiso para usar otro profesional."
    );

    return;
  }

  const opcion =
    citaHora.options[
      citaHora.selectedIndex
    ];

  let horaFin =
    opcion?.dataset?.fin || "";

  if (!horaFin) {

    const { data: servicio } =
      await db
        .from("servicios")
        .select(
          "duracion_minutos"
        )
        .eq(
          "id",
          servicioId
        )
        .maybeSingle();

    horaFin =
      sumarMinutos(
        horaInicio,
        servicio?.duracion_minutos || 60
      );
  }

  btnGuardarCita.disabled =
    true;

  btnGuardarCita.textContent =
    idEditando
      ? "Reagendando..."
      : "Guardando...";

  try {

    const disponible =
      await validarDisponibilidad(
        profesionalId,
        fecha,
        horaInicio,
        horaFin,
        idEditando
      );

    if (!disponible) {

      mostrarError(
        "Ese horario ya está ocupado. Selecciona otro."
      );

      await cargarHorariosDisponibles();

      return;
    }

    if (idEditando) {

      let consulta =
        db
          .from("citas")
          .update({
            profesional_id:
              profesionalId,

            servicio_id:
              servicioId,

            paciente_nombre:
              paciente,

            paciente_telefono:
              telefono,

            paciente_email:
              email || null,

            fecha:
              fecha,

            hora_inicio:
              horaInicio + ":00",

            hora_fin:
              horaFin + ":00",

            estado:
              estadoAlReagendar(idEditando)
          })
          .eq(
            "id",
            idEditando
          )
          .eq(
            "negocio_id",
            negocioActualId
          );

      if (
        esProfesional &&
        !esAdmin &&
        profesionalActualId
      ) {
        consulta =
          consulta.eq(
            "profesional_id",
            profesionalActualId
          );
      }

      const { error } =
        await consulta;

      if (error) {
        throw error;
      }

      mostrarExito(
        "Cita reagendada correctamente."
      );

    } else {

      const { error } =
        await db
          .from("citas")
          .insert({
            negocio_id:
              negocioActualId,

            profesional_id:
              profesionalId,

            servicio_id:
              servicioId,

            paciente_nombre:
              paciente,

            paciente_telefono:
              telefono,

            paciente_email:
              email || null,

            fecha:
              fecha,

            hora_inicio:
              horaInicio + ":00",

            hora_fin:
              horaFin + ":00",

            estado:
              "pendiente"
          });

      if (error) {
        throw error;
      }

      mostrarExito(
        "Cita agregada correctamente."
      );
    }

    cerrarFormularioCita();

    await cargarCitas();

  } catch (error) {

    console.error(
      "Error guardando cita:",
      error
    );

    if (
      String(
        error?.message || ""
      )
        .toLowerCase()
        .includes("ocup")
    ) {
      mostrarError(
        "Ese horario acaba de ser ocupado."
      );
    } else {
      mostrarError(
        "No fue posible guardar la cita."
      );
    }

  } finally {

    btnGuardarCita.disabled =
      false;

    btnGuardarCita.textContent =
      "Guardar cita";
  }
}


// =====================================================
// VALIDAR DISPONIBILIDAD
// =====================================================

async function validarDisponibilidad(
  profesionalId,
  fecha,
  inicio,
  fin,
  ignorarCitaId = ""
) {

  const { data, error } =
    await db
      .from("citas")
      .select(`
        id,
        hora_inicio,
        hora_fin,
        estado
      `)
      .eq(
        "profesional_id",
        profesionalId
      )
      .eq(
        "fecha",
        fecha
      );

  if (error) {

    console.error(error);

    return false;
  }

  const ocupada =
    (data || []).some(
      cita => {

        if (
          ignorarCitaId &&
          cita.id === ignorarCitaId
        ) {
          return false;
        }

        if (
          cita.estado === "cancelada"
        ) {
          return false;
        }

        return hayTraslape(
          inicio,
          fin,
          horaCorta(cita.hora_inicio),
          horaCorta(cita.hora_fin)
        );
      }
    );

  return !ocupada;
}


// =====================================================
// REAGENDAR
// =====================================================

async function abrirReagendar(
  citaId
) {

  ocultarMensaje();

  const cita =
    citasActuales.find(
      c => c.id === citaId
    );

  if (!cita) {

    mostrarError(
      "No se encontró la cita."
    );

    return;
  }

  limpiarFormularioCita();

  citaEditandoId.value =
    cita.id;

  tituloFormularioCita.textContent =
    "Reagendar cita";

  citaPaciente.value =
    cita.paciente_nombre || "";

  citaTelefono.value =
    cita.paciente_telefono || "";

  citaEmail.value =
    cita.paciente_email || "";

  citaProfesional.value =
    cita.profesional_id || "";

  citaFecha.value =
    cita.fecha || "";

  await cargarServiciosFormulario();

  citaServicio.value =
    cita.servicio_id || "";

  await cargarHorariosDisponibles();

  citaHora.value =
    horaCorta(
      cita.hora_inicio
    );

  formularioCita.classList.remove(
    "oculto"
  );

  formularioCita.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

window.abrirReagendar =
  abrirReagendar;


function estadoAlReagendar(citaId) {
  const cita = citasActuales.find(c => c.id === citaId);
  if (!cita) return "pendiente";
  if (["cancelada", "no_asistio"].includes(cita.estado)) {
    return "pendiente";
  }
  return cita.estado || "pendiente";
}


// =====================================================
// CERRAR FORMULARIO
// =====================================================

function cerrarFormularioCita() {

  formularioCita.classList.add(
    "oculto"
  );

  limpiarFormularioCita();
}


// =====================================================
// LIMPIAR FORMULARIO
// =====================================================

function limpiarFormularioCita() {

  citaEditandoId.value = "";

  citaPaciente.value = "";

  citaTelefono.value = "";

  citaEmail.value = "";

  citaFecha.value = "";

  tituloFormularioCita.textContent =
    "Nueva cita";

  citaServicio.innerHTML = `
    <option value="">
      Selecciona un servicio
    </option>
  `;

  citaHora.innerHTML = `
    <option value="">
      Selecciona un horario
    </option>
  `;

  if (
    esProfesional &&
    !esAdmin &&
    profesionalActualId
  ) {
    citaProfesional.value =
      profesionalActualId;
  } else {
    citaProfesional.value = "";
  }
}


// =====================================================
// CAMBIAR ESTADO
// =====================================================

async function cambiarEstado(
  citaId,
  nuevoEstado
) {

  ocultarMensaje();

  if (
    nuevoEstado === "cancelada"
  ) {

    const confirmar =
      window.confirm(
        "¿Seguro que deseas cancelar esta cita?"
      );

    if (!confirmar) {
      return;
    }
  }

  let consulta =
    db
      .from("citas")
      .update({
        estado: nuevoEstado
      })
      .eq(
        "id",
        citaId
      )
      .eq(
        "negocio_id",
        negocioActualId
      );

  if (
    esProfesional &&
    !esAdmin &&
    profesionalActualId
  ) {
    consulta =
      consulta.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const { error } =
    await consulta;

  if (error) {

    console.error(error);

    mostrarError(
      "No se pudo actualizar la cita."
    );

    return;
  }

  mostrarExito(
    "Cita actualizada."
  );

  await cargarCitas();
}

window.cambiarEstado =
  cambiarEstado;


// =====================================================
// ELIMINAR CITA
// =====================================================

async function eliminarCita(
  citaId
) {

  ocultarMensaje();

  const confirmar =
    window.confirm(
      "¿Eliminar esta cita definitivamente? Esta acción no se puede deshacer."
    );

  if (!confirmar) {
    return;
  }

  let consulta =
    db
      .from("citas")
      .delete()
      .eq(
        "id",
        citaId
      )
      .eq(
        "negocio_id",
        negocioActualId
      );

  if (
    esProfesional &&
    !esAdmin &&
    profesionalActualId
  ) {
    consulta =
      consulta.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const { error } =
    await consulta;

  if (error) {

    console.error(
      "Error eliminando cita:",
      error
    );

    mostrarError(
      "No fue posible eliminar la cita."
    );

    return;
  }

  mostrarExito(
    "Cita eliminada."
  );

  await cargarCitas();
}

window.eliminarCita =
  eliminarCita;


// =====================================================
// CERRAR SESIÓN
// =====================================================

async function cerrarSesion() {

  await db.auth.signOut();

  negocioActualId = null;
  profesionalActualId = null;
  esProfesional = false;
  esAdmin = false;

  profesionalesActuales = [];
  serviciosActuales = [];
  citasActuales = [];

  panel.classList.add(
    "oculto"
  );

  login.classList.remove(
    "oculto"
  );

  passwordInput.value = "";

  cerrarFormularioCita();

  ocultarMensaje();
}


// =====================================================
// SESIÓN EXISTENTE
// =====================================================

async function revisarSesion() {

  const { data } =
    await db.auth.getSession();

  if (
    data.session?.user
  ) {
    await procesarUsuario(
      data.session.user
    );
  }
}


// =====================================================
// AYUDANTES
// =====================================================

function mostrarError(texto) {

  mensaje.textContent =
    texto;

  mensaje.className =
    "mensaje error";
}

function mostrarExito(texto) {

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

function horaCorta(hora) {

  return String(
    hora || ""
  ).slice(
    0,
    5
  );
}

function formatearFecha(fecha) {

  if (!fecha) {
    return "";
  }

  const partes =
    fecha.split("-");

  return (
    `${partes[2]}/` +
    `${partes[1]}/` +
    `${partes[0]}`
  );
}

function nombreEstado(estado) {

  const estados = {
    pendiente:
      "Pendiente",

    confirmada:
      "Confirmada",

    atendida:
      "Atendida",

    cancelada:
      "Cancelada",

    no_asistio:
      "No asistió"
  };

  return (
    estados[estado] ||
    estado
  );
}

function escapar(texto = "") {

  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// FECHA LOCAL
// =====================================================

function fechaLocalHoy() {

  const ahora =
    new Date();

  const año =
    ahora.getFullYear();

  const mes =
    String(
      ahora.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      ahora.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${año}-${mes}-${dia}`
  );
}


// =====================================================
// DÍA DE SEMANA
// =====================================================

function obtenerDiaSemana(
  fecha
) {

  const fechaLocal =
    new Date(
      `${fecha}T12:00:00`
    );

  const dia =
    fechaLocal.getDay();

  return dia === 0
    ? 7
    : dia;
}


// =====================================================
// COMPARAR HORAS
// =====================================================

function horaAMinutos(hora) {

  const partes =
    String(hora)
      .slice(0, 5)
      .split(":");

  const h =
    Number(partes[0]);

  const m =
    Number(partes[1]);

  return (
    h * 60 + m
  );
}


// =====================================================
// TRASLAPE
// =====================================================

function hayTraslape(
  inicioA,
  finA,
  inicioB,
  finB
) {

  const aInicio =
    horaAMinutos(inicioA);

  const aFin =
    horaAMinutos(finA);

  const bInicio =
    horaAMinutos(inicioB);

  const bFin =
    horaAMinutos(finB);

  return (
    aInicio < bFin &&
    aFin > bInicio
  );
}


// =====================================================
// SUMAR MINUTOS
// =====================================================

function sumarMinutos(
  hora,
  minutos
) {

  const total =
    horaAMinutos(hora) +
    Number(minutos || 0);

  const h =
    Math.floor(
      total / 60
    );

  const m =
    total % 60;

  return (
    String(h)
      .padStart(2, "0") +
    ":" +
    String(m)
      .padStart(2, "0")
  );
}


// =====================================================
// INICIAR
// =====================================================

revisarSesion();
