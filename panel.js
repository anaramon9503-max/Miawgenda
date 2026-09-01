const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

let negocioActualId = null;
let negocioActualNombre = null;
let usuarioActualId = null;
let usuarioEsProfesional = false;
let profesionalActualId = null;

const login =
  document.getElementById("login");

const panel =
  document.getElementById("panel");

const mensaje =
  document.getElementById("mensaje");

const listaCitas =
  document.getElementById("listaCitas");

const nombreNegocio =
  document.getElementById("nombreNegocio");

const btnLogin =
  document.getElementById("btnLogin");

const btnCerrar =
  document.getElementById("btnCerrar");

btnLogin.addEventListener(
  "click",
  iniciarSesion
);

btnCerrar.addEventListener(
  "click",
  cerrarSesion
);

document
  .getElementById("password")
  .addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Enter") {
        iniciarSesion();
      }
    }
  );

async function iniciarSesion() {
  const email =
    document
      .getElementById("email")
      .value
      .trim();

  const password =
    document
      .getElementById("password")
      .value;

  ocultarMensaje();

  if (!email || !password) {
    mostrarError(
      "Escribe tu correo y contraseña."
    );

    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent =
    "Entrando...";

  const {
    data,
    error
  } = await db.auth.signInWithPassword({
    email,
    password
  });

  btnLogin.disabled = false;
  btnLogin.textContent =
    "Entrar";

  if (error) {
    console.error(error);

    mostrarError(
      "Correo o contraseña incorrectos."
    );

    return;
  }

  if (!data.user) {
    mostrarError(
      "No fue posible iniciar sesión."
    );

    return;
  }

  await procesarUsuario(
    data.user
  );
}

async function procesarUsuario(usuario) {
  usuarioActualId =
    usuario.id;

  const esSuperAdmin =
    await revisarSuperAdmin(
      usuario.id
    );

  if (esSuperAdmin) {
    window.location.href =
      "superadmin.html";

    return;
  }

  await mostrarPanel(
    usuario
  );
}

async function revisarSuperAdmin(
  usuarioId
) {
  const {
    data,
    error
  } = await db
    .from("super_admins")
    .select(
      "usuario_id,activo"
    )
    .eq(
      "usuario_id",
      usuarioId
    )
    .eq(
      "activo",
      true
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Error comprobando super admin:",
      error
    );

    return false;
  }

  return !!data;
}

async function cerrarSesion() {
  await db.auth.signOut();

  negocioActualId = null;
  negocioActualNombre = null;
  usuarioActualId = null;
  usuarioEsProfesional = false;
  profesionalActualId = null;

  panel.classList.add(
    "oculto"
  );

  login.classList.remove(
    "oculto"
  );

  document
    .getElementById("password")
    .value = "";

  ocultarMensaje();
}

async function mostrarPanel(usuario) {
  login.classList.add(
    "oculto"
  );

  panel.classList.remove(
    "oculto"
  );

  document
    .getElementById(
      "correoUsuario"
    )
    .textContent =
      usuario.email;

  nombreNegocio.textContent =
    "Cargando...";

  const negocioEncontrado =
    await cargarNegocioUsuario(
      usuario.id
    );

  if (!negocioEncontrado) {
    listaCitas.innerHTML =
      '<div class="sin-citas">No se encontró un negocio asociado a esta cuenta.</div>';

    return;
  }

  await cargarCitas();
}

async function cargarNegocioUsuario(
  usuarioId
) {
  const {
    data: membresias,
    error
  } = await db
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
    .eq(
      "activo",
      true
    )
    .limit(1);

  if (error) {
    console.error(error);

    nombreNegocio.textContent =
      "No disponible";

    mostrarError(
      "No fue posible identificar el negocio de esta cuenta."
    );

    return false;
  }

  if (
    !membresias ||
    membresias.length === 0
  ) {
    nombreNegocio.textContent =
      "Sin negocio";

    return false;
  }

  const membresia =
    membresias[0];

  negocioActualId =
    membresia.negocio_id;

  usuarioEsProfesional =
    membresia.es_profesional === true;

  if (usuarioEsProfesional) {
    await cargarProfesionalUsuario(
      usuarioId
    );
  }

  const {
    data: negocios,
    error: errorNegocio
  } = await db
    .from("negocios_publicos")
    .select(
      "id,nombre"
    )
    .eq(
      "id",
      negocioActualId
    )
    .limit(1);

  if (
    errorNegocio ||
    !negocios ||
    negocios.length === 0
  ) {
    console.error(
      errorNegocio
    );

    nombreNegocio.textContent =
      "Negocio";

    negocioActualNombre =
      "Negocio";

    return true;
  }

  negocioActualNombre =
    negocios[0].nombre;

  nombreNegocio.textContent =
    negocioActualNombre;

  return true;
}

async function cargarProfesionalUsuario(
  usuarioId
) {
  const {
    data,
    error
  } = await db
    .from("profesionales")
    .select("id")
    .eq(
      "usuario_id",
      usuarioId
    )
    .eq(
      "activo",
      true
    )
    .maybeSingle();

  if (error) {
    console.error(error);

    profesionalActualId =
      null;

    return;
  }

  profesionalActualId =
    data?.id || null;
}

async function cargarCitas() {
  listaCitas.innerHTML =
    '<div class="cargando">Cargando citas...</div>';

  const hoy =
    new Date();

  const hoyTexto =
    hoy.getFullYear()
    + "-"
    + String(
        hoy.getMonth() + 1
      ).padStart(2, "0")
    + "-"
    + String(
        hoy.getDate()
      ).padStart(2, "0");

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
        hoyTexto
      )
      .order(
        "fecha",
        {
          ascending: true
        }
      )
      .order(
        "hora_inicio",
        {
          ascending: true
        }
      );

  if (
    usuarioEsProfesional &&
    profesionalActualId
  ) {
    consulta =
      consulta.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const {
    data: citas,
    error
  } = await consulta;

  if (error) {
    console.error(error);

    listaCitas.innerHTML =
      '<div class="sin-citas">No fue posible cargar las citas.</div>';

    return;
  }

  if (
    !citas ||
    citas.length === 0
  ) {
    listaCitas.innerHTML =
      '<div class="sin-citas">No tienes próximas citas.</div>';

    return;
  }

  const idsProfesionales =
    [
      ...new Set(
        citas
          .map(
            cita =>
              cita.profesional_id
          )
          .filter(Boolean)
      )
    ];

  const idsServicios =
    [
      ...new Set(
        citas
          .map(
            cita =>
              cita.servicio_id
          )
          .filter(Boolean)
      )
    ];

  let mapaProfesionales = {};
  let mapaServicios = {};

  if (
    idsProfesionales.length > 0
  ) {
    const {
      data: profesionales,
      error: errorProfesionales
    } = await db
      .from(
        "profesionales_publicos"
      )
      .select(
        "id,nombre"
      )
      .in(
        "id",
        idsProfesionales
      );

    if (
      !errorProfesionales &&
      profesionales
    ) {
      profesionales.forEach(
        profesional => {
          mapaProfesionales[
            profesional.id
          ] =
            profesional.nombre;
        }
      );
    }
  }

  if (
    idsServicios.length > 0
  ) {
    const {
      data: servicios,
      error: errorServicios
    } = await db
      .from(
        "servicios_publicos"
      )
      .select(
        "id,nombre"
      )
      .in(
        "id",
        idsServicios
      );

    if (
      !errorServicios &&
      servicios
    ) {
      servicios.forEach(
        servicio => {
          mapaServicios[
            servicio.id
          ] =
            servicio.nombre;
        }
      );
    }
  }

  listaCitas.innerHTML =
    "";

  citas.forEach(
    cita => {
      const tarjeta =
        document.createElement(
          "div"
        );

      tarjeta.className =
        "cita";

      const fechaBonita =
        formatearFecha(
          cita.fecha
        );

      const horaInicio =
        String(
          cita.hora_inicio ||
          ""
        ).substring(
          0,
          5
        );

      const horaFin =
        String(
          cita.hora_fin ||
          ""
        ).substring(
          0,
          5
        );

      const servicio =
        mapaServicios[
          cita.servicio_id
        ] ||
        "Sin servicio";

      const profesional =
        mapaProfesionales[
          cita.profesional_id
        ] ||
        "Sin profesional";

      const estadoTexto =
        nombreEstado(
          cita.estado
        );

      tarjeta.innerHTML = `

        <div class="fecha">
          📅 ${fechaBonita}
        </div>

        <div class="hora">
          🕐 ${horaInicio} - ${horaFin}
        </div>

        <div class="dato">
          <strong>Paciente:</strong>
          ${escapar(
            cita.paciente_nombre ||
            ""
          )}
        </div>

        <div class="dato">
          <strong>Teléfono:</strong>
          ${escapar(
            cita.paciente_telefono ||
            ""
          )}
        </div>

        ${
          cita.paciente_email
          ?
          `
          <div class="dato">
            <strong>Correo:</strong>
            ${escapar(
              cita.paciente_email
            )}
          </div>
          `
          :
          ""
        }

        <div class="dato">
          <strong>Servicio:</strong>
          ${escapar(
            servicio
          )}
        </div>

        <div class="dato">
          <strong>Profesional:</strong>
          ${escapar(
            profesional
          )}
        </div>

        <div
          class="estado estado-${cita.estado}"
        >
          ${estadoTexto}
        </div>

        <div class="acciones">

          <button
            class="btn-confirmar"
            onclick="cambiarEstado(
              '${cita.id}',
              'confirmada'
            )"
            ${
              cita.estado ===
              "confirmada"
              ? "disabled"
              : ""
            }
          >
            ✓ Confirmar
          </button>

          <button
            class="btn-atendida"
            onclick="cambiarEstado(
              '${cita.id}',
              'atendida'
            )"
            ${
              cita.estado ===
              "atendida"
              ? "disabled"
              : ""
            }
          >
            ✓ Atendida
          </button>

          <button
            class="btn-cancelar"
            onclick="cambiarEstado(
              '${cita.id}',
              'cancelada'
            )"
            ${
              cita.estado ===
              "cancelada"
              ? "disabled"
              : ""
            }
          >
            ✕ Cancelar
          </button>

          <button
            class="btn-no-asistio"
            onclick="cambiarEstado(
              '${cita.id}',
              'no_asistio'
            )"
            ${
              cita.estado ===
              "no_asistio"
              ? "disabled"
              : ""
            }
          >
            No asistió
          </button>

        </div>
      `;

      listaCitas.appendChild(
        tarjeta
      );
    }
  );
}

async function cambiarEstado(
  citaId,
  nuevoEstado
) {
  ocultarMensaje();

  if (
    nuevoEstado ===
    "cancelada"
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
        estado:
          nuevoEstado
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
    usuarioEsProfesional &&
    profesionalActualId
  ) {
    consulta =
      consulta.eq(
        "profesional_id",
        profesionalActualId
      );
  }

  const {
    error
  } = await
