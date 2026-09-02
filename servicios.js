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
const mensaje = $("mensaje");

const servicioEditandoId = $("servicioEditandoId");
const servicioNombre = $("servicioNombre");
const servicioDescripcion = $("servicioDescripcion");
const servicioDuracion = $("servicioDuracion");
const servicioPrecio = $("servicioPrecio");
const btnGuardarServicio = $("btnGuardarServicio");
const btnCancelarEdicionServicio = $("btnCancelarEdicionServicio");
const tituloFormularioServicio = $("tituloFormularioServicio");
const listaServicios = $("listaServicios");

let negocioActualId = null;
let usuarioActual = null;
let servicios = [];

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

btnGuardarServicio?.addEventListener(
  "click",
  guardarServicio
);

btnCancelarEdicionServicio?.addEventListener(
  "click",
  limpiarFormulario
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
    await obtenerMembresiaAdmin(
      usuarioActual.id
    );

  if (!membresia) {
    mostrarError(
      "Esta sección es solo para administradores del negocio."
    );

    setTimeout(() => {
      window.location.href =
        "dashboard.html";
    }, 1500);

    return;
  }

  negocioActualId =
    membresia.negocio_id;

  await cargarNombreNegocio();
  await cargarServicios();
}

async function obtenerMembresiaAdmin(
  usuarioId
) {
  const { data, error } =
    await db
      .from("miembros_negocio")
      .select(`
        negocio_id,
        es_admin,
        activo
      `)
      .eq(
        "usuario_id",
        usuarioId
      )
      .eq("activo", true)
      .eq("es_admin", true)
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

async function cargarServicios() {
  listaServicios.innerHTML = `
    <div class="cargando">
      Cargando servicios...
    </div>
  `;

  const { data, error } =
    await db
      .from("servicios")
      .select(`
        id,
        negocio_id,
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
      .order(
        "nombre",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error servicios:",
      error
    );

    listaServicios.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar los servicios.
      </div>
    `;

    mostrarError(
      "No fue posible cargar los servicios."
    );

    return;
  }

  servicios = data || [];
  renderServicios();
}

function renderServicios() {
  if (!servicios.length) {
    listaServicios.innerHTML = `
      <div class="sin-resultados">
        Todavía no hay servicios.
      </div>
    `;
    return;
  }

  listaServicios.innerHTML = "";

  for (
    const servicio
    of servicios
  ) {
    const card =
      document.createElement(
        "div"
      );

    card.className =
      `servicio-card-ar ${
        servicio.activo
          ? ""
          : "servicio-inactivo"
      }`;

    const precio =
      servicio.precio === null ||
      servicio.precio === undefined
        ? "Sin precio"
        : formatoDinero(
            servicio.precio
          );

    const duracion =
      Number(
        servicio.duracion_minutos
      ) || 0;

    card.innerHTML = `
      <div class="servicio-top">
        <div>
          <div class="servicio-nombre-ar">
            ${escapar(
              servicio.nombre
            )}
          </div>

          <div class="servicio-descripcion-ar">
            ${escapar(
              servicio.descripcion ||
              "Sin descripción"
            )}
          </div>
        </div>
      </div>

      <div class="servicio-meta-ar">
        <span class="servicio-chip">
          ⏱️ ${duracion} min
        </span>

        <span class="servicio-chip">
          💲 ${precio}
        </span>

        <span class="servicio-chip ${
          servicio.activo
            ? ""
            : "inactivo"
        }">
          ${
            servicio.activo
              ? "Activo"
              : "Inactivo"
          }
        </span>
      </div>

      <div class="servicio-acciones-ar">
        <button
          type="button"
          class="btn-editar-servicio"
          onclick="editarServicio(
            '${servicio.id}'
          )"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btn-estado-servicio"
          onclick="cambiarEstadoServicio(
            '${servicio.id}',
            ${!servicio.activo}
          )"
        >
          ${
            servicio.activo
              ? "Desactivar"
              : "Activar"
          }
        </button>
      </div>
    `;

    listaServicios.appendChild(
      card
    );
  }
}

async function guardarServicio() {
  ocultarMensaje();

  const nombre =
    servicioNombre.value.trim();

  const descripcion =
    servicioDescripcion.value.trim();

  const duracion =
    Number(
      servicioDuracion.value
    );

  const precioTexto =
    servicioPrecio.value.trim();

  const precio =
    precioTexto === ""
      ? null
      : Number(precioTexto);

  if (!nombre) {
    mostrarError(
      "Escribe el nombre del servicio."
    );
    return;
  }

  if (
    !Number.isFinite(duracion) ||
    duracion <= 0
  ) {
    mostrarError(
      "La duración debe ser mayor a 0 minutos."
    );
    return;
  }

  if (
    precio !== null &&
    (
      !Number.isFinite(precio) ||
      precio < 0
    )
  ) {
    mostrarError(
      "Escribe un precio válido."
    );
    return;
  }

  btnGuardarServicio.disabled =
    true;

  btnGuardarServicio.textContent =
    "Guardando...";

  try {
    const id =
      servicioEditandoId.value;

    if (id) {
      const { error } =
        await db
          .from("servicios")
          .update({
            nombre,
            descripcion:
              descripcion || null,
            duracion_minutos:
              duracion,
            precio
          })
          .eq("id", id)
          .eq(
            "negocio_id",
            negocioActualId
          );

      if (error) throw error;

      mostrarExito(
        "Servicio actualizado."
      );

    } else {
      const { error } =
        await db
          .from("servicios")
          .insert({
            negocio_id:
              negocioActualId,
            nombre,
            descripcion:
              descripcion || null,
            duracion_minutos:
              duracion,
            precio,
            activo:
              true
          });

      if (error) throw error;

      mostrarExito(
        "Servicio agregado."
      );
    }

    limpiarFormulario();
    await cargarServicios();

  } catch (error) {
    console.error(
      "Error guardando servicio:",
      error
    );

    mostrarError(
      error?.message ||
      "No fue posible guardar el servicio."
    );

  } finally {
    btnGuardarServicio.disabled =
      false;

    btnGuardarServicio.textContent =
      "Guardar servicio";
  }
}

function editarServicio(
  id
) {
  const servicio =
    servicios.find(
      s => s.id === id
    );

  if (!servicio) return;

  servicioEditandoId.value =
    servicio.id;

  servicioNombre.value =
    servicio.nombre || "";

  servicioDescripcion.value =
    servicio.descripcion || "";

  servicioDuracion.value =
    servicio.duracion_minutos || 60;

  servicioPrecio.value =
    servicio.precio ?? "";

  tituloFormularioServicio.textContent =
    "Editar servicio";

  btnCancelarEdicionServicio.classList.remove(
    "oculto"
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function limpiarFormulario() {
  servicioEditandoId.value = "";
  servicioNombre.value = "";
  servicioDescripcion.value = "";
  servicioDuracion.value = "60";
  servicioPrecio.value = "";

  tituloFormularioServicio.textContent =
    "Agregar servicio";

  btnCancelarEdicionServicio.classList.add(
    "oculto"
  );
}

async function cambiarEstadoServicio(
  id,
  nuevoActivo
) {
  ocultarMensaje();

  const texto =
    nuevoActivo
      ? "¿Activar este servicio?"
      : "¿Desactivar este servicio? No se borrarán las citas anteriores.";

  if (!window.confirm(texto)) {
    return;
  }

  const { error } =
    await db
      .from("servicios")
      .update({
        activo:
          nuevoActivo
      })
      .eq("id", id)
      .eq(
        "negocio_id",
        negocioActualId
      );

  if (error) {
    console.error(error);

    mostrarError(
      "No fue posible cambiar el estado del servicio."
    );

    return;
  }

  mostrarExito(
    nuevoActivo
      ? "Servicio activado."
      : "Servicio desactivado."
  );

  await cargarServicios();
}

function formatoDinero(
  valor
) {
  const numero =
    Number(valor);

  if (!Number.isFinite(numero)) {
    return "0.00";
  }

  return numero.toLocaleString(
    "es-MX",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}

function escapar(
  texto = ""
) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

window.editarServicio =
  editarServicio;

window.cambiarEstadoServicio =
  cambiarEstadoServicio;

iniciar();
