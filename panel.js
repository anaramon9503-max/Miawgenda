const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const login = document.getElementById("login");
const panel = document.getElementById("panel");
const mensaje = document.getElementById("mensaje");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const btnLogin = document.getElementById("btnLogin");
const btnCerrar = document.getElementById("btnCerrar");

const nombreNegocio =
  document.getElementById("nombreNegocio");

const correoUsuario =
  document.getElementById("correoUsuario");

const listaCitas =
  document.getElementById("listaCitas");

let negocioActualId = null;
let profesionalActualId = null;
let esProfesional = false;


// =====================================================
// LOGIN
// =====================================================

btnLogin.addEventListener("click", iniciarSesion);

passwordInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    iniciarSesion();
  }
});

btnCerrar.addEventListener("click", cerrarSesion);


async function iniciarSesion() {

  const email = emailInput.value.trim();
  const password = passwordInput.value;

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
// USUARIO
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


async function comprobarSuperAdmin(userId) {

  const { data, error } =
    await db
      .from("super_admins")
      .select("usuario_id")
      .eq("usuario_id", userId)
      .eq("activo", true)
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

  login.classList.add("oculto");
  panel.classList.remove("oculto");

  correoUsuario.textContent =
    user.email || "";

  nombreNegocio.textContent =
    "Cargando...";

  const membresia =
    await obtenerMembresia(
      user.id
    );

  if (!membresia) {

    nombreNegocio.textContent =
      "Sin negocio";

    listaCitas.innerHTML =
      `
      <div class="sin-citas">
        No se encontró un negocio
        asociado a esta cuenta.
      </div>
      `;

    return;
  }

  negocioActualId =
    membresia.negocio_id;

  esProfesional =
    membresia.es_profesional === true;

  if (esProfesional) {

    profesionalActualId =
      await obtenerProfesional(
        user.id
      );
  }

  await cargarNombreNegocio();

  await cargarCitas();
}


async function obtenerMembresia(userId) {

  const { data, error } =
    await db
      .from("miembros_negocio")
      .select(`
        negocio_id,
        es_admin,
        es_profesional,
        activo
      `)
      .eq("usuario_id", userId)
      .eq("activo", true)
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


async function obtenerProfesional(userId) {

  const { data, error } =
    await db
      .from("profesionales")
      .select("id")
      .eq("usuario_id", userId)
      .eq("activo", true)
      .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.id || null;
}


async function cargarNombreNegocio() {

  const { data, error } =
    await db
      .from("negocios")
      .select("nombre")
      .eq("id", negocioActualId)
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
// CITAS
// =====================================================

async function cargarCitas() {

  listaCitas.innerHTML =
    `
    <div class="cargando">
      Cargando citas...
    </div>
    `;

  const hoy =
    new Date()
      .toISOString()
      .slice(0, 10);

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
      .eq(
        "negocio_id",
        negocioActualId
      )
      .gte(
        "fecha",
        hoy
      )
      .order(
        "fecha",
        { ascending: true }
      )
      .order(
        "hora_inicio",
        { ascending: true }
      );

  if (
    esProfesional &&
    profesionalActualId
  ) {

    consulta =
      consulta.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const { data, error } =
    await consulta;

  if (error) {

    console.error(error);

    listaCitas.innerHTML =
      `
      <div class="sin-citas">
        No fue posible cargar las citas.
      </div>
      `;

    return;
  }

  if (!data || !data.length) {

    listaCitas.innerHTML =
      `
      <div class="sin-citas">
        No tienes próximas citas.
      </div>
      `;

    return;
  }

  listaCitas.innerHTML = "";

  for (const cita of data) {

    const nombres =
      await obtenerNombresCita(
        cita
      );

    const tarjeta =
      document.createElement("div");

    tarjeta.className = "cita";

    tarjeta.innerHTML = `

      <div class="fecha">
        📅 ${formatearFecha(cita.fecha)}
      </div>

      <div class="hora">
        🕐
        ${horaCorta(cita.hora_inicio)}
        -
        ${horaCorta(cita.hora_fin)}
      </div>

      <div class="dato">
        <strong>Paciente:</strong>
        ${escapar(cita.paciente_nombre)}
      </div>

      <div class="dato">
        <strong>Teléfono:</strong>
        ${escapar(cita.paciente_telefono)}
      </div>

      <div class="dato">
        <strong>Servicio:</strong>
        ${escapar(nombres.servicio)}
      </div>

      <div class="dato">
        <strong>Profesional:</strong>
        ${escapar(nombres.profesional)}
      </div>

      <div class="estado">
        ${nombreEstado(cita.estado)}
      </div>

      <div class="acciones">

        <button
          onclick="cambiarEstado(
            '${cita.id}',
            'confirmada'
          )"
        >
          ✓ Confirmar
        </button>

        <button
          onclick="cambiarEstado(
            '${cita.id}',
            'atendida'
          )"
        >
          ✓ Atendida
        </button>

        <button
          onclick="cambiarEstado(
            '${cita.id}',
            'cancelada'
          )"
        >
          ✕ Cancelar
        </button>

        <button
          onclick="cambiarEstado(
            '${cita.id}',
            'no_asistio'
          )"
        >
          No asistió
        </button>

      </div>
    `;

    listaCitas.appendChild(
      tarjeta
    );
  }
}


async function obtenerNombresCita(cita) {

  let servicio =
    "Sin servicio";

  let profesional =
    "Sin profesional";


  if (cita.servicio_id) {

    const { data } =
      await db
        .from("servicios")
        .select("nombre")
        .eq(
          "id",
          cita.servicio_id
        )
        .maybeSingle();

    if (data) {
      servicio = data.nombre;
    }
  }


  if (cita.profesional_id) {

    const { data } =
      await db
        .from("profesionales")
        .select("nombre")
        .eq(
          "id",
          cita.profesional_id
        )
        .maybeSingle();

    if (data) {
      profesional = data.nombre;
    }
  }


  return {
    servicio,
    profesional
  };
}


// =====================================================
// CAMBIAR ESTADO
// =====================================================

async function cambiarEstado(
  citaId,
  nuevoEstado
) {

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


// Necesaria porque los botones
// usan onclick.
window.cambiarEstado =
  cambiarEstado;


// =====================================================
// CERRAR SESIÓN
// =====================================================

async function cerrarSesion() {

  await db.auth.signOut();

  negocioActualId = null;
  profesionalActualId = null;
  esProfesional = false;

  panel.classList.add("oculto");
  login.classList.remove("oculto");

  passwordInput.value = "";

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

  mensaje.textContent = texto;

  mensaje.className =
    "mensaje error";
}


function mostrarExito(texto) {

  mensaje.textContent = texto;

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
  ).slice(0, 5);
}


function formatearFecha(fecha) {

  if (!fecha) {
    return "";
  }

  const partes =
    fecha.split("-");

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

  return estados[estado] || estado;
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
// INICIAR
// =====================================================

revisarSesion();
